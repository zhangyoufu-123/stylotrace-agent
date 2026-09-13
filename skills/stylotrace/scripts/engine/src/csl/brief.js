// Cognitive Writing Brief（Stylotrace Cognitive Integration）
// 核心对象：连接 Fast Interaction / Canonical State / HRME / Reasoning / Writer / Outcome。
// 不是最终文章、不是聊天记录——是"这个人现在究竟想写什么、为什么这么写"的工作表示。
// 原则：Brief 由 Kernel 提交/版本化；Writer 只消费 briefText；HumanEdit → Outcome → AuthorModel 更新。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as st from './state.js';
import * as ws from '../workspace.js';
import { readGovernance } from '../governance.js';
import { classifyFailure } from './failure.js';

const BRIEF_FILE = 'protocol/csl-brief.json';

export function createBrief() {
  return {
    briefVersion: 0,
    briefHash: '',
    goal: {},
    audience: {},
    purpose: {},
    coreIdea: '',
    authorPosition: '',
    claims: [],
    assumptions: [],
    evidence: [],
    counterarguments: [],
    openQuestions: [],
    memoryRefs: [],
    authorSchemas: [],
    styleProfile: {},
    redLines: [],
    structure: {},
    artifactPlan: {},
    outcomeRefs: [],
    editCount: 0,
    updatedAt: null,
  };
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function briefFile(workspace) {
  return path.join(workspace, BRIEF_FILE);
}

export function readBrief(workspace) {
  return { ...createBrief(), ...(readJsonSafe(briefFile(workspace)) || {}) };
}

function hrmrSchemas(workspace) {
  const mem = readJsonSafe(path.join(workspace, 'vault', 'csl-memory.json'));
  if (!mem || !Array.isArray(mem.items)) return [];
  return mem.items
    .filter((i) => i.kind === 'schema' && i.level >= 3)
    .map((i) => ({
      relationText: i.relationText,
      level: i.level,
      confidence: i.confidence ?? 0,
      support: i.support ?? 0,
      exceptions: i.exceptions ?? 0,
      transfer: i.transfer ?? 0,
    }));
}

function styleProfile(workspace) {
  const write = readJsonSafe(path.join(workspace, 'vault', 'write-style.json'));
  const read = readJsonSafe(path.join(workspace, 'vault', 'read-style.json'));
  const dims = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.keys(o).length : 0);
  return { writeDims: dims(write), readDims: dims(read), source: 'style-adapter' };
}

function hashOf(brief) {
  const { updatedAt, briefVersion, briefHash, ...rest } = brief;
  return crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 16);
}

/** 组装：Canonical（goal/coreIdea/claims/evidence/questions/memoryRefs）+ 产品（audience/stance/structure）
 *  + HRME（authorSchemas）+ Style（styleProfile）+ 治理（redLines）。 */
export function buildBrief(workspace, { sessionId = 'default' } = {}) {
  const cs = st.readCanonicalState(workspace, { sessionId });
  const ps = ws.readState(workspace);
  const gov = readGovernance(workspace);
  const claims = (cs.hypotheses || [])
    .map((h) => (typeof h === 'string' ? h : h.claim || ''))
    .filter(Boolean)
    .slice(0, 3)
    .map((c) => String(c).slice(0, 120));
  const schemas = hrmrSchemas(workspace);
  const brief = {
    ...createBrief(),
    goal: {
      inferred: cs.goal?.inferred || ps.confirmed?.topic || ps.outline?.title || '',
      confirmed: cs.goal?.confirmed || cs.coreIdea || '',
    },
    audience: { value: ps.confirmed?.audience || ps.confirmed?.recipient || '' },
    purpose: { stance: ps.confirmed?.stance || ps.intent?.summary || '' },
    coreIdea: cs.coreIdea || ps.confirmed?.topic || ps.outline?.title || '',
    authorPosition: ps.confirmed?.stance || '',
    claims,
    assumptions: [],
    evidence: (cs.evidence || []).map((e) => (typeof e === 'string' ? e : e)).slice(0, 5),
    counterarguments: cs.workingMemory?.counterexamples || cs.workingMemory?.counterarguments || [],
    openQuestions: cs.questions || [],
    memoryRefs: (cs.memoryRefs || []).slice(0, 5),
    authorSchemas: schemas,
    styleProfile: styleProfile(workspace),
    redLines: [gov.authorIntent, gov.currentFocus].filter(Boolean),
    structure: {
      title: ps.outline?.title || '',
      sections: (ps.outline?.sections || []).map((s) => ({ heading: s.heading, function: s.function, thesis: s.thesis })),
    },
    artifactPlan: {
      hasDraft: fs.existsSync(path.join(workspace, 'draft.md')),
      targetWords: ps.targetWords || 0,
      phase: ps.phase || '',
    },
  };
  brief.briefHash = hashOf(brief);
  return brief;
}

