// CSLA 真实 LLM 冒烟测试（opt-in，默认跳过；不进入常规 CI）。
// 运行：CSL_REAL_LLM=1 npm run test:csl-real
// 验证：真实 request → 真实 response → 非 mock → usage 可读 → runtime state 改变 → CLI 链路。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));
const { loadConfig } = await import(path.join(HERE, '..', 'src', 'config.js'));
const { makeLlm } = await import(path.join(HERE, '..', 'src', 'llm.js'));
const hrmr = await import(path.join(HERE, '..', 'src', 'csl', 'hrmr.js'));
const adapter = await import(path.join(HERE, '..', 'src', 'csl', 'adapter.js'));

if (process.env.CSL_REAL_LLM !== '1') {
  console.log('SKIP csl-real（真实 token 冒烟需显式开启: CSL_REAL_LLM=1 npm run test:csl-real）');
  process.exit(0);
}

const cfg = loadConfig();
assert.ok(cfg.apiKey, '需要真实 LLM 凭据（STYLOTRACE_LLM_API_KEY 或宿主自动发现）');
const llm = makeLlm(cfg);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-real-'));

const report = { provider: cfg.provider || 'openai', model: cfg.model, tests: [] };

// 真实 API 偶发慢响应/连接中断（kind=error 且状态安全）→ 有限重试；逻辑错误仍立即失败。
const runTurnRobust = async (w2, opts, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const r = await rt.runTurn(w2, opts);
    if (r.kind !== 'error') return r;
    if (i < tries - 1) await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return { kind: 'error', error: '真实 API 重试耗尽' };
};
const runTaskRobust = async (opts, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const r = await adapter.runTask(opts);
    if (r.kind !== 'error') return r;
    if (i < tries - 1) await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return { kind: 'error', error: '真实 API 重试耗尽' };
};

// TEST 0 — Fast 冒烟：真实请求 + usage 可读
const w0 = ws.ensureWorkspace(path.join(tmp, 'w0'), { create: true });
const before0 = st.readState(w0).sVersion;
const fast = await rt.runTurn(w0, { input: '今天天气不错', llm, sessionId: 'smoke0' });
assert.equal(fast.kind, 'fast', `应走快通道: ${fast.kind}`);
assert.ok(fast.reply && fast.reply.length > 0, '快答应为真实回复');
assert.ok(fast.usage.calls >= 1 && fast.usage.total_tokens > 0, `usage 可读: ${JSON.stringify(fast.usage)}`);
report.tests.push({
  name: 'fast-smoke',
  kind: fast.kind,
  action: 'fast',
  usage: fast.usage,
  stateBefore: before0,
  stateAfter: st.readState(w0).sVersion,
});

// TEST A — 小猪吃玉米（--deep 等价：forceDeep 走真实算子）
const wa = ws.ensureWorkspace(path.join(tmp, 'wa'), { create: true });
rt.acceptAnswer(wa, null, '小猪吃玉米', 'smokeA');
const stateBeforeA = st.readState(wa, 'smokeA').sVersion;
const a = await runTurnRobust(wa, { input: '小猪吃玉米。', llm, sessionId: 'smokeA', forceDeep: true });
assert.equal(a.kind, 'deep', `TEST A 应进深层: ${a.kind}`);
assert.ok(a.actionTrace.some((t) => t.action === 'abstract'), '应执行抽象算子');
assert.ok((a.hypotheses || []).length >= 1, 'LLM 应产出候选假设');
assert.ok(a.state.sVersion > stateBeforeA, `状态版本应前进: ${stateBeforeA} → ${a.state.sVersion}`);
assert.ok(a.usage.calls >= 4 && a.usage.total_tokens > 0, `用量可读: ${JSON.stringify(a.usage)}`);
report.tests.push({
  name: 'test-a-pig-corn',
  kind: a.kind,
  action: a.actionTrace.map((t) => t.action).join('→'),
  usage: a.usage,
  stateBefore: stateBeforeA,
  stateAfter: a.state.sVersion,
  hypotheses: (a.hypotheses || []).length,
});

// TEST B — 人机写作：Fast→AskHuman→answer→deep（Core Idea 而非整篇成稿）
const wb = ws.ensureWorkspace(path.join(tmp, 'wb'), { create: true });
const b1 = await rt.runTurn(wb, { input: '我觉得现在 AI 写作太同质化了', llm, sessionId: 'smokeB' });
assert.equal(b1.kind, 'ask', `TEST B 第一轮应为 Fast→AskHuman: ${b1.kind}`);
rt.acceptAnswer(wb, null, '问题在思想：AI 太快开始写，没有先想清楚要说什么', 'smokeB');
const b2 = await runTurnRobust(wb, { input: '我觉得现在 AI 写作太同质化了', llm, sessionId: 'smokeB' });
assert.equal(b2.kind, 'deep', `回答后应进深层: ${b2.kind}`);
assert.ok(b2.state.coreIdea.includes('思想'), 'Core Idea 必须进入状态');
assert.ok(b2.state.coreIdea.length < 100, 'Core Idea 是用户回答的提炼，不是整篇成稿');
report.tests.push({
  name: 'test-b-human-writing',
  firstKind: b1.kind,
  question: b1.question,
  secondKind: b2.kind,
  action: b2.actionTrace.map((t) => t.action).join('→'),
  usage: b2.usage,
  coreIdea: b2.state.coreIdea.slice(0, 50),
  stateBefore: 0,
  stateAfter: b2.state.sVersion,
});

