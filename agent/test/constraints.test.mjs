// success_definition→可验证约束测试：解析、注入文本、交付检查、近似计数。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const {
  parseConstraints,
  constraintBrief,
  countConcreteEvidence,
  checkConstraints,
} = await import(path.join(HERE, '..', 'src', 'constraints.js'));

// 1. 解析：3 个具体案例
const c1 = parseConstraints({
  intent: { coreNeed: '用3个具体案例说服读者减少塑料使用' },
  confirmed: { stance: '减少塑料使用' },
});
assert.equal(c1.minConcreteExamples, 3);
assert.equal(c1.persuasionTarget, '减少塑料使用');

// 2. 中文数字 + 引文
assert.equal(parseConstraints({ confirmed: { stance: '至少两处引文支撑观点' } }).minCitations, 2);
// 3. 数据点
assert.equal(parseConstraints({ confirmed: { stance: '给出5个数据说明趋势' } }).minDataPoints, 5);
// 4. 无约束 → 空
assert.deepEqual(parseConstraints({}), { minConcreteExamples: 0, minCitations: 0, minDataPoints: 0, persuasionTarget: '', raw: [] });
assert.equal(constraintBrief({}), '');

// 5. 注入文本
const brief = constraintBrief({ intent: { coreNeed: '用3个具体案例说服读者' }, confirmed: {} });
assert.ok(brief.includes('成功标准'));
assert.ok(brief.includes('3 个具体案例'));

// 6. 近似计数：引号引语 + 数字单位
const draft = '他说：“这件事必须改”。2023年有 5 万人参与，比例从 10% 升到 30%。';
const ev = countConcreteEvidence(draft, []);
assert.ok(ev.quotedLines >= 1);
assert.ok(ev.dataPoints >= 2);

// 7. 交付检查：不达标 → missing；达标 → met
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stylotrace-cons-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
fs.writeFileSync(path.join(w, 'draft.md'), '这是没有证据的干巴巴段落。');
const miss = checkConstraints(w, { intent: { coreNeed: '用3个具体案例说服读者' } });
assert.ok(miss.missing.length >= 1);
assert.equal(miss.met, false);
fs.writeFileSync(
  path.join(w, 'draft.md'),
  '例如：“案例一”说清了事实。2020年有 3 万人参与，占 15%。又如“案例二”和“案例三”。',
);
const ok = checkConstraints(w, { intent: { coreNeed: '用3个具体案例说服读者' } });
assert.equal(ok.met, true);

console.log('PASS success_definition→可验证约束（解析/注入/计数/检查）');
