// 并发工具验收：保序、并发上限真的生效、错误能传出来、不留悬空 rejection。
// 这几条任何一条不成立，都会变成"看着更快、实际偷偷出错"。
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { mapLimit } = await import(path.join(HERE, '..', 'src', 'concurrency.js'));

let passed = 0;
const ok = (n) => {
  passed += 1;
  console.log(`✓ ${n}`);
};

// 1) 保序
const order = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
  await new Promise((r) => setTimeout(r, (7 - n) * 5)); // 故意让后面的先完成
  return n * 10;
});
assert.deepEqual(order, [10, 20, 30, 40, 50, 60], '结果必须与输入同序，不受完成先后影响');
ok('保序返回');

// 2) 并发上限真的生效，且不低效
let peak = 0;
let cur = 0;
await mapLimit(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
  cur += 1;
  peak = Math.max(peak, cur);
  await new Promise((r) => setTimeout(r, 15));
  cur -= 1;
});
assert.equal(peak, 3, `并发峰值应恰为 3（实际 ${peak}）`);
ok('并发上限生效');

// 3) limit 大于任务数时不报错
assert.deepEqual(await mapLimit([1, 2], 8, async (n) => n + 1), [2, 3]);
ok('limit 超过任务数不报错');

// 4) 空数组
assert.deepEqual(await mapLimit([], 4, async () => 1), []);
ok('空输入返回空');

// 5) 错误照常抛出（不能吞）
let threw = '';
try {
  await mapLimit([1, 2, 3], 2, async (n) => {
    if (n === 2) throw new Error('boom');
    return n;
  });
} catch (e) {
  threw = e.message;
}
assert.equal(threw, 'boom', '第一个错误必须抛出去，不能被并发掩盖');
ok('错误正常传播');

// 6) 失败后不留悬空 rejection，也不卡住
const t0 = Date.now();
await mapLimit([1, 2, 3, 4], 2, async (n) => {
  if (n === 1) throw new Error('early');
  await new Promise((r) => setTimeout(r, 40));
  return n;
}).catch(() => {});
assert.ok(Date.now() - t0 < 400, '失败后应尽快收敛，不能挂死');
ok('失败后及时收敛');

console.log(`\nconcurrency.test.mjs 全部通过 (${passed} 项)`);
