// Stylotrace Cognitive Integration — Cognitive Writing Brief 全链验收：
// Fast → Brief → (HRME/Reasoning) → Brief → Writer → HumanEdit → Outcome → AuthorModel/Policy。
// 每一步必须留下真实状态/文件证据（不是"设计上可以"）。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));
const br = await import(path.join(HERE, '..', 'src', 'csl', 'brief.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));
const cn = await import(path.join(HERE, '..', 'src', 'csl', 'canonical.js'));
const hrmr = await import(path.join(HERE, '..', 'src', 'csl', 'hrmr.js'));
const cr = await import(path.join(HERE, '..', 'src', 'csl', 'credit.js'));
const { writeSection } = await import(path.join(HERE, '..', 'src', 'write.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-brief-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
const mockLlm = async () => '（mock）哺乳动物吃植物粮，作者倾向从具体小事切进大观点。';

// ── 1) Fast Interaction → Brief：核心想法进入 Brief + canonical 版本化 ──
rt.acceptAnswer(w, null, '故乡的门槛被磨矮了，想写它的沉默和倔强');
const ps = ws.readState(w);
ps.confirmed = { ...(ps.confirmed || {}), audience: '普通读者', stance: '门槛不是阻隔，是记忆的承重' };
ps.outline = { title: '门槛', sections: [{ heading: '一', function: '引入', thesis: '门槛与沉默', words: 20, keyPoints: [] }] };
ws.writeState(w, ps);
const s1 = br.syncBrief(w);
assert.equal(s1.changed, true, 'Brief 应首次组装');
assert.ok(s1.brief.coreIdea.includes('门槛'), `coreIdea 入 Brief: ${s1.brief.coreIdea}`);
assert.equal(s1.brief.audience.value, '普通读者');
assert.equal(s1.brief.authorPosition, '门槛不是阻隔，是记忆的承重');
assert.ok(st.readCanonicalState(w).brief.version >= 1, 'Brief 应提交 canonical');
const vAfterFast = st.stateVersion(w);
const s2 = br.syncBrief(w);
assert.equal(s2.changed, false, '无内容变化不得重复提交（版本防膨胀）');
assert.equal(st.stateVersion(w), vAfterFast, '不变时 canonical 版本不动');

// ── 2) HRME → Brief：作者模式（schema）进入 Brief ──
for (const [t, g] of [['小猪吃玉米', 's1'], ['小猪吃粮食', 's2'], ['牛吃玉米', 's3'], ['羊吃粮食', 's4']]) {
  hrmr.addEpisode(w, { text: t, outcome: 1, goal: g });
}
br.syncBrief(w);
const brief2 = br.readBrief(w);
assert.ok(brief2.authorSchemas.some((s) => s.relationText.includes('mammal')), `作者模式应入 Brief: ${JSON.stringify(brief2.authorSchemas)}`);

// ── 3) Reasoning → Brief：golden 认知后 claims/counterarguments 入 Brief ──
const g = await rt.goldenCognition(w, { input: '小猪吃玉米。', llm: mockLlm, sessionId: 'brief-golden' });
br.syncBrief(w, { sessionId: 'brief-golden' });
const brief3 = br.readBrief(w);
assert.ok(brief3.claims.length >= 1, `Reasoning → claims 入 Brief: ${brief3.claims.length}`);
assert.ok(Array.isArray(brief3.counterarguments), 'counterarguments 为数组');
assert.ok(brief3.authorSchemas.length >= 1, 'authorSchemas 保留');

// ── 4) Brief → Writer：写作文本块注入（fetch stub 捕获请求体）+ 产出草稿 ──
let lastBody = '';
const oldFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  lastBody = String(opts?.body || '');
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'req_brief', model: 'm',
      choices: [{ message: { content: '（mock 段落）门槛被磨矮了，它不说话，却承着所有记忆。' } }],
      usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
    }),
  };
};
try {
  const wr = await writeSection({ baseUrl: 'https://fake', model: 'm' }, w, {});
  assert.ok(wr.draftFile && fs.existsSync(path.join(w, 'draft.md')), '应产出草稿');
  assert.ok(lastBody.includes('认知简报'), 'Writer 提示应含 Cognitive Brief');
  assert.ok(lastBody.includes('门槛'), 'Brief 核心观点应注入');
} finally {
  globalThis.fetch = oldFetch;
}

// ── 5) HumanEdit → Outcome：真实编辑落 OutcomeStore + Brief 更新 ──
const re = br.recordEdit(w, { edit: '删掉"它不说话" → "它从不出声，却记得每双脚"', source: 'point-edit' });
assert.equal(re.editCount, 1);
assert.ok(re.outcome.outcomeId);
assert.ok(fs.readFileSync(path.join(w, 'protocol', 'csl-outcomes.jsonl'), 'utf8').includes('point-edit'));
assert.equal(br.readBrief(w).outcomeRefs.length, 1, 'Brief 应记录 outcome ref');

// ── 6) Learning：真实反馈 → 政策证据（未来行为基础）──
// 先让默认会话有推理参与（hypotheses），纠正反馈才产生负 credit（模块确实参与才归因）
st.commit(w, { delta: { addHypothesis: '门槛是记忆的承重' }, event: { eventType: 'hypothesis.seed' }, sessionId: 'default' });
const fb = rt.recordFeedback(w, { value: 0.3, source: 'user-correct' }); // 与前面状态同一会话（默认）
assert.equal(fb.credit.status, 'resolved');
const fbOps = fb.credit.credits.find((c) => c.target === 'operators');
assert.ok(fbOps.delta < 0, `纠正 → 算子负 credit: ${fbOps.delta}`);
const goalCtx = cn.readCanonical(w).goal; // 与 recordFeedback 策略上下文一致
const weights = cr.policyWeights(w, { context: { taskType: 'human', goal: goalCtx, risk: 0.1, uncertainty: 0.5, failureType: 'decision_drift' } });
assert.ok(weights.operators < 0, `纠正反馈应压低 operators 权重（学习落点）: ${weights.operators}`);

console.log('PASS csl-brief（Fast→Brief→HRME/Reasoning→Brief→Writer→HumanEdit→Outcome→AuthorModel/Policy 全链）');
