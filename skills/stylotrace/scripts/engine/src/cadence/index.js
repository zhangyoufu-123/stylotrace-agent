// CADENCE · 对外只暴露三个函数（规格 §2.3，语义永不变化）
//
//   analyze(text, author_id?)        —— 永远只读
//   suggest(report, target_spans?)   —— 只产出建议，不改文本
//   apply(text, suggestions)         —— 永远返回新的三元组，不做原地修改
//
// 这是对接稳定性的底线：旧 agent 一行代码不改，只在外面套 adapter。
//
// 五条不冲突约束（规格 §2.2）：
//   契约带 schema_version · 默认旁路 shadow mode · 特性开关逐项接管
//   rhythm_audit / rhythm_suggest / prosody_ssml / metrical_check

import { COUNTING_NOTES, countUnits, segment } from './segment.js';
import { lengthSeriesStats } from './metrics.js';
import { boundaryMisalignments, breathGroups } from './breath.js';
import { detectAntipatterns } from './antipattern.js';
import { buildPrompt, buildSuggestions } from './suggest.js';
import { applyToText } from './apply.js';
import { readBaseline } from './baseline.js';
import { metricalReport } from './meter.js';
import { toSsml } from './ssml.js';

export const SCHEMA_VERSION = '1.0';

/** 特性开关：默认全部旁路（shadow），逐项接管（规格 §2.2 第五条）。 */
export const FEATURES = ['rhythm_audit', 'rhythm_suggest', 'prosody_ssml', 'metrical_check'];

export function featureFlags(flags = {}) {
  const on = (k) => flags[k] !== false;
  return {
    rhythm_audit: on('rhythm_audit'),
    rhythm_suggest: on('rhythm_suggest'),
    prosody_ssml: on('prosody_ssml'),
    metrical_check: on('metrical_check'),
  };
}

/**
 * 只读分析。绝不改文本、绝不联网、绝不调用模型。
 * @param text 待分析文本
 * @param opts.authorId / opts.standard（平仄标准）/ opts.workspace（读作者基线）
 */
export function analyze(text, { authorId = null, workspace = null, standard = null } = {}) {
  const src = String(text || '');
  const sentences = segment(src);
  const lengths = sentences.map((s) => s.length);
  const groups = breathGroups(sentences);
  const misalignments = boundaryMisalignments(sentences, groups);
  const stats = lengthSeriesStats(lengths);
  const groupLengths = groups.map((g) => g.length);
  const gStats = lengthSeriesStats(groupLengths);

  // 冷启动与短文本纪律（规格 §6.3）：句读 < 8 → 明确拒绝判定
  const baseline = readBaseline({ workspace, authorId, genre: null });
  const insufficient = sentences.length < 8;
  const verdict = insufficient ? 'insufficient' : 'ok';

  const antipatterns = insufficient
    ? []
    : detectAntipatterns({ text: src, sentences, lengths, groups, misalignments });

  return {
    schema_version: SCHEMA_VERSION,
    doc_id: null,
    author_id: authorId,
    baseline_source: baseline.source,
    baseline,
    insufficient,
    sentence_level: {
      n: sentences.length,
      labels: sentences.map((s) => s.text),
      segments: sentences,
      lengths,
      ...stats,
    },
    breath_level: {
      groups,
      lengths: groupLengths,
      mean: gStats.mean,
      sd: gStats.sd,
      cv: gStats.cv,
      groups_per_sentence: sentences.length ? Number((groups.length / sentences.length).toFixed(2)) : 0,
    },
    misalignments,
    antipatterns,
    verdict: antipatterns.length ? 'attention' : verdict,
    notes: [
      ...COUNTING_NOTES,
      '本模块不判定"是否 AI 所写"：分类器对非母语者的误判率高达 61.22%，那是伤害而不是功能',
      '均匀不等于差：说明文/法律文本里均匀是优点，这里只报告数值与相对基线，不做价值判断',
      ...(insufficient ? ['句读数 < 8，不足以判定（不给任何节奏结论）'] : []),
    ],
  };
}

/** 生成建议（可拒绝、可锁定）。 */
export function suggest(report, { lockedSpans = [], targetSpans = null } = {}) {
  return buildSuggestions(report, { lockedSpans, targetSpans });
}

/** 交给大模型时的结构化输入（不是"请改得有节奏些"）。 */
export function promptFor(report, suggestions, opts = {}) {
  return buildPrompt(report, suggestions, opts);
}

/**
 * 应用建议。永远返回 { text, report, applied }，不改原对象。
 * 应用后重算报告，并把"实际效果 vs 预期效果"一并给出——
 * 没达到预期就说明这条建议无效，如实记录，不粉饰。
 */
export function apply(text, suggestions, { workspace = null, authorId = null } = {}) {
  const before = analyze(text, { workspace, authorId });
  const { text: newText, applied, skipped } = applyToText(String(text || ''), suggestions || [], before);
  const after = analyze(newText, { workspace, authorId });

  // 每条建议**单独**量一次效果，而不是把累计变化复制到每一行——
  // 否则会看到"8 条建议每条都让 CV +0.321"这种明显误导的数字。
  // 纯确定性计算、不调模型，逐条跑得起。
  const effects = applied.map((id) => {
    const s = (suggestions || []).find((x) => x.id === id);
    let one = null;
    try {
      const r = applyToText(String(text || ''), [s], before);
      const ra = analyze(r.text, { workspace, authorId });
      one = {
        cv: Number((ra.sentence_level.cv - before.sentence_level.cv).toFixed(3)),
        mad: Number((ra.sentence_level.mad - before.sentence_level.mad).toFixed(3)),
        breath_groups: ra.breath_level.groups.length - before.breath_level.groups.length,
        misalignments: ra.misalignments.length - before.misalignments.length,
      };
    } catch {
      one = null;
    }
    return {
      id,
      type: s?.type || '',
      expected: s?.expected_effect || {},
      actual: one, // 单条建议单独施加后的实际变化
    };
  });

  const total = {
    cv: Number((after.sentence_level.cv - before.sentence_level.cv).toFixed(3)),
    mad: Number((after.sentence_level.mad - before.sentence_level.mad).toFixed(3)),
    breath_groups: after.breath_level.groups.length - before.breath_level.groups.length,
    misalignments: after.misalignments.length - before.misalignments.length,
  };

  return { text: newText, report: after, applied, skipped, effects, total, before };
}

export { applyToText } from './apply.js';
export { toSsml } from './ssml.js';
export { metricalReport } from './meter.js';
export { renderRhythmReport } from './report.js';
export { breathGroups, boundaryMisalignments } from './breath.js';
export { segment, splitSentences, splitClauses, countUnits, COUNTING_NOTES } from './segment.js';
export { lengthSeriesStats } from './metrics.js';
export { buildSuggestions, buildPrompt } from './suggest.js';
export { readBaseline, writeBaseline } from './baseline.js';
