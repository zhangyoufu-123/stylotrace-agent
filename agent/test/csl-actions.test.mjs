// Action-driven execution 验收（A1–A6 + F5 确定性）。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ac = await import(path.join(HERE, '..', 'src', 'csl', 'actions.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-actions-'));
const wSep = ws.ensureWorkspace(path.join(tmp, 'sep'), { create: true });

// A1: 选 search 只执行 search（事件/stateDelta 只含 search，不偷偷跑 generate/plan/verify）
const a1 = await ac.dispatch('search', { coreIdea: 'x', hypotheses: ['h'] }, {});
assert.deepEqual(a1.events.map((e) => e.event_type), ['search']);
assert.ok('evidence' in a1.stateDelta);
assert.ok(!('artifact' in a1.stateDelta) && !('taskComplete' in a1.stateDelta), 'search 不得偷偷生成');
assert.equal(a1.stateDelta.evidence[0].pending, true, '离线 search 证据应标记 pending（不伪造事实）');

// A2: 不同认知状态 → 不同动作轨迹（Policy→Behavior）
const t1 = await ac.runCognitiveLoop({ coreIdea: 'x' }, {}, { maxSteps: 6 });
const t2 = await ac.runCognitiveLoop({ coreIdea: 'x', hypotheses: ['h'] }, {}, { maxSteps: 6 });
const t3 = await ac.runCognitiveLoop({ coreIdea: 'x', hypotheses: ['h'], evidence: ['e'] }, {}, { maxSteps: 6 });
const acts1 = t1.trace.map((s) => s.action);
const acts2 = t2.trace.map((s) => s.action);
const acts3 = t3.trace.map((s) => s.action);
assert.ok(acts1[0] === 'abstract', `无假设应 abstract：${acts1}`);
assert.ok(acts2[0] === 'search', `有假设无证据应 search：${acts2}`);
assert.ok(acts3[0] === 'generate', `就绪应 generate：${acts3}`);
assert.notDeepEqual(acts1, acts2, '不同状态应走不同路径');

// A3: 重规划（一个状态需要多步：abstract→search→generate→stop）
assert.ok(t1.trace.length >= 2, `应从核心想法多步重规划：${t1.trace.map((s) => s.action)}`);

// A4: taskComplete 后必须 stop（不为"完整流程"继续跑）
const t4 = await ac.runCognitiveLoop({ coreIdea: 'x', hypotheses: ['h'], evidence: ['e'], taskComplete: true }, {}, { maxSteps: 4 });
assert.equal(t4.trace[t4.trace.length - 1].action, 'stop', '完成状态应停');

// A5: Native Escape——LLM 提出 native_reasoning，价值提升后可选且可执行
const chosen = ac.selectAction({ coreIdea: 'x' }, { proposed: { action: 'native_reasoning', expectedGain: 2.0 } });
assert.equal(chosen.action, 'native_reasoning', 'LLM 提议应能改变选择');
const nv = await ac.dispatch('native_reasoning', { coreIdea: 'x' }, { llm: null });
assert.equal(nv.action, 'native_reasoning');
assert.ok('nativeResult' in nv.stateDelta);

// F5: 确定性——同一状态同一输入 → 同一轨迹
const d1 = await ac.runCognitiveLoop({ coreIdea: 'x' }, {}, { maxSteps: 6 });
const d2 = await ac.runCognitiveLoop({ coreIdea: 'x' }, {}, { maxSteps: 6 });
assert.deepEqual(d1.trace, d2.trace);

// 认知剧场（Cognitive Theater）：选中 askHuman 不得偷偷成稿；compare 不得偷偷检索；stop 后不再调用 LLM
const ask1 = await ac.dispatch('askHuman', {}, {});
assert.ok(!('artifact' in ask1.stateDelta) && !('taskComplete' in ask1.stateDelta), 'askHuman 不得成稿');
const cmp1 = await ac.dispatch('compare', { hypotheses: ['a', 'b'] }, {});
assert.ok(!('evidence' in cmp1.stateDelta), 'compare 不得偷偷执行 search');

let llmCalls = 0;
const countingLlm = async () => { llmCalls += 1; return 'mock'; };
const stopLoop = await ac.runCognitiveLoop({ coreIdea: 'x', hypotheses: ['h'], evidence: ['e'], taskComplete: true }, { llm: countingLlm }, { maxSteps: 4 });
assert.equal(stopLoop.trace[stopLoop.trace.length - 1].action, 'stop');
const callsAtStop = llmCalls;
// stop 后不能再有 LLM 调用（trace 到此结束；若再跑一步会调用语言层之外的算子）
assert.equal(stopLoop.trace.length, 1, `stop 应只走一步：${stopLoop.trace.map((t) => t.action)}`);
assert.equal(callsAtStop, 0, 'stop 路径不应触发 LLM');

// usage 聚合：abstract 走 3 个真实算子（llm.run 计数），trace/总量可读
const usageLlm = { run: async () => ({ output: '候选', usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 }, latencyMs: 11, model: 'm', provider: 'openai' }) };
const uLoop = await ac.runCognitiveLoop({ coreIdea: 'x' }, { llm: usageLlm }, { maxSteps: 3 });
assert.ok(uLoop.usage.calls >= 3, `abstract 应调用 3 个算子：calls=${uLoop.usage.calls}`);
assert.ok(uLoop.usage.total_tokens >= 24, `用量应聚合：${uLoop.usage.total_tokens}`);

// A6: Fast/Deep 分离——闲聊走快，深层不阻塞前台
const f = await rt.runTurn({}, { input: '今天天气不错' }).catch(() => null);
// runTurn 需要 workspace；这里用 fastSalience 验证门槛即可
assert.ok(rt.fastSalience('今天天气不错').p_deep < rt.DEEP_TAU, '闲聊 p_deep 应低于阈值');
assert.ok(rt.fastSalience("我想写一篇关于故乡的散文，核心是门槛").p_deep >= rt.DEEP_TAU, '写作意图应进深层');

// 第 17 节：浅层不被深层吞掉——10 次闲聊 0 次深层算子调用；复杂任务 ≥3 次
let deepCalls = 0;
const sepLlm = Object.assign(async () => '好', {
  run: async () => {
    deepCalls += 1;
    return { output: '候选', usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }, latencyMs: 1, model: 'm', provider: 'openai' };
  },
});
for (const c of ['今天天气不错', '哈哈', '好的', '嗯嗯', '随便聊聊', '天气', '吃饭了吗', '在吗', '嗯', '哦']) {
  await rt.runTurn(wSep, { input: c, llm: sepLlm });
}
assert.equal(deepCalls, 0, `10 次闲聊不得触发深层算子: ${deepCalls}`);
rt.acceptAnswer(wSep, null, '写一篇关于故乡门槛的散文');
const beforeDeep = deepCalls;
await rt.runTurn(wSep, { input: '我想写一篇关于故乡的散文，核心是门槛', llm: sepLlm });
assert.ok(deepCalls - beforeDeep >= 3, `复杂任务应触发 ≥3 次深层算子: ${deepCalls - beforeDeep}`);

console.log('PASS csl-actions（A1 只执行所选 / A2 状态→路径 / A3 重规划 / A4 stop / A5 原生escape / A6 快深分离 + F5）');
