// 双色 diff —— 事实层 / 风格层分离（PRISM 创新点三 + 论纲 §8.1）
// 目的：回答作者最关心的那个问题——"AI 到底改了我什么？是改了我说的事实/主张，还是只改了说法？"
// 判定：事实层改动 = 数字/年份/专有名词/断言与否定极性/模态强度；风格层改动 = 连接词/副词/修辞/虚词/标点。
// 确定性实现（零 token），可作为"风格层改写、事实层锁定"的验证器。

const FACT_MARKS = /(\d{3,4}\s*年|\d+(\.\d+)?%|[\d０-９]+[万亿]?[人个座篇家所层米公里吨元]|研究表明|数据表明|统计|实验|调查|报告显示|调查显示)/;
const CLAIM_VERBS = /(是|不是|并非|属于|导致|证明|表明|说明|意味着|必须|应当|不能|不可能|一定|必然|从未|总是|所有|任何)/;
const NEGATION = /(不|没|无|未|别|非)/;

/**
 * 含"否定字"但不表否定的常用词。
 *
 * 这是 OpenCodeReview 审出来的真 bug：判否定极性时只要看到"不/无/非"就算一次否定，
 * 于是把**正当的风格替换**误判成"改了事实"并拒绝交付：
 *   非常 → 十分   被拒（"非"被当成否定）
 *   无疑 → 肯定   被拒（"无"被当成否定）
 *   无数 → 很多   被拒
 * 实测 5 组常见替换里 3 组被误拒——和早先 A/B 实验里"中文改写 3/3 被拒"是同一类病。
 * 做法：先剥掉这些"看着像否定、其实不是"的词，再判极性。
 * 只收并列/副词/成语这类**明确不否定**的词；像"没有""不是"这种真否定一个都不收。
 */
const NON_NEGATING =
  /(非常|非常规|无比|无疑|无论|无数|无非|无妨|无可奈何|无时无刻|非但|非凡|非议|不仅|不但|不管|不外乎|不失为|不无|不时|不约而同|不由自主|不知所措|不折不扣|迫不及待|无可厚非|不妨|不曾想|不由得)/g;

/** 真正的否定极性判断：先剥掉非否定词，再看有没有否定字。 */
function hasNegation(t) {
  return NEGATION.test(String(t || '').replace(NON_NEGATING, ''));
}
const MODAL_STRONG = /(必然|一定|毫无疑问|肯定|绝对|从不|永远)/;
const MODAL_WEAK = /(可能|也许|大概|似乎|或许|大概|倾向于|某种程度上|我猜|怀疑)/;
const STYLE_CONNECT = /(而且|然而|因此|所以|此外|另外|不过|同时|于是|总之|综上|换言之|换句话说|首先|其次|最后)/;
const STYLE_ADVERB = /(非常|十分|极其|相当|格外|尤其|特别|略显|略微|稍稍|颇为|甚为)/;
const STYLE_RHETORIC = /(像|如同|仿佛|宛如|好似|犹如|恰似|一般|一样)/;
const STYLE_PARTICLE = /(的|了|着|吧|呢|啊|嘛|哦|呀|罢了|而已)/;

/** 把文本切成"变化单元"：优先按句切，保留标点。 */
export function toUnits(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  return t
    .split(/(?<=[。！？!?；;\n])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const chars = (s) => [...String(s || '')];

/** 字符级 LCS：返回变化块 [{type:'same'|'del'|'add', text}]，用于最小 diff 呈现。 */
export function charDiff(before, after) {
  const a = chars(before);
  const b = chars(after);
  const n = a.length;
  const m = b.length;
  // 长度保护：超长文本退化为整体替换（避免 O(n*m) 爆内存）
  if (n * m > 400000) {
    return before === after ? [{ type: 'same', text: before }] : [{ type: 'del', text: before }, { type: 'add', text: after }];
  }
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  const push = (type, text) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('del', a[i]);
      i += 1;
    } else {
      push('add', b[j]);
      j += 1;
    }
  }
  while (i < n) push('del', a[i++]);
  while (j < m) push('add', b[j++]);
  return out;
}

/**
 * ⚠️ 已删除：classifyChange（原第 901-127 行）
 *
 * 它是 dualDiff 早期的单块判定函数，改用句子级序列对齐后用不上了：
 * dualDiff 现在走 classifyRun，按对齐/增删片段分层。
 * 它定义了但**全仓没有任何调用点**（OpenContracts 审查指出），而且它的 STYLE_* 词表
 * 与 classifyRun 用的 SIM_STYLE 是两份，会各自漂移——留着只会误导。
 */

