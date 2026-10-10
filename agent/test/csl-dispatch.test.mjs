// Application Dispatcher 测试（规划文档 D1 的修复验收）。
// 核心不变量：**统一入口绝不把认知循环里拼出来的字符串当文章返回。**
// Failure cases：
//   F1 没有大纲就写 → executed=false + reason=no_outline，不抛异常、不调 LLM；
//   F2 有核心但无大纲 → 同上（不是 gate 拦截，是缺前置）；
//   F3 写作门拦截 → reason=writer_gate，原样上报原因；
//   F4 executor 未实现 → 明确报 executor_not_implemented，不伪装成功；
//   F5 内联动作（chat/ask）→ 不重复执行。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const d = await import(path.join(HERE, '..', 'src', 'csl', 'dispatch.js'));
const ad = await import(path.join(HERE, '..', 'src', 'csl', 'adapter.js'));
const actions = await import(path.join(HERE, '..', 'src', 'csl', 'actions.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-dispatch-'));
const mk = (n) => ws.ensureWorkspace(path.join(tmp, n), { create: true });

// ── F1 没有大纲就写 ──
const w1 = mk('no-outline');
const r1 = await d.dispatchApp(w1, { app: 'write', executor: 'write' });
assert.equal(r1.executed, false);
assert.equal(r1.reason, 'no_outline');
assert.equal(r1.nextAction, 'abstract', '缺大纲时的下一步是 abstract，不是硬写');

// ── F2 有核心但无大纲 ──
const w2 = mk('core-only');
const st2 = ws.readState(w2);
st2.coreIdea = '门槛是记忆的刻度';
ws.writeState(w2, st2);
const r2 = await d.dispatchApp(w2, { app: 'write', executor: 'write' });
assert.equal(r2.reason, 'no_outline', '有核心但没有大纲时仍不应开始写');

// ── F3 写作门拦截（有大纲、无核心）──
const w3 = mk('gate-blocked');
const st3 = ws.readState(w3);
st3.outline = { sections: [{ heading: '一、门槛', words: 300 }] };
ws.writeState(w3, st3);
const r3 = await d.dispatchApp(w3, { app: 'write', executor: 'write' });
assert.equal(r3.executed, false);
assert.equal(r3.reason, 'writer_gate', `应被写作门拦截，实际 ${r3.reason}`);

// ── F4 executor 未实现要明说 ──
const r4 = await d.dispatchApp(w3, { app: 'review', executor: 'redteam' });
assert.equal(r4.executed, false);
assert.equal(r4.reason, 'executor_not_implemented', '未实现的 executor 不许伪装成功');
assert.ok(d.EXECUTOR_STATUS.rag === 'not_implemented' && d.EXECUTOR_STATUS.deliver === 'not_implemented');

// ── F5 内联动作不重复执行 ──
const r5 = await d.dispatchApp(w3, { app: 'ask', executor: 'clarify' });
assert.equal(r5.reason, 'handled_inline');
assert.equal((await d.dispatchApp(w3, { app: 'chat', executor: 'chat' })).reason, 'handled_inline');

// ── 核心不变量：runTask 返回的 artifact 只能来自 executor ──
const w6 = mk('run');
const mockLlm = async () => '（mock）作者倾向从具体小事切进大观点。';
const out = await ad.runTask({ workspace: w6, sessionId: 'S', input: '我想写一篇关于故乡门槛的散文', channel: 'cli', llm: mockLlm });
assert.ok('executed' in out, 'runTask 必须报告有没有真的执行应用动作');
if (!out.executed.executed) {
  assert.equal(out.artifact, null, 'executor 没执行时不得返回任何"产物"');
}
assert.ok(!String(out.artifact || '').includes('。'), '产物不得是认知循环的拼接串');

// ── 对照：认知循环内部的 generate 仍然是拼接串，但它只作为内部状态 ──
const jt = { coreIdea: 'x', hypotheses: [{ claim: 'A' }, { claim: 'B' }] };
const inner = await actions.dispatch('generate', jt, {});
assert.equal(inner.result.artifact, 'A。B');
assert.notEqual(out.artifact, inner.result.artifact, '内部拼接串不得冒充产品产物');

console.log('PASS csl-dispatch（F1 缺大纲/F2 有核心无大纲/F3 写作门/F4 未实现明说/F5 内联 + 产物只来自 executor）');
