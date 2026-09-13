// CADENCE · 呼吸建议（规格 §9）
//
// 三条原则：可解释（说"这个句子塞了两个气群"，不说"太长了"）、
// 可拒绝、可锁定（锁死的 span 永不出现建议）。
//
// 每条建议都带 expected_effect —— 它是可验证的：改完 CV 没朝预期方向变，
// 就说明这条建议无效。这个反馈既能回流训练，也是答辩时的诚实性证据。

import { detectAntipatterns } from './antipattern.js';

let seq = 0;
const nextId = () => `sug-${Date.now().toString(36)}-${(seq += 1)}`;

/** 建议类型：split / merge / punctuate / rebalance / focus / prosody */
export function buildSuggestions(report, { lockedSpans = [], targetSpans = null } = {}) {
  const out = [];
  const inLocked = (from, to) =>
    lockedSpans.some((s) => {
      const a = Array.isArray(s) ? s[0] : s.start;
      const b = Array.isArray(s) ? s[1] : s.end;
      return from <= b && to >= a;
    });
  const inTarget = (from, to) =>
    !targetSpans || targetSpans.some((s) => from <= s[1] && to >= s[0]);

  for (const ap of report.antipatterns) {
    const [from, to] = ap.spans;
    if (inLocked(from, to) || !inTarget(from, to)) continue;

    if (ap.type === 'boundary_misalign') {
      // 最重要的一条：拆分。理由不是"太长"，是"这里有两个气群"。
      out.push({
        schema_version: '1.0',
        id: nextId(),
        type: 'split',
        span: { start: ap.spans[0], end: ap.spans[0] },
        reason: ap.evidence,
        action: { op: 'insert_break', at: ap.breakAfter, with: '。' },
        expected_effect: { breath_groups: '+1', cv: '+0.02~+0.05' },
        confidence: 0.72,
      });
    } else if (ap.type === 'choppy_groups') {
      out.push({
        schema_version: '1.0',
        id: nextId(),
        type: 'merge',
        span: { start: from, end: to },
        reason: ap.evidence,
        action: { op: 'merge_clauses' },
        expected_effect: { breath_groups: '-1', cv: '变化不定' },
        confidence: 0.55,
      });
    } else if (ap.type === 'punctuation_monotony') {
      out.push({
        schema_version: '1.0',
        id: nextId(),
        type: 'punctuate',
        span: { start: 1, end: report.sentence_level.n },
        reason: ap.evidence,
        action: { op: 'upgrade_punctuation', prefer: '；' },
        expected_effect: { punctuation_kinds: '+1', cv: '≈' },
        confidence: 0.5,
      });
    } else if (ap.type === 'uniform_run' || ap.type === 'mechanical_alternation') {
      // 措辞纪律（规格 §9.2）：不指定改多长，只指出问题；具体改写交给大模型。
      out.push({
        schema_version: '1.0',
        id: nextId(),
        type: 'rebalance',
        span: { start: from, end: to },
        reason: ap.evidence,
        action: { op: 'adjust_length_variety' },
        expected_effect: { cv: '+0.02~+0.06', mad: '+0.5~+2' },
        confidence: 0.6,
      });
    }
  }
  return out;
}

/**
 * 交给大模型的结构化输入（规格 §9.3）。
 *
 * 绝不能发"请把这段改得有节奏一些"——那会得到均匀化后的结果，反而更糟。
 * 要发气群图 + 问题 span + 作者基线 + 硬约束，并告诉它"改完我会机械校验"。
 */
export function buildPrompt(report, suggestions, { protectedSpans = [], baseline = null } = {}) {
  const groups = (report.breath_level.groups || []).map((g) => `[${g.text}(${g.length}字)]`).join('');
  const lines = [
    `当前气群图：${groups}`,
    `句长序列：${report.sentence_level.labels.join(' ')}`,
    `问题：`,
    ...suggestions.map((s, i) => `  ${i + 1}. ${s.reason} → ${s.type}`),
  ];
  if (baseline) {
    lines.push(`作者历史节奏基线：CV ${baseline.cv ?? '—'}，平均句长 ${baseline.mean ?? '—'} 字（来源：${baseline.source || '—'}）`);
  }
  lines.push(
    '要求：',
    '  1. 只在指定位置调整断句，不得改变任何事实内容（数字、年份、否定、断言强度一字不动）',
    '  2. 不得引入新的连接词',
    protectedSpans.length
      ? `  3. 以下 span 必须一字不变：${protectedSpans.map((s) => `「${s.text || s}」`).join('、')}`
      : '  3. 不要为了凑节奏增删信息',
    '  4. 输出后我会重新计算气群与 CV；若边界未按预期改变，或事实层被改动，结果将被拒绝',
  );
  return lines.join('\n');
}
