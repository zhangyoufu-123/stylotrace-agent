// Harness Release Manager failure-case 测试 + q* 重复项修复验证。
// F1 parentVersion 不匹配拒绝；F2 冻结区/白名单/值类型拒收；F3 未过门不许发布；
// F4 回滚到不存在版本拒绝且保持现状。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { ensureWorkspace } = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const h = await import(path.join(HERE, '..', 'src', 'csl', 'harness.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));
const ev = await import(path.join(HERE, '..', 'src', 'csl', 'events.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-harness-'));
const mk = (name) => ensureWorkspace(path.join(tmp, name), { create: true });

// ── 结构守卫：冻结区永远不能出现在白名单里 ──
for (const frozen of h.FROZEN_ZONE) {
  const prefix = frozen.endsWith('.*') ? frozen.slice(0, -1) : frozen;
  for (const key of h.EVOLVABLE_KEYS) {
    const hit = frozen.endsWith('.*') ? key.startsWith(prefix) : key === frozen;
    assert.ok(!hit, `冻结项 ${frozen} 不得出现在可进化白名单里（命中 ${key}）`);
  }
}
// 证据门整层冻结（规范 §4.9 与 §6.6 的冲突在 v1 用"不开放"解决）
assert.ok(h.FROZEN_ZONE.includes('evidence.*'), '证据门必须整层冻结');
assert.ok(h.GATE_V0.minSampleSize >= 8, '发布门必须有样本量下限');
assert.ok(!h.EVOLVABLE_KEYS.some((k) => k.startsWith('evidence.')), '证据门不得可进化');

// ── 基线 ──
const w0 = mk('base');
assert.equal(h.currentVersion(w0), 'H0');
assert.equal(h.harnessTag(w0), 'H0');
assert.equal(Object.keys(h.current(w0).config).length, 0);
assert.deepEqual(h.activeConfig(w0), { ...h.DEFAULTS });
assert.deepEqual(h.questionWeights(w0), { wIg: 1, lambda: 0.2, mu: 0.25, rho: 0.3 });

// ── F1：parentVersion 不匹配 ──
assert.throws(
  () => h.propose(w0, { config: { 'question.weights.cost': 0.1 }, parentVersion: 'H9' }),
  /必须从当前版本派生/,
);

// ── F2：冻结区 / 白名单外 / 值类型 ──
let err = null;
try {
  h.propose(w0, { config: { 'state.schema': 'v2' } });
} catch (e) {
  err = e;
}
assert.ok(err, 'F2a 冻结区必须拒收');
assert.equal(err.code, 'frozen_zone_violation');
assert.deepEqual(err.violations.map((v) => v.reason), ['frozen_zone']);

err = null;
try {
  h.propose(w0, { config: { 'evidence.requireSourceForNumbers': false } });
} catch (e) {
  err = e;
}
assert.ok(err && err.violations[0].reason === 'frozen_zone', 'F2b 证据门配置必须判为 frozen_zone');

err = null;
try {
  h.propose(w0, { config: { 'totally.unknown.key': 1 } });
} catch (e) {
  err = e;
}
assert.ok(err && err.violations[0].reason === 'not_evolvable', 'F2c 白名单外的键必须拒收');

err = null;
try {
  h.propose(w0, { config: { 'writer.stopPolicy': () => 'always' } });
} catch (e) {
  err = e;
}
assert.ok(err && err.violations[0].reason === 'unsupported_value_type', 'F2d 函数值必须拒收');

err = null;
try {
  h.propose(w0, { config: { 'memory.retrieval.topK': Number.NaN } });
} catch (e) {
  err = e;
}
assert.ok(err && err.violations[0].reason === 'non_finite_number', 'F2e NaN 必须拒收');

err = null;
try {
  h.propose(w0, { config: {} });
} catch (e) {
  err = e;
}
assert.ok(err && err.violations[0].reason === 'empty_config', 'F2f 空候选必须拒收（不制造不改任何东西的版本）');

// 被拒的候选要留下负证据（可审计，不是静默丢弃）
assert.equal(h.releaseLog(w0).filter((r) => r.type === 'harness.rejected').length, 6, '6 次拒收都要进账本');
assert.equal(h.currentVersion(w0), 'H0', '拒收不得改变当前版本');

// ── 发布门 ──
const J = h.judge;
assert.equal(J({ paired: true, heldOut: true, sampleSize: 3, heldOutDelta: 0.5, regressionRate: 0 }).passed, false);
assert.ok(J({ paired: true, heldOut: true, sampleSize: 3, heldOutDelta: 0.5, regressionRate: 0 }).reasons.some((r) => r.startsWith('sample_too_small')));
assert.equal(J({ paired: false, heldOut: true, sampleSize: 20, heldOutDelta: 0.5, regressionRate: 0 }).passed, false);
assert.equal(J({ paired: true, heldOut: false, sampleSize: 20, heldOutDelta: 0.5, regressionRate: 0 }).passed, false);
assert.equal(J({ paired: true, heldOut: true, sampleSize: 20, heldOutDelta: 0.01, regressionRate: 0 }).passed, false);
assert.equal(J({ paired: true, heldOut: true, sampleSize: 20, heldOutDelta: 0.5, regressionRate: 0.1 }).passed, false);
assert.equal(J({ paired: true, heldOut: true, sampleSize: 20, heldOutDelta: 0.5, regressionRate: 0 }).passed, true);

