// CADENCE · 作者语料：样本从**我们自己的 agent** 里取，不去外面找文章
//
// 这是关键的一步。规格里说"分层基线：样本 < 5 篇只用体裁基线"，
// 但样本从来不该去外面找——**agent 本来就在持续收集作者的写作**：
//
//   vault/library/<类别>/*.md   写作完成后自动归档的作者作品（主力样本）
//   draft.md                    当前这篇
//   vault/edits.jsonl           作者每次亲手改写的"改后"文本（最高密度信号）
//
// 所以 CADENCE 的基线是"你自己"的：写得越多，基线越准。
// 冷启动阶段诚实标 insufficient，不拿别人的 CV 冒充你的。

import fs from 'node:fs';
import path from 'node:path';
import { lengthSeriesStats } from './metrics.js';
import { segment } from './segment.js';

/** 归档文件顶部的元信息块（# 标题 / - 分类: …）要剥掉，只留正文。 */
function stripHeader(md) {
  const lines = String(md || '').split('\n');
  const out = [];
  let inHead = true;
  for (const line of lines) {
    if (inHead) {
      if (/^#\s/.test(line) || /^-\s*(分类|归档时间|session|来源|部分)[:：]/.test(line) || !line.trim()) continue;
      inHead = false;
    }
    out.push(line);
  }
  return out.join('\n').trim();
}

/** 从 edits.jsonl 取作者亲手改后的文本（体现的是他的节奏偏好，不是 AI 的）。 */
function readEditTexts(workspace, limit = 50) {
  try {
    const lines = fs
      .readFileSync(path.join(workspace, 'vault', 'edits.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean);
    const out = [];
    for (const l of lines.slice(-limit * 2)) {
      try {
        const j = JSON.parse(l);
        const t = String(j.after || j.new || j.to || '').trim();
        if (t) out.push({ source: 'edit', text: t });
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}

function walkMd(dir, acc, depth = 0) {
  if (depth > 3) return acc;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(p, acc, depth + 1);
    else if (/\.(md|txt)$/i.test(e.name) && !/^index\.json$/i.test(e.name)) acc.push(p);
  }
  return acc;
}

/**
 * 收集作者语料。
 * @returns {{pieces: Array<{source,text,chars}>, stats, bySource}}
 */
export function collectAuthorCorpus(workspace, { includeDraft = true, minChars = 60 } = {}) {
  const pieces = [];
  if (workspace) {
    // 1) 归档作品（主力）
    for (const f of walkMd(path.join(workspace, 'vault', 'library'), [])) {
      try {
        const text = stripHeader(fs.readFileSync(f, 'utf8'));
        if (text.length >= minChars) pieces.push({ source: 'library', file: f, text });
      } catch {}
    }
    // 2) 作者亲手改后的文本
    for (const e of readEditTexts(workspace)) {
      if (e.text.length >= minChars) pieces.push(e);
    }
    // 3) 当前成稿
    if (includeDraft) {
      try {
        const text = stripHeader(fs.readFileSync(path.join(workspace, 'draft.md'), 'utf8'));
        if (text.length >= minChars) pieces.push({ source: 'draft', text });
      } catch {}
    }
  }

  const measured = pieces.map((p) => {
    const sentences = segment(p.text);
    const st = lengthSeriesStats(sentences.map((s) => s.length));
    return { ...p, chars: p.text.replace(/\s/g, '').length, sentences: st.n, cv: st.cv, mean: st.mean, mad: st.mad };
  });

  // 基线的含义是"作者多篇作品各自的 CV，构成他自己的分布"，
  // 所以**每一篇作品就是一个样本**——不能用"句读 ≥8"去筛，
  // 那会把作者归档的短篇全部丢光（实测 6 篇散文只剩 0 篇，基线永远攒不起来）。
  //
  // "句读 <8 不足以判定"这条门槛只针对**评判某一篇**（规格 §6.3），
  // 不是用来丢样本的。样本偏短会让 CV 波动大，所以如实标出来，
  // 而不是假装没有这回事。
  const MIN_SAMPLE_SENTENCES = 4; // 低于 4 句，CV 没有意义
  const usable = measured.filter((p) => p.sentences >= MIN_SAMPLE_SENTENCES);
  const shortSamples = usable.filter((p) => p.sentences < 8).length;
  const bySource = {};
  for (const p of usable) bySource[p.source] = (bySource[p.source] || 0) + 1;

  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const stats = {
    pieces: usable.length,
    skipped: measured.length - usable.length,
    shortSamples,
    cv: usable.length ? Number(avg(usable.map((p) => p.cv)).toFixed(3)) : null,
    mean: usable.length ? Number(avg(usable.map((p) => p.mean)).toFixed(2)) : null,
    mad: usable.length ? Number(avg(usable.map((p) => p.mad)).toFixed(2)) : null,
    // 作者节奏的波动范围：给出区间比给单一均值更有用
    cvRange: usable.length ? [Math.min(...usable.map((p) => p.cv)), Math.max(...usable.map((p) => p.cv))] : null,
  };

  return { pieces: usable, all: measured, stats, bySource };
}

/**
 * 作者偏离度：这篇相对"你自己的节奏区间"在哪里。
 * 只报告相对自己，不做跨作者判断（规格 §1.2 第一条）。
 */
export function deviationFromAuthor(corpus, currentCv) {
  const s = corpus?.stats;
  if (!s || s.pieces < 5 || s.cvRange == null) {
    return { ok: false, reason: `作者样本 ${s?.pieces ?? 0} 篇，不足 5 篇`, source: 'insufficient' };
  }
  const [lo, hi] = s.cvRange;
  const pos = currentCv < lo ? 'below' : currentCv > hi ? 'above' : 'within';
  return {
    ok: true,
    source: 'author',
    pieces: s.pieces,
    authorCv: s.cv,
    authorRange: s.cvRange,
    current: currentCv,
    position: pos,
    note:
      pos === 'within'
        ? `这篇 CV ${currentCv}，落在你自己 ${lo}–${hi} 的区间内`
        : pos === 'below'
          ? `这篇 CV ${currentCv}，比你自己的区间 ${lo}–${hi} 更平（更均匀）`
          : `这篇 CV ${currentCv}，比你自己的区间 ${lo}–${hi} 更起伏`,
  };
}
