// 有并发上限的 map。
//
// 为什么需要它：好几处工作天然互不依赖（比如 8 个读者身份各读一遍同一篇稿），
// 但写成了 for + await，一个接一个等模型，纯属把时间堆在排队上
// （实测读者群像 8 个人 ≈ 60 秒，其实 4 并发只要十几秒）。
//
// 为什么不直接 Promise.all：一次性打出去几十个请求容易撞上游限流，
// 并发数要可控；而且一个失败不该连累其它，也不该留下没人管的 rejection。

/**
 * 保序并发 map。
 * @param items 输入数组
 * @param limit 并发上限（自动裁到 items.length）
 * @param fn (item, index) => Promise
 * @returns 与 items 等长、顺序一致的结果数组
 * @throws 第一个抛出的错误（其余 worker 会跑完再抛，不留悬空 rejection）
 */
export async function mapLimit(items, limit, fn) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const out = new Array(list.length);
  let next = 0;
  let firstErr = null;
  const workers = Array.from(
    { length: Math.max(1, Math.min(Number(limit) || 1, list.length)) },
    async () => {
      for (;;) {
        const i = next;
        next += 1;
        if (i >= list.length) return;
        try {
          out[i] = await fn(list[i], i);
        } catch (e) {
          if (!firstErr) firstErr = e;
          return; // 本 worker 停手，但其它 worker 会跑完，避免半途抛错留下悬空 promise
        }
      }
    },
  );
  await Promise.all(workers);
  if (firstErr) throw firstErr;
  return out;
}
