// CSLA InnovationElicitor（v1.0）
// 目标：q* = argmax_q [ IG(q) − λ·Cost(q) − μ·Intrusion(q) ]，每轮只问一个最高价值问题。
// 保护 Human ownership of Core Idea：不替用户把核心观点"生成"掉，只挖用户没说出口的。
// Failure cases：
//   F1 空状态 → 仍返回一个有效问题（不许卡死）；
//   F2 状态已完备 → 返回 null（不许过度追问）；
//   F3 同输入同输出（确定性，可复现）。

// 问题候选：按状态缺口给出类型与启发式 IG（0–1，确定性）。
function candidates(state) {
  const s = state || {};
  const list = [];
  if (!s.coreIdea || !s.coreIdea.trim()) {
    list.push({
      type: 'clarify',
      question: '你最想说的那件事是什么？它为什么非说不可？',
      ig: 0.95,
      cost: 1,
      intrusion: 0.2,
    });
    return list;
  }
  if (!s.hypotheses?.length) {
    list.push({
      type: 'differentiate',
      question: '你这个想法，和一般人的常见看法有什么不同？',
      ig: 0.85,
      cost: 1,
      intrusion: 0.3,
    });
    list.push({
      type: 'why',
      question: '你为什么会有这个判断？是哪个经历或推理让你得出它的？',
      ig: 0.8,
      cost: 1,
      intrusion: 0.35,
    });
    return list;
  }
  if (!s.evidence?.length) {
    list.push({
      type: 'counterexample',
      question: '什么情况会推翻这个想法？你先想想它最脆弱的环节。',
      ig: 0.7,
      cost: 1,
      intrusion: 0.4,
    });
    return list;
  }
  if (!s.decisions?.length) {
    list.push({
      type: 'boundary',
      question: '这个观点在哪里不成立？它的边界是什么？',
      ig: 0.5,
      cost: 1,
      intrusion: 0.4,
    });
    list.push({
      type: 'implication',
      question: '如果这个想法是对的，会意味着什么？',
      ig: 0.55,
      cost: 1,
      intrusion: 0.3,
    });
    return list;
  }
  return list;
}

/** 确定性选问：score = IG − λ·Cost − μ·Intrusion。 */
export function pickQuestion(state, { lambda = 0.2, mu = 0.25 } = {}) {
  const c = candidates(state);
  if (!c.length) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const q of c) {
    const score = q.ig - lambda * q.cost - mu * q.intrusion;
    if (score > bestScore) {
      bestScore = score;
      best = { ...q, score: Number(score.toFixed(4)) };
    }
  }
  return best;
}

/** 把用户回答吸收进核心想法：答案并入 coreIdea 的原始证据，不替用户改写观点。 */
// ─────────────────────────────────────────────────────────────
// 智能提问（红队 R1–R3 修复）：固定问题库只是**兜底**。
// 真实使用时按"当前主题 + 已答内容 + 还没答的缺口"生成一个**贴题的问题**，
// 并要求：只问一个问题、不复述已回答内容、不重复问过的句子、中学生能答、≤40 字。
// LLM 不可用 / 失败 / 输出不合规 → 回退固定库（保证不卡死，F1 保持）。
// ─────────────────────────────────────────────────────────────

const QUESTION_SYS = `你是写作访谈者。只输出一个中文问题，不要解释、不要编号、不要引号。
硬性要求：
1) 只问一个最关键的问题，≤40 字；
2) 必须贴着用户**当前这个话题**问，不能问与话题无关的通用问题；
3) 不要复述用户已经说过的内容；
4) 不要问已经问过的问题；
5) 用中学生能直接回答的口语，不要术语；
6) 目标是帮用户把"他到底想说什么"挖出来，而不是评价他的想法。`;

function normQ(s) {
  return String(s || '').replace(/\s+/g, '').replace(/[，。！？、；：""''（）]/g, '');
}

/** 兜底问题变体库：同类缺口给多个说法，避免"每次都问同一句"。 */
const BANK_VARIANTS = {
  clarify: [
    '你最想说的那件事是什么？它为什么非说不可？',
    '如果只能用一句话说清你想表达什么，那句话是什么？',
    '你希望读者读完之后记住哪一句？为什么是它？',
  ],
  differentiate: [
    '你这个想法，和一般人的常见看法有什么不同？',
    '别人多半会怎么说这件事？你哪里不同意？',
  ],
  why: [
    '你为什么会有这个判断？是哪个经历或推理让你得出它的？',
    '这件事你是从什么时候开始这么想的？中间发生了什么？',
  ],
  counterexample: [
    '什么情况会推翻这个想法？你先想想它最脆弱的环节。',
    '如果有人说你错了，他最可能从哪一点反驳你？',
  ],
  boundary: ['这个观点在哪里不成立？它的边界是什么？'],
  implication: ['如果这个想法是对的，会意味着什么？'],
};

