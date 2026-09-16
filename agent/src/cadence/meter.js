// CADENCE · 声律引擎（平仄/押韵）——规格 §7
//
// 三条硬约束，写死在代码里：
//   一、规则后端是唯一真相源，LLM 不参与判定（只可解释）
//   二、必须声明标准（平水韵 / 中华新韵 / 普通话），未声明的结果无效
//   三、现代普通话声调 ≠ 中古平仄；入声字必须查表
//
// ⚠️ 诚实红线：字音表**不能由代码或 LLM 生成**。
// 本仓库不附带完整韵书（那需要可核查的数据源与许可）。所以：
//   · 结构层（句数/字数/体式）照常给结果 —— 这部分不依赖字音表，是真实计算
//   · 平仄层在缺表时**明确返回 unknown 并列出全部未验证字**，
//     tonal_score 返回 null —— 绝不猜、绝不编一个好看的分数
//   · 未收录词牌一律 unknown，不做猜测性判定

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countUnits } from './segment.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TONE_DIR = path.join(HERE, 'tone_data');

/** 标准名 → 数据文件名。三者结果不同，必须显式声明。 */
export const STANDARDS = { pingshui: 'pingshui.json', xinyun: 'xinyun.json', mandarin: 'mandarin.json' };

/** 五言/七言四种基本句式（规格 §7.3：必须拆成四个字段，不能给一个含混标签）。 */
export const PATTERNS = {
  '仄起仄收': { wu: '仄仄平平仄', qi: '仄仄平平平仄仄' },
  '平起仄收': { wu: '平平平仄仄', qi: '平平仄仄平平仄' },
  '仄起平收': { wu: '仄仄仄平平', qi: '仄仄平平仄仄平' },
  '平起平收': { wu: '平平仄仄平', qi: '平平仄仄仄平平' },
};

const P = '平';
const Z = '仄';

/** 句数与字数 → 体式。这部分不依赖字音表，是真实判定。 */
export function detectPoemType(lines) {
  const lens = lines.map((l) => countUnits(l)).filter((n) => n > 0);
  if (!lens.length) return { poem_type: 'unknown', reason: '没有可识别的句子' };
  const set = [...new Set(lens)];
  if (set.length > 1) return { poem_type: 'unknown', reason: `各句字数不一致（${set.join('/')}），不是格律诗` };
  const per = set[0];
  const n = lens.length;
  if (per !== 5 && per !== 7) return { poem_type: 'unknown', reason: `每句 ${per} 字，不是五言/七言` };
  if (per === 5 && n === 4) return { poem_type: 'wujue', per, lines: n };
  if (per === 7 && n === 4) return { poem_type: 'qijue', per, lines: n };
  if (per === 5 && n === 8) return { poem_type: 'wulü', per, lines: n };
  if (per === 7 && n === 8) return { poem_type: 'qilü', per, lines: n };
  if (n > 8 && n % 2 === 0) return { poem_type: 'pailü', per, lines: n };
  return { poem_type: 'unknown', reason: `每句 ${per} 字、共 ${n} 句，未匹配已知体式` };
}

/** 载入字音表。缺表 → null（**不是**空表，含义不同）。 */
export function loadToneTable(standard) {
  const file = STANDARDS[standard];
  if (!file) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(TONE_DIR, file), 'utf8'));
    return {
      standard,
      chars: raw.chars || {},
      source: raw.source || '',
      license: raw.license || '',
      size: Object.keys(raw.chars || {}).length,
      note: raw.note || '',
    };
  } catch {
    return null;
  }
}

/**
 * 单字平仄。
 * 多音字（表里值为数组）无法确定时返回 unknown —— 规格 §7.2 的准确性红线。
 */
export function toneOf(ch, table) {
  if (!table) return { char: ch, tone: 'unknown', source: 'no_table' };
  const v = table.chars[ch];
  if (v === undefined) return { char: ch, tone: 'unknown', source: 'not_in_table' };
  if (Array.isArray(v)) {
    return v.length === 1
      ? { char: ch, tone: v[0], source: 'table' }
      : { char: ch, tone: 'unknown', source: 'ambiguous', candidates: v };
  }
  return { char: ch, tone: v, source: 'table' };
}

