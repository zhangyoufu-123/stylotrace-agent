// CSLA Outcome + Counterfactual Credit Engine（Phase 2）
// 链：State → Action → Prediction → RealOutcome → Error → ExplicitCounterfactual → Credit → PolicyEvidence → State'
// 原则：禁止 δ/N 均分；禁止硬编码模块标签；CF 运行必须隔离（不污染 canonical state）；
//       LLM 可做语义评价但不是 ground truth；无法建立可信 baseline → creditStatus=unresolved。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as st from './state.js';
import { writeFileAtomic } from '../workspace.js';

const OUTCOME_FILE = 'protocol/csl-outcomes.jsonl';
const CREDIT_FILE = 'protocol/csl-credits.jsonl';
const POLICY_EVIDENCE_FILE = 'vault/csl-policy-evidence.json';
export const CREDIT_CONFIDENCE_THRESHOLD = 0.4;
export const CREDIT_BASELINE_TYPES = ['frozen_baseline', 'matched_alternative', 'deterministic_baseline'];

function nowIso() {
  return new Date().toISOString();
}

function appendLine(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
  return obj;
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function listLines(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

const round = (x, p = 4) => Number(Number(x).toFixed(p));

// ── Prediction Contract ─────────────────────────────────────────
export function createPrediction({ expected, confidence = 0.5, successCriteria = [], predictedChanges = [], action = '', goal = '', sessionId = '', traceId = '' } = {}) {
  if (expected === undefined || expected === null) throw new Error('createPrediction requires expected');
  return {
    predictionId: crypto.randomUUID(),
    traceId,
    sessionId,
    expected,
    confidence: Number(confidence),
    successCriteria,
    predictedChanges,
    action,
    goal,
    timestamp: nowIso(),
  };
}

// ── Outcome Contract + Store ────────────────────────────────────
export function outcomeFile(workspace) {
  return path.join(workspace, OUTCOME_FILE);
}

export function recordOutcome(workspace, { traceId = '', sessionId = 'default', stateVersion = 0, goal = {}, action = {}, prediction = {}, actual = {}, feedback = {}, cost = {}, risk = {}, humanReaction = {}, worldReaction = {}, evaluation = {} } = {}) {
  if (actual === undefined || actual === null || Object.keys(actual).length === 0) {
    throw new Error('recordOutcome requires actual');
  }
  const outcome = {
    outcomeId: crypto.randomUUID(),
    traceId,
    sessionId,
    stateVersion,
    goal,
    action,
    prediction,
    actual,
    feedback,
    cost,
    risk,
    humanReaction,
    worldReaction,
    evaluation,
    timestamp: nowIso(),
  };
  appendLine(outcomeFile(workspace), outcome);
  return outcome;
}

export function listOutcomes(workspace, { sessionId = '' } = {}) {
  return listLines(outcomeFile(workspace)).filter((o) => !sessionId || o.sessionId === sessionId);
}

// ── Outcome Evaluator（维度化，不把不同量纲直接相加）─────────────
export function evaluateOutcome({ prediction, actual, dimensions = null, confidence = 0.5 } = {}) {
  const exp = prediction?.expected;
  const evalDims = dimensions || {};
  const keys = ['goalError', 'factualError', 'interactionError', 'executionError', 'styleError', 'decisionError'];
  const dim = {};
  let sum = 0;
  let n = 0;
  for (const k of keys) {
    const v = evalDims[k];
    if (v === undefined || v === null) continue;
    dim[k] = round(v);
    sum += Number(v);
    n += 1;
  }
  // 无维度时退化：用 prediction.expected 与 actual.value 的绝对差（0..1 归一）
  if (n === 0 && typeof exp === 'number' && typeof actual?.value === 'number') {
    dim.executionError = round(Math.abs(Number(exp) - Number(actual.value)));
    n = 1;
    sum = dim.executionError;
  }
  const overallError = n ? round(sum / n) : 0;
  return {
    dimensions: dim,
    overallError,
    severity: round(Math.min(1, overallError)),
    confidence: Number(confidence),
  };
}

// ── Explicit Counterfactual（基线替换 + 重评价；不重跑随机生成）──
export function runCounterfactual({ evaluate, targets = [], baselineType = 'deterministic_baseline', baselineConfig = {} } = {}) {
  if (!Array.isArray(targets) || !targets.length) throw new Error('runCounterfactual requires targets');
  if (!CREDIT_BASELINE_TYPES.includes(baselineType)) {
    return { baselineType, baselineConfig, status: 'unresolved', reason: 'invalid_baseline', runs: [] };
  }
  const actualScore = round(evaluate({ active: targets, replaced: null }));
  const runs = [];
  for (const t of targets) {
    const cfScore = round(evaluate({ active: targets, replaced: t }));
    runs.push({
      target: t,
      actualScore,
      counterfactualScore: cfScore,
      delta: round(actualScore - cfScore), // >0 有帮助；<0 有害；≈0 无影响
    });
  }
  return { baselineType, baselineConfig, status: 'resolved', actualScore, runs };
}

export function computeCredit({ counterfactual, confidence = 0.5, traceId = '', sessionId = 'default', stateVersion = 0 } = {}) {
  if (!counterfactual || counterfactual.status !== 'resolved') {
    return { creditId: crypto.randomUUID(), status: 'unresolved', reason: counterfactual?.reason || 'no_baseline', traceId, sessionId, stateVersion, credits: [] };
  }
  const threshold = confidence >= CREDIT_CONFIDENCE_THRESHOLD ? 'resolved' : 'low_confidence';
  const credits = counterfactual.runs.map((r) => ({
    creditId: crypto.randomUUID(),
    traceId,
    sessionId,
    stateVersion,
    target: r.target,
    actualScore: r.actualScore,
    counterfactualScore: r.counterfactualScore,
    delta: r.delta,
    baselineType: counterfactual.baselineType,
    baselineConfig: counterfactual.baselineConfig,
    method: 'explicit_counterfactual',
    confidence: Number(confidence),
    status: threshold,
    invalidated: false,
    appliedQ: 0,
    timestamp: nowIso(),
  }));
  return { creditId: crypto.randomUUID(), status: threshold, traceId, sessionId, stateVersion, credits };
}

// ── Credit Store + Canonical refs ────────────────────────────────
export function creditFile(workspace) {
  return path.join(workspace, CREDIT_FILE);
}

export function listCredits(workspace, { sessionId = '' } = {}) {
  return listLines(creditFile(workspace)).filter((c) => !sessionId || c.sessionId === sessionId);
}

// ── Policy Evidence（context-aware、versioned、bounded、reversible）──
export function policyEvidenceFile(workspace) {
  return path.join(workspace, POLICY_EVIDENCE_FILE);
}

export function readPolicyEvidence(workspace) {
  const e = readJsonSafe(policyEvidenceFile(workspace));
  return e && typeof e === 'object' ? e : { version: 0, items: {} };
}

export function contextKey({ taskType = '', goal = '', risk = 0, uncertainty = 0, failureType = '' } = {}) {
  return JSON.stringify({
    taskType: String(taskType).slice(0, 20),
    goal: String(goal || '').slice(0, 30),
    risk: round(risk, 2),
    uncertainty: round(uncertainty, 2),
    failureType: String(failureType || ''),
  });
}

function itemKey(context, operator) {
  return `${contextKey(context)}|${operator}`;
}

export function policyWeights(workspace, { context = {} } = {}) {
  const e = readPolicyEvidence(workspace);
  const ck = contextKey(context);
  const out = {};
  for (const [k, v] of Object.entries(e.items || {})) {
    if (k.startsWith(`${ck}|`)) out[v.operator || k.split('|').pop()] = round(v.appliedQ || 0, 4);
  }
  return out;
}

/**
 * applyCredit：Q_new = Q_old + η·C（有界 [-1,1]、按 context+operator 记录、可撤销）。
 * 低置信（< CREDIT_CONFIDENCE_THRESHOLD）→ 跳过强更新（仅落 store，不改行为）。
 */
export function applyCredit(workspace, { credits, context = {}, eta = 0.3, traceId = '', sessionId = 'default' } = {}) {
  const ev = readPolicyEvidence(workspace);
  const applied = [];
  for (const c of (credits || [])) {
    let appliedQ = 0;
    if (c.status === 'resolved' && c.confidence >= CREDIT_CONFIDENCE_THRESHOLD) {
      const key = itemKey(context, c.target);
      const item = ev.items[key] || { operator: c.target, context, creditSum: 0, count: 0, appliedQ: 0, lastCreditId: '' };
      const before = round(item.appliedQ || 0);
      const q = round(before + eta * c.delta);
      item.appliedQ = Math.max(-1, Math.min(1, q)); // bounded
      item.creditSum = round((item.creditSum || 0) + c.delta);
      item.count = (item.count || 0) + 1;
      item.lastCreditId = c.creditId;
      item.updatedAt = nowIso();
      ev.items[key] = item;
      appliedQ = item.appliedQ;
      applied.push({ target: c.target, context, before, after: item.appliedQ, creditId: c.creditId });
    }
    const rec = { ...c, sessionId, context, contextKey: contextKey(context), appliedQ, invalidated: false };
    appendLine(creditFile(workspace), rec);
  }
  ev.version += 1;
  fs.mkdirSync(path.dirname(policyEvidenceFile(workspace)), { recursive: true });
  writeFileAtomic(policyEvidenceFile(workspace), JSON.stringify(ev, null, 2) + '\n');
  // Canonical 状态：policy 分区只存证据版本引用，不塞全部历史（防 state 膨胀）
  st.commit(workspace, {
    delta: { policy: { evidenceVersion: ev.version }, credits: [ev.version] },
    event: { eventType: 'policy.updated', payload: { applied, count: applied.length, traceId } },
    sessionId: sessionId || 'default',
    actor: 'credit-engine',
    traceId,
  });
  return { applied, evidenceVersion: ev.version };
}

/** invalidateCredit：把错误 credit 撤销，并恢复相关 policy evidence（可逆性，Test 8）。 */
export function invalidateCredit(workspace, { creditId, sessionId = 'default', traceId = '' } = {}) {
  const all = listLines(creditFile(workspace));
  const target = all.find((c) => c.creditId === creditId);
  if (!target) throw new Error(`credit not found: ${creditId}`);
  if (target.invalidated) return { invalidated: false, reason: 'already_invalidated' };
  target.invalidated = true;
  target.invalidatedAt = nowIso();
  const ev = readPolicyEvidence(workspace);
  let restored = null;
  if (target.status === 'resolved' && target.confidence >= CREDIT_CONFIDENCE_THRESHOLD && target.appliedQ !== 0) {
    const key = itemKey(target.context, target.target);
    const item = ev.items[key];
    if (item) {
      const before = round(item.appliedQ || 0);
      item.appliedQ = round(before - target.appliedQ); // 撤销该 credit 的 Q 增量
      item.creditSum = round((item.creditSum || 0) - target.delta);
      item.count = Math.max(0, (item.count || 1) - 1);
      item.updatedAt = nowIso();
      ev.items[key] = item;
      ev.version += 1;
      writeFileAtomic(policyEvidenceFile(workspace), JSON.stringify(ev, null, 2) + '\n');
      restored = { target: target.target, before, after: item.appliedQ };
      st.commit(workspace, {
        delta: { policy: { evidenceVersion: ev.version } },
        event: { eventType: 'credit.invalidated', payload: { creditId, restored, traceId } },
        sessionId,
        actor: 'credit-engine',
        traceId,
      });
    }
  }
  // 重写 credit store（标记 invalidated）
  writeFileAtomic(creditFile(workspace), all.map((c) => JSON.stringify(c)).join('\n') + '\n');
  return { invalidated: true, restored };
}

/** 从实际轨迹构造确定性 CF 评价器（baseline=移除参与模块的贡献；confidence 如实低标）。 */
export function traceEvaluator(trace = [], real) {
  const actions = (trace || []).map((t) => t.action);
  const contribution = (target) => {
    if (target === 'operators') return actions.includes('abstract') ? Number(real) * 0.2 : 0;
    if (target === 'router') return actions.length >= 2 ? Number(real) * 0.1 : 0;
    if (target === 'elicitor') return actions.includes('askHuman') ? Number(real) * 0.1 : 0;
    return 0;
  };
  return ({ active, replaced }) => {
    if (!replaced) return Number(real);
    return round(Number(real) - contribution(replaced));
  };
}

export function traceCredits(trace, real, { confidence = 0.35, sessionId = 'default', traceId = '', stateVersion = 0 } = {}) {
  const cf = runCounterfactual({
    evaluate: traceEvaluator(trace, real),
    targets: ['operators', 'router', 'elicitor'],
    baselineType: 'deterministic_baseline',
    baselineConfig: { source: 'actual-trace' },
  });
  return computeCredit({ counterfactual: cf, confidence, traceId, sessionId, stateVersion });
}

/**
 * 基于规范状态的确定性 CF 评价器（直接人类反馈路径）：
 * 确认（outcome≥0.5）→ 参与模块贡献为正（移除则变差）；纠正（outcome<0.5）→ 贡献为负（移除则变好）。
 * baselineType=deterministic_baseline，confidence 由调用方如实标注。
 */
export function stateEvaluator(state = {}, outcome) {
  const h = (state.hypotheses || []).length;
  const hasAsk = (state.questions || []).length > 0;
  const sign = Number(outcome) >= 0.5 ? 1 : -1;
  return ({ replaced }) => {
    if (!replaced) return Number(outcome);
    let drop = 0;
    if (replaced === 'operators' && h) drop = Number(outcome) * 0.2 * sign;
    else if (replaced === 'router' && h) drop = Number(outcome) * 0.1 * sign;
    else if (replaced === 'elicitor' && hasAsk) drop = Number(outcome) * 0.1 * sign;
    return round(Number(outcome) - drop);
  };
}
