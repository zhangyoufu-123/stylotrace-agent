// 棱镜三视图（PRISM 创新点一）：同一段文字，三个视角同时看，并且可以"就地转换"。
//   视图 A 原文      —— 作者原句（含冻结标记）
//   视图 B 事实层    —— 这段说了什么：断言/数字/极性/模态强度
//   视图 C 风格层    —— 这段怎么说的：连接词/修辞/副词/虚词/节奏
// 就地转换 = 只改风格层、事实层锁定；改完必须用双色 diff 自证"事实层零改动"，否则拒绝结果。
import * as dd from './dual-diff.js';
import * as dc from './decision.js';
import { deAiDirective } from '../ai-tells.js';

const ASSERT = /(是|不是|并非|属于|导致|造成|证明|表明|说明|意味着|必须|应当|不能|不可能|从未|总是|所有|任何|需要|应该)/g;
const NUMBER = /(\d{3,4}\s*年|\d+(\.\d+)?%|[\d０-９]+[万亿]?[人个座篇家所层米公里吨元])/g;
const MODAL_STRONG = /(必然|一定|毫无疑问|肯定|绝对|从不|永远)/g;
const MODAL_WEAK = /(可能|也许|大概|似乎|或许|倾向于|某种程度上|我猜|怀疑)/g;
const NEGATION = /(不|没|无|未|非)/g;

const CONNECT = /(而且|然而|因此|所以|此外|另外|不过|同时|于是|总之|综上|换言之|换句话说|首先|其次|最后)/g;
const ADVERB = /(非常|十分|极其|相当|格外|尤其|特别|略显|略微|稍稍|颇为|甚为)/g;
const RHETORIC = /(像|如同|仿佛|宛如|好似|犹如|恰似|一般|一样)/g;
const PARTICLE = /(的|了|着|吧|呢|啊|嘛|哦|呀|罢了|而已)/g;

const uniq = (arr) => [...new Set(arr)];
const hits = (text, re) => uniq(String(text).match(re) || []);

/** 事实层视图：这段"说了什么"（可被核对、可被证伪的部分）。 */
export function factView(text) {
  const t = String(text || '');
  const nums = hits(t, NUMBER);
  const asserts = hits(t, ASSERT);
  const strong = hits(t, MODAL_STRONG);
  const weak = hits(t, MODAL_WEAK);
  const neg = hits(t, NEGATION);
  const claims = t
    .split(/(?<=[。！？!?；;\n])/)
    .map((s) => s.trim())
    .filter((s) => s && (ASSERT.test(s) || NUMBER.test(s)))
    .map((s) => s.replace(/\s+/g, ''));
  return {
    claims: claims.slice(0, 8),
    numbers: nums,
    assertions: asserts,
    modalStrength: strong.length ? 'strong' : weak.length ? 'weak' : 'neutral',
    modalMarks: strong.length ? strong : weak,
    negations: neg,
    count: claims.length,
  };
}

/** 风格层视图：这段"怎么说的"（可替换、可迁移的部分）。 */
export function styleView(text) {
  const t = String(text || '');
  const sentences = t.split(/(?<=[。！？!?；;\n])/).map((s) => s.trim()).filter(Boolean);
  const lens = sentences.map((s) => (s.match(/[\u4e00-\u9fff]/g) || []).length);
  const avg = lens.length ? Number((lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1)) : 0;
  const rhythm = lens.length < 2 ? 'flat' : Math.max(...lens) - Math.min(...lens) >= 12 ? 'wavy' : 'even';
  return {
    connectives: hits(t, CONNECT),
    adverbs: hits(t, ADVERB),
    rhetoric: hits(t, RHETORIC),
    particles: hits(t, PARTICLE),
    punctuation: hits(t, /[，。！？；：、—…""''（）]/g).length,
    sentenceCount: sentences.length,
    avgSentenceLen: avg,
    sentenceLens: lens,
    rhythm,
  };
}

/** 三视图合并（原文 + 冻结标记）。 */
export function analyzePrism(workspace, text) {
  const frozen = workspace ? dc.listDecisions(workspace).map((d) => d.spanText) : [];
  const t = String(text || '');
  const frozenHits = frozen.filter((f) => t.includes(f));
  return {
    original: t,
    frozenSpans: frozenHits,
    fact: factView(t),
    style: styleView(t),
    dualDiffSelf: dd.dualDiff(t, t).verdict, // = identical（自检基线）
  };
}

