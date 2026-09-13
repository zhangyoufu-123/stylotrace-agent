// InnovationElicitor failure-case 测试。
// F1 空状态仍返回问题；F2 完备状态返回 null；F3 确定性。
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { pickQuestion, captureCoreIdea } = await import(path.join(HERE, '..', 'src', 'csl', 'elicit.js'));

// F1: 空状态 → 有效问题
const q1 = pickQuestion({});
assert.ok(q1 && q1.question && q1.type === 'clarify');

// 有 coreIdea 无假设 → differentiate/why
const q2 = pickQuestion({ coreIdea: '故乡的门槛' });
assert.ok(['differentiate', 'why'].includes(q2.type));

// F2: 完备状态 → null（不追问）
const full = { coreIdea: 'x', hypotheses: ['h'], evidence: ['e'], decisions: ['d'] };
assert.equal(pickQuestion(full), null);

// F3: 确定性
assert.deepEqual(pickQuestion({ coreIdea: 'x', hypotheses: ['h'] }), pickQuestion({ coreIdea: 'x', hypotheses: ['h'] }));

// captureCoreIdea 拒绝空回答
assert.throws(() => captureCoreIdea({}, ''), /non-empty/);

console.log('PASS csl-elicit（F1 不卡死 / F2 不追问 / F3 确定性）');