// ── F3：未评估 / 未过门不许发布 ──
const wA = mk('flow');
const c1 = h.propose(wA, { config: { 'question.weights.repetition': 0.1 }, targetFailure: 'redundant_question' });
assert.equal(c1.status, 'proposed');
assert.throws(() => h.publish(wA, c1.releaseId, { approvedBy: 'human' }), /尚未评估/);

assert.equal(h.evaluate(wA, c1.releaseId, { paired: true, heldOut: true, sampleSize: 4, heldOutDelta: 0.4, regressionRate: 0 }).passed, false);
assert.throws(() => h.publish(wA, c1.releaseId, { approvedBy: 'human' }), /未过门/);
assert.equal(h.currentVersion(wA), 'H0', '未过门的发布不得生效');

// ── 正常发布 ──
assert.equal(h.evaluate(wA, c1.releaseId, { paired: true, heldOut: true, sampleSize: 24, heldOutDelta: 0.11, regressionRate: 0 }).passed, true);
assert.throws(() => h.publish(wA, c1.releaseId, {}), /审批人/);
const pub = h.publish(wA, c1.releaseId, { approvedBy: 'zhangyoufu' });
assert.equal(pub.version, 'H1');
assert.equal(h.currentVersion(wA), 'H1');
assert.equal(h.activeConfig(wA)['question.weights.repetition'], 0.1);
assert.deepEqual(h.questionWeights(wA), { wIg: 1, lambda: 0.2, mu: 0.25, rho: 0.1 });

// ── H1 → H2：第二版叠加 ──
const c2 = h.propose(wA, { config: { 'question.weights.cost': 0.35 }, targetFailure: 'redundant_question' });
h.evaluate(wA, c2.releaseId, { paired: true, heldOut: true, sampleSize: 30, heldOutDelta: 0.05, regressionRate: 0 });
assert.equal(h.publish(wA, c2.releaseId, { approvedBy: 'zhangyoufu' }).version, 'H2');
assert.equal(h.activeConfig(wA)['question.weights.cost'], 0.35);
assert.equal(h.activeConfig(wA)['question.weights.repetition'], 0.1, '第二版应保留第一版未被覆盖的项');

// ── F4：回滚 ──
const before = h.currentVersion(wA);
assert.throws(() => h.rollback(wA, { toVersion: 'H99' }), /不存在/);
assert.equal(h.currentVersion(wA), before, '回滚失败必须保持现状');
assert.equal(h.rollback(wA).to, 'H1', '默认回到父版本');
assert.equal(h.activeConfig(wA)['question.weights.cost'], 0.2, 'H1 没有覆盖 cost');
assert.equal(h.rollback(wA, { toVersion: 'H0' }).to, 'H0');
assert.deepEqual(h.current(wA).config, {}, '回到基线应清空覆盖');

// ── 事件带 Harness 版本 ──
const wB = mk('stamp');
ev.appendEvent(wB, { event_type: 'x', state_version: 's_1' });
assert.equal(ev.listEvents(wB)[0].harness_version, 'H0');
ev.appendEvent(wB, { event_type: 'y', state_version: 's_2', harness_version: 'H7' });
assert.equal(ev.listEvents(wB)[1].harness_version, 'H7', '显式指定的版本不被覆盖');

// ── q* 修复：ρ 参与全候选排序（原来只改显示分数） ──
const state = { coreIdea: 'AI 让人懒得想', hypotheses: [], evidence: [], decisions: [] };
assert.equal(rt.chooseQuestion(state, { askedTypes: { differentiate: 1 } }, { rho: 0.3 }).type, 'why');
assert.equal(rt.chooseQuestion(state, { askedTypes: { differentiate: 1 } }, { rho: 0 }).type, 'differentiate');

// ── 端到端：已发布的 Harness 真的改变运行时行为 ──
const wC = mk('effect');
const cE = h.propose(wC, { config: { 'question.weights.repetition': 0 }, targetFailure: 'redundant_question' });
h.evaluate(wC, cE.releaseId, { paired: true, heldOut: true, sampleSize: 20, heldOutDelta: 0.3, regressionRate: 0 });
h.publish(wC, cE.releaseId, { approvedBy: 'zhangyoufu' });
assert.equal(
  rt.chooseQuestion(state, { askedTypes: { differentiate: 1 } }, { workspace: wC }).type,
  'differentiate',
  '发布 ρ=0 后，即使同类问过也不再压制 → Harness 版本真的影响选择',
);
assert.equal(
  rt.chooseQuestion(state, { askedTypes: { differentiate: 1 } }, { workspace: wB }).type,
  'why',
  '未发布覆盖的工作区仍按默认 ρ=0.3 选 why',
);

assert.ok(h.renderHarness(wA).includes('Harness 发行状态'));

console.log('PASS csl-harness（F1 派生 / F2 冻结区拒收 / F3 未过门 / F4 回滚 + q* ρ 修复 + 已发布版本真的改变行为）');
