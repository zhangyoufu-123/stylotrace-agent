// CSLA v1.6 — Executable Cognitive Runtime（24 步调度器）
// 这是"统一状态机"本体：不再平行开发旧架构，所有写作/认知流程都经此状态机。
// LLM 只是算子（可注入 mock/真实 llm.js）；长期状态/目标/记忆/信用由本运行时维护。
//
// Failure cases（先定义，测试覆盖）：
//   F1 低显著性输入 → 走 Fast 路径，只返回快答，不改变深层状态；
//   F2 模糊想法 → 必须先进 InnovationElicitor 问高价值问题，禁止直接成稿；
//   F3 无 outcome 时 credit 不可用（复用 ledger F1）；
//   F4 状态版本必须单调（复用 state F3）；
//   F5 同输入同输出（mock LLM 确定性）。
import * as st from './state.js';
import * as ev from './events.js';
import { pickQuestion, pickQuestionSmart, captureCoreIdea } from './elicit.js';
import { buildContextBundle, selectOperators } from './operators.js';
import * as creditEngine from './credit.js';
import { policyFor } from './replay.js';
import { runCognitiveLoop, dispatch } from './actions.js';
import { readCanonical, syncCoreIdea } from './canonical.js';
import * as hrmr from './hrmr.js';
import { syncBrief } from './brief.js';
import { classifyFailure, failureContext } from './failure.js';
import path from 'node:path';
import fs from 'node:fs';

export const DEEP_TAU = 0.5;
const INTERACTION_FILE = 'vault/csl-interaction.json';

/** 浅层交互状态 I_t（L1）：与深层状态分离，持久化去重与节奏。 */
export function newInteractionState() {
  return { topic: '', currentQuestion: '', missingInfo: [], lastAnswers: [], confirmed: {}, askedTypes: {}, askedTexts: [], updatedAt: null };
}

export function readInteraction(workspace) {
  try {
    return { ...newInteractionState(), ...JSON.parse(fs.readFileSync(path.join(workspace, INTERACTION_FILE), 'utf8')) };
  } catch {
    return newInteractionState();
  }
}

export function saveInteraction(workspace, i) {
  const next = { ...i, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.join(workspace, 'vault'), { recursive: true });
  fs.writeFileSync(path.join(workspace, INTERACTION_FILE), JSON.stringify(next, null, 2) + '\n');
  return next;
}

/**
 * 下一最佳问题（浅层核心算法）：IG − λ·Cost − μ·Intrusion − ρ·Repetition。
 * 同一类型问题被问过越多，分数越低（防重复盘问）。
 */
export function chooseQuestion(state, interaction = newInteractionState(), { lambda = 0.2, mu = 0.25, rho = 0.3 } = {}) {
  const q = pickQuestion(state);
  if (!q) return null;
  const asked = interaction.askedTypes?.[q.type] || 0;
  const score = q.ig - lambda * q.cost - mu * q.intrusion - rho * asked;
  interaction.askedTypes = interaction.askedTypes || {};
  interaction.askedTypes[q.type] = asked + 1;
  return { ...q, score: Number(score.toFixed(4)) };
}

/**
 * 贴题提问（红队 R1–R3）：优先用 LLM 按当前话题/缺口生成问题，
 * 固定库只做兜底；并把问过的**原句**记下来，避免换汤不换药地重复问。
 */
export async function chooseQuestionSmart(state, interaction = newInteractionState(), { llm = null, topic = '' } = {}) {
  interaction.askedTexts = interaction.askedTexts || [];
  const q = await pickQuestionSmart(state, { llm, topic, askedTexts: interaction.askedTexts });
  if (!q) return null;
  if (q.question) interaction.askedTexts = [...interaction.askedTexts, q.question].slice(-20);
  interaction.askedTypes = interaction.askedTypes || {};
  interaction.askedTypes[q.type] = (interaction.askedTypes[q.type] || 0) + 1;
  interaction.currentQuestion = q.question || '';
  return q;
}

/**
 * ChooseHowToThink（L3）：按状态缺口从认知算子库动态选动作，替代固定 24 步入口。
 */