/** 人类可读的三视图（CLI/文档用）。 */
export function renderPrism(p) {
  const L = [];
  L.push('【视图 A · 原文】');
  L.push(p.original || '（空）');
  if (p.frozenSpans?.length) L.push(`🔒 冻结保护：${p.frozenSpans.join(' / ')}`);
  L.push('');
  L.push('【视图 B · 事实层（说了什么）】');
  L.push(`主张：${p.fact.claims.join(' ｜ ') || '（无显式主张）'}`);
  L.push(`数字/年份：${p.fact.numbers.join('、') || '（无）'}`);
  L.push(`断言词：${p.fact.assertions.join('、') || '（无）'}`);
  L.push(`模态强度：${p.fact.modalStrength}${p.fact.modalMarks.length ? `（${p.fact.modalMarks.join('、')}）` : ''}`);
  L.push(`否定：${p.fact.negations.join('、') || '（无）'}`);
  L.push('');
  L.push('【视图 C · 风格层（怎么说的）】');
  L.push(`连接词：${p.style.connectives.join('、') || '（无）'}`);
  L.push(`副词：${p.style.adverbs.join('、') || '（无）'}`);
  L.push(`修辞：${p.style.rhetoric.join('、') || '（无）'}`);
  L.push(`句数/平均句长：${p.style.sentenceCount} / ${p.style.avgSentenceLen} 字`);
  L.push(`节奏：${p.style.rhythm === 'wavy' ? '起伏（长短交错）' : p.style.rhythm === 'even' ? '均匀' : '单句'}`);
  return L.join('\n');
}

const RESTYLE_SYS = `你是风格层改写器。铁律：
1) 只允许改"怎么说的"：连接词、语序、断句、修辞、语气、副词、标点。
2) 绝对不许改"说了什么"：不许改任何数字、年份、百分比；不许改否定（是/不是）；
   不许改断言强度（可能→必然 之类一律禁止）；不许增删事实或主张。
3) 输出只有改写后的正文，不要解释、不要标题。`;

const OUT_RULE = '直接给最终正文。不要分析、不要解释、不要复述原文、不要逐条说明你改了什么、不要写"原文："。';

/**
 * 输出卫生检查：模型偶尔不输出正文，而是把"思考过程"整段吐出来
 * （实测：真实模型一次吐了 13310 字推理，远超原文 242 字，把成品彻底污染）。
 * 这种输出不能当候选稿，必须判为坏尝试并重来，否则用户拿到的就是一堆自我分析。
 */
export function looksLeaked(out, src) {
  const o = String(out || '').trim();
  const s = String(src || '');
  if (!o) return true;
  if (o.length / Math.max(1, s.length) > 3) return true;
  if (/^(我们需要|让我|好的，我|首先我需要|分析[:：]|原文[:：]|改写后[:：]|以下(是|为))/m.test(o)) return true;
  if ((o.match(/原文[:：]/g) || []).length >= 1 && o.length > s.length * 1.5) return true;
  return false;
}

/**
 * 就地转换：只改风格层，事实层锁定。
 * 生成后用双色 diff 自证；若事实层被改动 → 重试一次 → 仍失败则**拒绝结果**（不静默返回）。
 */
export async function restyleOnly({ text, llm, direction = '', attempts = 2 }) {
  const src = String(text || '');
  if (!src.trim()) return { ok: false, reason: 'empty_text' };
  if (!llm) return { ok: false, reason: 'no_llm' };
  const tries = [];
  let candidate = src;
  let strict = false;
  let lastLeak = '';
  for (let i = 0; i < attempts; i += 1) {
    // 只列这篇里真的出现的 AI 腔（25 类模式目录里命中哪几条），
    // 比泛泛一句"去掉 AI 味"更能落到实处；事实层仍由下面的守卫锁死。
    const tellHint = i === 0 && !strict ? deAiDirective(src) : '';
    const ask = [
      RESTYLE_SYS,
      direction ? `改写方向：${direction}` : '',
      tellHint,
      `原文：\n${src}`,
      i === 0 && !strict ? '' : OUT_RULE,
      '只输出改写后的正文。',
    ]
      .filter(Boolean)
      .join('\n\n');
    try {
      const out = String((await llm([{ role: 'user', content: ask }])) || '').trim();
      if (looksLeaked(out, src)) {
        // 吐的是推理不是正文 —— 不当候选稿，改用严格版提示重来
        tries.push({ attempt: i + 1, ok: false, verdict: 'leaked_reasoning', chars: out.length });
        lastLeak = out;
        strict = true;
        continue;
      }
      candidate = out || src;
    } catch (e) {
      tries.push({ attempt: i + 1, error: String(e.message || e) });
      continue;
    }
    const guard = dd.styleOnlyGuard(src, candidate);
    tries.push({ attempt: i + 1, ok: guard.ok, verdict: guard.verdict, factChanges: guard.factChanges.length });
    if (guard.ok) {
      return { ok: true, original: src, restyled: candidate, guard, dualDiff: dd.dualDiff(src, candidate), attempts: i + 1, tries };
    }
  }
  if (lastLeak && candidate === src) {
    return { ok: false, reason: 'leaked_reasoning', original: src, rejected: lastLeak, attempts, tries };
  }
  return {
    ok: false,
    reason: 'fact_layer_changed',
    original: src,
    rejected: candidate,
    guard: dd.styleOnlyGuard(src, candidate),
    attempts: attempts,
    tries,
  };
}
