// 目的→风格调节测试：分类正确、brief 生成正确、无立场时为空。
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { detectPurpose, purposeStyleBrief, PURPOSE_KEYS } = await import(
  path.join(HERE, '..', 'src', 'purpose.js')
);

// 1. 分类正确
assert.equal(detectPurpose('写一篇说服大家减少塑料使用的文章'), 'persuade');
assert.equal(detectPurpose('想写一篇回忆外婆的随笔'), 'reflect');
assert.equal(detectPurpose('论文：论证跨主题作者识别的可行性'), 'academic');
assert.equal(detectPurpose('写一个关于老屋的故事'), 'narrate');
assert.equal(detectPurpose('这份报告要向领导汇报项目进展'), 'inform');
assert.equal(detectPurpose('随便写点什么'), 'generic');

// 2. brief：有立场时非空且带类别说明
const b = purposeStyleBrief({ confirmed: { stance: '想说服大家少用塑料' } });
assert.ok(b.includes('写作目的'));
assert.ok(b.includes('说服'));

// 3. 无立场/无法判定时为空（不干扰默认写法）
assert.equal(purposeStyleBrief({}), '');
assert.equal(purposeStyleBrief({ confirmed: {} }), '');

// 4. 关键词枚举完整
assert.deepEqual(PURPOSE_KEYS, ['persuade', 'reflect', 'academic', 'narrate', 'inform']);

console.log('PASS 目的→风格调节（分类/brief/空值/枚举）');