export function chooseCognitiveAction(jt = {}) {
  const core = String(jt.coreIdea || '').trim();
  if (!core) return { action: 'askHuman', reason: '无核心想法' };
  const h = jt.hypotheses || [];
  const e = jt.evidence || [];
  if (!h.length) return { action: 'abstract', reason: '有核心无假设' };
  if (!e.length) return { action: 'search', reason: '有假设无证据' };
  if ((jt.uncertainty || 0) >= 0.7) return { action: 'counterexample', reason: '高不确定找反例' };
  return { action: 'generate', reason: '可成稿' };
}

/**
 * 深层 → 人类检查点：两个假设证据都不足且接近 → 发回浅层问人（Deep↔Human Checkpoint）。
 */
export function maybeCheckpoint(jt = {}) {
  const h = jt.hypotheses || [];
  const e = jt.evidence || [];
  if (h.length >= 2 && !e.length) {
    return {
      needHumanInput: true,
      question: `我目前有两个方向（${h[0]?.claim || h[0]} / ${h[1]?.claim || h[1]}），证据都不足。你更接近哪一个？`,
      why: '决定 hypothesis selection',
      expectedInformationGain: 0.8,
    };
  }
  return null;
}

/**
 * 连续 Authority（红队修复 #3）：alpha = σ(w·[competence, alignment, confidence, −risk, novelty, −humanNeed])。
 * 替代原来的两档硬编码；低风险高置信 → 高 alpha，高风险低置信 → 低 alpha，单调连续。
 */
export function computeAuthority({
  competence = 0.5,
  alignment = 0.8,
  confidence = 0.5,
  risk = 0.1,
  novelty = 0,
  humanNeed = 0.4,
} = {}) {
  const z =
    2.2 * competence +
    1.4 * alignment +
    1.2 * confidence -
    2.6 * risk +
    0.6 * novelty -
    0.5 * humanNeed;
  return Number((1 / (1 + Math.exp(-z))).toFixed(3));
}

/** 快速显著性（确定性启发式）：信号越"像要深思"越高。 */
export function fastSalience(input = '', state = {}) {
  const t = String(input || '');
  let novelty = 0;
  let decisionImpact = 0;
  let uncertainty = 0.3;
  if (t.length > 24) novelty += 0.25;
  if (/\?|？|是不是|感觉|我觉得|想写|要写|帮我|改|观点|矛盾|不确定/.test(t)) {
    decisionImpact += 0.3;
    uncertainty += 0.15;
  }
  // 复杂/规划类任务：决策影响翻倍（红队攻击 #16 校准修复）
  if (/(为什么|怎么|规划|方案|权衡|多步骤|调研|项目|分析|论证|跨部门|决策)/.test(t)) {
    decisionImpact += 0.3;
    uncertainty += 0.15;
  }
  if (/(写作|论文|散文|报告|小说|演讲稿)/.test(t)) decisionImpact += 0.3;
  if (/(重要|正式|提交|比赛|发表|公开|关键|决策)/.test(t)) decisionImpact += 0.25;
  const salience = Math.min(1, 0.2 + novelty + decisionImpact);
  const risk = /(删除|覆盖|发布|公开|支付|购买|删除文件|资金|大额|合规|法律|医疗|金融|风险|投资|合同|授权|手术|用药)/.test(t) ? 0.6 : 0.1;
  const urgency = t.length > 40 ? 0.6 : 0.3;
  let p_deep = Math.min(1, 0.3 * salience + 0.25 * uncertainty + 0.3 * decisionImpact + 0.15 * risk - 0.05 * (t.length > 60 ? 0 : 0.1));
  // 高风险安全提升级（红队攻击 #14）：资金/法律/医疗/授权类任务强制进入深通道
  if (risk >= 0.6) p_deep = Math.max(p_deep, 0.65);
  const reasons = [];
  if (novelty > 0) reasons.push(`novelty=${novelty}`);
  if (decisionImpact >= 0.3) reasons.push(`decisionImpact=${decisionImpact}`);
  if (uncertainty >= 0.45) reasons.push(`uncertainty=${uncertainty}`);
  if (risk >= 0.6) reasons.push(`risk=${risk}`);
  return { salience, urgency, risk, novelty, decisionImpact, p_deep: Number(p_deep.toFixed(3)), reasons };
}

