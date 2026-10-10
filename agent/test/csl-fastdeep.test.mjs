// Fast–Deep Cognitive Runtime 重构验证：I_t / q* 去重 / ChooseHowToThink / Checkpoint。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-fastdeep-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// L1：q* 去重复惩罚——同一问题类型被问过，就该被别的类型顶掉（而不只是分数变低）
// 旧断言写的是 `askedTypes[q1.type] === 2`，那正是"ρ 只改显示分数、改不了选择"这个 bug 的化石：
// 系统会把同一类问题反复问，只是分数一路走低。2026-10 修正后 ρ 参与全候选排序。
const i = rt.newInteractionState();
const q1 = rt.chooseQuestion({ coreIdea: 'x', hypotheses: ['h'] }, i);
assert.ok(q1 && i.askedTypes[q1.type] === 1);
const q2 = rt.chooseQuestion({ coreIdea: 'x', hypotheses: ['h'] }, i);
assert.ok(q2, '第二次仍要给出问题（不许卡死）');
assert.notEqual(q2.type, q1.type, `同类问过之后必须换一类，而不是继续问 ${q1.type}`);
assert.ok(i.askedTypes[q1.type] === 1 && i.askedTypes[q2.type] === 1);
// 关掉 ρ 时，第一问仍然是同一类 → 证明换类确实来自重复惩罚
const noPenalty = rt.chooseQuestion({ coreIdea: 'x', hypotheses: ['h'] }, { askedTypes: {} }, { rho: 0 });
assert.equal(noPenalty.type, q1.type);

// L3：ChooseHowToThink 按状态缺口选动作
assert.equal(rt.chooseCognitiveAction({}).action, 'askHuman');
assert.equal(rt.chooseCognitiveAction({ coreIdea: 'x' }).action, 'abstract');
assert.equal(rt.chooseCognitiveAction({ coreIdea: 'x', hypotheses: ['h'] }).action, 'search');
assert.equal(rt.chooseCognitiveAction({ coreIdea: 'x', hypotheses: ['h'], evidence: ['e'], uncertainty: 0.8 }).action, 'counterexample');
assert.equal(rt.chooseCognitiveAction({ coreIdea: 'x', hypotheses: ['h'], evidence: ['e'] }).action, 'generate');

// Deep→Human Checkpoint：两假设无证据 → 信号；单假设 → null
const cp = rt.maybeCheckpoint({ hypotheses: ['a', 'b'], evidence: [] });
assert.ok(cp && cp.needHumanInput === true && cp.expectedInformationGain > 0);
assert.equal(rt.maybeCheckpoint({ hypotheses: ['a'], evidence: [] }), null);

// 集成：深层结果带 cognitiveAction 与 checkpoint 信号，不破坏默认 deep 流程
const s1 = rt.acceptAnswer(w, null, '故乡的门槛被磨矮了');
const deep = await rt.runTurn(w, {
  input: "把'故乡的门槛被磨矮了'这个核心观点展开成一段散文，要有我的克制留白风格",
  state: s1,
});
assert.equal(deep.kind, 'deep');
assert.ok(typeof deep.cognitiveAction === 'string' && deep.cognitiveAction, '深层应带认知动作');
assert.ok(Array.isArray(deep.actionTrace) && deep.actionTrace.length >= 1, '应记录动作轨迹');
assert.ok('checkpoint' in deep, '深层应暴露 checkpoint 信号');
assert.ok(deep.candidates.length >= 2 && deep.hypotheses.length >= 2);

console.log('PASS csl-fastdeep（I_t/q*去重/ChooseHowToThink/Checkpoint 信号/集成不破坏）');
