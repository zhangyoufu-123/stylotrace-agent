// CADENCE · 闭环：应用建议 → 重算 → 校验 → 不一致就回滚（规格 §9.4）
//
// 关键纪律：apply 只做确定性可验证的动作（插断句、升级标点），
// **语义改写不在这里做**——那要交给大模型，然后回来重新验证。
// 这样"建议 → 应用 → 校验"整条链里，凡是我们自己能验的，就一定验。

import { unitSpans } from './segment.js';

/**
 * 把建议施加到文本上。
 *
 * 支持的确定性动作：
 *   insert_break  在第 N 字后插入终结标点（拆分气群）—— 这是核心动作
 *   upgrade_punctuation  把一个逗号升级为分号等（标点单一化）
 * merge_clauses / adjust_length_variety 属于语义动作，这里跳过（skipped），
 *   交给大模型改写后再回来验证——不假装能做到。
 */
export function applyToText(text, suggestions, before) {
  const applied = [];
  const skipped = [];
  let out = String(text || '');

  for (const s of suggestions || []) {
    const op = s?.action?.op;
    if (op === 'insert_break') {
      const targetIdx = s.span?.start;
      const sentence = (before.sentence_level.segments || []).find((x) => x.index === targetIdx);
      if (!sentence) {
        skipped.push({ id: s.id, reason: '找不到目标句读' });
        continue;
      }
      const at = Number(s.action.at);
      const rebuilt = insertBreakInSentence(sentence.text, at, s.action.with || '。');
      if (!rebuilt || rebuilt === sentence.text) {
        skipped.push({ id: s.id, reason: '按这个位置插不进断句' });
        continue;
      }
      const pos = out.indexOf(sentence.text);
      if (pos < 0) {
        skipped.push({ id: s.id, reason: '目标句读在原文中已变化' });
        continue;
      }
      out = out.slice(0, pos) + rebuilt + out.slice(pos + sentence.text.length);
      applied.push(s.id);
      continue;
    }

    if (op === 'upgrade_punctuation') {
      // 标点升级**不做机械替换**。
      // 试过"把中间那句的第一个逗号换成分号"，结果是「只有这样；学生才能…」——
      // 语法上不算错，读起来却别扭：分号要标的是**真正的并列层次**，
      // 而这一步机器判断不了。所以只提示、不代改，把决定权留给人。
      skipped.push({
        id: s.id,
        reason: '标点升级需要人判断层次关系（机械替换会改出别扭的句子），只提示不代改',
      });
      continue;
    }

    skipped.push({ id: s.id, reason: `「${op || '未知'}」属于语义改写，需交给模型后重新验证` });
  }

  return { text: out, applied, skipped };
}

/**
 * 在句内第 at 个书写单位之后插入断句标点。
 * 插在标点之前/之后要讲究：不能插到标点后面（那会变成"。。"）。
 */
export function insertBreakInSentence(sentence, at, mark = '。') {
  const t = String(sentence || '');
  // 按**书写单位**走，不按字符走：
  // 否则「某机构 3200 名」里的 3200 会被当成 4 个单位，标点插到数字中间。
  const spans = unitSpans(t);
  const target = spans[Math.min(at, spans.length) - 1];
  if (!target) return t;
  // 从该单位之后往后跳过紧跟的标点，再插入断句标点。
  // 注意：head 末尾的那个标点会被**替换**成新标点（不是保留）——
  // 「他站着，没动」在第 3 字后断句会变成「他站着。没动」。
  // 原来的注释写的是"保留原有层次"，与实现不符（OpenCodeReview 指出）。
  let j = target.end + 1;
  while (j < t.length && /[，,、：:；;—]/.test(t[j])) j += 1;
  const head = t.slice(0, j).replace(/[，,、：:；;—]\s*$/, '');
  const tail = t.slice(j);
  if (!tail.trim()) return t; // 已经是句尾，不插
  return `${head}${mark}${tail}`;
}