/** 合并语言层与动作循环的 token/延迟统计（可观测性：真实调用 usage 可读）。 */
function mergeUsage(loopUsage, langUsage) {
  const base = {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    calls: 0,
    latencyMs: 0,
  };
  const lang = langUsage
    ? {
        input_tokens: langUsage.usage?.input_tokens || 0,
        output_tokens: langUsage.usage?.output_tokens || 0,
        total_tokens: langUsage.usage?.total_tokens || 0,
        calls: 1,
        latencyMs: langUsage.latencyMs || 0,
      }
    : base;
  const loop = loopUsage || { calls: 0 };
  return {
    input_tokens: (loop.input_tokens || 0) + lang.input_tokens,
    output_tokens: (loop.output_tokens || 0) + lang.output_tokens,
    total_tokens: (loop.total_tokens || 0) + lang.total_tokens,
    calls: (loop.calls || 0) + lang.calls,
    latencyMs: (loop.latencyMs || 0) + lang.latencyMs,
  };
}

/** 语言层：低延迟回复（mock 或注入 LLM）。 */
export async function languageLoop(input, llm, { brief = false } = {}) {
  if (llm) {
    // 深意图输入要求简短回应：防止 LLM 在"先问后写"阶段直接产出完整文章（真实 token 接入实测发现）
    const content = brief
      ? `请先简短回应（一两句即可），不要展开成完整文章；后续系统会引导你深入。\n用户输入：${input}`
      : input;
    return String(await llm([{ role: 'user', content }]) || '').trim();
  }
  return `（快答）我先记下了："${String(input).slice(0, 40)}"。需要深入的话我会追问。`;
}

/**
 * 认知决策（P0-2 主门）：确定性控制器——根据共享状态决定"这次应该 Ask/Abstract/Search/
 * Counterexample/Generate/Stop"。零 LLM 调用；director 只把选择转成应用动作。
 */
export function cognitiveDecision(workspace, { input = '', state = null } = {}) {
  const cs = state || st.readState(workspace);
  const canonical = readCanonical(workspace);
  const core = String(canonical.coreIdea || '').trim();
  const sig = fastSalience(input, cs);
  if (!core) return { action: 'askHuman', reason: '无核心想法（Core Idea 缺失）', coreIdeaConfirmed: false, p_deep: sig.p_deep };
  const h = cs.hypotheses || [];
  const e = cs.evidence || [];
  if (!h.length) return { action: 'abstract', reason: '有核心无假设', coreIdeaConfirmed: true, p_deep: sig.p_deep };
  if (!e.length) return { action: 'search', reason: '有假设无证据', coreIdeaConfirmed: true, p_deep: sig.p_deep };
  if ((cs.uncertainty || 0) >= 0.7) return { action: 'counterexample', reason: '高不确定找反例', coreIdeaConfirmed: true, p_deep: sig.p_deep };
  return { action: 'generate', reason: '可成稿', coreIdeaConfirmed: true, p_deep: sig.p_deep };
}

/**
 * 真实反馈入口（P0-4）：用户回答/确认/纠正/编辑 → outcome 从预测变为真实值，
 * credit 用反事实（非均分），并记录 baseline/intervention/result/confidence。
 */
