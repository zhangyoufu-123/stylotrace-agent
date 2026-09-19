// CADENCE · 第一层：中文句读切分与归一化
//
// 这一层决定后面所有统计的可信度——分句口径不固定，后面的数字全是假的。
// 所以口径全部写死在这里，并在报告里逐条声明（见 notes）。
//
// 三层切分，不能混：
//   句读（sentence）—— 。！？；… 与换行，**默认统计单位**
//   小句（clause）—— ，、：— 等
//   气群（breath）  —— 不是标点产物，交给 breath.js

// 终结标点（句读边界）。省略号按"一个终结标点"处理。
const SENTENCE_END = /[。！？；…!?;]/;
// 英文缩写：Mr. / Dr. / etc. / a.m. 以及首字母缩写 J. K.
//
// ⚠️ 这里**不能带 /i**（OpenCodeReview 审出来的真 bug）：
// 带 /i 时小写普通词也会命中——"No. I disagree." 和 "He is a prof. She left."
// 都被当成缩写、拒不切句，实测两句合一。所以：
//   · 大小写敏感（Mr 不是 mr）
//   · "No" 只在大写且后接数字时才算缩写（No. 5），避免吞掉 "No. I disagree."
const ABBREV = /(?:^|[^A-Za-z])(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|a\.m|p\.m)\.$/;
const ABBREV_NO_NUMBER = /(?:^|[^A-Za-z])No\.$/; // 后面接数字才算缩写，见 splitSentences
// 小句边界
const CLAUSE_SEP = /[，、：:,—]/;
// 成对符号：其内部的标点不单独成句
const PAIRS = { '“': '”', '‘': '’', '「': '」', '『': '』', '《': '》', '〈': '〉', '（': '）', '(': ')', '【': '】', '[': ']' };
const CLOSERS = new Set(Object.values(PAIRS));

/**
 * 全角字母/数字 → 半角；全角空格 → 空格。
 *
 * 注意：**只转换字母数字，绝不碰标点**。
 * 曾经图省事用 U+FF01–U+FF5E 整段转换，结果把中文逗号「，」转成了 ASCII「,」——
 * 那等于篡改用户原文（回写时用户的标点全变了），而且统计口径也跟着漂。
 * 识别中文标点时两个都认（正则里同时写 ，和 ,），但**保持原样**。
 */
export function toHalfWidth(s) {
  return String(s || '')
    .replace(/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    )
    .replace(/\u3000/g, ' ');
}

/**
 * 计数单位：只计书写单位（汉字、数字、字母），标点不计。
 * 口径见规格 §4.2：引号/书名号/括号内计入所在句；英文单词按一个书写单位计。
 */
