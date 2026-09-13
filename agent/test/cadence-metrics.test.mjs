// CADENCE · 统计层测试（规格 §11.2）
//
// 黄金样本这件事必须说清楚：规格要求拿老舍《入会誓言》（25 句读、均值 23.24、
// SD 6.53、CV 0.28）与汪曾祺《受戒》片段（17 句读、12.94、3.57、0.28）校准。
// 但那两段文本有版权、本仓库不转载，**所以这里不会假装跑过它们**。
//
// 做法改成两条都能验证的路：
//   ① 用**已知答案的构造序列**证明公式实现正确（解析解，可以手算核对）
//   ② 提供 calibrate 工具：把原文放进指定文件即可对公开数字断言（见文末）
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M = await import(path.join(HERE, '..', 'src', 'cadence', 'metrics.js'));
const S = await import(path.join(HERE, '..', 'src', 'cadence', 'segment.js'));

let n = 0;
const ok = (m) => {
  n += 1;
  console.log(`  ✓ ${m}`);
};

// ── ① 解析解：手算就能核对 ──────────────────────────────
assert.equal(M.mean([10, 20, 30]), 20);
assert.equal(M.median([3, 1, 2]), 2);
assert.equal(M.median([1, 2, 3, 4]), 2.5);
ok('均值 / 中位数');

// 样本标准差 n-1：[5,15] → 均值 10，sd = sqrt(((5-10)^2+(15-10)^2)/1) = 7.071
const near3 = (a, b) => Math.abs(a - b) < 5e-4;
assert.ok(near3(M.sd([5, 15]), Math.sqrt(50)), `sd([5,15]) 应等于 √50，实际 ${M.sd([5, 15])}`);
assert.equal(M.sd([10, 10, 10]), 0);
ok('样本标准差（n-1）');

assert.ok(near3(M.cv([5, 15]), Math.sqrt(50) / 10), `cv([5,15]) 应为 √50/10，实际 ${M.cv([5, 15])}`);
assert.equal(M.cv([10, 10, 10, 10]), 0, '全等 → CV 为 0');
ok('变异系数 CV = σ/μ');

// MAD = 相邻差绝对值均值
assert.equal(M.mad([10, 20, 30]), 10);
assert.equal(M.mad([10, 10, 10]), 0);
assert.equal(M.mad([1, 3, 6]), Number((2 + 3) / 2));
ok('MAD（相邻句长差绝对值均值）');

assert.equal(M.quantile([1, 2, 3, 4], 0.25), 1.75);
assert.equal(M.quantile([1, 2, 3, 4], 0.75), 3.25);
ok('四分位');

// 完全规则的交替，排列熵应显著低于随机序列
const regular = [10, 20, 10, 20, 10, 20, 10, 20];
const varied = [8, 22, 11, 30, 6, 25, 9, 18];
assert.ok(
  M.permutationEntropy(regular) < M.permutationEntropy(varied),
  '规则交替的排列熵应低于有变化的序列',
);
ok('排列熵能区分"规则交替"与"真变化"');

// DFA：完全随机的小序列不应给出高 Hurst；长程相关的序列应更高
const anti = [10, 1, 10, 1, 10, 1, 10, 1, 10, 1, 10, 1, 10, 1, 10, 1];
const trend = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
assert.ok(M.dfaHurst(anti) < M.dfaHurst(trend), '趋势序列的 DFA 指数应高于反相关交替');
ok('DFA 标度指数方向正确');

// ── ② 统计层与分句层联通（构造样本，长度序列完全可知） ──
// 造 10 个句读，长度依次为 5,6,7,8,9,10,11,12,13,14（已知）
const parts = [];
for (let i = 5; i <= 14; i += 1) parts.push('字'.repeat(i) + '。');
const text = parts.join('');
const segs = S.splitSentences(text);
assert.equal(segs.length, 10);
const lens = segs.map((s) => S.countUnits(s));
assert.deepEqual(lens, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14], '分句+计数必须与构造完全一致');
const st = M.lengthSeriesStats(lens);
assert.equal(st.mean, 9.5);
assert.equal(st.min, 5);
assert.equal(st.max, 14);
assert.equal(st.range, 9);
assert.equal(st.n, 10);
ok('构造样本：分句 → 计数 → 统计 全链一致（长度序列完全可知）');

// ── ③ 已出版文本的校准（可选，不转载原文） ─────────────
// 把老舍《入会誓言》全文存到 agent/test/fixtures/laoshe-rumian.json 的 {text: "..."}，
// 再跑 `node test/cadence-metrics.test.mjs --calibrate` 即会对公开数字断言。
// 没放文件就明确说"没校准"，绝不假装跑过。
const CALIB = {
  laoshe: { file: 'laoshe-rumian.json', segments: 25, mean: 23.24, sd: 6.53, cv: 0.28, tol: 0.03 },
};

if (process.argv.includes('--calibrate')) {
  let any = false;
  for (const [name, spec] of Object.entries(CALIB)) {
    const f = path.join(HERE, 'fixtures', spec.file);
    if (!fs.existsSync(f)) {
      console.log(`  · 跳过 ${name}：未提供原文（${spec.file}）——不假装跑过`);
      continue;
    }
    any = true;
    const { text } = JSON.parse(fs.readFileSync(f, 'utf8'));
    const ss = S.splitSentences(text);
    const s2 = M.lengthSeriesStats(ss.map((x) => S.countUnits(x)));
    const near = (a, b) => Math.abs(a - b) <= Math.max(spec.tol, b * 0.02);
    assert.ok(near(ss.length, spec.segments), `${name} 句读数 期望 ${spec.segments} 实际 ${ss.length}`);
    assert.ok(near(s2.mean, spec.mean), `${name} 均值 期望 ${spec.mean} 实际 ${s2.mean}`);
    assert.ok(near(s2.sd, spec.sd), `${name} SD 期望 ${spec.sd} 实际 ${s2.sd}`);
    assert.ok(near(s2.cv, spec.cv), `${name} CV 期望 ${spec.cv} 实际 ${s2.cv}`);
    console.log(`  ✓ ${name} 与公开统计一致（${ss.length} 句 / 均值 ${s2.mean} / SD ${s2.sd} / CV ${s2.cv}）`);
  }
  if (!any) console.log('  （没有可校准的原文，跳过——这是诚实的跳过，不是通过）');
} else {
  console.log('  · 公开文本校准未运行（需自备原文，见 --calibrate）');
}

console.log(`\ncadence-metrics.test.mjs 全部通过 (${n} 项)`);
