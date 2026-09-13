// 决断卡（Decision Card）——把"创新"与"风格"分开的可执行对象
// 依据《创新点分离论纲》§8.2/§8.5：创新最小粒度 = 一个决断，且必须显式声明"比较集"，
// 没有比较集的"新颖性"一律视为无效；低概率只给候选，必须改变关系/论证才升级为创新候选。
// 工程作用：作者把某句话标记为"我的决断" → 冻结保护 → 写作时逐字保留（AI 只能在旁边工作）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as st from './state.js';
import * as ws from '../workspace.js';

const DECISION_FILE = 'protocol/csl-decisions.json';
export const DECISION_FIELDS = [
  'object',          // 对象：这段在写什么
  'oldDomain',       // 旧域：原本属于哪个领域/套路
  'newDomain',       // 新域：被移到了哪里
  'link',            // 联结方式：怎么连的
  'comparisonSet',   // 比较集：相对于谁算新（不能省）
  'expectedEffect',  // 预期后果
  'counterEvidence', // 反对证据
  'spanText',        // 文本落点：原文那一句
];

function file(workspace) {
  return path.join(workspace, DECISION_FILE);
}

function read(workspace) {
  try {
    const o = JSON.parse(fs.readFileSync(file(workspace), 'utf8'));
    return { version: o.version || 1, items: Array.isArray(o.items) ? o.items : [] };
  } catch {
    return { version: 1, items: [] };
  }
}

function write(workspace, data) {
  fs.mkdirSync(path.dirname(file(workspace)), { recursive: true });
  fs.writeFileSync(file(workspace), JSON.stringify(data, null, 2) + '\n');
}

const clean = (s, n = 200) => String(s || '').trim().slice(0, n);

/**
 * 创建决断卡。comparisonSet 必填——没有比较集的新颖性无效（论纲 §8.5）。
 * @returns {{ok:boolean, card?:object, reason?:string}}
 */
export function createDecisionCard(input = {}) {
  const card = {};
  for (const f of DECISION_FIELDS) card[f] = clean(input[f], f === 'spanText' ? 500 : 200);
  if (!card.spanText) return { ok: false, reason: 'missing_span_text' };
  if (!card.comparisonSet) return { ok: false, reason: 'missing_comparison_set' };
  if (!card.object) return { ok: false, reason: 'missing_object' };
  return {
    ok: true,
    card: {
      decisionId: crypto.randomUUID(),
      ...card,
      frozen: true,
      createdAt: ws.nowIso(),
    },
  };
}

/** 写入决断卡：持久化 + 经 Canonical Kernel 提交（版本单调、事件可审计）。 */
export function addDecision(workspace, input = {}, { sessionId = 'default' } = {}) {
  const made = createDecisionCard(input);
  if (!made.ok) return made;
  const data = read(workspace);
  data.items.push(made.card);
  write(workspace, data);
  st.commit(workspace, {
    delta: { workingMemory: { lastDecision: made.card.decisionId, decisionCount: data.items.length } },
    event: {
      eventType: 'decision.frozen',
      payload: { decisionId: made.card.decisionId, spanText: made.card.spanText.slice(0, 80), comparisonSet: made.card.comparisonSet.slice(0, 80) },
    },
    sessionId,
    actor: 'decision-card',
  });
  return { ok: true, card: made.card, count: data.items.length };
}

export function listDecisions(workspace) {
  return read(workspace).items;
}

/** 移除冻结（作者反悔）。 */
export function unfreezeDecision(workspace, decisionId, { sessionId = 'default' } = {}) {
  const data = read(workspace);
  const before = data.items.length;
  data.items = data.items.filter((d) => d.decisionId !== decisionId);
  if (data.items.length === before) return { ok: false, reason: 'not_found' };
  write(workspace, data);
  st.commit(workspace, {
    delta: { workingMemory: { decisionCount: data.items.length } },
    event: { eventType: 'decision.unfrozen', payload: { decisionId } },
    sessionId,
    actor: 'decision-card',
  });
  return { ok: true, count: data.items.length };
}

const normalize = (s) => String(s || '').replace(/\s+/g, '').replace(/[，。！？、；：""''（）《》]/g, '');

/**
 * 冻结校验：成稿必须逐字保留每个冻结句（去空白/标点后比较）。
 * 违反 = 系统 bug/模型越界，必须暴露而不是静默通过（对应"先冻结后生成"的硬约束）。
 */
export function verifyFrozen(workspace, draftText = '') {
  const items = listDecisions(workspace).filter((d) => d.frozen !== false);
  if (!items.length) return { ok: true, checked: 0, violations: [] };
  const normDraft = normalize(draftText);
  const violations = [];
  for (const d of items) {
    const needle = normalize(d.spanText);
    if (needle && !normDraft.includes(needle)) {
      violations.push({ decisionId: d.decisionId, spanText: d.spanText, reason: 'frozen_span_modified_or_missing' });
    }
  }
  return { ok: violations.length === 0, checked: items.length, violations };
}

/** 决断密度：冻结决断数 / 字数（千字）。用于反锁死（密度过低时系统应拒绝继续生成）。 */
export function decisionDensity(workspace, draftText = '') {
  const chars = (String(draftText).match(/[\u4e00-\u9fff]/g) || []).length;
  const frozen = listDecisions(workspace).filter((d) => d.frozen !== false).length;
  const per1k = chars > 0 ? Number(((frozen / chars) * 1000).toFixed(3)) : 0;
  return { frozen, chars, per1k };
}

/**
 * 反锁死判定：连续 N 次"AI 内容被用户大量删除/决断密度不足" → 拒绝继续生成服务。
 * 依据 PRISM 创新点四 + 论纲"低概率只给候选"的诚实姿态：宁可拒绝，也不帮作者加固套路。
 */
export function lockInGuard(workspace, { draftText = '', aiRejectedStreak = 0, minDensity = 0.8, streakLimit = 3 } = {}) {
  const den = decisionDensity(workspace, draftText);
  const lowDensity = den.frozen > 0 && den.per1k < minDensity;
  const refuse = aiRejectedStreak >= streakLimit || (den.frozen > 0 && lowDensity && aiRejectedStreak >= 1);
  return {
    refuse,
    density: den,
    reason: refuse
      ? (aiRejectedStreak >= streakLimit
        ? '连续多次删除 AI 内容：先写点属于你自己的东西，再让我接手'
        : '你的决断密度偏低：继续让我填充只会加固套路')
      : '',
    advice: refuse ? '建议：自己先写 2–3 句真实经历或判断，标记为决断卡，再让我扩写。' : '',
  };
}