export function countUnits(s) {
  const t = String(s || '');
  let n = 0;
  // 英文单词算 1
  const words = t.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || [];
  n += words.length;
  // 汉字
  n += (t.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
  // 数字串算 1（12.5 算 1 个书写单位）
  n += (t.match(/\d+(?:\.\d+)?/g) || []).length;
  return n;
}

/**
 * 列出每个"书写单位"在原文中的区间。
 *
 * 为什么必须有它：countUnits 是**有上下文**的——"3200" 算 1 个单位，
 * 但按字符逐个调用时每个数字都返回 1。断句要按"单位"走，
 * 否则会把标点插进数字中间（实测把「3200」切成了「32。00」）。
 */
export function unitSpans(s) {
  const t = String(s || '');
  const spans = [];
  let i = 0;
  while (i < t.length) {
    const c = t[i];
    if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < t.length && /[A-Za-z'’-]/.test(t[j])) j += 1;
      spans.push({ start: i, end: j - 1 });
      i = j;
      continue;
    }
    if (/\d/.test(c)) {
      let j = i;
      while (j < t.length && /[\d.]/.test(t[j]) && !(t[j] === '.' && !/\d/.test(t[j + 1] || ''))) j += 1;
      spans.push({ start: i, end: j - 1 });
      i = j;
      continue;
    }
    if (/[\u3400-\u4dbf\u4e00-\u9fff]/.test(c)) {
      spans.push({ start: i, end: i });
      i += 1;
      continue;
    }
    i += 1; // 标点/空白：不算单位
  }
  return spans;
}

/**
 * 归一化：统一标点、压缩连续标点、规整省略号。
 * 目的不是"美化"，是让分句口径稳定（否则同一段文本两次跑可能不一样）。
 */
export function normalize(text) {
  // ⚠️ 归一化**不修改用户原文**。
  // 曾经在这里把「……」压成一个「…」、把「！！」压成「！」——看着无害，
  // 实际是在改作者的标点：回写时用户的省略号少了一半。
  // "连续标点算一处边界"是**切分规则**，应该在切分时处理，不是改文本。
  // 这里只做零风险的转换：全角字母数字 → 半角，全角空格 → 空格。
  return toHalfWidth(text).trim();
}

/**
 * 按终结标点切句读。
 *
 * 关键坑（每条都有测试）：
 *   · 数字之间的小数点不是句号（12.5%）
 *   · 成对符号内部的终结标点不切（书名号里的句号）
 *   · 连续标点计一处（已在 normalize 处理）
 */
export function splitSentences(text) {
  const t = normalize(text);
  const out = [];
  let cur = '';
  const stack = [];
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    cur += c;
    if (PAIRS[c]) {
      stack.push(PAIRS[c]);
      continue;
    }
    if (CLOSERS.has(c) && stack.length && stack[stack.length - 1] === c) {
      stack.pop();
      continue;
    }
    if (stack.length) continue; // 成对符号内不切
    // 英文句点：能切，但要避开两个坑（规格 §4.3 明确点名）
    //   ① 数字之间的小数点：12.5%  → 不切
    //   ② 缩写点：Mr. / etc. / J. K. → 不切
    if (c === '.') {
      const prev = t[i - 1] || '';
      const next = t[i + 1] || '';
      const isDecimal = /\d/.test(prev) && /\d/.test(next);
      // "No." 只有后接数字时才是缩写（No. 5），否则是句子（No. I disagree.）
      const isNoAbbrev = ABBREV_NO_NUMBER.test(cur.trim()) && /^\s*\d/.test(next);
      const isAbbrev =
        ABBREV.test(cur.trim()) ||
        isNoAbbrev ||
        (/^[A-Z]$/.test(prev) && /^[A-Z]/.test(next.trim())); // 首字母缩写 J. K.
      if (isDecimal || isAbbrev) continue;
      // 视为句末：走下面的终结逻辑
      let j = i + 1;
      while (j < t.length && (SENTENCE_END.test(t[j]) || /[”’」』》）)]/.test(t[j]))) {
        cur += t[j];
        i = j;
        j += 1;
      }
      const body = cur.trim();
      if (countUnits(body) > 0) out.push(body);
      cur = '';
      continue;
    }
    if (c === '\n') {
      const body = cur.trim();
      if (countUnits(body) > 0) out.push(body);
      cur = '';
      continue;
    }
    if (SENTENCE_END.test(c)) {
      // 吸收紧随的：① 连续标点（…… / ！！ / ？！ 都算同一处边界）
      //             ② 收尾引号/括号
      // 注意是"吸收进同一个句读"，不是把字符删掉——原文一字不动。
      let j = i + 1;
      while (j < t.length && (SENTENCE_END.test(t[j]) || CLOSERS.has(t[j]) || /[”’」』》）)]/.test(t[j]))) {
        // 句号/问号等紧随其后也一并吸收（连续标点计一处）
        cur += t[j];
        i = j;
        j += 1;
      }
      const body = cur.trim();
      if (countUnits(body) > 0) out.push(body);
      cur = '';
    }
  }
  const tail = cur.trim();
  if (countUnits(tail) > 0) out.push(tail);
  return out;
}

/** 小句切分（用于气群候选边界），返回每句内的小句数组。 */
export function splitClauses(sentence) {
  return splitClausesWithOffsets(sentence).map((c) => c.text);
}

/**
 * 小句切分并带上在原文中的位置。
 *
 * 为什么要带位置：气群文本必须**从原文切片**得到，不能把小句用固定分隔符重新拼起来
 * ——原文可能是「他站着：没动、也没说话。」，用「，」重拼会变成
 * 「他站着，没动，也没说话。」，等于改了作者的标点（OpenCodeReview 审出的真 bug）。
 */
export function splitClausesWithOffsets(sentence) {
  const t = normalize(String(sentence || ''));
  const parts = [];
  let cur = '';
  let startAt = 0;
  const stack = [];
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (PAIRS[c]) stack.push(PAIRS[c]);
    else if (CLOSERS.has(c) && stack.length && stack[stack.length - 1] === c) stack.pop();
    if (!stack.length && CLAUSE_SEP.test(c)) {
      const body = cur.trim();
      if (body) parts.push({ text: body, start: startAt, end: i });
      cur = '';
      startAt = i + 1;
      continue;
    }
    cur += c;
  }
  const tail = cur.trim();
  if (tail) parts.push({ text: tail, start: startAt, end: t.length });
  return parts.length ? parts : [{ text: t, start: 0, end: t.length }];
}

/** 句读 + 小句一次拿全，供气群划分使用。 */
export function segment(text) {
  const sentences = splitSentences(text);
  return sentences.map((s, i) => ({
    index: i + 1,
    text: s,
    length: countUnits(s),
    clauses: splitClausesWithOffsets(s).map((c) => ({ ...c, length: countUnits(c.text) })),
  }));
}

/** 报告里必须声明的统计口径（规格 §4.2 第七条）。 */
export const COUNTING_NOTES = [
  '只计书写单位（汉字/数字/字母串），标点不计入字数',
  '引号、书名号、括号内的内容计入所在句读，不单独成句',
  '省略号 …… 计为一个终结标点（不是六个句号）',
  '英文单词按一个书写单位计，不做字母拆分',
  '短句（"是的。""走。"）同样计为一个句读——否则 CV 会被误读',
  'CV 是"句读尺度"的指标，不是严格主谓句尺度',
];