/** 句式判定：实例与四种基本式比对，返回最接近的式名与偏差。 */
export function matchPattern(instance) {
  const per = instance.length;
  const key = per === 5 ? 'wu' : per === 7 ? 'qi' : null;
  if (!key) return null;
  let best = null;
  for (const [name, p] of Object.entries(PATTERNS)) {
    const target = p[key];
    const deviations = [];
    for (let i = 0; i < per; i += 1) {
      const actual = instance[i];
      if (actual === 'unknown') continue;
      if (actual !== target[i]) deviations.push({ pos: i + 1, expected: target[i], actual });
    }
    if (!best || deviations.length < best.deviations.length) best = { pattern_name: name, target, deviations };
  }
  return best;
}

/**
 * 孤平：平脚句（末字平）中，除韵脚外只有一个平声字。
 * 只在整句所有字都判出来时才判——有 unknown 就不下结论。
 */
export function detectGuping(instance) {
  if (instance.includes('unknown')) return null;
  if (instance[instance.length - 1] !== P) return null;
  const pings = instance.slice(0, -1).filter((t) => t === P).length;
  return pings === 1 ? { type: 'guping', severity: 'error' } : null;
}

/** 三平调：句末三字全平。 */
export function detectSanping(instance) {
  if (instance.length < 3) return null;
  const tail = instance.slice(-3);
  if (tail.includes('unknown')) return null;
  return tail.every((t) => t === P) ? { type: 'sanping', severity: 'error' } : null;
}

/**
 * 粘对：同一联出句与对句的节奏位平仄相对（对）；
 * 后联出句与前联对句的节奏位相同（粘）。
 * 只比较已判定的节奏位（第 2、4、6 字）。
 */
export function detectNianDui(instances) {
  const rhythmPos = (line) => [1, 3, 5].filter((i) => i < line.length).map((i) => line[i]);
  const warnings = [];
  for (let i = 0; i + 1 < instances.length; i += 2) {
    const a = rhythmPos(instances[i]);
    const b = rhythmPos(instances[i + 1]);
    const cmp = a.filter((t, k) => t !== 'unknown' && b[k] !== 'unknown' && t === b[k]).length;
    const known = a.filter((t, k) => t !== 'unknown' && b[k] !== 'unknown').length;
    if (known && cmp / known > 0.5) {
      warnings.push({ type: 'shidui', severity: 'warn', detail: `第 ${i + 1} 联出句与对句节奏位多处相同（失对）` });
    }
    if (i + 2 < instances.length) {
      const c = rhythmPos(instances[i + 2]);
      const same = b.filter((t, k) => t !== 'unknown' && c[k] !== 'unknown' && t === c[k]).length;
      const ok = b.filter((t, k) => t !== 'unknown' && c[k] !== 'unknown').length;
      if (ok && same / ok < 0.5) {
        warnings.push({ type: 'shinian', severity: 'warn', detail: `第 ${i + 1} 联对句与第 ${i + 2} 联出句节奏位多处不同（失粘）` });
      }
    }
  }
  return warnings;
}

/**
 * 组装格律报告。
 * 缺表时：结构层照常给，平仄层全部 unknown、tonal_score = null，并说明原因。
 */
