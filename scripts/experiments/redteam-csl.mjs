#!/usr/bin/env node
// CSLA 红队伪造化实验（确定性、可复现、零真实 token）。
// 把红队报告中标 UNKNOWN 的项，用 mock LLM + 确定性运行时实测。
// 用法：node scripts/experiments/redteam-csl.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'agent', 'src');
const ws = await import(path.join(SRC, 'workspace.js'));
const st = await import(path.join(SRC, 'csl', 'state.js'));
const ev = await import(path.join(SRC, 'csl', 'events.js'));
const rt = await import(path.join(SRC, 'csl', 'runtime.js'));
const rp = await import(path.join(SRC, 'csl', 'replay.js'));
const rs = await import(path.join(SRC, 'csl', 'reasoning.js'));
const lg = await import(path.join(SRC, 'csl', 'ledger.js'));
const el = await import(path.join(SRC, 'csl', 'elicit.js'));

const results = [];
const record = (name, pass, evidence) => results.push({ name, pass, evidence });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'redteam-csl-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
const w2 = ws.ensureWorkspace(path.join(tmp, 'w2'), { create: true });

// T1/T2 认知真实性：失败 → 重放 → 行为改变；novel 模式不被污染
const before = rp.policyFor(w, 'creative'); // 基线 = draft
ev.appendEvent(w, { event_type: 'cognitive.run', state_version: 's_1', session_id: 's', step: 1, goal: '散文', action: { action: 'draft' }, prediction: { value: 0.8 }, outcome: { value: 0.2 }, error: { magnitude: 0.6 } });
rp.replayOnce(w, { sessionId: 's' });
const after = rp.policyFor(w, 'creative');
record('T1 失败→行为改变（draft→ask）', before === 'draft' && after === 'ask', `before=${before}, after=${after}`);
record('T2 泛化（novel 模式不受污染）', rp.policyFor(w, 'research') === 'draft', `research=${rp.policyFor(w, 'research')}`);

// DeepGate：简单=快，复杂=深，高风险=深
const s2 = rt.fastSalience('2+2');
const s3 = rt.fastSalience('帮我规划一个多步骤的跨部门项目方案，需要调研和权衡');
const s4 = rt.fastSalience('请给出涉及大额资金的合规建议');
record('DeepGate 简单任务走快通道', s2.p_deep < rt.DEEP_TAU, `p_deep=${s2.p_deep}`);
record('DeepGate 复杂任务走深通道', s3.p_deep >= rt.DEEP_TAU, `p_deep=${s3.p_deep}`);
record('DeepGate 高风险任务走深通道', s4.p_deep >= rt.DEEP_TAU, `p_deep=${s4.p_deep}`);

// Fast/Deep 泄漏：普通聊天不动深层状态；重要消息进入深层
const f = await rt.runTurn(w2, { input: '今天天气不错' });
record('Fast/Deep 泄漏：闲聊走快通道', f.kind === 'fast', `kind=${f.kind}`);
const g = await rt.runTurn(w2, { input: '我想写一篇关于故乡的散文，核心是门槛' });
record('Fast/Deep 泄漏：写作意图走深层', g.kind === 'ask' || g.kind === 'deep', `kind=${g.kind}`);

// Goal formation：模糊想法必须 ask，不直接成稿
record('Goal formation：无明确目的先问不写', g.kind === 'ask', `kind=${g.kind}`);

// Ask-human / Innovation：完备状态不再追问
record('Ask-human：完备状态返回 null', el.pickQuestion({ coreIdea: 'x', hypotheses: ['h'], evidence: ['e'], decisions: ['d'] }) === null, 'null');
record('Ask-human：空状态必有高价值问题', el.pickQuestion({})?.type === 'clarify', el.pickQuestion({})?.type);

// Authority：连续且方向正确
const aHigh = rt.computeAuthority({ risk: 0.1, confidence: 0.9, competence: 0.8 });
const aLow = rt.computeAuthority({ risk: 0.9, confidence: 0.2, competence: 0.3 });
record('Authority：低风险高置信>高风险低置信', aHigh > 0.5 && aLow < 0.5 && aHigh > aLow, `high=${aHigh}, low=${aLow}`);

