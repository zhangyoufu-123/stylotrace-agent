// CSLA EventStore / CognitiveTrace（v1.0）
// 结构化认知事件账本：高价值人机互动必须形成可审计、可回放的事件。
// Failure cases：
//   F1 事件缺 state_version → 拒绝写入（无法回放/审计）；
//   F2 事件文件损坏 → 从损坏点之后重建，不丢已解析事件；
//   F3 查询 session 返回按 step 有序事件。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const EVENTS_FILE = 'protocol/csl-events.jsonl';

function nowIso() {
  return new Date().toISOString();
}

function appendLine(file, line) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, line + '\n');
}

export function eventsFile(workspace) {
  return path.join(workspace, EVENTS_FILE);
}

export function appendEvent(workspace, event) {
  if (!event || !event.state_version || !event.event_type) {
    throw new Error('event requires state_version and event_type');
  }
  const dir = path.dirname(eventsFile(workspace));
  fs.mkdirSync(dir, { recursive: true });
  appendLine(eventsFile(workspace), JSON.stringify({
    event_id: event.event_id || crypto.randomUUID(),
    ...event,
    timestamp: event.timestamp || nowIso(),
  }));
  return true;
}

export function listEvents(workspace) {
  try {
    return fs
      .readFileSync(eventsFile(workspace), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function traceForSession(workspace, sessionId) {
  return listEvents(workspace)
    .filter((e) => !sessionId || e.session_id === sessionId)
    .sort((a, b) => (a.step || 0) - (b.step || 0));
}

/** 回放：把事件序列折叠成"事件概要"（不含副作用执行，只重建可审计时间线）。 */
export function replayEvents(workspace, sessionId) {
  const evs = traceForSession(workspace, sessionId);
  return evs.map((e) => ({
    step: e.step,
    event_type: e.event_type,
    state_version: e.state_version,
    action: e.action,
    outcome: e.outcome,
    credit: e.credit,
    error: e.error,
  }));
}

/**
 * 人类修改 → CognitiveTrace（接入现有 edit flow）。
 * 把"原文→改后→意图"作为一条 human.edit 事件，后续由 outcome/credit 回填。
 */
export function traceHumanEdit(workspace, { original, changed, intent, evidence, sessionId } = {}) {
  appendEvent(workspace, {
    event_type: 'human.edit',
    state_version: 's_0',
    session_id: sessionId || '',
    step: 0,
    action: { original, changed, intent },
    observation: { evidence },
  });
  return true;
}