/**
 * 风格层归一：去掉连接词/副词/虚词/标点后剩下的"内容骨架"，用于判断
 * 两句话是不是同一句话（只是被改了说法、拆过句、并过句）。
 */
const SIM_STYLE =
  /(而且|然而|因此|所以|此外|另外|不过|同时|于是|总之|综上|换言之|换句话说|首先|其次|最后|非常|十分|极其|相当|格外|尤其|特别|的|了|着|吧|呢|啊|嘛|哦|呀|罢了|而已|[，。！？；：、""''（）《》—…\s])/g;

const FACT_TOKEN = /(\d{3,4}\s*年|\d+(\.\d+)?%|[\d０-９]+[万亿]?[人个座篇家所层米公里吨元]|必然|一定|毫无疑问|肯定|绝对|从不|永远|可能|也许|大概|似乎|或许|倾向于|某种程度上)/g;

const NEG_TOKEN = /(不|没|无|未|非)/g;

/** 内容骨架：用于"是不是同一句话"的相似度判断。 */
export function unitCore(unit) {
  return String(unit || '').replace(SIM_STYLE, '');
}

function sameUnit(a, b) {
  const ca = unitCore(a);
  const cb = unitCore(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  // 一方是另一方的残片（拆句/并句）且长度不过分悬殊
  if (ca.includes(cb) || cb.includes(ca)) {
    // 阈值实测标定：0.45/0.6 时，被拆开的长句会跟"后半截"配成一对，
    // 于是丢掉的前半截（例如"不是手机本身可怕"）被误判成否定翻转；
    // 0.7 时这类情况退回"未对齐片段"路径，由 classifyRun 拿对面全文核对，不再误报。
    return Math.min(ca.length, cb.length) / Math.max(ca.length, cb.length) >= 0.7;
  }
  const setB = new Set([...cb]);
  const hit = [...new Set([...ca])].filter((c) => setB.has(c)).length;
  const union = new Set([...ca, ...cb]).size;
  return union > 0 && hit / union >= 0.55;
}

/**
 * 句子级序列对齐（LCS）。
 *
 * 这是本文件的核心修复：**不能按位置逐句配对**。语言模型改写时几乎一定会
 * 拆句或并句，一旦句数变了，按位置配对就会从拆句处整体错位，
 * 于是"第 2 句 vs 第 2 句"其实是两句毫不相干的话，判出来满屏假事实改动
 * （实测：真实中文改写 3/3 全部被误拒）。改成序列对齐后，只有真正
 * 对应的句子才会被拿来比极性/模态。
 *
 * @returns {Array<[number, number]>} 对齐上的 (beforeIndex, afterIndex) 配对
 */
function alignUnits(bu, au) {
  const n = bu.length;
  const m = au.length;
  // 与 charDiff 同样的长度保护：DP 是 O(n×m)，而且每个格子里还要跑 sameUnit
  // （正则替换 + 两次 Set 构造）。长文本（几万字的稿子按句切仍有上千句）
  // 会直接卡死甚至 OOM——charDiff 早就有这个保护，这里漏了。
  if (n * m > 400000) {
    // 退化策略：按位置配对（至少不会卡死），并如实标记为近似对齐
    const pairs = [];
    for (let i = 0; i < Math.min(n, m); i += 1) pairs.push([i, i]);
    pairs.approximate = true;
    return pairs;
  }
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = sameUnit(bu[i], au[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (sameUnit(bu[i], au[j]) && dp[i][j] === dp[i + 1][j + 1] + 1) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

/**
 * 未对齐片段（增/删/拆/并）的分层。
 *
 * 关键设计：只增删的片段**拿到对面全文里去找**同样的事实标记。
 * 例如"却必须明确边界"被拆成"可边界，必须明确"——"必须"在对面仍然存在，
 * 就不是丢失主张，只是换了说法。只有对面全文里彻底找不到的数字/模态/否定，
 * 才算真的改了事实。
 */
function classifyRun(beforeRun, afterRun, fullBefore, fullAfter) {
  const factHits = [];
  const styleHits = [];
  const b = String(beforeRun || '');
  const a = String(afterRun || '');

  if (!b) {
    for (const t of new Set(a.match(FACT_TOKEN) || [])) {
      if (!String(fullBefore).includes(t)) factHits.push(`added_fact:${t}`);
    }
    for (const t of new Set(a.replace(NON_NEGATING, '').match(NEG_TOKEN) || [])) {
      if (!String(fullBefore).includes(t)) factHits.push(`added_polarity:${t}`);
    }
  } else if (!a) {
    for (const t of new Set(b.match(FACT_TOKEN) || [])) {
      if (!String(fullAfter).includes(t)) factHits.push(`dropped_fact:${t}`);
    }
    for (const t of new Set(b.replace(NON_NEGATING, '').match(NEG_TOKEN) || [])) {
      if (!String(fullAfter).includes(t)) factHits.push(`dropped_polarity:${t}`);
    }
  } else {
    // 双向都有的改写片段：数字必须逐一对上，极性/模态不许翻转
    const nums = (s) => (s.match(/\d+(\.\d+)?/g) || []).join(',');
    if (nums(b) !== nums(a)) factHits.push('number_changed');
    if (hasNegation(b) !== hasNegation(a)) factHits.push('polarity_flip');
    if (MODAL_WEAK.test(b) && MODAL_STRONG.test(a)) factHits.push('modal_strength_raise');
    if (MODAL_STRONG.test(b) && MODAL_WEAK.test(a)) factHits.push('modal_strength_lower');
  }

  if (STYLE_CONNECT.test(b) || STYLE_CONNECT.test(a)) styleHits.push('connective');
  if (STYLE_ADVERB.test(b) || STYLE_ADVERB.test(a)) styleHits.push('adverb');
  if (STYLE_RHETORIC.test(b) || STYLE_RHETORIC.test(a)) styleHits.push('rhetoric');
  if (/[，。！？；：、""''（）]/.test(b) || /[，。！？；：、""''（）]/.test(a)) styleHits.push('punctuation');
  if (!factHits.length && !styleHits.length) styleHits.push('resegmented');

  const layer = factHits.length && styleHits.length ? 'mixed' : factHits.length ? 'fact' : 'style';
  return { layer, factHits, styleHits };
}

/**
 * 双色 diff：序列对齐配对 → 字符级变化块 → 分层。
 * 返回 {changes, stats, verdict}；verdict='style_only' 表示"只改了说法，没改事实/主张"。
 */
export function dualDiff(before = '', after = '') {
  const bu = toUnits(before);
  const au = toUnits(after);
  const changes = [];
  const pairs = alignUnits(bu, au);
  const push = (b, a) => {
    const blocks = b === a ? [] : charDiff(b, a);
    const del = blocks.filter((x) => x.type === 'del').map((x) => x.text).join('');
    const add = blocks.filter((x) => x.type === 'add').map((x) => x.text).join('');
    const cls = classifyRun(b, a, before, after);
    changes.push({
      unit: changes.length + 1,
      before: b,
      after: a,
      removed: del,
      added: add,
      layer: cls.layer,
      evidence: [...cls.factHits, ...cls.styleHits],
      blocks,
    });
  };

  let bi = 0;
  let ai = 0;
  for (const [pi, qi] of pairs) {
    // 对齐缝隙：这一对之前所有没配上的句子，是一段拆句/并句/增删
    const bRun = bu.slice(bi, pi).join('');
    const aRun = au.slice(ai, qi).join('');
    if (bRun || aRun) push(bRun, aRun);
    // 对齐上的这一对：只有真的不一样才记一笔
    if (bu[pi] !== au[qi]) push(bu[pi], au[qi]);
    bi = pi + 1;
    ai = qi + 1;
  }
  const tailB = bu.slice(bi).join('');
  const tailA = au.slice(ai).join('');
  if (tailB || tailA) push(tailB, tailA);

  const factChanges = changes.filter((c) => c.layer === 'fact' || c.layer === 'mixed').length;
  const styleChanges = changes.filter((c) => c.layer === 'style' || c.layer === 'mixed').length;
  // neutral 层目前不可达：classifyRun 对未对齐片段至少会给一个 style 标记（resegmented）。
  // 保留字段是为了不破坏调用方，但它是恒为 0 的——不要拿它当"中性改动"的指标。
  const neutral = changes.filter((c) => c.layer === 'neutral').length;
  const total = changes.length;
  const factRatio = total ? Number((factChanges / total).toFixed(3)) : 0;
  return {
    changes,
    stats: { total, factChanges, styleChanges, neutral, factRatio },
    verdict: total === 0 ? 'identical' : factChanges === 0 ? 'style_only' : styleChanges === 0 ? 'fact_only' : 'facts_and_style',
  };
}

/** 风格层改写守卫：只允许风格层变化，事实层必须零改动（棱镜"就地转换"的硬约束）。 */
export function styleOnlyGuard(before, after) {
  const d = dualDiff(before, after);
  const factChanges = d.changes.filter((c) => c.layer === 'fact' || c.layer === 'mixed');
  return {
    ok: factChanges.length === 0,
    factChanges: factChanges.map((c) => ({ before: c.before, after: c.after, evidence: c.evidence })),
    stats: d.stats,
    verdict: d.verdict,
  };
}
