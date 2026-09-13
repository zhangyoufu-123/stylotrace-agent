// CADENCE · 反模式检测（规格 §6.2 六条，每条都可解释）
//
// 纪律：不输出"这是 AI 写的"。只描述结构事实（"这几句长度几乎一样"），
// 由作者判断这是不是问题——说明文里均匀本来就是优点。

import { mean, mad, permutationEntropy, sd } from './metrics.js';

const ANTIPATTERN_LABELS = {
  uniform_run: '连续等长句',
  mechanical_alternation: '机械交替',
  boundary_misalign: '边界错位',
  choppy_groups: '气群过碎',
  connective_stack: '连接词堆叠',
  punctuation_monotony: '标点单一化',
};

export const ANTIPATTERN_LABELS_ALL = ANTIPATTERN_LABELS;

/** 一：连续 3 个以上句读，长度差 ≤ 2 字 */
function uniformRun(lengths) {
  const hits = [];
  let start = 0;
  for (let i = 1; i < lengths.length; i += 1) {
    if (Math.abs(lengths[i] - lengths[i - 1]) <= 2) continue;
    if (i - start >= 3) hits.push({ from: start, to: i - 1 });
    start = i;
  }
  if (lengths.length - start >= 3) hits.push({ from: start, to: lengths.length - 1 });
  return hits.map((h) => ({
    type: 'uniform_run',
    label: ANTIPATTERN_LABELS.uniform_run,
    spans: [h.from + 1, h.to + 1],
    evidence: `第 ${h.from + 1}–${h.to + 1} 句长度几乎一样（差 ≤ 2 字）`,
    hint: '这几句的长度几乎一样，读起来会像打拍子。',
    severity: 'warn',
  }));
}

/** 二：机械交替——长短周期明显，MAD 高但排列熵低 */
function mechanicalAlternation(lengths) {
  if (lengths.length < 6) return [];
  const m = mean(lengths);
  const pattern = lengths.map((l) => (l >= m ? 'L' : 'S')).join('');
  // 找 2 周期主导（LSLS / SLSL）
  let alternations = 0;
  for (let i = 2; i < pattern.length; i += 1) {
    if (pattern[i] === pattern[i - 2]) alternations += 1;
  }
  const ratio = alternations / Math.max(1, pattern.length - 2);
  const entropy = permutationEntropy(lengths);
  const m2 = mad(lengths);
  // 规格 §6.2：机械交替比均匀更糟——看起来有变化，实际是另一种规律
  if (ratio > 0.8 && entropy < 0.75 && m2 > 2) {
    return [
      {
        type: 'mechanical_alternation',
        label: ANTIPATTERN_LABELS.mechanical_alternation,
        spans: [1, lengths.length],
        evidence: `长短交替周期明显（周期一致率 ${(ratio * 100).toFixed(0)}%），排列熵仅 ${entropy.toFixed(2)}`,
        hint: '这里在规律地长短交替，但变化没有落在语义转折上。',
        severity: 'warn',
      },
    ];
  }
  return [];
}

/** 三：边界错位——一个标点句里塞了 ≥2 个气群 */
function boundaryMisalign(misalignments) {
  return misalignments.map((m) => ({
    type: 'boundary_misalign',
    label: ANTIPATTERN_LABELS.boundary_misalign,
    spans: [m.sentenceIndex, m.sentenceIndex],
    evidence: `第 ${m.sentenceIndex} 句里装了 ${m.groups} 个气群（${m.groupLengths.join(' + ')} 字）`,
    hint: '这个句子塞了两个气群，读起来会喘不过气。',
    severity: 'warn',
    breakAfter: m.breakAfter,
  }));
}

/** 四：气群过碎——连续多个气群短于 7 字且不构成并列 */
function choppyGroups(groups) {
  const hits = [];
  let run = [];
  for (const g of groups) {
    if (g.length < 7) run.push(g);
    else {
      if (run.length >= 3) hits.push([...run]);
      run = [];
    }
  }
  if (run.length >= 3) hits.push(run);
  return hits.map((rs) => ({
    type: 'choppy_groups',
    label: ANTIPATTERN_LABELS.choppy_groups,
    spans: [rs[0].sentenceIndex, rs[rs.length - 1].sentenceIndex],
    evidence: `连续 ${rs.length} 个气群短于 7 字（${rs.map((r) => r.length).join('/')} 字）`,
    hint: '这几处断得太碎，像是被随机切开的，不是一个完整的口气。',
    severity: 'info',
  }));
}

/** 五：连接词堆叠——相邻句读以相同连接词开头 */
function connectiveStack(sentences) {
  const LEAD = /^(因为|所以|但是|然而|不过|而且|并且|因此|于是|如果|虽然|尽管|即使|首先|其次|最后|另外|此外|同时|总之)/;
  const hits = [];
  let prev = null;
  let run = 1;
  for (let i = 0; i < sentences.length; i += 1) {
    const m = String(sentences[i].text).match(LEAD);
    const w = m ? m[1] : null;
    if (w && w === prev) {
      run += 1;
      if (run === 2) hits.push({ word: w, at: [i, i + 1] });
    } else {
      if (hits.length) hits[hits.length - 1].at[1] = i;
      prev = w;
      run = 1;
    }
  }
  return hits.map((h) => ({
    type: 'connective_stack',
    label: ANTIPATTERN_LABELS.connective_stack,
    spans: h.at,
    evidence: `连续 ${h.at[1] - h.at[0] + 1} 句以「${h.word}」开头`,
    hint: '连续几句用同样的词开头，节奏会变平。',
    severity: 'info',
  }));
}

/** 六：标点单一化——全段只有逗号+句号 */
function punctuationMonotony(text) {
  const t = String(text || '');
  const kinds = [
    ['顿号', /、/], ['分号', /；/], ['破折号', /—/], ['冒号', /：/],
    ['感叹号', /！/], ['问号', /？/], ['省略号', /…/],
  ].filter(([, re]) => re.test(t)).map(([n]) => n);
  if (kinds.length === 0 && (t.match(/[，。]/g) || []).length >= 6) {
    return [
      {
        type: 'punctuation_monotony',
        label: ANTIPATTERN_LABELS.punctuation_monotony,
        spans: [1, Number.MAX_SAFE_INTEGER],
        evidence: '全段只用了逗号和句号',
        hint: '这段的标点种类很少，句子之间的层次关系没有被标出来。',
        severity: 'info',
      },
    ];
  }
  return [];
}

export function detectAntipatterns({ text, sentences, lengths, groups, misalignments }) {
  return [
    ...uniformRun(lengths),
    ...mechanicalAlternation(lengths),
    ...boundaryMisalign(misalignments),
    ...choppyGroups(groups),
    ...connectiveStack(sentences),
    ...punctuationMonotony(text),
  ];
}
