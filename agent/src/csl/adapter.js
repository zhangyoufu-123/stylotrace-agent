// CSLA Application Adapter（Phase 3：统一所有 Agent 入口）
// CLI + MCP + Skill + Web/API → runTask → Canonical State → CSLA Runtime → Action → Application Executor。
// 边界：adapter 只负责 channel/presentation/serialization；cognition（决策/记忆/信用/目标）只在 CSLA。
import * as st from './state.js';
import * as rt from './runtime.js';
import * as br from './brief.js';
import { readCanonical, syncCoreIdea, canWrite } from './canonical.js';

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
