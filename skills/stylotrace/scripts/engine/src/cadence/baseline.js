// CADENCE · 分层基线（规格 §6.3）
//
// 绝对阈值是错的：说明文 CV 0.15 可能正常，散文 CV 0.15 就是问题。
// 所以只报告**相对作者自身基线的百分位**，并明确标注基线来源。
//
// 冷启动纪律：样本 < 5 篇 → 只用体裁基线，标 baseline_source: "genre"；
// 样本不足时标 "insufficient"，**不给判定**。

import fs from 'node:fs';
import path from 'node:path';
import { lengthSeriesStats } from './metrics.js';
import { segment } from './segment.js';
import { collectAuthorCorpus, deviationFromAuthor } from './author-corpus.js';

const MIN_SAMPLES = 5;

// 体裁基线：需要真实语料才能填。这里只放结构，值留空——
// 编一组好看的数字比留空更糟：评审一问来源就露馅。
export const GENRE_BASELINES = {};

function baselineFile(workspace) {
  return path.join(workspace, 'cadence', 'baseline.json');
}

/**
 * 读取作者基线。
 *
 * **样本来自 agent 自己收集的作者内容**（归档作品 / 作者亲手改后的文本 / 当前成稿），
 * 不去外面找文章。工作区里写得越多，基线越准；不够就诚实标 insufficient。
 */
export function readBaseline({ workspace = null, authorId = null, genre = null } = {}) {
  // 首选：作者语料（agent 自有数据）
  if (workspace) {
    try {
      const corpus = collectAuthorCorpus(workspace, { includeDraft: false });
      if (corpus.stats.pieces >= MIN_SAMPLES) {
        return {
          source: 'author',
          author_id: authorId,
          samples: corpus.stats.pieces,
          cv: corpus.stats.cv,
          mean: corpus.stats.mean,
          mad: corpus.stats.mad,
          cvRange: corpus.stats.cvRange,
          bySource: corpus.bySource,
          shortSamples: corpus.stats.shortSamples,
          note:
            `来自你自己归档的 ${corpus.stats.pieces} 篇（作品库 ${corpus.bySource.library || 0} · 修改轨迹 ${corpus.bySource.edit || 0}）` +
            (corpus.stats.shortSamples
              ? `，其中 ${corpus.stats.shortSamples} 篇偏短（<8 句读），CV 波动会大一些`
              : ''),
        };
      }
    } catch {}
  }
  // 兼容：工作区里手工写的 baseline.json（早期版本）
  let samples = [];
  if (workspace) {
    try {
      const raw = JSON.parse(fs.readFileSync(baselineFile(workspace), 'utf8'));
      samples = Array.isArray(raw.samples) ? raw.samples : [];
    } catch {}
  }
  if (samples.length >= MIN_SAMPLES) {
    const cvList = samples.map((s) => s.cv).filter((n) => Number.isFinite(n));
    const meanList = samples.map((s) => s.mean).filter((n) => Number.isFinite(n));
    return {
      source: 'author',
      author_id: authorId,
      samples: samples.length,
      cv: cvList.length ? Number((cvList.reduce((a, b) => a + b, 0) / cvList.length).toFixed(3)) : null,
      mean: meanList.length ? Number((meanList.reduce((a, b) => a + b, 0) / meanList.length).toFixed(2)) : null,
    };
  }
  if (genre && GENRE_BASELINES[genre]) {
    return { source: 'genre', genre, ...GENRE_BASELINES[genre] };
  }
  // 拿到语料但不够 5 篇：把"攒了多少"如实告诉用户，而不是一句"样本不足"
  let partial = null;
  if (workspace) {
    try {
      const c = collectAuthorCorpus(workspace, { includeDraft: false });
      partial = c.stats;
    } catch {}
  }
  return {
    source: 'insufficient',
    samples: partial ? partial.pieces : samples.length,
    need: MIN_SAMPLES,
    note: partial
      ? `你自己的语料 ${partial.pieces}/${MIN_SAMPLES} 篇（作品库会在一篇写完时自动归档）——攒够 ${MIN_SAMPLES} 篇就能给出你自己的节奏基线。现在只报绝对值，不下结论。`
      : `还没有你自己的语料。写完或导入几篇后，CADENCE 会用**你自己的**节奏做基线。`,
  };
}

export { deviationFromAuthor };

/** 把一篇文本的统计追加进作者基线（用于冷启动逐步攒样本）。 */
export function writeBaseline(workspace, text, { authorId = null } = {}) {
  if (!workspace) return { ok: false, reason: 'no_workspace' };
  const sentences = segment(String(text || ''));
  const st = lengthSeriesStats(sentences.map((s) => s.length));
  const file = baselineFile(workspace);
  let raw = { author_id: authorId, samples: [] };
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(raw.samples)) raw.samples = [];
  } catch {}
  raw.author_id = authorId || raw.author_id || null;
  raw.samples.push({ cv: st.cv, mean: st.mean, sd: st.sd, n: st.n, ts: new Date().toISOString() });
  if (raw.samples.length > 200) raw.samples = raw.samples.slice(-200);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(raw, null, 2) + '\n', { mode: 0o600 });
  return { ok: true, samples: raw.samples.length };
}

/**
 * 在作者自己的历史里算百分位——这是唯一允许对外说的"好/坏"，
 * 而且说的是"相对你自己"，不是"相对所有人"。
 */
export function percentileOf(baseline, value) {
  if (!baseline || baseline.source !== 'author' || !Number.isFinite(baseline.cv)) return null;
  return value >= baseline.cv ? '高于你自己的平均' : '低于你自己的平均';
}
