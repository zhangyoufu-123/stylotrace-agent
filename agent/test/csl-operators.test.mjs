// LLMOperatorPool + ContextRouter failure-case 测试。
// F1 未知 operator 回退；F2 超预算裁剪；F3 确定性。
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const op = await import(path.join(HERE, '..', 'src', 'csl', 'operators.js'));

const state = {
  goal: '写一篇散文',
  coreIdea: '故乡的门槛被磨矮了',
  hypotheses: ['门槛代表记忆的磨损'],
  evidence: ['祖母养过红鲤'],
  questions: ['为什么非说不可'],
  decisions: ['留白结尾'],
};

// F1: 未知 operator 回退到默认（divergent），不崩溃
const b = op.buildContextBundle(state, 'unknown_op');
assert.equal(b.operator, 'unknown_op');
assert.ok(b.state.coreIdea);

// 不同 operator 看到不同字段
const skeptic = op.buildContextBundle(state, 'skeptic');
assert.ok(skeptic.state.hypotheses);
assert.equal(skeptic.state.questions, undefined);

// F2: 超预算 → 裁剪到只保留 goal + coreIdea 截断
const tiny = op.buildContextBundle(state, 'analyst', { budget: 40 });
const size = JSON.stringify(tiny).length;
assert.ok(size <= 400, `裁剪后应显著小于原始（${size}）`);
assert.ok(!tiny.state.hypotheses);

// F3: 确定性
assert.deepEqual(
  op.buildContextBundle(state, 'skeptic'),
  op.buildContextBundle(state, 'skeptic'),
);

// selectOperators 覆盖任务类型
assert.deepEqual(op.selectOperators('research'), ['researcher', 'analyst', 'skeptic']);
assert.deepEqual(op.selectOperators('weird'), op.selectOperators('creative'));

console.log('PASS csl-operators（F1 回退 / F2 裁剪 / F3 确定性）');