export function metricalReport(text, { standard = 'pingshui' } = {}) {
  const rawLines = String(text || '')
    .split(/[\n。！？；]+/)
    .map((s) => s.replace(/[，、,：:]/g, '').trim())
    .filter((s) => countUnits(s) > 0);

  const t = detectPoemType(rawLines);
  const table = loadToneTable(standard);
  const unverified = [];

  const lines = rawLines.map((line, i) => {
    const chars = [...line];
    const tones = chars.map((ch) => {
      const r = toneOf(ch, table);
      if (r.tone === 'unknown') unverified.push(r.source === 'ambiguous' ? `多音字：${ch}（${(r.candidates || []).join('/')}）` : ch);
      return r;
    });
    const instance = tones.map((x) => (x.tone === 'unknown' ? 'unknown' : x.tone === P || x.tone === '平' ? P : Z));
    const known = instance.filter((x) => x !== 'unknown').length;
    const matched = known ? matchPattern(instance) : null;
    const devs = [];
    if (matched) {
      for (const d of matched.deviations) {
        // "一三五不论"的边界（规格 §7.4 第五条）：按王力更稳妥的概括，
        // 不是无条件规则——仄脚句可有三字不论、平脚句只可有两字不论（七言）。
        const isOddPos = [1, 3, 5].includes(d.pos);
        const isPingFoot = instance[instance.length - 1] === P;
        const allowed = isOddPos && (isPingFoot ? d.pos <= 2 : true);
        if (!allowed) devs.push({ ...d, severity: 'error' });
      }
    }
    const extra = [...(known ? [detectGuping(instance), detectSanping(instance)].filter(Boolean) : [])];
    return {
      index: i + 1,
      text: line,
      length_chars: chars.length,
      chars: tones.map((x, k) => ({ char: x.char, pos: k + 1, tone: x.tone, source: x.source })),
      pattern_name: matched?.pattern_name || null,
      // 每个位置一个符号：平/仄/？（未判定）。直接 join('unknown') 会变成一长串字母。
      instance_pattern: instance.map((t) => (t === 'unknown' ? '？' : t)).join(''),
      // 内部用：保留 'unknown' 原值，供粘对/孤平/三平调判断。
      // 上面的「？」只是给人看的占位符——**不能拿它去比平仄**，
      // 否则「未判定」会被当成一个真实的声调参与比较，凭空判出失对/失粘
      // （OpenCodeReview 审出来的真 bug）。
      instance_raw: instance,
      deviations: devs,
      extra,
      rhyme_slot: i % 2 === 1,
      rhyme_matched: null,
    };
  });

  const knownTotal = lines.reduce((a, l) => a + l.chars.filter((c) => c.tone !== 'unknown').length, 0);
  const charTotal = lines.reduce((a, l) => a + l.chars.length, 0) || 1;
  const warnings = [];
  if (knownTotal) {
    for (const l of lines) for (const e of l.extra || []) warnings.push(`${e.type === 'guping' ? '孤平' : '三平调'}：第 ${l.index} 句`);
    // 用 instance_raw（含 'unknown'）而不是给人看的「？」占位符
    const instances = lines.map((l) => l.instance_raw);
    for (const w of detectNianDui(instances)) warnings.push(`${w.detail}`);
  }

  const structureScore = t.poem_type === 'unknown' ? null : 1;
  const tonalScore = knownTotal === charTotal && knownTotal > 0
    ? Number((1 - lines.reduce((a, l) => a + l.deviations.length, 0) / charTotal).toFixed(3))
    : null;

  return {
    schema_version: '1.0',
    standard,
    table: table ? { source: table.source, license: table.license, size: table.size, note: table.note } : null,
    poem_type: t.poem_type,
    poem_type_reason: t.reason || null,
    lines,
    structure_score: structureScore,
    tonal_score: tonalScore,
    rhyme_score: null, // 需要韵部表，缺表时不编
    antithesis_score: null,
    warnings,
    unverified_chars: [...new Set(unverified)].slice(0, 80),
    notes: table
      ? [`字音表：${table.source}（${table.size} 字）`, '判定由规则后端完成，LLM 不参与']
      : [
          '本仓库未附带完整字音表，因此**平仄不做判定**（按规格要求：不确定必须标 unknown，绝不猜）',
          '结构层（句数/字数/体式）不依赖字音表，结果是真实的',
          `放入 ${path.join('tone_data', STANDARDS[standard] || '?')} 后即可启用平仄判定；格式见 tone_data/README.md`,
        ],
  };
}
