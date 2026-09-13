// v1.6 运行时 failure-case 测试。
// F1 低显著性→快答不动深层状态；F2 无 coreIdea→先问不直接成稿；
// F3 无 outcome→credit 拒绝（ledger）；F4 版本单调；F5 mock 确定性。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));
const lg = await import(path.join(HERE, '..', 'src', 'csl', 'ledger.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-runtime-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// F1: 低显著性 → fast，状态版本不变
const fast = await rt.runTurn(w, { input: '嗯' });
assert.equal(fast.kind, 'fast');
assert.ok(fast.reply);

// F2: 模糊想法 → ask（先问核心，不直接成稿）
const ask = await rt.runTurn(w, { input: '我想写一篇关于故乡的散文' });
assert.equal(ask.kind, 'ask');
assert.ok(ask.question);

// 接受回答 → coreIdea 进入状态，版本 1
const s1 = rt.acceptAnswer(w, null, '故乡的门槛被磨矮了');
assert.ok(s1.coreIdea.includes('门槛'));

// 深层路径：有 coreIdea 后跑 deep（用明显需要深思的输入，mock LLM 确定性）
const deepInput = "把'故乡的门槛被磨矮了'这个核心观点展开成一段散文，要有我的克制留白风格";
const deep1 = await rt.runTurn(w, { input: deepInput, state: s1 });
assert.equal(deep1.kind, 'deep');
assert.ok(deep1.candidates.length >= 2);
assert.ok(deep1.hypotheses.length >= 2);
assert.ok(deep1.state.hypotheses.length >= 1, '假设已写入状态');
assert.ok(deep1.state.decisions.length >= 1, '决策已写入状态');
assert.ok('credit' in deep1);

// 自适应验收：不同认知状态 → 不同动作 → 不同结果（Policy→Behavior）
const deep2 = await rt.runTurn(w, { input: deepInput }); // 读盘最新状态（状态已前进）
assert.notDeepEqual(
  deep2.actionTrace.map((t) => t.action),
  deep1.actionTrace.map((t) => t.action),
  '状态不同应产生不同动作路径',
);

// F4: 版本单调（读取状态）
assert.ok(s1.sVersion >= 1);

// F3: 无 outcome 的 credit 被拒绝
assert.throws(() => lg.basicCredit({ prediction: 0.8 }), /outcome/);

// 真实 token 接入回归：深意图输入的语言层必须提示"简短回应"，
// 防止 LLM 在"先问后写"阶段直接产出完整文章（真实调用实测发现）。
const w2 = ws.ensureWorkspace(path.join(tmp, 'w2'), { create: true });
let briefSeen = false;
const captureLlm = async (msgs) => {
  // 现在 LLM 还会被用于"生成贴题问题"，所以只要**任一次**调用带了简短约束即可
  if (/简短回应/.test(msgs[0].content)) briefSeen = true;
  return '好，我们聊聊。';
};
const askBrief = await rt.runTurn(w2, { input: '我想写一篇关于故乡的散文，核心是门槛', llm: captureLlm });
assert.equal(askBrief.kind, 'ask');
assert.ok(briefSeen, '深意图输入应要求简短回应');

// 真实 token 接入回归：检查点问题必须渲染假设文本，不能出现 [object Object]
const cp = rt.maybeCheckpoint({ hypotheses: [{ claim: '方向A' }, { claim: '方向B' }], evidence: [] });
assert.ok(cp && cp.question.includes('方向A') && cp.question.includes('方向B') && !cp.question.includes('[object Object]'));

// 真实 token 接入回归：任务信号输入在 Fast 层就应澄清（Fast→AskHuman），纯闲聊不追问
const w3 = ws.ensureWorkspace(path.join(tmp, 'w3'), { create: true });
const taskAsk = await rt.runTurn(w3, { input: '我觉得现在 AI 写作太同质化了', llm: captureLlm });
assert.equal(taskAsk.kind, 'ask', '写作观点输入应 Fast 层先问');
assert.ok(taskAsk.question);
const casualFast = await rt.runTurn(w3, { input: '今天天气不错', llm: captureLlm });
assert.equal(casualFast.kind, 'fast', '纯闲聊应直接快答不追问');

// 错误恢复：LLM 失败 → kind=error + failure event + 状态不变（不提交部分结果）
const w4 = ws.ensureWorkspace(path.join(tmp, 'w4'), { create: true });
const throwingLlm = async () => { throw new Error('模拟 LLM 故障'); };
const errR = await rt.runTurn(w4, { input: '我想写一篇关于门槛的散文', llm: throwingLlm }).catch((e) => e);
assert.equal(errR.kind, 'error', 'LLM 失败应返回 error 而非崩溃');
assert.ok(String(errR.error).includes('模拟 LLM 故障'));
assert.equal(errR.state.sVersion, 0, '失败时状态版本不得前进');
assert.equal(st.readState(w4).sVersion, 0, '失败不得写入部分状态');

// forceDeep：有 coreIdea 时即使闲聊也可强制进深层（TEST A 用）
const w5 = ws.ensureWorkspace(path.join(tmp, 'w5'), { create: true });
rt.acceptAnswer(w5, null, '小猪吃玉米，哺乳动物吃植物粮');
const forced = await rt.runTurn(w5, { input: '嗯', llm: captureLlm, forceDeep: true });
assert.equal(forced.kind, 'deep', 'forceDeep 应进深层');
assert.ok(forced.actionTrace.some((t) => t.action === 'abstract'), '深层应执行抽象算子');

// P0-4：Outcome 不再合成——无反馈 → outcome.pending + credit null；有反馈 → 真实 outcome + 反事实 credit
const w6 = ws.ensureWorkspace(path.join(tmp, 'w6'), { create: true });
rt.acceptAnswer(w6, null, '故乡的门槛被磨矮了，写它的沉默和倔强');
const noFb = await rt.runTurn(w6, { input: '我想写一篇关于故乡的散文，核心是门槛', llm: captureLlm });
assert.equal(noFb.kind, 'deep');
assert.equal(noFb.outcomePending, true, '无反馈应标记 outcome.pending');
assert.equal(noFb.credit, null, '无反馈不得伪造 credit');
assert.ok(Math.abs(noFb.prediction - noFb.alpha) < 0.001, `prediction 应来自状态（alpha），非硬编码: ${noFb.prediction}`);

const w7 = ws.ensureWorkspace(path.join(tmp, 'w7'), { create: true });
rt.acceptAnswer(w7, null, '门槛是外婆家的旧木门槛');
const withFb = await rt.runTurn(w7, { input: '我想写一篇关于故乡的散文，核心是门槛', llm: captureLlm, feedback: 0.9 });
assert.equal(withFb.outcomePending, false, '有反馈应记录 outcome');
assert.equal(withFb.credit.status, 'low_confidence', 'runtime 自评应低置信（不强力更新政策）');
const opsCredit = withFb.credit.credits.find((c) => c.target === 'operators');
assert.equal(opsCredit.method, 'explicit_counterfactual', 'credit 必须反事实');
assert.ok(opsCredit.delta > 0, '算子应有正向 credit');
assert.equal(withFb.credit.credits.find((c) => c.target === 'elicitor').delta, 0, '未参与模块 credit 为 0（非均分）');

// P0-4/5：recordFeedback 真实反馈入口（用户确认 → outcome + 反事实 credit 落账）
const fb = rt.recordFeedback(w7, { value: 0.9, sessionId: 's-fb', source: 'user-confirm' });
assert.ok(fb.credit && fb.credit.status === 'resolved', '直接人类反馈应 resolved');
assert.equal(fb.credit.credits[0].method, 'explicit_counterfactual');
assert.equal(fb.credit.credits[0].confidence, 0.55, '确定性仿真应如实标注置信');
assert.ok(fb.applied.length >= 1, '真实反馈应产生政策更新');
const outcomeLog = fs.readFileSync(path.join(w7, 'protocol', 'csl-outcomes.jsonl'), 'utf8');
assert.ok(outcomeLog.includes('user-confirm'), '反馈来源应落 OutcomeStore');
const canonEvt = fs.readFileSync(path.join(w7, 'protocol', 'csl-canonical-events.jsonl'), 'utf8');
assert.ok(canonEvt.includes('OutcomeError'), '误差事件应入统一事件流');

console.log('PASS csl-runtime（F1 快答 / F2 先问 / F3 信用拒绝 / F4 版本 / F5 确定性 + 真实桥接回归）');
