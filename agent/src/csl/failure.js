// AI Writing Failure Taxonomy + AuthorQuality KPI（产品问题地图 → 可执行检测）
// 分类：Outcome → FailureType → Credit → Policy（与 CSLA Outcome/Credit 引擎直连）。
// 原则：不重造轮子——复用 fake-thinking（表演思考）/ redteam（AI 味）/ originality / avoidance；
// 新增 IdeaIntegrity（偷换核心思想）与 Claim Calibration（立场强度偷偷升级）两类确定性检测。
// 诚实声明：检测器是启发式（可误报/漏报）；LLM 深检是扩展点。
import { deterministicFakeThinking } from '../fake-thinking.js';
import { audit } from '../redteam.js';

export const FAILURE_TYPES = [
  'intent_drift',      // 作者意图漂移
  'idea_flattening',   // 观点被平均化/扁平化
  'style_drift',       // 风格漂移
  'decision_drift',    // 决策方向被改（用户纠正方向）
  'evidence_error',    // 证据缺失/编造
  'reasoning_error',   // 推理错误
  'audience_error',    // 读者错位
  'overclaim',         // 过度断言（立场强度偷偷升级）
  'overconfidence',    // 过度自信
  'ai_artifact',       // AI 套话/表演思考
  'creative_fixation', // 创意固定
  'human_agency_loss', // 人的主体性丧失
  'context_loss',      // 上下文丢失
  'revision_loss',     // 作者已确认文本被覆盖
  'memory_error',      // 记忆错误
  'unclassified',
];

const HEDGE = /(可能|也许|怀疑|似乎|倾向|不太确定|某种程度上|我猜)/;
const BOOST = /(研究表明|事实证明|毫无疑问|必然|一定|已经证明|毋庸置疑|从根本上说)/;

/** 提取中文/英文词元（用于 IdeaIntegrity 的覆盖度检查）。 */
function tokens(text) {
  const t = String(text || '');
  const set = new Set();
  for (const ch of t) {
    if (/[\u4e00-\u9fff]/.test(ch)) set.add(ch);
  }
  for (const m of t.matchAll(/[a-zA-Z]{2,}/g)) set.add(m[0].toLowerCase());
  return [...set];
}

/**
 * 失败分类（确定性启发式；复用现有检测器）。
 * @param {object} o { text, coreIdea, evidence, priorDraft, outcomeValue, source }
 */
export function classifyFailure({ text = '', coreIdea = '', evidence = [], priorDraft = '', outcomeValue, source = '' } = {}) {
  const t = String(text || '');
  const findings = [];

  // 1) 用户方向纠正 → decision_drift（最高可靠信号，优先）
  if (source === 'user-correct' || (outcomeValue !== undefined && outcomeValue < 0.5 && source)) findings.push('decision_drift');

  // 2) AI 套话/表演思考（复用现有检测器）
  try {
    const ft = deterministicFakeThinking(t);
    if (ft && ((ft.issues && ft.issues.length) || (ft.score || 0) > 0.3)) findings.push('ai_artifact');
  } catch {}
  try {
    const a = audit(t);
    if (a && (a.blacklistHits?.length || (a.humanizationScore ?? 100) < 60)) findings.push('ai_artifact');
  } catch {}

  // 2) 过度断言（IdeaIntegrity 的立场强度维度）：brief 用弱词、成稿用强词 → overclaim
  if (HEDGE.test(String(coreIdea || '')) && BOOST.test(t)) findings.push('overclaim');
  if (BOOST.test(t) && !HEDGE.test(t) && (findings.length === 0 || findings.includes('ai_artifact'))) {
    // 无弱词可对比时不判 overclaim（避免误报），仅记录候选
  }

  // 3) IdeaIntegrity（观点偷换）：成稿足够长且核心观点关键词覆盖不足 → idea_drift
  const coreToks = tokens(coreIdea);
  if (t.length >= 20 && coreToks.length >= 4) {
    const present = coreToks.filter((w) => t.includes(w)).length;
    if (present / coreToks.length < 0.45) findings.push('idea_drift');
  }

  // 4) 证据缺失：成稿出现数字/年份/事实模式但无证据 → evidence_error（候选）
  const hasFact = /(\d{3,4}\s*年|\d+%|[\d０-９]+[万亿]?[人个座篇家所层米公里吨元])/.test(t);
  if (hasFact && (!evidence || !evidence.length)) findings.push('evidence_error');

  // 6) 已确认文本被覆盖（revision_loss）：priorDraft 有而新稿消失的已确认片段
  if (priorDraft && priorDraft.length > 20 && t && !t.includes(priorDraft.slice(0, 12))) {
    // 保守：仅当 priorDraft 是作者确认段（本函数不判断确认状态），标记候选
  }

  return {
    failureType: findings[0] || 'unclassified',
    findings: [...new Set(findings)],
    confidence: findings.length ? 0.6 : 0.3, // 启发式置信，如实标注
  };
}

// ── AuthorQuality KPI 向量（Q = Intent/Idea/Individuality/Style/Logic/Evidence/Audience/Agency/Novelty/Factuality）──
const TASK_WEIGHTS = {
  creative: { novelty: 0.18, individuality: 0.18, idea: 0.16, intent: 0.12, style: 0.12, agency: 0.08, logic: 0.06, evidence: 0.04, audience: 0.04, factuality: 0.02 },
  academic: { evidence: 0.2, logic: 0.18, factuality: 0.16, idea: 0.12, intent: 0.1, audience: 0.08, style: 0.06, agency: 0.04, novelty: 0.04, individuality: 0.02 },
  balanced: { intent: 0.12, idea: 0.12, individuality: 0.1, style: 0.1, logic: 0.1, evidence: 0.1, audience: 0.1, agency: 0.1, novelty: 0.08, factuality: 0.08 },
};

export function evaluateAuthorQuality({ dims = {}, task = 'balanced' } = {}) {
  const weights = TASK_WEIGHTS[task] || TASK_WEIGHTS.balanced;
  const dimensions = {};
  let sum = 0;
  let wsum = 0;
  for (const [k, w] of Object.entries(weights)) {
    const v = dims[k] !== undefined ? Math.max(0, Math.min(1, Number(dims[k]))) : 0.5; // 缺省中性
    dimensions[k] = v;
    sum += w * v;
    wsum += w;
  }
  return {
    task,
    weights,
    dimensions,
    overall: Number((sum / wsum).toFixed(3)),
  };
}

/** FailureType → 信用策略上下文（让 policy 按失败类型积累证据，防止跨类型污染）。 */
export function failureContext(failureType) {
  return failureType && failureType !== 'unclassified' ? { failureType } : {};
}
