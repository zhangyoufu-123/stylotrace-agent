// 决断卡（创新/风格分离）验收：
// 比较集必填 · 冻结入库+事件 · 成稿逐字校验（改了必须暴露）· 决断密度 · 反锁死拒绝 · Writer 集成。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));
const dc = await import(path.join(HERE, '..', 'src', 'csl', 'decision.js'));
const { writeSection } = await import(path.join(HERE, '..', 'src', 'write.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-decision-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

const SPAN = '门槛不是阻隔，是记忆的承重';

// 1) 比较集必填（论纲 §8.5：没有声明比较集的新颖性一律无效）
assert.equal(dc.createDecisionCard({ object: '门槛', spanText: SPAN }).ok, false);
assert.equal(dc.createDecisionCard({ object: '门槛', spanText: SPAN }).reason, 'missing_comparison_set');
assert.equal(dc.createDecisionCard({ comparisonSet: '乡愁散文', spanText: SPAN }).reason, 'missing_object');
assert.equal(dc.createDecisionCard({ object: '门槛', comparisonSet: '乡愁散文' }).reason, 'missing_span_text');

// 2) 入库 + canonical 提交 + 事件
const v0 = st.stateVersion(w);
const add = dc.addDecision(w, {
  object: '门槛——被磨矮的木头',
  oldDomain: '乡愁散文的抒情套路',
  newDomain: '建筑构件的受力隐喻',
  link: '把"承重"从结构工程借到记忆上',
  comparisonSet: '乡愁散文 / 伤痕叙事 / 家族解体叙事',
  expectedEffect: '让"沉默"变成一种支撑而不是缺席',
  counterEvidence: '可能被读成滥情隐喻',
  spanText: SPAN,
});
assert.equal(add.ok, true);
assert.equal(add.count, 1);
assert.equal(st.stateVersion(w), v0 + 1, '决断卡应经 Kernel 提交');
const evt = fs.readFileSync(path.join(w, 'protocol', 'csl-canonical-events.jsonl'), 'utf8');
assert.ok(evt.includes('decision.frozen'), '冻结事件应入统一事件流');
assert.ok(fs.readFileSync(path.join(w, 'protocol', 'csl-decisions.json'), 'utf8').includes('comparisonSet'));

// 3) 冻结校验：逐字保留通过；被改写必须报违规
const okDraft = `院子里的门槛矮了一截。${SPAN}，它记得每一双脚。`;
assert.equal(dc.verifyFrozen(w, okDraft).ok, true, '原样保留应通过');
const badDraft = '门槛不再是阻隔，而成了记忆的载体。'; // 被"润色"改写了
const bad = dc.verifyFrozen(w, badDraft);
assert.equal(bad.ok, false, '改写冻结句必须被判违规');
assert.equal(bad.violations.length, 1);
assert.equal(bad.violations[0].reason, 'frozen_span_modified_or_missing');
// 标点/空白差异不算改动（容错）
assert.equal(dc.verifyFrozen(w, '门槛不是阻隔 是记忆的承重！').ok, true, '标点空白差异应容忍');

// 4) 决断密度 + 反锁死
const den = dc.decisionDensity(w, okDraft);
assert.ok(den.frozen === 1 && den.chars > 0, `密度可算: ${JSON.stringify(den)}`);
assert.equal(dc.lockInGuard(w, { draftText: okDraft, aiRejectedStreak: 3 }).refuse, true, '连续删 AI 应拒绝服务');
const guarded = dc.lockInGuard(w, { draftText: okDraft, aiRejectedStreak: 3 });
assert.ok(guarded.reason.includes('先写点属于你自己的东西') || guarded.reason.length > 0);
assert.ok(guarded.advice.length > 0, '拒绝时应给出可执行建议');
const wEmpty = ws.ensureWorkspace(path.join(tmp, 'empty'), { create: true });
assert.equal(dc.lockInGuard(wEmpty, { draftText: '随便写点', aiRejectedStreak: 0 }).refuse, false, '无决断卡时不应误拒');

// 5) Writer 集成：提示词含冻结约束 + 成稿违规被抓出 + URL 提示词注入
const w2 = ws.ensureWorkspace(path.join(tmp, 'w2'), { create: true });
const ps = ws.readState(w2);
ps.confirmed = { topic: '门槛', genre: '散文' };
ps.outline = { title: '门槛', sections: [{ heading: '一', function: '引入', thesis: '门槛', words: 30, keyPoints: [] }] };
ws.writeState(w2, ps);
st.commit(w2, { delta: { coreIdea: '门槛是记忆的承重' }, event: { eventType: 'core_idea.set' } });
dc.addDecision(w2, { object: '门槛', comparisonSet: '乡愁散文', spanText: SPAN });

let bodies = [];
const oldFetch = globalThis.fetch;
const stub = (content) => async (url, opts) => {
  bodies.push(String(opts?.body || ''));
  return {
    ok: true, status: 200,
    json: async () => ({ id: 'r', model: 'm', choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 } }),
  };
};
try {
  // 5a) 模型保留冻结句 → 0 违规
  globalThis.fetch = stub(`（mock）${SPAN}，它记得每一双脚。`);
  const okRun = await writeSection({ baseUrl: 'https://fake', model: 'm', targetWords: 30 }, w2, {});
  const writeCall = bodies.find((b) => b.includes('作者决断')) || '';
  assert.ok(writeCall, '写作提示应含冻结约束');
  assert.ok(writeCall.includes(SPAN), '冻结句原文应进提示词');
  assert.equal(okRun.frozen.checked, 1);
  assert.equal(okRun.frozen.violations, 0, '保留冻结句不应报违规');

  // 5b) 模型改写冻结句 → 被抓出并记录
  const w3 = ws.ensureWorkspace(path.join(tmp, 'w3'), { create: true });
  const ps3 = ws.readState(w3);
  ps3.confirmed = { topic: '门槛', genre: '散文' };
  ps3.outline = { title: '门槛', sections: [{ heading: '一', function: '引入', thesis: '门槛', words: 30, keyPoints: [] }] };
  ws.writeState(w3, ps3);
  st.commit(w3, { delta: { coreIdea: '门槛是记忆的承重' }, event: { eventType: 'core_idea.set' } });
  dc.addDecision(w3, { object: '门槛', comparisonSet: '乡愁散文', spanText: SPAN });
  globalThis.fetch = stub('门槛不再是阻隔，而成了记忆的载体。');
  const badRun = await writeSection({ baseUrl: 'https://fake', model: 'm', targetWords: 30 }, w3, {});
  assert.ok(badRun.frozen.violations >= 1, `改写冻结句应被记录: ${JSON.stringify(badRun.frozen)}`);
  assert.ok(ws.readState(w3).frozenViolations?.length >= 1, '违规应留痕在状态里');
} finally {
  globalThis.fetch = oldFetch;
}

console.log('PASS csl-decision（比较集必填/冻结入库/逐字校验/密度/反锁死/Writer 集成）');
