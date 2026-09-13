// P0 端到端集成链（离线/mock）：User → Fast → SharedState → CSLA → Director → Writer → Outcome/Credit。
// 验证 Cognitive Theater 消除：CoreIdea=∅ → Writer 被阻塞；确认后 → Writer 放行；
// outcome 来自真实 feedback，credit 为反事实。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));
const cn = await import(path.join(HERE, '..', 'src', 'csl', 'canonical.js'));
const { writeSection } = await import(path.join(HERE, '..', 'src', 'write.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-integration-'));
const mockLlm = async () => '（mock）好，我们聊聊。';

// ── Part A：User→Fast→SharedState→CSLA 链 ──
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
// 模糊想法 → Fast 层先问（无 coreIdea）
const a1 = await rt.runTurn(w, { input: '我觉得 AI 写作越来越同质化', llm: mockLlm });
assert.equal(a1.kind, 'ask', '模糊想法应 Fast→AskHuman');
// 用户回答 → 共享状态更新
rt.acceptAnswer(w, null, '问题在思想：AI 太快开始写');
const a2 = await rt.runTurn(w, { input: '我觉得 AI 写作越来越同质化', llm: mockLlm });
assert.equal(a2.kind, 'deep', '回答后应进深层');
assert.ok(cn.readCanonical(w).coreIdeaConfirmed, 'Core Idea 应入规范状态');
assert.ok(a2.actionTrace.some((t) => t.action === 'abstract'), '深层应执行抽象');
// Reality Audit：search 动作必须真实执行（排队宿主代检），不是占位字符串
const requestsLog = fs.existsSync(path.join(w, 'protocol', 'requests.jsonl'))
  ? fs.readFileSync(path.join(w, 'protocol', 'requests.jsonl'), 'utf8')
  : '';
assert.ok(requestsLog.includes('csl-search'), 'search 应真实排队检索请求');

// ── Part B：认知决策（Director 主门）──
const wEmpty = ws.ensureWorkspace(path.join(tmp, 'empty'), { create: true });
assert.equal(rt.cognitiveDecision(wEmpty, { input: '写点什么' }).action, 'askHuman', '无核心 → askHuman');
assert.equal(rt.cognitiveDecision(w, { input: '继续' }).coreIdeaConfirmed, true, '有核心 → 非 askHuman');

// ── Part C：Writer 服从认知状态（Cognitive Theater 消除）──
const wNoCore = ws.ensureWorkspace(path.join(tmp, 'nocore'), { create: true });
const ps = ws.readState(wNoCore);
ps.outline = { title: '', sections: [{ heading: '一', function: '引入', thesis: '门槛', words: 20, keyPoints: [] }] };
ws.writeState(wNoCore, ps);
await assert.rejects(
  () => writeSection({ baseUrl: 'https://fake', model: 'm' }, wNoCore, {}),
  /核心想法（Core Idea 缺失）/,
  '无 Core Idea 时 Writer 必须被阻塞',
);

// 有 Core Idea（经规范提交）→ Writer 放行（fetch stub 离线跑通）
const oldFetch = globalThis.fetch;
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    id: 'req_int',
    model: 'm',
    choices: [{ message: { content: '（mock 段落）故乡的门槛被磨矮了，像一句没说完的话。' } }],
    usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
  }),
});
try {
  cn.commitDelta(wNoCore, { delta: { coreIdea: '故乡的门槛被磨矮了' }, eventType: 'core_idea.set' });
  const wr = await writeSection({ baseUrl: 'https://fake', model: 'm' }, wNoCore, {});
  assert.ok(wr && wr.draftFile && wr.sections >= 1, '确认核心后 Writer 应放行');
  assert.ok(fs.existsSync(path.join(wNoCore, 'draft.md')), '应产出草稿');
} finally {
  globalThis.fetch = oldFetch;
}

// ── Part D：真实反馈 → 反事实 Credit（非均分）──
const fb = rt.recordFeedback(w, { value: 0.9, source: 'user-confirm' }); // 与前面 runTurn 同一会话
assert.equal(fb.credit.status, 'resolved');
const fbOps = fb.credit.credits.find((c) => c.target === 'operators');
const fbEli = fb.credit.credits.find((c) => c.target === 'elicitor');
assert.ok(fbOps.delta > 0 && fbEli.delta === 0, 'credit 非均分');

console.log('PASS csl-integration（User→Fast→State→CSLA→Director→Writer→Outcome/Credit 全链）');