// TEST C — 状态可续：下一轮能读到上一次更新（hypotheses 已入状态）
const c1 = await rt.runTurn(wb, { input: '继续这个话题', llm, sessionId: 'smokeB' });
assert.ok(c1.state.sVersion >= b2.state.sVersion, '状态版本单调');
report.tests.push({ name: 'test-c-state-continuation', stateAfter: c1.state.sVersion });

// TEST D（Phase 2 T10）— 真实 LLM：Prediction → Action → RealOutcome → Counterfactual Credit
const wd = ws.ensureWorkspace(path.join(tmp, 'wd'), { create: true });
rt.acceptAnswer(wd, null, 'AI 写作同质化的根源在思想深度', 'smokeD');
const d1 = await runTurnRobust(wd, { input: '为什么 AI 写作容易同质化', llm, sessionId: 'smokeD', feedback: 0.8 });
assert.equal(d1.kind, 'deep');
assert.equal(d1.outcomePending, false, '真实反馈应记录 outcome');
assert.equal(d1.credit.status, 'low_confidence', 'runtime 自评低置信');
assert.equal(d1.credit.credits[0].method, 'explicit_counterfactual', 'credit 必须显式反事实');
const cfRun = d1.credit.credits.find((c) => c.target === 'operators');
assert.ok(typeof cfRun.delta === 'number', '算子 delta 可读');
// 直接人类反馈 → 高置信 → 真实政策证据更新
const fbD = rt.recordFeedback(wd, { value: 0.9, sessionId: 'smokeD', source: 'user-confirm' });
assert.equal(fbD.credit.status, 'resolved');
assert.ok(fbD.applied.length >= 1, '真实反馈应产生政策更新（credit→行为基础）');
const outcomesLog = fs.readFileSync(path.join(wd, 'protocol', 'csl-outcomes.jsonl'), 'utf8');
assert.ok(outcomesLog.includes('smokeD'), 'OutcomeStore 应含真实 outcome');
const canonEvt = fs.readFileSync(path.join(wd, 'protocol', 'csl-canonical-events.jsonl'), 'utf8');
assert.ok(canonEvt.includes('OutcomeError'), '误差事件应入统一事件流');
report.tests.push({
  name: 'test-d-real-credit',
  kind: d1.kind,
  action: d1.actionTrace.map((t) => t.action).join('→'),
  usage: d1.usage,
  creditStatus: d1.credit.status,
  cfMethod: d1.credit.credits[0].method,
  policyApplied: fbD.applied.length,
});

// TEST E（Phase 3A）— 真实 LLM Golden Cognitive Test：小猪吃玉米
const we = ws.ensureWorkspace(path.join(tmp, 'we'), { create: true });
for (const [t, g] of [['小猪吃玉米', 's1'], ['小猪吃粮食', 's2'], ['牛吃玉米', 's3'], ['羊吃粮食', 's4']]) {
  hrmr.addEpisode(we, { text: t, outcome: 1, goal: g });
}
const g = await rt.goldenCognition(we, { input: '小猪吃玉米。', llm, sessionId: 'smokeE' });
assert.ok(g.relations.length >= 1, 'golden relations');
assert.ok(g.entities.length >= 2, 'golden entities');
assert.ok(g.hypotheses.length >= 1, 'golden hypotheses（真实 LLM）');
assert.ok(g.schema && g.schema.relationText.includes('mammal'), 'golden schema');
assert.ok(g.stateVersionAfter > g.stateVersionBefore, 'golden 状态版本前进');
report.tests.push({
  name: 'test-e-golden-pig',
  trace: g.trace.map((t) => t.action).join('→'),
  schema: g.schema?.relationText,
  confidence: g.confidence,
  hypotheses: g.hypotheses.length,
  stateVersion: [g.stateVersionBefore, g.stateVersionAfter],
});

// TEST F（Phase 3）— 真实 LLM 统一入口：CLI 通道 ask → checkpoint 恢复 deep → MCP 通道共享会话
const wf = ws.ensureWorkspace(path.join(tmp, 'wf'), { create: true });
const taskF = '我想写一篇关于故乡门槛的散文，核心是记忆';
const f1 = await runTaskRobust({ workspace: wf, sessionId: 'smokeF', input: taskF, channel: 'cli', mode: 'auto', llm });
assert.ok(f1.kind === 'ask' || f1.kind === 'deep', `CLI 通道应 Fast→Ask: ${f1.kind}`);
const f2 = await (async () => {
  for (let i = 0; i < 3; i++) {
    const r = await adapter.answerCheckpoint(wf, { sessionId: 'smokeF', answer: '门槛是外婆家的旧木门槛，被磨矮了', input: taskF, llm });
    if (r.kind !== 'error') return r;
    await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
  }
  return { kind: 'error', error: '真实 API 重试耗尽' };
})();
assert.equal(f2.kind, 'deep', `回答后应恢复深层: ${f2.kind}`);
const f3 = await adapter.runTask({ workspace: wf, sessionId: 'smokeF', input: taskF, channel: 'mcp', mode: 'auto', llm });
assert.ok(f3.stateVersion >= f2.stateVersion, 'MCP 通道应共享同一会话状态');
assert.ok(f3.state.coreIdea.includes('门槛'), '跨通道 coreIdea 可见');
report.tests.push({
  name: 'test-f-adapter-channels',
  cliKind: f1.kind,
  resumeKind: f2.kind,
  mcpKind: f3.kind,
  stateVersion: [f1.stateVersion, f3.stateVersion],
  coreIdeaShared: Boolean(f3.state.coreIdea),
});

const outPath = path.join(tmp, 'csl-real-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\n真实冒烟通过（结果 → ${outPath}）`);
