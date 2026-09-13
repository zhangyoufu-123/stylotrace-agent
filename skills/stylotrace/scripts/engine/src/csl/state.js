// CSLA CognitiveStateStore（v1.0）
// 版本化共享认知状态 S^C（内容层），Θ（参数层）只存引用。
// 硬规则（I2）：任何持久状态变更必须经 transition() 并产生 CognitiveEvent，
// 且 state_version 单调递增；禁止绕过事件直接改状态。
// Failure cases（先定义，测试覆盖）：
//   F1 状态文件损坏 → 返回默认状态 + error 事件，不崩溃；
//   F2 无事件的状态变更 → 拒绝（不产生 nextState）；
//   F3 版本不单调 → 拒绝回退。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as ws from '../workspace.js';

const STATE_FILE = 'protocol/csl-state.json';
const CANONICAL_EVENTS = 'protocol/csl-canonical-events.jsonl';

/** 规范会话状态文件（default → 旧路径，保持向后兼容；显式 session → 独立文件实现隔离）。 */
export function canonicalFile(workspace, sessionId = 'default') {
  const safe = String(sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return safe === 'default'
    ? path.join(workspace, STATE_FILE)
    : path.join(workspace, 'protocol', `csl-state-${safe}.json`);
}

export function emptyCognitiveState() {
  return {
    schemaVersion: '1.0',
    sVersion: 0,
    goal: '',
    coreIdea: '',
    hypotheses: [],
    evidence: [],
    questions: [],
    decisions: [],
    uncertainty: 0.5,
    intent: '',
    paramsRef: null, // Θ 层引用（内存/文件指针），不存参数本体
    createdAt: null,
    updatedAt: null,
  };
}

export function stateFile(workspace) {
  return path.join(workspace, STATE_FILE);
}

export function readState(workspace, sessionId = 'default') {
  try {
    const o = JSON.parse(fs.readFileSync(canonicalFile(workspace, sessionId), 'utf8'));
    return { ...emptyCognitiveState(), ...o };
  } catch {
    return emptyCognitiveState();
  }
}

function newEventId() {
  return crypto.randomUUID();
}

/**
 * 纯函数转移：input state + event + action → nextState + ledgerEvent。
 * event 必须含 event_type 与 action；否则抛错（F2）。
 * action 更新 state 的方式：显式字段映射，禁止任意写。
 */
export function transition(state, event, action) {
  if (!event || !event.event_type) {
    throw new Error('state transition requires an event with event_type');
  }
  if (!action || typeof action !== 'object') {
    throw new Error('state transition requires an action object');
  }
  const allowed = new Set([
    'goal', 'coreIdea', 'intent', 'uncertainty', 'paramsRef',
    'addHypothesis', 'addEvidence', 'addQuestion', 'addDecision', 'clearQuestions',
    // Canonical 分区（对象合并/数组替换）
    'session', 'interaction', 'motivation', 'task', 'workingMemory', 'beliefs',
    'memoryRefs', 'reasoning', 'humanModel', 'jointState', 'styleState',
    'artifactState', 'policy', 'resources', 'traceId', 'confirmedGoal', 'strategy',
    'outcomes', 'credits', 'brief',
  ]);
  const SECTION_KEYS = new Set([
    'session', 'interaction', 'motivation', 'task', 'workingMemory', 'reasoning',
    'humanModel', 'jointState', 'styleState', 'artifactState', 'policy', 'resources', 'brief',
  ]);
  const ARRAY_SECTION_KEYS = new Set(['beliefs', 'memoryRefs', 'outcomes', 'credits']);
  const next = { ...state, sVersion: state.sVersion + 1, updatedAt: ws.nowIso() };
  for (const [k, v] of Object.entries(action)) {
    if (!allowed.has(k)) throw new Error(`action key not allowed: ${k}`);
    if (k === 'addHypothesis' || k === 'addEvidence' || k === 'addQuestion' || k === 'addDecision') {
      const arrKey = k === 'addHypothesis' ? 'hypotheses' : k === 'addEvidence' ? 'evidence' : k === 'addQuestion' ? 'questions' : 'decisions';
      if (!Array.isArray(next[arrKey])) next[arrKey] = [];
      next[arrKey] = [...next[arrKey], v];
    } else if (SECTION_KEYS.has(k)) {
      // 分区对象：delta 为部分字段 → 合并（模块只输出 StateDelta，Kernel 负责 merge/commit）
      next[k] = { ...(next[k] || {}), ...(v && typeof v === 'object' ? v : {}) };
    } else if (ARRAY_SECTION_KEYS.has(k)) {
      next[k] = Array.isArray(v) ? [...v] : [];
    } else if (k === 'clearQuestions') {
      next.questions = [];
    } else {
      next[k] = v;
    }
  }
  const ledgerEvent = {
    event_type: event.event_type,
    event_id: event.event_id || newEventId(),
    session_id: event.session_id || '',
    step: (state.sVersion || 0) + 1,
    state_version: `s_${next.sVersion}`,
    timestamp: ws.nowIso(),
    goal: next.goal,
    action: event.action || action,
    observation: event.observation || {},
    prediction: event.prediction || {},
    outcome: event.outcome || {},
    error: event.error || {},
    uncertainty: next.uncertainty,
    credit: event.credit || {},
    provenance: event.provenance || {},
    cost: event.cost || {},
  };
  return { nextState: next, ledgerEvent };
}

/** 持久化状态（必须已由 transition 产生，校验版本单调，F3）。 */
export function persistState(workspace, nextState, ledgerEvent, sessionId = 'default') {
  const cur = readState(workspace, sessionId);
  if (nextState.sVersion <= cur.sVersion) {
    throw new Error(`state version regression: ${nextState.sVersion} <= ${cur.sVersion}`);
  }
  const dir = path.dirname(canonicalFile(workspace, sessionId));
  fs.mkdirSync(dir, { recursive: true });
  ws.writeJson(canonicalFile(workspace, sessionId), nextState);
  const safe = String(sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const hist = path.join(workspace, 'vault', 'csl-history', safe === 'default' ? '' : safe);
  fs.mkdirSync(hist, { recursive: true });
  fs.writeFileSync(
    path.join(hist, `s_${nextState.sVersion}.json`),
    JSON.stringify({ state: nextState, ledgerEvent }, null, 2) + '\n',
  );
  return nextState;
}

// ─────────────────────────────────────────────────────────────
// Canonical Cognitive State Kernel（Phase 1）
// 原则：State = 当前可影响未来决策的状态（非全部历史）。
// 四类边界：CognitiveState(本文件) / EventStore(csl-events.jsonl + csl-canonical-events.jsonl)
//          / MemoryStore(vault/csl-memory.json，只存 refs) / ArtifactStore(draft.md 等文件)。
// ─────────────────────────────────────────────────────────────

/** 唯一规范 schema（分区）。legacy 顶层字段保留给既有 reader（适配层），版本号单一。 */
export function createCanonicalState(sessionId = 'default') {
  return {
    schemaVersion: 1,
    sVersion: 0,
    traceId: '',
    session: { id: sessionId },
    interaction: {},
    motivation: {},
    goal: '',
    confirmedGoal: '',
    strategy: '',
    task: {},
    workingMemory: {},
    beliefs: [],
    hypotheses: [],
    evidence: [],
    uncertainty: 0.5,
    memoryRefs: [],
    reasoning: {},
    humanModel: {},
    jointState: {},
    styleState: {},
    artifactState: {},
    policy: {},
    resources: {},
    outcomes: [],
    credits: [],
    brief: {},
    // legacy（适配层）
    coreIdea: '',
    questions: [],
    decisions: [],
    intent: '',
    paramsRef: null,
    createdAt: null,
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

/** Adapter：InteractionState（vault/csl-interaction.json 是持久化 backend，非第二状态源）。 */
function interactionAdapter(workspace) {
  return readJsonSafe(path.join(workspace, 'vault', 'csl-interaction.json')) || {};
}

/** Adapter：LegacyStyleState → styleState（只取当前可影响决策的摘要，不复制全部历史）。 */
function styleAdapter(workspace) {
  const write = readJsonSafe(path.join(workspace, 'vault', 'write-style.json'));
  const read = readJsonSafe(path.join(workspace, 'vault', 'read-style.json'));
  return {
    writeDims: write && typeof write === 'object' && !Array.isArray(write) ? write : {},
    readDims: read && typeof read === 'object' && !Array.isArray(read) ? read : {},
  };
}

/** Adapter：MemoryStore（HRME vault/csl-memory.json）→ memoryRefs（只存引用，不把记忆灌进状态）。 */
function memoryRefsAdapter(workspace) {
  const mem = readJsonSafe(path.join(workspace, 'vault', 'csl-memory.json'));
  if (!mem || !Array.isArray(mem.items)) return [];
  return mem.items.map((i) => ({
    id: i.id,
    kind: i.kind || '',
    level: i.level || 0,
    confidence: i.confidence ?? 0,
    relationText: i.relationText || '',
  }));
}

/**
 * 规范读取：单一事实源（canonical 文件，default session = 旧 csl-state.json），
 * interaction/style/memory 经 Adapter 汇入分区视图。所有核心模块读此视图。
 */
export function readCanonicalState(workspace, { sessionId = 'default' } = {}) {
  const store = readState(workspace, sessionId);
  return {
    schemaVersion: store.schemaVersion || 1,
    stateVersion: store.sVersion,
    traceId: store.traceId || '',
    session: { id: sessionId, ...(store.session || {}) },
    interaction: interactionAdapter(workspace),
    motivation: store.motivation || {},
    goal: {
      inferred: store.goal || '',
      confirmed: store.confirmedGoal || store.coreIdea || '',
      strategy: store.strategy || '',
    },
    task: store.task || {},
    workingMemory: store.workingMemory || {},
    beliefs: store.beliefs || [],
    hypotheses: store.hypotheses || [],
    evidence: store.evidence || [],
    uncertainty: { value: store.uncertainty ?? 0.5 },
    memoryRefs: store.memoryRefs?.length ? store.memoryRefs : memoryRefsAdapter(workspace),
    reasoning: store.reasoning || {},
    humanModel: store.humanModel || {},
    jointState: store.jointState || {},
    styleState: store.styleState && Object.keys(store.styleState).length ? store.styleState : styleAdapter(workspace),
    artifactState: {
      ...(store.artifactState || {}),
      hasDraft: fs.existsSync(path.join(workspace, 'draft.md')),
    },
    policy: store.policy || {},
    resources: store.resources || {},
    outcomes: store.outcomes || [],
    credits: store.credits || [],
    brief: store.brief || {},
    // legacy 镜像（适配层，不是第二状态源）
    coreIdea: store.coreIdea || '',
    decisions: store.decisions || [],
    questions: store.questions || [],
    intent: store.intent || '',
  };
}

/** 纯 patch：模块输出 StateDelta → Kernel 合并（不持久化、不升版本；commit 才提交）。 */
export function patch(state, delta) {
  const { nextState } = transition(state, { event_type: 'state.patch' }, delta);
  return { ...nextState, sVersion: state.sVersion }; // patch 不升版本
}

/** 规范提交：StateDelta + Event → Kernel Commit（版本单调 + 统一事件 + 镜像）。 */
export function commit(workspace, { delta = {}, event = {}, sessionId = 'default', actor = 'system', traceId = '' } = {}) {
  const before = readState(workspace, sessionId);
  const type = event.eventType || event.type || 'state.commit';
  const trace = traceId || delta.traceId || before.traceId || '';
  const { nextState, ledgerEvent } = transition(
    before,
    { ...event, event_type: type, session_id: sessionId, actor, traceId: trace },
    delta,
  );
  persistState(workspace, nextState, ledgerEvent, sessionId);
  appendCanonicalEvent(workspace, {
    type,
    sessionId,
    traceId: trace,
    actor,
    payload: event.payload || { delta },
    versionBefore: before.sVersion,
    versionAfter: nextState.sVersion,
  });
  return { state: readCanonicalState(workspace, { sessionId }), version: nextState.sVersion, event: ledgerEvent };
}

/** 统一事件（EventStore）：eventId/traceId/sessionId/versionBefore/versionAfter/type/actor/payload/timestamp。 */
export function appendCanonicalEvent(workspace, { type, sessionId = 'default', traceId = '', actor = 'system', payload = {}, versionBefore, versionAfter } = {}) {
  const file = path.join(workspace, CANONICAL_EVENTS);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(
    file,
    JSON.stringify({
      eventId: crypto.randomUUID(),
      traceId,
      sessionId,
      stateVersionBefore: versionBefore,
      stateVersionAfter: versionAfter,
      type,
      actor,
      payload,
      timestamp: ws.nowIso(),
    }) + '\n',
  );
  return true;
}

/** 快照目录（每 session 隔离）。 */
export function snapshotDir(workspace, sessionId = 'default') {
  const safe = String(sessionId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(workspace, 'protocol', 'csl-snapshots', safe);
}

/** 快照：把当前版本状态复制到快照目录（可恢复）。 */
export function snapshot(workspace, { sessionId = 'default' } = {}) {
  const state = readState(workspace, sessionId);
  const dir = snapshotDir(workspace, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `v${state.sVersion}.json`);
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
  return { version: state.sVersion, file };
}

/** 恢复：从快照版本恢复为当前状态（显式操作，写 restore 事件；下一次 commit 从该版本继续单调）。 */
export function restore(workspace, version, { sessionId = 'default' } = {}) {
  const file = path.join(snapshotDir(workspace, sessionId), `v${version}.json`);
  const snap = readJsonSafe(file);
  if (!snap) throw new Error(`snapshot not found: v${version} (session ${sessionId})`);
  const cur = readState(workspace, sessionId);
  fs.mkdirSync(path.dirname(canonicalFile(workspace, sessionId)), { recursive: true });
  ws.writeJson(canonicalFile(workspace, sessionId), snap);
  appendCanonicalEvent(workspace, {
    type: 'state.restore',
    sessionId,
    traceId: snap.traceId || '',
    actor: 'system',
    payload: { from: version, to: cur.sVersion },
    versionBefore: cur.sVersion,
    versionAfter: snap.sVersion,
  });
  return { state: readCanonicalState(workspace, { sessionId }), version: snap.sVersion };
}

/** 比较两个状态版本：回答 Goal/Hypothesis/Evidence/Decision/Style/Artifact 是否变化（Replay/Credit 基础）。 */
export function compare(v1, v2) {
  const g1 = String(v1?.goal || v1?.coreIdea || '');
  const g2 = String(v2?.goal || v2?.coreIdea || '');
  const h1 = JSON.stringify(v1?.hypotheses || []);
  const h2 = JSON.stringify(v2?.hypotheses || []);
  const e1 = JSON.stringify(v1?.evidence || []);
  const e2 = JSON.stringify(v2?.evidence || []);
  const d1 = JSON.stringify(v1?.decisions || []);
  const d2 = JSON.stringify(v2?.decisions || []);
  const s1 = JSON.stringify(v1?.styleState || {});
  const s2 = JSON.stringify(v2?.styleState || {});
  const a1 = JSON.stringify(v1?.artifactState || {});
  const a2 = JSON.stringify(v2?.artifactState || {});
  return {
    version: [v1?.sVersion, v2?.sVersion],
    goalChanged: g1 !== g2,
    hypothesisChanged: h1 !== h2,
    evidenceChanged: e1 !== e2,
    decisionChanged: d1 !== d2,
    styleChanged: s1 !== s2,
    artifactChanged: a1 !== a2,
  };
}

/** 当前版本号（单一版本源：sVersion）。 */
export function stateVersion(workspace, { sessionId = 'default' } = {}) {
  return readState(workspace, sessionId).sVersion;
}
