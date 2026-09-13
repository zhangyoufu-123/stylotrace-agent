// CSLA v1.7 — Hippocampal Replay（符号化/结构化，v1.0）
// Replay = Reactivation + Reevaluation + Recombination + Prediction。
// 不是"读日志再跑一遍"，而是：从 CognitiveEvents 重建 episode → 重算预测/结果误差 →
// 重算 credit → 更新 policy stats / schema 候选（reconsolidation）。
// 第一版不训练神经网络；全部为确定性符号计算。
//
// 对照条件：A=不重放（基线）；B=重放但不加权（credit:'none'）；C=credit 加权（credit:'weighted'）；
// D=加权+巩固（默认）。
//
// Tests（R1–R5 + DoD）：
//   R1 同一事件重放 → 等价状态（幂等）；
//   R2 新 outcome 出现 → 旧判断可被重放更新（reconsolidation）；
//   R3 高 credit/高误差经验优先重放；
//   R4 重放后未来策略真的改变（Π_{t+1} ≠ Π_t，DoD）；
//   R5 无关任务经验不污染当前任务（模式隔离）。
import fs from 'node:fs';
import path from 'node:path';
import * as ev from './events.js';

const POLICY_FILE = 'vault/csl-policy.json';
const SCHEMA_FILE = 'vault/csl-schema.json';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readPolicy(workspace) {
  return readJson(path.join(workspace, POLICY_FILE)) || { modes: {} };
}

function readSchema(workspace) {
  return readJson(path.join(workspace, SCHEMA_FILE)) || { schemas: [] };
}

/**
 * Schema 置信度（红队修复 #5）：随证据数/多样性/反例/时间戳变化。
 * confidence = 0.3 + 0.15·成功数 + 0.08·来源数 − 0.25·失败数，clamp [0,1]。
 */
export function schemaConfidence(evidence = [], sources = 0) {
  const succ = evidence.filter((e) => e === 'succeeded').length;
  const fail = evidence.filter((e) => e === 'failed').length;
  return Number(Math.max(0, Math.min(1, 0.3 + 0.15 * succ + 0.08 * sources - 0.25 * fail)).toFixed(3));
}

/** 从事件重建 episodes（同一 session 内按 step 分组）。 */
export function reconstructEpisodes(workspace, sessionId) {
  const events = ev.traceForSession(workspace, sessionId);
  const episodes = [];
  let current = null;
  for (const e of events) {
    if (e.event_type === 'cognitive.run' || e.event_type === 'outcome.observed' || e.event_type === 'human.edit') {
      if (!current || e.step !== current.step) {
        if (current && current.outcome !== undefined) episodes.push(current);
        current = {
          sessionId: e.session_id || sessionId || '',
          step: e.step || 0,
          goal: e.goal || '',
          action: e.action || {},
          prediction: e.prediction?.value !== undefined ? e.prediction.value : null,
          outcome: e.outcome?.value !== undefined ? e.outcome.value : undefined,
          error: e.error?.magnitude !== undefined ? e.error.magnitude : null,
          credit: e.credit || {},
          mode: inferMode(e.action || {}, e.goal || ''),
        };
      } else {
        if (current.outcome === undefined && e.outcome?.value !== undefined) current.outcome = e.outcome.value;
        if (current.error === null && e.error?.magnitude !== undefined) current.error = e.error.magnitude;
      }
    }
  }
  if (current && current.outcome !== undefined) episodes.push(current);
  return episodes;
}

/** 从动作/目标推断任务模式（确定性的最小分类）。 */
function inferMode(action, goal = '') {
  const s = JSON.stringify(action || {}) + (action?.question || '') + ' ' + goal;
  if (/(论文|学术|研究)/.test(s)) return 'research';
  if (/(小说|故事)/.test(s)) return 'creative';
  if (/(公文|报告|汇报)/.test(s)) return 'official';
  return 'creative';
}