/**
 * 用 LLM 生成贴题问题；不合规就返回 null（由调用方回退固定库）。
 * @param {object} state 当前认知状态
 * @param {object} o { llm, topic, askedTexts }
 */
export async function generateQuestion(state, { llm = null, topic = '', askedTexts = [] } = {}) {
  if (!llm) return null;
  const s = state || {};
  const answered = [
    s.coreIdea ? `已确认核心：${String(s.coreIdea).slice(0, 80)}` : '',
    s.hypotheses?.length ? `已有假设：${s.hypotheses.slice(0, 3).map((h) => (typeof h === 'string' ? h : h.claim || '')).join('；').slice(0, 120)}` : '',
    s.evidence?.length ? `已有证据 ${s.evidence.length} 条` : '',
    s.decisions?.length ? `已有决定 ${s.decisions.length} 条` : '',
  ].filter(Boolean).join('\n');
  const gaps = [
    !s.coreIdea ? '还不知道他到底想说什么（核心想法）' : '',
    s.coreIdea && !s.hypotheses?.length ? '还没形成任何可检验的想法/主张' : '',
    s.hypotheses?.length && !s.evidence?.length ? '还没考虑过反例或反方' : '',
    s.evidence?.length && !s.decisions?.length ? '还没确定这个观点的边界' : '',
  ].filter(Boolean).join('；');
  const asked = askedTexts.slice(-6).map((t, i) => `${i + 1}. ${t}`).join('\n') || '（无）';
  const ask = `${topic ? `用户这次想写：${topic}\n` : ''}${answered ? `${answered}\n` : ''}当前缺口：${gaps || '信息基本齐备'}\n已经问过的问题：\n${asked}\n\n请给出下一个问题。`;
  try {
    const out = String((await llm([{ role: 'system', content: QUESTION_SYS }, { role: 'user', content: ask }])) || '').trim();
    const one = out.split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';
    const q = one.replace(/^[-*\d.、)）\s]+/, '').replace(/^["“「『]|["”」』]$/g, '').trim();
    if (!q || q.length > 40) return null;
    if (/[?？]$/.test(q) === false && q.length > 30) return null; // 太长且不像问题 → 丢弃
    const nq = normQ(q);
    if (askedTexts.some((t) => normQ(t) === nq || normQ(t).includes(nq) || nq.includes(normQ(t)))) return null; // 重复 → 丢弃
    if (!/[\u4e00-\u9fff]/.test(q)) return null;
    return q;
  } catch {
    return null;
  }
}

/** 贴题提问（异步）：优先 LLM 生成，失败回退固定库；保证永不返回空。 */
export async function pickQuestionSmart(state, { llm = null, topic = '', askedTexts = [], interaction = null } = {}) {
  const fallback = pickQuestion(state);
  const made = await generateQuestion(state, { llm, topic: topic || state?.topic || '', askedTexts });
  if (made) {
    return {
      type: fallback?.type || 'clarify',
      question: made,
      ig: fallback?.ig ?? 0.9,
      cost: fallback?.cost ?? 1,
      intrusion: fallback?.intrusion ?? 0.25,
      source: 'llm',
      score: fallback?.score ?? 0.9,
    };
  }
  if (!fallback) return null;
  // 兜底也要避免"换汤不换药地重复问"：优先挑没问过的变体（红队 R2）
  const variants = BANK_VARIANTS[fallback.type] || [fallback.question];
  const unasked = variants.find((v) => !askedTexts.some((t) => normQ(t) === normQ(v)));
  if (unasked) return { ...fallback, question: unasked, source: 'bank' };
  // 所有变体都问过了 → 标记重复，由调用方决定是否停止追问
  return { ...fallback, source: 'bank', repeat: true };
}

export function captureCoreIdea(state, answer) {
  const text = String(answer || '').trim();
  if (!text) throw new Error('captureCoreIdea requires a non-empty answer');
  return { coreIdea: text, intent: state.intent || '' };
}