export function recordFeedback(workspace, { value, sessionId = 'default', source = '' } = {}) {
  // 会话一致性（人机交互模拟发现）：反馈必须读"该会话"的状态，否则假设为空 → 归因全 0
  const cs = st.readState(workspace, sessionId);
  const outcome = Number(value);
  if (Number.isNaN(outcome)) throw new Error('recordFeedback requires numeric value');
  const h = cs.hypotheses || [];
  const alpha = computeAuthority({ competence: 0.6, alignment: 0.8, confidence: h.length ? 0.6 : 0.3, risk: 0.1 });
  const prediction = Number(alpha.toFixed(3));
  // Phase 2：Prediction → Real Outcome（人类反馈）→ Evaluator → 显式反事实 → Credit → Policy Evidence
  const pred = creditEngine.createPrediction({
    expected: prediction,
    confidence: 0.55, // 直接人类信号比 runtime 自评可靠
    action: 'human-feedback',
    goal: cs.goal || '',
    sessionId,
    traceId: '',
  });
  const outcomeRec = creditEngine.recordOutcome(workspace, {
    traceId: '',
    sessionId,
    stateVersion: cs.sVersion + 1,
    goal: { inferred: cs.goal || '' },
    action: { action: 'human-feedback' },
    prediction: pred,
    actual: { value: outcome, source },
    feedback: { value: outcome, source },
    cost: {},
    risk: {},
    humanReaction: { source },
    worldReaction: {},
  });
  const evaluation = creditEngine.evaluateOutcome({ prediction: pred, actual: outcomeRec.actual });
  const cf = creditEngine.runCounterfactual({
    evaluate: creditEngine.stateEvaluator(cs, outcome),
    targets: ['operators', 'router', 'elicitor'],
    baselineType: 'deterministic_baseline',
    baselineConfig: { source: 'canonical-state' },
  });
  const creditResult = creditEngine.computeCredit({
    counterfactual: cf,
    confidence: 0.55,
    sessionId,
    traceId: '',
    stateVersion: cs.sVersion + 1,
  });
  // Failure Taxonomy：真实反馈分类 → 失败类型进入政策上下文（FailureType → Credit → Policy）
  const fail = classifyFailure({
    text: outcomeRec.actual?.edit || '',
    coreIdea: cs.coreIdea || '',
    outcomeValue: outcome,
    source,
  });
  const applied = creditEngine.applyCredit(workspace, {
    credits: creditResult.credits,
    // 策略上下文用规范目标（cs.goal 常为空；canonical/brief 才是产品事实源）
    context: {
      taskType: 'human',
      goal: cs.goal || readCanonical(workspace, { sessionId }).goal || '',
      risk: 0.1,
      uncertainty: cs.uncertainty ?? 0.5,
      ...failureContext(fail.failureType),
    },
    eta: 0.3,
    sessionId,
    traceId: '',
  });
  st.appendCanonicalEvent(workspace, {
    type: 'OutcomeError',
    sessionId,
    traceId: '',
    actor: 'human-feedback',
    payload: {
      predictionRef: pred.predictionId,
      outcomeRef: outcomeRec.outcomeId,
      dimensions: evaluation.dimensions,
      severity: evaluation.severity,
      confidence: evaluation.confidence,
    },
    versionBefore: cs.sVersion,
    versionAfter: cs.sVersion + 1,
  });
  return { prediction, error: { magnitude: evaluation.overallError }, credit: creditResult, applied: applied.applied };
}

/**
 * Golden Cognitive Test 管线（Phase 3A）：
 * Observation → Relation(bind) → Memory(encode+retrieve) → Compare → Abstract → Counterexample → Schema。
 * 驱动同一个 ActionDispatcher（dispatch），状态增量逐级合并，最终提交 canonical state + HRME。
 * 验收：结构化认知变化（entities/relations/hypotheses/counterexamples/schema/confidence），而非一句解释。
 */
export async function goldenCognition(workspace, { input = '', llm = null, sessionId = 'golden' } = {}) {
  const s0 = st.readState(workspace);
  const jt = { coreIdea: input, observation: input, goal: input, hypotheses: [], evidence: [], memoryRefs: [] };
  const trace = [];
  const ctx = { workspace, llm, mode: 'creative' };
  const run = async (action) => {
    const r = await dispatch(action, jt, ctx);
    Object.assign(jt, r.stateDelta);
    // Module → State 证据：每步后假设/记忆变化可观测（Reasoning → ChangedHypothesis）
    trace.push({
      action,
      events: r.events.map((e) => e.event_type),
      hypothesesAfter: (jt.hypotheses || []).length,
      memoryRefsAfter: (jt.memoryRefs || []).length,
    });
    return r;
  };
  await run('memory');
  await run('compare');
  await run('abstract');
  await run('counterexample');
  // Schema 精化后落库查询（含置信/支持/例外/层级）
  const subject = jt.relations?.[0]?.subject || '';
  const schema = subject
    ? hrmr.retrieve(workspace, subject, { max: 5 }).find((i) => i.kind === 'schema') || null
    : null;
  const result = {
    entities: jt.relations?.slice(1).map((r) => ({ name: r.subject || r.object, type: r.type })) || [],
    relations: jt.relations?.slice(0, 1) || [],
    hypotheses: jt.hypotheses || [],
    comparison: jt.comparison || null,
    counterexamples: jt.counterexamples || [],
    schema: schema
      ? { relationText: schema.relationText, level: schema.level, confidence: schema.confidence, support: schema.support, exceptions: schema.exceptions, transfer: schema.transfer }
      : null,
    confidence: schema?.confidence ?? 0,
    trace,
    stateVersionBefore: s0.sVersion,
  };
  // Module → State：结构化认知结果提交 canonical（版本单调 + 统一事件）
  const delta = {
    coreIdea: input,
    workingMemory: {
      relations: jt.relations || [],
      retrievedMemories: jt.retrievedMemories || [],
      comparison: jt.comparison || null,
      schema: result.schema,
      counterexamples: jt.counterexamples || [],
    },
  };
  if (jt.hypotheses?.[0]?.claim) delta.addHypothesis = String(jt.hypotheses[0].claim).slice(0, 60);
  const committed = st.commit(workspace, {
    delta,
    event: { eventType: 'cognition.golden', payload: { trace, input } },
    sessionId,
    actor: 'golden-pipeline',
  });
  syncBrief(workspace, { sessionId }); // HRME/Reasoning → Brief（authorSchemas/claims/counterarguments）
  return { ...result, stateVersionAfter: committed.version };
}

