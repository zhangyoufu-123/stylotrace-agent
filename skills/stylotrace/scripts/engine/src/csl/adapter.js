// CSLA Application Adapter（Phase 3：统一所有 Agent 入口）
// CLI + MCP + Skill + Web/API → runTask → Canonical State → CSLA Runtime → Action → Application Executor。
// 边界：adapter 只负责 channel/presentation/serialization；cognition（决策/记忆/信用/目标）只在 CSLA。
import * as st from './state.js';
import * as rt from './runtime.js';
import * as br from './brief.js';
import { readCanonical, syncCoreIdea, canWrite } from './canonical.js';
import { dispatchApp, renderDispatch } from './dispatch.js';
import * as lineage from './lineage.js';

/** 认知动作 → 应用执行器映射（应用层只做转换，不重新认知）。 */
export const ACTION_APP_MAP = {
  askHuman: { app: 'ask', executor: 'clarify' },
  checkpoint: { app: 'ask', executor: 'checkpoint' },
  abstract: { app: 'research', executor: 'outline' },
  search: { app: 'research', executor: 'rag' },
  compare: { app: 'review', executor: 'redteam' },
  counterexample: { app: 'review', executor: 'redteam' },
  generate: { app: 'write', executor: 'write' },
  stop: { app: 'deliver', executor: 'deliver' },
  fast: { app: 'chat', executor: 'chat' },
};

export function mapAction(action) {
  return ACTION_APP_MAP[action] || { app: 'chat', executor: 'chat' };
}

/** 规范状态快照（跨通道同会话看到同一份状态）。 */
export function canonicalSnapshot(workspace, sessionId = 'default') {
  const c = st.readCanonicalState(workspace, { sessionId });
  return {
    stateVersion: c.stateVersion,
    coreIdea: c.coreIdea,
    goal: c.goal?.inferred || c.goal?.confirmed || '',
    hypotheses: (c.hypotheses || []).length,
    evidence: (c.evidence || []).length,
    memoryRefs: (c.memoryRefs || []).length,
    brief: br.readBrief(workspace),
  };
}

/**
 * 统一任务入口：所有通道（cli|mcp|skill|web|api）走这里。
 * mode: auto（Fast→Ask→Deep 门控）| fast（强制快）| deep（强制深）。
 */
