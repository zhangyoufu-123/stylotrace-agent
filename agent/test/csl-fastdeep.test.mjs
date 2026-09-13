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

// L1：q* 去重复惩罚——同一问题类型被问过越多分越低
const i = rt.newInteractionState();
const q1 = rt.chooseQuestion({ coreIdea: 'x', hypotheses: ['h'] }, i);
const q2 = rt.chooseQuestion({ coreIdea: 'x', hypotheses: ['h'] }, i);
assert.ok(q1 && q2 && q2.score < q1.score, `重复应压低分数：${q1.score} > ${q2.score}`);
assert.ok(i.askedTypes[q1.type] === 2);

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
