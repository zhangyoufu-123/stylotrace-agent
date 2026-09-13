// Phase 2 — Outcome + Counterfactual Credit Engine 验收（T1–T9 + 契约/审计）。
// 关键：非均分 / 正负零 credit / CF 状态隔离 / 真实 outcome / credit→行为变化 / 上下文敏感 / 可撤销 / 低置信受限。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));
const cr = await import(path.join(HERE, '..', 'src', 'csl', 'credit.js'));
const ac = await import(path.join(HERE, '..', 'src', 'csl', 'actions.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-credit-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// ── 契约：Prediction / Outcome / Evaluator ──
const pred = cr.createPrediction({ expected: 0.9, confidence: 0.8, successCriteria: ['user 接受段落'], action: 'write', goal: 'g' });
assert.ok(pred.predictionId && pred.expected === 0.9 && pred.confidence === 0.8);
const outcome = cr.recordOutcome(w, {
  traceId: 'tr-t5', sessionId: 'S', stateVersion: 1,
  goal: { inferred: 'g' }, action: { action: 'write' },
  prediction: pred, actual: { value: 0.2, type: 'paragraph_deleted' },
  feedback: { source: 'user-edit' }, cost: {}, risk: {}, humanReaction: { deleted: true }, worldReaction: {},
});
assert.ok(outcome.outcomeId && outcome.actual.value === 0.2);
assert.ok(fs.readFileSync(path.join(w, 'protocol', 'csl-outcomes.jsonl'), 'utf8').includes('paragraph_deleted'));

const ev = cr.evaluateOutcome({ prediction: pred, actual: outcome.actual });
assert.equal(ev.overallError, 0.7, '|0.9−0.2| 应=0.7');
assert.ok('executionError' in ev.dimensions);

// ── T1 非均分：A 强 / B 弱 / C 无 ──
const evalAB = ({ replaced }) => {
  if (replaced === 'A') return 0.42;
  if (replaced === 'B') return 0.62;
  if (replaced === 'C') return 0.72;
  return 0.72;
};
const cf1 = cr.runCounterfactual({ evaluate: evalAB, targets: ['A', 'B', 'C'], baselineType: 'matched_alternative' });
const cr1 = cr.computeCredit({ counterfactual: cf1, confidence: 0.8 });
const cA = cr1.credits.find((c) => c.target === 'A').delta;
const cB = cr1.credits.find((c) => c.target === 'B').delta;
const cC = cr1.credits.find((c) => c.target === 'C').delta;
assert.ok(cA > cB && cA === 0.3 && cB === 0.1, `A>B 非均分: A=${cA} B=${cB}`);
assert.ok(Math.abs(cC) < 1e-9, `C 应≈0: ${cC}`);

// ── T2 负 credit ──
const evalNeg = ({ replaced }) => (replaced === 'D' ? 0.9 : 0.72);
const cf2 = cr.runCounterfactual({ evaluate: evalNeg, targets: ['D'], baselineType: 'frozen_baseline' });
const cD = cr.computeCredit({ counterfactual: cf2, confidence: 0.8 }).credits[0].delta;
assert.ok(cD < 0, `D 应负 credit: ${cD}`);

// ── T3 零 credit ──
const evalZero = ({ replaced }) => 0.72;
const cf3 = cr.runCounterfactual({ evaluate: evalZero, targets: ['E'], baselineType: 'frozen_baseline' });
assert.ok(Math.abs(cr.computeCredit({ counterfactual: cf3, confidence: 0.8 }).credits[0].delta) < 1e-9);

// ── T4 CF 状态隔离：反事实运行不污染 canonical state ──
st.commit(w, { delta: { coreIdea: '门槛' }, event: { eventType: 'core_idea.set' }, sessionId: 'default' });
const stateBefore = fs.readFileSync(path.join(w, 'protocol', 'csl-state.json'), 'utf8');
cr.runCounterfactual({ evaluate: evalAB, targets: ['A', 'B', 'C'], baselineType: 'matched_alternative' });
cr.computeCredit({ counterfactual: cf1, confidence: 0.8 });
const stateAfter = fs.readFileSync(path.join(w, 'protocol', 'csl-state.json'), 'utf8');
assert.equal(stateBefore, stateAfter, 'CF 运行不得修改 canonical state');

// ── T5 真实 outcome 误差入统一事件流 ──
st.appendCanonicalEvent(w, {
  type: 'OutcomeError', sessionId: 'S', traceId: 'tr-t5', actor: 'test',
  payload: { predictionRef: pred.predictionId, outcomeRef: outcome.outcomeId, dimensions: ev.dimensions, severity: ev.severity, confidence: ev.confidence },
  versionBefore: 1, versionAfter: 2,
});
assert.ok(fs.readFileSync(path.join(w, 'protocol', 'csl-canonical-events.jsonl'), 'utf8').includes('OutcomeError'));

// ── T6 credit → 真实动作选择变化 ──
const ctx = { taskType: 'creative', goal: 'g', risk: 0.1, uncertainty: 0.5 };
const jt = { coreIdea: 'x', hypotheses: ['h'] };
const before = ac.selectAction(jt, {}).action;
assert.equal(before, 'search', `基线应选 search: ${before}`);
const negCredit = [{
  creditId: 'credit-search-neg', target: 'search', delta: -3, confidence: 0.8, status: 'resolved',
  actualScore: 0.7, counterfactualScore: 3.7, baselineType: 'deterministic_baseline', method: 'explicit_counterfactual', stateVersion: 1,
}];
cr.applyCredit(w, { credits: negCredit, context: ctx, eta: 0.3, sessionId: 'S' });
const weights = cr.policyWeights(w, { context: ctx });
assert.ok(weights.search < 0, `search 应有负权重: ${JSON.stringify(weights)}`);
const afterSel = ac.selectAction(jt, { policyWeights: weights }).action;
assert.notEqual(afterSel, 'search', `credit 后动作选择应改变: ${afterSel}`);
const loopBefore = (await ac.runCognitiveLoop(jt, {}, { maxSteps: 3 })).trace[0].action;
const loopAfter = (await ac.runCognitiveLoop(jt, { policyWeights: weights }, { maxSteps: 3 })).trace[0].action;
assert.notEqual(loopAfter, loopBefore, '动作循环首步应因政策证据而变');

// ── T7 上下文敏感：context B 的 search 不受污染 ──
const ctxB = { taskType: 'research', goal: 'g2', risk: 0.1, uncertainty: 0.5 };
assert.ok(!('search' in cr.policyWeights(w, { context: ctxB })), 'B 上下文不得继承 A 的负权重');
assert.equal(ac.selectAction(jt, { policyWeights: cr.policyWeights(w, { context: ctxB }) }).action, 'search', 'B 上下文 search 仍可用');

// ── T8 credit 可撤销 ──
const wBefore = cr.policyWeights(w, { context: ctx }).search;
cr.invalidateCredit(w, { creditId: 'credit-search-neg', sessionId: 'S' });
const wAfter = cr.policyWeights(w, { context: ctx }).search || 0;
assert.ok(Math.abs(wAfter - 0) < 1e-9 || wAfter > wBefore, `撤销后权重应恢复: ${wBefore} -> ${wAfter}`);

// ── T9 低置信不强力更新 ──
const lowCred = [{
  creditId: 'credit-low', target: 'abstract', delta: 2, confidence: 0.2, status: 'low_confidence',
  actualScore: 1, counterfactualScore: -1, baselineType: 'deterministic_baseline', method: 'explicit_counterfactual', stateVersion: 1,
}];
const lowApply = cr.applyCredit(w, { credits: lowCred, context: ctx, eta: 0.3, sessionId: 'S' });
assert.deepEqual(lowApply.applied, [], '低置信不得强力更新');
assert.ok(!('abstract' in cr.policyWeights(w, { context: ctx })), '低置信不得产生权重');

// ── 审计：credit store 可回查 why/what/baseline/delta/confidence ──
const stored = cr.listCredits(w, { sessionId: 'S' });
const aud = stored.find((c) => c.creditId === 'credit-search-neg');
assert.ok(aud && aud.baselineType && typeof aud.delta === 'number' && typeof aud.confidence === 'number' && aud.invalidated === true, 'credit 可审计');

// ── 错误处理：无效 baseline → unresolved ──
const badCf = cr.runCounterfactual({ evaluate: evalAB, targets: ['A'], baselineType: 'not_a_baseline' });
assert.equal(badCf.status, 'unresolved');
const badCredit = cr.computeCredit({ counterfactual: badCf, confidence: 0.8 });
assert.equal(badCredit.status, 'unresolved');

console.log('PASS csl-credit（契约/T1 非均分/T2 负/T3 零/T4 隔离/T5 真实outcome/T6 行为变化/T7 上下文/T8 可撤销/T9 低置信/审计/错误处理）');