export async function runTask({
  workspace,
  sessionId = 'default',
  input = '',
  channel = 'cli',
  application = 'stylotrace',
  mode = 'auto',
  llm = null,
  metadata = {},
} = {}) {
  // P1 版本谱系：任务开始就登记不可变 lineage，之后这条任务里的事件/产物都能回溯到它。
  // modelRef 优先用调用方给的（metadata.modelRef），否则按进程配置记录；拿不到就 unversioned。
  let modelRef = metadata.modelRef || '';
  if (!modelRef) {
    try {
      const { loadConfig } = await import('../config.js');
      modelRef = lineage.defaultModelRef(loadConfig());
    } catch {
      modelRef = '';
    }
  }
  const lin = lineage.startLineage(workspace, {
    modelRef,
    sessionId,
    channel,
  });
  // Fast → State（产品已确认信息入内核 + Brief 组装）
  syncCoreIdea(workspace);
  br.syncBrief(workspace, { sessionId });
  // CSLA Runtime（唯一认知源）
  const r = await rt.runTurn(workspace, { input, llm, sessionId, forceDeep: mode === 'deep' });
  if (r.kind === 'error') {
    return {
      channel, application, mode, sessionId, kind: 'error', error: r.error,
      stateVersion: st.stateVersion(workspace, { sessionId }),
      state: canonicalSnapshot(workspace, sessionId),
    };
  }
  let cognitiveAction;
  if (r.kind === 'ask') cognitiveAction = 'askHuman';
  else if (r.kind === 'checkpoint') cognitiveAction = 'checkpoint';
  else if (r.kind === 'deep') cognitiveAction = r.cognitiveAction || r.actionTrace?.[0]?.action || 'generate';
  else cognitiveAction = 'fast';
  const app = mapAction(cognitiveAction);
  const gate = canWrite(workspace, { sessionId });
  const blocked = app.app === 'write' && gate.blocked;
  // 派发：把 ACTION_APP_MAP 声明的 executor 真正执行掉（Route A）。
  // 一次调用只执行一个 executor，不在一次调用里跑完整链——否则绕过 Human Checkpoint，
  // 并且违反预算硬约束（§9）。失败不抛异常，以 executed/reason 返回。
  const executed = await dispatchApp(workspace, {
    app: app.app,
    executor: app.executor,
    sessionId,
    llm,
    maxSections: Number(metadata.maxSections) || 1,
  });
  return {
    channel,
    application,
    mode,
    sessionId,
    kind: r.kind,
    cognitiveAction,
    app,
    blocked,
    writerGate: gate,
    question: r.question || '',
    reply: r.reply || '',
    actionTrace: r.actionTrace || [],
    needsHuman: r.kind === 'ask' || r.kind === 'checkpoint' || blocked,
    lineageId: lin.lineageId,
    lineage: lin,
    executed,
    // 产物只来自 executor（Writer 写进 draft.md）；executor 没执行时这里是 null，
    // 绝不把认知循环里 `hypotheses.join('。')` 那种拼接串当文章返回。
    artifact: executed.executed ? executed.artifact || null : null,
    dispatchNote: renderDispatch(executed),
    stateVersion: st.stateVersion(workspace, { sessionId }),
    state: canonicalSnapshot(workspace, sessionId),
    usage: r.usage || null,
    metadata,
  };
}

/** 认知决定（零 LLM）：director / MCP decide 复用——同一决定规则，跨入口一致。 */
export function decideTask(workspace, { input = '', sessionId = 'default', channel = 'cli' } = {}) {
  syncCoreIdea(workspace);
  br.syncBrief(workspace, { sessionId });
  const d = rt.cognitiveDecision(workspace, { input });
  return {
    ...d,
    channel,
    app: mapAction(d.action),
    writerGate: canWrite(workspace, { sessionId }),
    stateVersion: st.stateVersion(workspace, { sessionId }),
  };
}

/** Deep → Human → Deep：回答追问/检查点后恢复同一会话深层。 */
export async function answerCheckpoint(workspace, { sessionId = 'default', answer = '', input = '', llm = null, mode = 'auto' } = {}) {
  rt.acceptAnswer(workspace, null, answer, sessionId);
  br.syncBrief(workspace, { sessionId });
  // Deep→Human→Deep：用原任务输入恢复深层（回答只进状态，不当作新任务）
  return runTask({ workspace, sessionId, input: input || answer, channel: 'checkpoint', mode, llm });
}

/** 执行单一认知动作（MCP csl_action；selected == executed）。 */
export async function runAction(workspace, { action = '', input = '', sessionId = 'default', llm = null } = {}) {
  const { dispatch } = await import('./actions.js');
  const cs = st.readState(workspace, sessionId);
  const jt = {
    coreIdea: cs.coreIdea || input,
    observation: input,
    goal: cs.goal || input,
    hypotheses: cs.hypotheses || [],
    evidence: cs.evidence || [],
    memoryRefs: cs.memoryRefs || [],
  };
  const r = await dispatch(action, jt, { workspace, llm, mode: 'creative' });
  const delta = { workingMemory: { lastAction: action, lastDelta: r.stateDelta } };
  if (r.stateDelta.hypotheses) delta.hypotheses = r.stateDelta.hypotheses;
  const committed = st.commit(workspace, {
    delta,
    event: { eventType: 'action.executed', payload: { action, channel: 'adapter' } },
    sessionId,
    actor: 'adapter',
  });
  return { action, executed: true, stateDelta: r.stateDelta, events: r.events, needsHuman: r.needsHuman, stateVersion: committed.version };
}
