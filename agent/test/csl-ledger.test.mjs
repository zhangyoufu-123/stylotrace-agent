// OutcomeLedger + BasicCredit failure-case 测试。
// F1 无 outcome 拒绝；F2 未知模块归因拒绝；F3 确定性；基线枚举。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const lg = await import(path.join(HERE, '..', 'src', 'csl', 'ledger.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-ledger-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// F1: 无 outcome 拒绝
assert.throws(() => lg.basicCredit({ prediction: 0.8 }), /outcome/);
assert.throws(() => lg.recordOutcome(w, { prediction: 0.8 }), /outcome/);

// F2: 未知模块归因拒绝
assert.throws(() => lg.basicCredit({ outcome: 0.5, prediction: 0.8, involvedModules: ['nope'] }), /unknown module/);

// F3: 确定性 + 误差正确
const c1 = lg.basicCredit({ outcome: 0.5, prediction: 0.8, baseline: 'B0', involvedModules: ['elicitor', 'router'] });
const c2 = lg.basicCredit({ outcome: 0.5, prediction: 0.8, baseline: 'B0', involvedModules: ['elicitor', 'router'] });
assert.deepEqual(c1, c2);
assert.equal(c1.error, 0.3);
assert.equal(c1.credit.elicitor, 0.15);

// 基线枚举
assert.deepEqual(lg.CREDIT_BASELINES, ['B0', 'B1', 'B2']);

// recordOutcome 落账本
const r = lg.recordOutcome(w, { sessionId: 's1', step: 2, prediction: 0.8, outcome: 0.5 });
assert.equal(r.error.magnitude, 0.3);

// P0-5：反事实 Credit（非均分）——C_i = real − off_i，且记录 baseline/intervention/result/confidence
const cf = lg.creditFromCounterfactual({
  real: 0.9,
  off: { operators: 0.6, router: 0.8, elicitor: 0.9 },
  baseline: 'B0',
  modules: ['operators', 'router', 'elicitor'],
  confidence: 0.4,
});
assert.equal(cf.credit.operators, 0.3, 'operators 反事实 credit 应为 0.3');
assert.equal(cf.credit.router, 0.1, 'router 应为 0.1（非均分 0.1/0.1/0.1）');
assert.equal(cf.credit.elicitor, 0, '未参与模块应为 0');
assert.equal(cf.method, 'counterfactual');
assert.equal(cf.confidence, 0.4);
assert.throws(() => lg.creditFromCounterfactual({ modules: ['m'] }), /requires real outcome/);
assert.throws(() => lg.creditFromCounterfactual({ real: 0.5 }), /requires modules/);

// P0-4：recordOutcome 可携带 credit 与来源（Baseline/Intervention/Result/Confidence 落账）
const rc = lg.recordOutcome(w, { sessionId: 's2', step: 3, prediction: 0.8, outcome: 0.9, credit: cf, source: 'user-confirm' });
assert.equal(rc.credit.credit.operators, 0.3, 'recordOutcome 应回传 credit');
const evt = fs.readFileSync(path.join(w, 'protocol', 'csl-events.jsonl'), 'utf8').trim().split('\n').pop();
const parsed = JSON.parse(evt);
assert.equal(parsed.provenance.source, 'user-confirm');
assert.equal(parsed.provenance.intervention.baseline, 'B0');
assert.equal(parsed.provenance.intervention.confidence, 0.4);
assert.ok(parsed.credit?.credit?.operators !== undefined, 'credit 应入事件');

console.log('PASS csl-ledger（F1 拒绝 / F2 防错误归因 / F3 确定性）');