// Pattern separation：4 条相似事件保持独立（按 step 分组）
for (let i = 1; i <= 4; i++) {
  ev.appendEvent(w2, { event_type: 'cognitive.run', state_version: `s_${i}`, session_id: 'sep', step: i, goal: '小狗', action: { action: i === 4 ? '闻' : '吃' }, prediction: { value: 0.5 }, outcome: { value: i === 4 ? 0.9 : 0.5 }, error: { magnitude: 0 } });
}
record('Pattern separation：4 相似事件不合并', rp.reconstructEpisodes(w2, 'sep').length >= 4, `episodes=${rp.reconstructEpisodes(w2, 'sep').length}`);

// Pattern completion 幻觉：少量证据置信<1
record('Completion 不冒充事实', rp.schemaConfidence(['succeeded']) < 1, `conf=${rp.schemaConfidence(['succeeded'])}`);

// Comparison 不塌缩为 embedding 相似度
const cmp = rs.compare('狗吃骨头', '狗闻骨头');
record('Comparison 输出关系差异', cmp.relationalDifference !== '同质' && cmp.different.a.length > 0, `rel=${cmp.relationalDifference}`);

// Induction 反例 → schema 置信下降
record('Induction 反例压低置信', rp.schemaConfidence(['succeeded', 'failed']) < rp.schemaConfidence(['succeeded', 'succeeded']), `${rp.schemaConfidence(['succeeded','failed'])} < ${rp.schemaConfidence(['succeeded','succeeded'])}`);

// Counterexample 主动找反例
record('Counterexample 命中', rs.counterexample('鸟会飞')?.counter.includes('企鹅') === true, rs.counterexample('鸟会飞')?.counter);

// Credit：因果模块归因集中
const sim = ({ active }) => (active.includes('M1') ? 0.9 : 0.2);
const cr = lg.interveneAndCredit({ simulate: sim, modules: ['M1', 'M2'], seed: 7 });
record('Credit 区分因果模块', cr.credit.M1 > 0.6 && Math.abs(cr.credit.M2) < 0.01, `M1=${cr.credit.M1}, M2=${cr.credit.M2}`);

// Memory bloat：重放有界（policy 文件只存模式统计，不复制事件）
for (let i = 1; i <= 200; i++) {
  ev.appendEvent(w2, { event_type: 'cognitive.run', state_version: `s_${i}`, session_id: 'bloat', step: i, goal: 'g', action: { action: i % 2 ? 'draft' : 'ask' }, prediction: { value: 0.5 }, outcome: { value: i % 2 ? 0.1 : 0.9 }, error: { magnitude: 0.4 } });
}
rp.replayOnce(w2, { sessionId: 'bloat' });
const policySize = fs.statSync(path.join(w2, 'vault', 'csl-policy.json')).size;
record('Memory bloat：200 事件后 policy 有界', policySize < 1000, `policySize=${policySize}B`);

// Cognitive theater：状态驱动行为（director 认知门）
const w3 = ws.ensureWorkspace(path.join(tmp, 'w3'), { create: true });
fs.mkdirSync(path.join(w3, 'vault'), { recursive: true });
fs.writeFileSync(path.join(w3, 'vault', 'csl-policy.json'), JSON.stringify({ modes: { creative: { drafts: 2, failures: 2, successes: 0 } } }));
record('Cognitive theater：学习状态驱动行为', rt.cognitiveGate(w3, { coreIdea: 'x' }, { mode: 'creative', stage: 'write' }) === 'ask', rt.cognitiveGate(w3, { coreIdea: 'x' }, { mode: 'creative', stage: 'write' }));

// 输出
const passed = results.filter((r) => r.pass).length;
console.log(`\n=== CSLA 红队实测（确定性/mock） ===\n通过 ${passed}/${results.length}\n`);
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n      evidence: ${r.evidence}`);
}
fs.writeFileSync(path.join(tmp, 'redteam-csl-results.json'), JSON.stringify(results, null, 2));
console.log(`\nresults → ${path.join(tmp, 'redteam-csl-results.json')}`);