/** 重估一个 episode：δ 与 credit（无 outcome 不参与学习）。 */
export function reevaluateEpisode(episode) {
  if (episode.outcome === undefined || episode.prediction === null) return null;
  const delta = Number(Math.abs(Number(episode.outcome) - Number(episode.prediction)).toFixed(4));
  const credit = Object.values(episode.credit || {}).reduce((a, b) => a + Number(b || 0), 0);
  return { ...episode, delta, credit };
}

/** 重放优先级（R3）：高误差/高 credit 优先。credit:'none' 时 credit 项为 0。 */
export function replayPriority(episode, { credit = 'weighted' } = {}) {
  const e = reevaluateEpisode(episode);
  if (!e) return 0;
  const alpha = 0.6;
  const beta = credit === 'weighted' ? 0.4 : 0;
  return Number((alpha * e.delta + beta * e.credit).toFixed(4));
}

/**
 * 重放一轮（确定性、无状态）：从事件重建 → 优先排序 → 重估 → 从零重算 policy/schema 并写盘。
 * 同一批事件重放两次 → 完全相同的结果（R1 幂等）。
 */
export function replayOnce(workspace, { sessionId = '', credit = 'weighted', topK = 5 } = {}) {
  const episodes = reconstructEpisodes(workspace, sessionId).map((e) => reevaluateEpisode(e)).filter(Boolean);
  const scored = episodes
    .map((e) => ({ e, p: replayPriority(e, { credit }) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, topK);

  const policy = { modes: {} };
  const schema = { schemas: [] };

  for (const { e, p } of scored) {
    const mode = e.mode;
    policy.modes[mode] = policy.modes[mode] || { drafts: 0, asks: 0, failures: 0, successes: 0 };
    const m = policy.modes[mode];
    const actionName = e.action?.action || 'draft';
    if (actionName === 'draft') m.drafts += 1;
    if (actionName === 'ask') m.asks += 1;
    if (Number(e.outcome) < 0.5) {
      m.failures += 1;
    } else {
      m.successes += 1;
    }
    // Reconsolidation（R2）：把失败/成功的动作记录进 schema 候选（带证据链）
    const claim = String(e.action?.question || e.action?.original || e.goal || '').slice(0, 40);
    if (claim) {
      const existing = schema.schemas.find((s) => s.claim === claim);
      const note = Number(e.outcome) < 0.5 ? 'failed' : 'succeeded';
      if (existing) {
        if (!existing.evidence.includes(note)) existing.evidence.push(note);
        existing.version = (existing.version || 1) + 1;
      } else {
        schema.schemas.push({
          claim,
          evidence: [note],
          version: 1,
          source: `ep_${e.step}`,
          confidence: 0,
        });
      }
    }
  }

  // 重算置信度（含 reconsolidation 版本化）
  for (const s of schema.schemas) {
    const sources = new Set((s.source || '').split(',')).size;
    s.confidence = schemaConfidence(s.evidence, sources);
    if (!s.updatedAt) s.updatedAt = new Date().toISOString();
  }

  fs.mkdirSync(path.join(workspace, 'vault'), { recursive: true });
  fs.writeFileSync(path.join(workspace, POLICY_FILE), JSON.stringify(policy, null, 2) + '\n');
  fs.writeFileSync(path.join(workspace, SCHEMA_FILE), JSON.stringify(schema, null, 2) + '\n');
  return { replayed: scored.length, policy, schema, priorities: scored.map((s) => s.p) };
}

/** 读取任务模式当前策略（R4：重放后应变化）。 */
export function policyFor(workspace, mode) {
  const policy = readPolicy(workspace);
  const m = policy.modes?.[mode];
  if (!m || m.drafts === 0) return 'draft'; // 基线：默认直接写
  const failRate = m.failures / Math.max(1, m.drafts);
  return failRate > 0.5 ? 'ask' : 'draft';
}

/** 幂等检查（R1）：同事件重放两次，stats 相等。 */
export function policySignature(workspace) {
  return JSON.stringify(readPolicy(workspace));
}
