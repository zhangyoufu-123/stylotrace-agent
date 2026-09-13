// 红队修复验证：Authority 连续 / Schema 置信度 / 推理算子 / 真实反事实 Credit / 认知门。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));
const rp = await import(path.join(HERE, '..', 'src', 'csl', 'replay.js'));
const rs = await import(path.join(HERE, '..', 'src', 'csl', 'reasoning.js'));
const lg = await import(path.join(HERE, '..', 'src', 'csl', 'ledger.js'));

// Fix #3 — Authority 连续：低风险高置信 > 高风险低置信；值域 (0,1)
const aHigh = rt.computeAuthority({ risk: 0.1, confidence: 0.9, competence: 0.8 });
const aLow = rt.computeAuthority({ risk: 0.9, confidence: 0.2, competence: 0.3 });
assert.ok(aHigh > 0.5 && aHigh < 1, `高置信应偏高：${aHigh}`);
assert.ok(aLow < 0.5 && aLow > 0, `高风险应偏低：${aLow}`);
assert.ok(aHigh > aLow);
// 单调：置信升 → alpha 升；风险升 → alpha 降
assert.ok(rt.computeAuthority({ risk: 0.1, confidence: 0.3 }) < rt.computeAuthority({ risk: 0.1, confidence: 0.8 }));
assert.ok(rt.computeAuthority({ risk: 0.1, confidence: 0.5 }) > rt.computeAuthority({ risk: 0.8, confidence: 0.5 }));

// Fix #5 — Schema 置信度：随证据/反例变化；reconsolidation 版本化
assert.ok(rp.schemaConfidence(['succeeded', 'succeeded']) > rp.schemaConfidence(['succeeded']));
assert.ok(rp.schemaConfidence(['succeeded', 'failed']) < rp.schemaConfidence(['succeeded', 'succeeded']));
assert.equal(rp.schemaConfidence(['failed', 'failed']), 0);

// Fix #4 — 推理算子
const c = rs.compare('狗吃骨头', '狗闻骨头');
assert.ok(c.shared.includes('狗') && c.shared.includes('骨') && c.shared.includes('头'), 'shared 应含共同字符');
assert.ok(c.different.a.includes('吃') && c.different.b.includes('闻'));
const ce = rs.counterexample('鸟会飞');
assert.ok(ce && ce.counter.includes('企鹅'));
assert.equal(rs.counterexample('石头会飞'), null);
const ab = rs.abstract(['小狗吃肉', '小狗闻肉']);
assert.ok(ab.claim.includes('狗') && ab.confidence > 0, '抽象应提取共同字符');

// Fix #2 — 真实反事实 Credit：因果模块集中归因，惰性模块≈0
const simulate = ({ active }) => (active.includes('M1') ? 0.9 : 0.2); // M1 因果，M2 惰性
const cred = lg.interveneAndCredit({ simulate, modules: ['M1', 'M2'], baseline: 'B0', seed: 7 });
assert.ok(cred.credit.M1 > 0.6, `因果模块应获主要 credit：${cred.credit.M1}`);
assert.ok(Math.abs(cred.credit.M2) < 0.01, `惰性模块 credit≈0：${cred.credit.M2}`);

// Fix #1 — 认知门：仅当学习到的策略要求 ask 且处于写作阶段 → ask；否则 proceed
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-gate-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
assert.equal(rt.cognitiveGate(w, {}, { mode: 'creative', stage: 'write' }), 'proceed', '无学习证据不拦截');
assert.equal(rt.cognitiveGate(w, { coreIdea: 'x' }, { mode: 'creative', stage: 'write' }), 'proceed');
// 有失败经历 → policy ask → write 阶段强制 ask
const w2 = ws.ensureWorkspace(path.join(tmp, 'w2'), { create: true });
fs.mkdirSync(path.join(w2, 'vault'), { recursive: true });
fs.writeFileSync(
  path.join(w2, 'vault', 'csl-policy.json'),
  JSON.stringify({ modes: { creative: { drafts: 2, failures: 2, successes: 0 } } }),
);
assert.equal(rt.cognitiveGate(w2, { coreIdea: 'x' }, { mode: 'creative', stage: 'write' }), 'ask');
assert.equal(rt.cognitiveGate(w2, { coreIdea: 'x' }, { mode: 'creative', stage: 'clarify' }), 'proceed', '澄清阶段不拦截');

console.log('PASS csl-redteam-fixes（Authority/Schema/算子/Credit/认知门 全部修复）');
