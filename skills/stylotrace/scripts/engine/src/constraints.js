// success_definition → 可验证约束（v1.8，备忘录 §3.2）。
// 用户说"用 3 个具体案例说服读者减少塑料使用"，系统把它解析成可数的约束：
//   { minConcreteExamples: 3, persuasionTarget: '减少塑料使用', ... }
// 写作时把约束注入提示词（模型先知道目标数），交付质量门做确定性检查（数一数有没有达标）。
// 计数为近似启发式，报告明确标注"请人工复核"，绝不把近似当精确。
import fs from 'node:fs';
import path from 'node:path';

const NUM_CN = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 几: 3 };
const COUNT_RE =
  /(至少|不少于|起码|最少|至少要|至少要有|用|给出|举|配|带)(\d+|一|两|二|三|四|五|六|七|八|九|十|几)(个|条|篇|处|位|组|项)?(具体|真实|明确)?(案例|例子|实例|例证|数据|细节|引文|引用|文献|出处|故事|人物|数字|素材)/;

/** 从意图/立场/论点中解析可数约束；没有明确数字要求时全部为 0。 */
export function parseConstraints(state = {}) {
  const texts = [
    state?.intent?.coreNeed,
    state?.intent?.summary,
    state?.confirmed?.stance,
    state?.confirmed?.theme,
    ...(state?.confirmed?.arguments || []),
  ].filter(Boolean);
  const joined = texts.join('；');
  const out = {
    minConcreteExamples: 0,
    minCitations: 0,
    minDataPoints: 0,
    persuasionTarget: String(state?.confirmed?.stance || state?.intent?.coreNeed || '').slice(0, 80),
    raw: [],
  };
  for (const m of joined.matchAll(new RegExp(COUNT_RE.source, 'g'))) {
    const num = m[2] in NUM_CN ? NUM_CN[m[2]] : parseInt(m[2], 10) || 0;
    const kind = (m[4] || '') + (m[5] || '');
    if (/案例|例子|实例|例证|故事|细节|素材/.test(kind)) {
      out.minConcreteExamples = Math.max(out.minConcreteExamples, num);
    }
    if (/引文|引用|文献|出处/.test(kind)) {
      out.minCitations = Math.max(out.minCitations, num);
    }
    if (/数据|数字/.test(kind)) {
      out.minDataPoints = Math.max(out.minDataPoints, num);
    }
    out.raw.push(m[0]);
  }
  return out;
}

/** 可注入写作提示的约束说明；无约束时返回空串（不干扰默认写法）。 */
export function constraintBrief(state) {
  const c = parseConstraints(state);
  const parts = [];
  if (c.minConcreteExamples) parts.push(`至少 ${c.minConcreteExamples} 个具体案例/例证`);
  if (c.minCitations) parts.push(`至少 ${c.minCitations} 处引文/出处`);
  if (c.minDataPoints) parts.push(`至少 ${c.minDataPoints} 处数据`);
  if (!parts.length) return '';
  const target = c.persuasionTarget ? `；论点/目的：${c.persuasionTarget}` : '';
  return `【成功标准，交付前必须核对】${parts.join('；')}${target}`;
}

/** 确定性近似计数：素材出现数 + 引号引语数 + 数字带单位句数。 */
export function countConcreteEvidence(draft, materials = []) {
  const t = String(draft || '');
  const citedMaterials = (materials || []).filter((m) => m && t.includes(String(m))).length;
  const quotedLines = (t.match(/[“「『][^”」』]{2,40}[”」』]/g) || []).length;
  const dataPoints = (
    t.match(/[\d０-９]+(?:[.,，]?\d+)?\s*(%|％|个|条|篇|年|月|日|万|亿|人|家|次|倍|元|字)/g) || []
  ).length;
  return { citedMaterials, quotedLines, dataPoints, evidenceCount: citedMaterials + quotedLines + dataPoints };
}

/** 交付质量门：检查约束是否达成，缺失项给出人工复核提示。 */
export function checkConstraints(workspace, state) {
  const c = parseConstraints(state);
  let draft = '';
  try {
    draft = fs.readFileSync(path.join(workspace, 'draft.md'), 'utf8');
  } catch {}
  const ev = countConcreteEvidence(draft, state?.materials || []);
  const missing = [];
  if (c.minConcreteExamples && ev.evidenceCount < c.minConcreteExamples) {
    missing.push(`具体案例/例证不足：目标 ${c.minConcreteExamples}，近似检出 ${ev.evidenceCount}（请人工复核）`);
  }
  if (c.minCitations && ev.quotedLines < c.minCitations) {
    missing.push(`引文/出处不足：目标 ${c.minCitations}，检出 ${ev.quotedLines}`);
  }
  if (c.minDataPoints && ev.dataPoints < c.minDataPoints) {
    missing.push(`数据不足：目标 ${c.minDataPoints}，检出 ${ev.dataPoints}`);
  }
  const hasTargets = c.minConcreteExamples + c.minCitations + c.minDataPoints > 0;
  return { ...c, evidence: ev, missing, met: hasTargets ? missing.length === 0 : null };
}
