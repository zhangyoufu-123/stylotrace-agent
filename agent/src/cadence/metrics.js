// CADENCE · 第二层：节奏统计量
//
// 术语纪律（规格 §6.1）：报告里不写"burstiness 分数"这种含混说法，
// 要写明是 CV / MAD / 熵，并给公式与单位——评审会追问定义。
//
// 全部确定性实现，零 API 调用。

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 样本标准差（n-1）。空/单元素返回 0。 */
export function sd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** 变异系数 CV = σ/μ（规格 §6.1 明确要用的那个） */
export function cv(xs) {
  const m = mean(xs);
  return m ? sd(xs) / m : 0;
}

/** 相邻差绝对值均值 MAD = mean(|l_{i+1} - l_i|) */
export function mad(xs) {
  if (xs.length < 2) return 0;
  let s = 0;
  for (let i = 1; i < xs.length; i += 1) s += Math.abs(xs[i] - xs[i - 1]);
  return s / (xs.length - 1);
}

export function quantile(xs, q) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function skewness(xs) {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const s = sd(xs);
  if (!s) return 0;
  return (n / ((n - 1) * (n - 2))) * xs.reduce((a, b) => a + ((b - m) / s) ** 3, 0);
}

/** 排列熵（order-3）：衡量序列的不可预测程度，取值 0–1（归一化）。 */
export function permutationEntropy(xs, order = 3) {
  const n = xs.length;
  if (n < order + 1) return 0;
  const counts = new Map();
  for (let i = 0; i + order <= n; i += 1) {
    const win = xs.slice(i, i + order);
    const key = win
      .map((v, idx) => [v, idx])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map((p) => p[1])
      .join('');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  let h = 0;
  for (const c of counts.values()) {
    const p = c / total;
    h -= p * Math.log(p);
  }
  // 归一化：排列数 = order!
  const factorial = (k) => (k <= 1 ? 1 : k * factorial(k - 1));
  return h / Math.log(factorial(order));
}

/**
 * DFA（去趋势波动分析）标度指数，近似 Hurst。
 *
 * 为什么值得做（规格 §6.1）：501 本小说的句长序列 DFA Hurst ≈ 0.75，
 * 说明句长序列不是噪声、携带结构信息——这是"机械交替"能被检测出来的理论基础。
 * 这里用简化的分段去趋势实现，够用且确定性。
 */
export function dfaHurst(xs, { scales = [4, 8, 16] } = {}) {
  const n = xs.length;
  const usable = scales.filter((s) => n >= s * 2);
  if (!usable.length) return 0;
  const m = mean(xs);
  const y = [];
  let acc = 0;
  for (const v of xs) {
    acc += v - m;
    y.push(acc);
  }
  const pts = [];
  for (const s of usable) {
    const segs = Math.floor(n / s);
    let sumSq = 0;
    let cnt = 0;
    for (let k = 0; k < segs; k += 1) {
      const seg = y.slice(k * s, (k + 1) * s);
      // 线性去趋势
      const nn = seg.length;
      const xsIdx = seg.map((_, i) => i);
      const mx = mean(xsIdx);
      const my = mean(seg);
      let num = 0;
      let den = 0;
      for (let i = 0; i < nn; i += 1) {
        num += (xsIdx[i] - mx) * (seg[i] - my);
        den += (xsIdx[i] - mx) ** 2;
      }
      const slope = den ? num / den : 0;
      const intercept = my - slope * mx;
      for (let i = 0; i < nn; i += 1) {
        sumSq += (seg[i] - (slope * i + intercept)) ** 2;
        cnt += 1;
      }
    }
    const f = Math.sqrt(sumSq / Math.max(1, cnt));
    if (f > 0) pts.push([Math.log(s), Math.log(f)]);
  }
  if (pts.length < 2) return 0;
  const mx = mean(pts.map((p) => p[0]));
  const my = mean(pts.map((p) => p[1]));
  let num = 0;
  let den = 0;
  for (const [x, yy] of pts) {
    num += (x - mx) * (yy - my);
    den += (x - mx) ** 2;
  }
  return den ? Number((num / den).toFixed(3)) : 0;
}

/** 一次算全句长序列的统计量。 */
export function lengthSeriesStats(lengths) {
  const xs = (lengths || []).filter((n) => Number.isFinite(n));
  if (!xs.length) {
    return {
      n: 0, mean: 0, median: 0, sd: 0, cv: 0, min: 0, max: 0, range: 0,
      iqr: 0, skew: 0, mad: 0, permEntropy: 0, dfaHurst: 0,
    };
  }
  const q1 = quantile(xs, 0.25);
  const q3 = quantile(xs, 0.75);
  // 不要用 Math.min(...xs)：长文本（几千个句读，正是"501 本小说"那种规模）
  // 会把数组展开成几万个实参，直接 RangeError 爆栈（OpenCodeReview 审出来的真 bug）。
  let lo = xs[0];
  let hi = xs[0];
  for (const v of xs) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const r2 = (v) => Number(v.toFixed(3));
  return {
    n: xs.length,
    mean: r2(mean(xs)),
    median: r2(median(xs)),
    sd: r2(sd(xs)),
    cv: r2(cv(xs)),
    min: lo,
    max: hi,
    range: hi - lo,
    iqr: r2(q3 - q1),
    skew: r2(skewness(xs)),
    mad: r2(mad(xs)),
    permEntropy: r2(permutationEntropy(xs)),
    dfaHurst: dfaHurst(xs),
  };
}
