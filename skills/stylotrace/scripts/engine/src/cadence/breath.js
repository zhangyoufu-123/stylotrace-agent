// CADENCE · 核心：气群划分
//
// 规格 §5 的核心洞察：
//   气群（breath group）是文本与声音的共同单位。
//   "没有节奏"不是修辞问题，是**边界错位**问题——
//   AI 的句号位置是概率产物，不对应任何呼吸单位。
//
// 所以这一层不做"统计句长"，做的是：**把边界放到正确的位置**。
// 这也是整个模块别人最难复制的部分（句长统计谁都能做）。
//
// 算法（规格 §5.2）：候选边界 → 边界强度打分 → 动态规划求最优切分。
// 纯规则、零 API、确定性；模型不可用时行为不变。

import { countUnits } from './segment.js';

// 汉语一个气群的舒适区间（规格 §5.2，默认 7–25 字，可配置）
export const COMFORT = { min: 7, max: 25 };

// 边界后若以下列词开头，通常不独立成气群（语义未完成）
const LEAD_CONNECTIVE = /^(因为|所以|但是|然而|不过|而且|并且|因此|于是|如果|虽然|尽管|即使|以及|或者|而|但|却|就|才|又|也|还|则|便|故|因|若|虽|且|并|或)/;
// 边界前若以此结尾，语义往往已完整（倾向成界）
const TAIL_COMPLETE = /(了|的|着|过|呢|吧|啊|吗|呀|嘛|罢了|而已|一样|似的)$/;
// 并列/对仗结构：边界强度低，应合并为一个气群
const PARALLEL_PAIR = /^(?=.*[，,、])/;

/**
 * 边界强度打分：越大越应该成为一个气群边界。
 * 返回 0–1。
 */
export function boundaryStrength({ left, right, leftLen, rightLen, clauseLen }) {
  let s = 0.4; // 基准：逗号级边界天然有中等强度

  // 句法完整度：左边像个完整小句（有谓语性收尾），右边不接连接词
  if (TAIL_COMPLETE.test(left)) s += 0.15;
  if (LEAD_CONNECTIVE.test(right)) s -= 0.35;
  if (/[。！？…]$/.test(left)) s += 0.2;

  // 长度约束：两侧都太短 → 倾向合并；一侧过长 → 倾向再切
  if (leftLen < 5 && rightLen < 5) s -= 0.25;
  if (leftLen >= COMFORT.min && rightLen >= COMFORT.min) s += 0.2;
  if (leftLen > COMFORT.max || rightLen > COMFORT.max) s += 0.15;

  // 并列/对仗：两个短句结构相似 → 不切
  if (PARALLEL_PAIR.test(left) || PARALLEL_PAIR.test(right)) s -= 0.15;

  // 焦点词被割裂：右边以"的"开头（修饰语被切断）→ 不切
  if (/^的/.test(right)) s -= 0.3;

  return Math.max(0, Math.min(1, s));
}

/** 把一个标点句内的小句序列，用动态规划切成最合理的气群。 */
function splitSentenceIntoGroups(sentence) {
  const clauses = sentence.clauses || [];
  if (clauses.length <= 1) {
    return [{ text: sentence.text, length: sentence.length, clauseStart: 0, clauseEnd: clauses.length - 1 }];
  }

  const n = clauses.length;
  // 候选边界 i = 第 i 与 i+1 个小句之间（i 从 0 到 n-2）
  const strength = [];
  for (let i = 0; i < n - 1; i += 1) {
    strength.push(
      boundaryStrength({
        left: clauses[i].text,
        right: clauses[i + 1].text,
        leftLen: clauses[i].length,
        rightLen: clauses[i + 1].length,
        clauseLen: sentence.length,
      }),
    );
  }

  // DP：dp[i][j] = 前 i 个小句、最后一段结束在 j 的最小代价
  // 代价 = Σ 长度惩罚 − Σ 边界收益；同时限制总气群数不超过句长上限所需
  const cost = (from, to) => {
    let len = 0;
    for (let k = from; k <= to; k += 1) len += clauses[k].length;
    let c = 0;
    if (len < COMFORT.min) c += (COMFORT.min - len) * 0.6;
    if (len > COMFORT.max) c += (len - COMFORT.max) * 1.4;
    return c;
  };

  // dp[i] = 切完前 i 个（0..i-1）小句的最小代价
  const dp = new Array(n + 1).fill(Infinity);
  const back = new Array(n + 1).fill(-1);
  dp[0] = 0;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 0; j < i; j += 1) {
      // 段 j..i-1（小句下标），段与段之间若切则在 j-1 处有边界
      const gain = j > 0 ? strength[j - 1] * 3 : 0;
      const v = dp[j] + cost(j, i - 1) - gain;
      if (v < dp[i]) {
        dp[i] = v;
        back[i] = j;
      }
    }
  }

  const cuts = [];
  let cur = n;
  while (cur > 0) {
    const j = back[cur];
    cuts.push([j, cur - 1]);
    cur = j;
  }
  cuts.reverse();

  return cuts.map(([a, b]) => {
    // 从**原文切片**，不要用小句重新拼接。
    // 原来写的是 clauses.slice(a,b+1).map(c=>c.text).join('，')，
    // 遇到「他站着：没动、也没说话。」会变成「他站着，没动，也没说话。」——
    // 等于改掉了作者的标点（OpenCodeReview 审出的真 bug）。
    const from = clauses[a]?.start ?? 0;
    const to = clauses[b]?.end ?? sentence.text.length;
    const text = String(sentence.text).slice(from, to).trim();
    return { text, length: countUnits(text), clauseStart: a, clauseEnd: b };
  });
}

/**
 * 划分气群。这是模块对外最有价值的产出：
 * 同一份结构既给文本侧（找边界错位），也给语音侧（生成 SSML）。
 */
export function breathGroups(sentences) {
  const groups = [];
  for (const s of sentences) {
    const parts = splitSentenceIntoGroups(s);
    for (const p of parts) {
      groups.push({
        sentenceIndex: s.index,
        text: p.text,
        length: p.length,
        clauseStart: p.clauseStart,
        clauseEnd: p.clauseEnd,
        // 一个标点句被切成多个气群 → 这些气群就是"塞进一个句子"的那些
        splitFromSentence: parts.length > 1,
      });
    }
  }
  return groups;
}

/** 边界错位：一句里装了 ≥2 个气群。这是"读起来喘不过气"的可解释来源。 */
export function boundaryMisalignments(sentences, groups) {
  const bySentence = new Map();
  for (const g of groups) {
    if (!bySentence.has(g.sentenceIndex)) bySentence.set(g.sentenceIndex, []);
    bySentence.get(g.sentenceIndex).push(g);
  }
  const out = [];
  for (const s of sentences) {
    const gs = bySentence.get(s.index) || [];
    if (gs.length >= 2) {
      out.push({
        sentenceIndex: s.index,
        text: s.text,
        length: s.length,
        groups: gs.length,
        groupLengths: gs.map((g) => g.length),
        // 建议断点：第一个气群之后
        breakAfter: gs[0].length,
      });
    }
  }
  return out;
}