/**
 * 跑一轮（24 步）。返回结构化结果；deep 路径完整走链。
 * llm: 可选异步函数 messages→string（测试传 mock，生产传 llm.js 包装）。
 */
export async function runTurn(workspace, { input, state = null, llm = null, sessionId = 'default', forceDeep = false, feedback = null }) {
  // 会话感知（Phase 1 内核支持按 session 隔离；runtime 此前忽略了 sessionId，仅用于事件）
  const s0 = state || st.readState(workspace, sessionId);
  const sig = fastSalience(input, s0);
  const taskSignal = sig.decisionImpact > 0 || sig.risk >= 0.6;

  // 步 2-3：语言层 + DeepGate（F1：低显著性 → 快答，不动深层状态）
  let reply;
  try {
    reply = await languageLoop(input, llm, { brief: sig.p_deep >= DEEP_TAU });
  } catch (err) {
    ev.appendEvent(workspace, {
      event_type: 'cognitive.error',
      state_version: `s_${s0.sVersion}`,
      session_id: sessionId,
      step: 0,
      action: { stage: 'language' },
      error: { message: String(err.message || err).slice(0, 200) },
    });
    return { kind: 'error', error: String(err.message || err), state: s0, salience: sig, events: [] };
  }
  const langUsage = llm && llm.last ? llm.last : null;

  // F2（Fast 层也负责澄清）：有任务信号且无 coreIdea → 先问高价值问题，不跑深层（Fast→AskHuman）。
  // 纯闲聊（decisionImpact=0、risk=0）不追问，直接快答（F1）。
  if (!s0.coreIdea && taskSignal) {
    const interaction = readInteraction(workspace);
    // 贴题提问：有 LLM 就按当前话题生成问题；没有/失败则回退固定库（F1 不卡死）
    const topic = s0.coreIdea || readCanonical(workspace, { sessionId }).goal || input;
    const q = await chooseQuestionSmart(s0, interaction, { llm, topic });
    saveInteraction(workspace, interaction);
    if (q) {
      const evt = {
        event_type: 'cognitive.elicit',
        state_version: `s_${s0.sVersion + 1}`,
        session_id: sessionId,
        step: s0.sVersion + 1,
        action: { type: q.type, question: q.question },
        observation: { input },
      };
      ev.appendEvent(workspace, evt);
      return {
        kind: 'ask',
        question: q.question,
        type: q.type,
        reply,
        salience: sig,
        state: s0,
        events: [evt],
        usage: mergeUsage(null, langUsage),
      };
    }
  }

  if (!forceDeep && sig.p_deep < DEEP_TAU) {
    return { kind: 'fast', reply, salience: sig, state: s0, events: [], usage: mergeUsage(null, langUsage) };
  }

  // 步 4-6：Desire → Goal → Task（确定性适配：目标从输入推断，保持 hypothesis 直到确认）
  const desire = {
    preference: String(input).slice(0, 40),
    priority: sig.decisionImpact > 0.4 ? 'high' : 'medium',
    urgency: sig.urgency,
  };
  const inferredGoal = desire.preference;
  const goal = { inferred: inferredGoal, confirmed: s0.goal || '' };

  // 步 7-9：MetaPolicy + Workspace + MemoryRetrieve
  const mode = /(论文|学术|研究)/.test(input) ? 'research' : /(小说|故事)/.test(input) ? 'creative' : 'creative';
  const task = { goal: inferredGoal, domain: mode, constraints: s0.decisions || [] };
  const memory = ev.replayEvents(workspace, sessionId);
  // Phase 2：政策证据（credit 学习）→ 真实动作选择调整（Q_new = Q_old + policyWeights[a]）
  const polCtx = { taskType: mode, goal: inferredGoal, risk: sig.risk, uncertainty: s0.uncertainty ?? 0.5 };
  const policyWeights = creditEngine.policyWeights(workspace, { context: polCtx });
  // Phase 3A：观察（输入）→ 关系绑定（确定性）→ 若带关系，memory 动作优先进入动作空间
  const relations = hrmr.bind(input);

  // 步 10-16：Action-driven 深层循环（A3 重规划）——St → 选动作 → 执行 → 重选 → …
  // 错误恢复：LLM 失败 → failure event + 安全状态（不提交部分结果）
  let loop;
  try {
    loop = await runCognitiveLoop(
      { ...s0, coreIdea: s0.coreIdea || inferredGoal, observation: input, relations },
      { llm, mode, policyWeights, workspace },
      { maxSteps: 6 },
    );
  } catch (err) {
    ev.appendEvent(workspace, {
      event_type: 'cognitive.error',
      state_version: `s_${s0.sVersion + 1}`,
      session_id: sessionId,
      step: s0.sVersion + 1,
      action: { stage: 'deep-loop' },
      error: { message: String(err.message || err).slice(0, 200) },
    });
    return { kind: 'error', error: String(err.message || err), state: s0, salience: sig, goal, task, events: [] };
  }
  if (loop.needsHuman) {
    return {
      kind: 'checkpoint',
      question: loop.step?.result?.question || '',
      reply,
      hypotheses: loop.current.hypotheses || [],
      state: s0,
      usage: mergeUsage(loop.usage, langUsage),
    };
  }
  const current = loop.current;
  const candidates = current.candidates || [];
  const hypotheses = current.hypotheses || [];
  const counterexamples = current.counterexamples || [];
  const plan = { mode, strategy: hypotheses.length ? `已走 ${loop.trace.map((t) => t.action).join('→')}` : 'ask' };
  const cognitiveAction = loop.trace[0]?.action || 'stop';
  const checkpoint = maybeCheckpoint({ hypotheses, evidence: counterexamples });

  // 步 15-16：Authority（连续）+ JointAction
  const confidence = hypotheses.length ? 0.6 : 0.3; // 有假设才有底气
  const alpha = computeAuthority({
    competence: 0.6,
    alignment: 0.8,
    confidence,
    risk: sig.risk,
    novelty: sig.novelty,
  });
  const jointAction = { alpha, action: alpha >= 0.5 ? 'draft' : 'requestApproval', candidates: candidates.length };

  // 步 17-19：Outcome → Error → Credit（P0-4/5）
  // Phase 2：Prediction（来自状态）→ Real Outcome（仅真实 feedback）→ Evaluator →
  // 显式反事实 → Credit → Policy Evidence；无反馈记 outcome.pending，不伪造成功值。
  const prediction = Number(alpha.toFixed(3));
  let error = null;
  let credit = null;
  let outcomePending = true;
  if (feedback !== null && feedback !== undefined) {
    const outcomeVal = Number(feedback);
    if (!Number.isNaN(outcomeVal)) {
      const pred = creditEngine.createPrediction({
        expected: prediction,
        confidence: 0.5,
        action: cognitiveAction,
        goal: inferredGoal,
        sessionId,
        traceId: '',
      });
      const outcomeRec = creditEngine.recordOutcome(workspace, {
        traceId: '',
        sessionId,
        stateVersion: s0.sVersion + 1,
        goal: { inferred: inferredGoal },
        action: { action: cognitiveAction, trace: loop.trace },
        prediction: pred,
        actual: { value: outcomeVal, source: 'runtime.feedback' },
        feedback: { value: outcomeVal },
        cost: {},
        risk: { value: sig.risk },
        humanReaction: { source: 'feedback' },
        worldReaction: {},
      });
      const evaluation = creditEngine.evaluateOutcome({ prediction: pred, actual: outcomeRec.actual });
      const creditResult = creditEngine.traceCredits(loop.trace, outcomeVal, {
        confidence: 0.35, // runtime 自评低置信：落账但不强更新政策（Test 9）
        sessionId,
        traceId: '',
        stateVersion: s0.sVersion + 1,
      });
      creditEngine.applyCredit(workspace, {
        credits: creditResult.credits,
        context: polCtx,
        eta: 0.3,
        sessionId,
        traceId: '',
      });
      st.appendCanonicalEvent(workspace, {
        type: 'OutcomeError',
        sessionId,
        traceId: '',
        actor: 'runtime',
        payload: {
          predictionRef: pred.predictionId,
          outcomeRef: outcomeRec.outcomeId,
          dimensions: evaluation.dimensions,
          severity: evaluation.severity,
          confidence: evaluation.confidence,
        },
        versionBefore: s0.sVersion,
        versionAfter: s0.sVersion + 1,
      });
      error = { magnitude: evaluation.overallError };
      credit = creditResult;
      outcomePending = false;
    }
  }
  if (outcomePending) {
    ev.appendEvent(workspace, {
      event_type: 'outcome.pending',
      state_version: `s_${s0.sVersion + 1}`,
      session_id: sessionId,
      step: s0.sVersion + 1,
      prediction: { value: prediction },
    });
  }

  // 步 20-24：SelectiveUpdate → SharedState → StateTransition（版本单调，F4）
  // 中间可能有 applyCredit 等提交 → 最终提交前重读当前状态，避免版本碰撞（真实运行发现）
  const base = st.readState(workspace, sessionId);
  const { nextState, ledgerEvent } = st.transition(
    base,
    { event_type: 'cognitive.run', outcome: { ok: true } },
    {
      coreIdea: base.coreIdea || inferredGoal,
      addHypothesis: hypotheses[0]?.claim || '',
      addDecision: loop.trace.map((t) => t.action).join('→') || plan.strategy,
    },
  );
  st.persistState(workspace, nextState, ledgerEvent, sessionId);
  ev.appendEvent(workspace, { ...ledgerEvent, event_type: 'cognitive.run', session_id: sessionId });

  return {
    kind: 'deep',
    reply,
    cognitiveAction,
    checkpoint,
    salience: sig,
    goal,
    task,
    memory,
    candidates,
    hypotheses,
    counterexamples,
    plan,
    actionTrace: loop.trace,
    alpha,
    jointAction,
    error,
    credit,
    prediction,
    outcomePending,
    usage: mergeUsage(loop.usage, langUsage),
    state: nextState,
    events: [ledgerEvent],
  };
}

/** 捕获用户回答为 Core Idea（复用 elicit；F2 的第二步）。state 缺省从盘读。 */
export function acceptAnswer(workspace, state, answer, sessionId = 'default') {
  const base = state || st.readState(workspace, sessionId);
  const patch = captureCoreIdea(base, answer);
  const { nextState, ledgerEvent } = st.transition(
    base,
    { event_type: 'core_idea.confirmed' },
    { coreIdea: patch.coreIdea },
  );
  st.persistState(workspace, nextState, ledgerEvent, sessionId);
  return nextState;
}

/**
 * 认知门（红队修复 #1：让认知状态驱动行为，而不是孤立岛）。
 * director 在每轮调用：仅当 csl 策略（从历史失败学习）要求 ask 且当前是写作阶段时 → 强制走澄清。
 * 注意：不因"csl 状态无 coreIdea"就拦截——产品的核心想法在主 state.json，csl 状态独立维护。
 */
export function cognitiveGate(workspace, state, { mode = 'creative', stage = '' } = {}) {
  const pol = policyFor(workspace, mode);
  if (pol === 'ask' && stage === 'write') return 'ask';
  return 'proceed';
}