/** 同步：组装 → 持久化 csl-brief.json + 内容变化时经 Kernel 提交（版本单调）。 */
export function syncBrief(workspace, { sessionId = 'default' } = {}) {
  const next = buildBrief(workspace, { sessionId });
  const prev = readBrief(workspace);
  const changed = prev.briefHash !== next.briefHash;
  next.briefVersion = (prev.briefVersion || 0) + (changed ? 1 : 0);
  next.updatedAt = ws.nowIso();
  fs.mkdirSync(path.dirname(briefFile(workspace)), { recursive: true });
  fs.writeFileSync(briefFile(workspace), JSON.stringify(next, null, 2) + '\n');
  if (changed) {
    st.commit(workspace, {
      delta: { brief: { version: next.briefVersion, hash: next.briefHash, coreIdea: next.coreIdea.slice(0, 60) } },
      event: { eventType: 'brief.synced', payload: { version: next.briefVersion } },
      sessionId,
      actor: 'brief-engine',
    });
  }
  return { brief: next, changed, version: next.briefVersion };
}

/** Writer 消费的文本块（Brief → Writer：核心/主张/反方/证据/作者 schema/红线）。 */
export function briefText(workspace) {
  const b = readBrief(workspace);
  const lines = [];
  if (b.coreIdea) lines.push(`【认知简报 · 核心观点】${b.coreIdea}`);
  if (b.claims.length) lines.push(`【认知简报 · 核心主张】${b.claims.join('；')}`);
  if (b.counterarguments.length) lines.push(`【认知简报 · 反方/待回应】${b.counterarguments.join('；')}`);
  if (b.evidence.length) lines.push(`【认知简报 · 证据】${b.evidence.join('；')}`);
  if (b.authorSchemas.length) {
    lines.push(`【认知简报 · 作者模式】${b.authorSchemas.map((s) => `${s.relationText}(conf=${s.confidence})`).join('；')}`);
  }
  if (b.redLines.length) lines.push(`【认知简报 · 红线】${b.redLines.join('；')}`);
  return lines.join('\n');
}

/** HumanEdit → Outcome → AuthorModel：编辑事实落 OutcomeStore + brief 更新（决策/风格信号入口）。 */
export function recordEdit(workspace, { edit = '', source = 'user-edit', sessionId = 'edit', value = 1 } = {}) {
  const brief = readBrief(workspace);
  const outcome = {
    outcomeId: crypto.randomUUID(),
    traceId: '',
    sessionId,
    stateVersion: st.stateVersion(workspace),
    goal: { inferred: brief.goal?.inferred || '' },
    action: { action: 'human-edit' },
    prediction: { expected: 1, confidence: 0.4 },
    actual: { value, source, edit: String(edit).slice(0, 200) },
    feedback: { source },
    cost: {},
    risk: {},
    humanReaction: { edited: true },
    worldReaction: {},
    evaluation: {},
    timestamp: ws.nowIso(),
  };
  // Failure Taxonomy：编辑信号分类（风格/决策/观点）→ outcome 带失败类型，供 Credit 上下文使用
  const fail = classifyFailure({ text: String(edit), coreIdea: brief.coreIdea || '', outcomeValue: value, source });
  outcome.failureType = fail.failureType;
  fs.mkdirSync(path.dirname(path.join(workspace, 'protocol', 'csl-outcomes.jsonl')), { recursive: true });
  fs.appendFileSync(path.join(workspace, 'protocol', 'csl-outcomes.jsonl'), JSON.stringify(outcome) + '\n');
  brief.editCount = (brief.editCount || 0) + 1;
  brief.outcomeRefs = [...(brief.outcomeRefs || []), outcome.outcomeId].slice(-20);
  brief.updatedAt = ws.nowIso();
  fs.writeFileSync(briefFile(workspace), JSON.stringify(brief, null, 2) + '\n');
  return { outcome, editCount: brief.editCount };
}
