// CSLA Canonical State Kernel 适配层（P0-1）
// 目标：ExistingState → Adapter → CanonicalState。
// csl-state（protocol/csl-state.json）是唯一版本化认知内核；
// 产品状态（protocol/state.json）是应用视图；一切认知变更经 commitDelta（版本+事件）后镜像。
import fs from 'node:fs';
import path from 'node:path';
import * as st from './state.js';
import * as ws from '../workspace.js';

/** 规范视图：Canonical Kernel 为事实源，产品视图（protocol/state.json）只补应用字段（Director Adapter，不反向污染）。 */
export function readCanonical(workspace, { sessionId = 'default' } = {}) {
  const cs = st.readCanonicalState(workspace, { sessionId });
  const ps = ws.readState(workspace);
  const outlineTitle = ps.outline?.title || '';
  const confirmedTopic = ps.confirmed?.topic || '';
  const coreIdea = cs.coreIdea || confirmedTopic || outlineTitle || '';
  return {
    version: cs.stateVersion,
    coreIdea,
    coreIdeaConfirmed: Boolean(coreIdea),
    uncertainty: cs.uncertainty?.value ?? 0.5,
    goal: cs.goal?.inferred || cs.goal?.confirmed || confirmedTopic || outlineTitle,
    intent: cs.intent || '',
    phase: ps.phase || '',
    stage: ps.director?.stage || '',
    genre: ps.confirmed?.genre || '',
    outlineSections: (ps.outline?.sections || []).length,
    hasDraft: fs.existsSync(path.join(workspace, 'draft.md')),
    hypotheses: cs.hypotheses || [],
  };
}

/** 规范提交：StateDelta + Event → Kernel Commit（版本单调 + 统一事件），并单向镜像到产品视图。 */
export function commitDelta(workspace, { delta = {}, eventType = 'state.delta', sessionId = '', event = {} } = {}) {
  const r = st.commit(workspace, {
    delta,
    event: { ...event, eventType },
    sessionId: sessionId || 'default',
    actor: 'system',
  });
  // 镜像（单向、只补不覆盖）：产品视图记录 cslVersion 与 topic 提示
  const ps = ws.readState(workspace);
  if (delta.coreIdea && !ps.confirmed?.topic) {
    ps.confirmed = ps.confirmed || {};
    ps.confirmed.topic = String(delta.coreIdea).slice(0, 60);
  }
  ps.cslVersion = r.version;
  ws.writeState(workspace, ps);
  return { state: r.state, version: r.version, ledgerEvent: r.event };
}

/** 从产品已确认信息补齐 csl coreIdea（集成：director 在澄清/大纲确认后调用，幂等）。 */
export function syncCoreIdea(workspace) {
  const cs = st.readCanonicalState(workspace);
  if (cs.coreIdea) return { synced: false, coreIdea: cs.coreIdea, version: cs.stateVersion };
  const ps = ws.readState(workspace);
  const source = String(ps.confirmed?.topic || ps.outline?.title || '').trim();
  if (!source) return { synced: false, coreIdea: '', version: cs.stateVersion };
  const r = commitDelta(workspace, {
    delta: { coreIdea: source },
    eventType: 'core_idea.synced',
    event: { action: { source: 'product-confirmed' } },
  });
  return { synced: true, coreIdea: source, version: r.version };
}

/**
 * Writer Gate（Phase 1 读路径 + Phase 4 前置）：canWrite(state) →
 * { blocked, reason, nextAction }。至少检查 Core Idea；Goal/约束/Authority/Risk 随分区扩展。
 */
export function canWrite(workspace, { state = null, sessionId = 'default' } = {}) {
  const c = state || readCanonical(workspace, { sessionId });
  if (!c.coreIdea) return { blocked: true, reason: 'missing_core_idea', nextAction: 'askHuman', warn: '' };
  // 两档门：有主题但没有明确主张（stance/立场）→ 放行但警告；两者皆无 → 硬阻断。
  // 依据产品主张："先问清楚你到底想说什么"——只有话题不足以开写。
  const ps = ws.readState(workspace);
  const hasStance = Boolean(String(ps.confirmed?.stance || ps.intent?.summary || '').trim());
  const cslCoreIdea = String(st.readCanonicalState(workspace, { sessionId }).coreIdea || '').trim();
  if (!cslCoreIdea && !hasStance) {
    return { blocked: true, reason: 'missing_core_idea', nextAction: 'askHuman', warn: '' };
  }
  return {
    blocked: false,
    reason: '',
    nextAction: 'write',
    warn: cslCoreIdea && hasStance ? '' : 'missing_core_claim',
  };
}
