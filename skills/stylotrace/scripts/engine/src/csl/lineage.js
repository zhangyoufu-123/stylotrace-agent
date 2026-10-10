// CSLA Lineage Manifest（v1.0）
//
// 解决的问题：一次运行变好或变坏，到底是**换了模型**、**换了 Harness 配置**、
// **作者画像变了**，还是**改了代码里的策略**？没有这层记录，任何"变好了"都归不了因，
// 后面所有实验结论都立不住。
//
// 设计原则（主提示词 §6.1）：**不要伪造版本语义**。
// 仓库里目前只有 Harness 与 Canonical State 有真正的版本号；
// 控制器策略（actions.js）、检索策略（rag.js）、写作策略（write.js）都没有独立版本管理。
// 所以这里对它们使用**正在运行的那个源文件的内容哈希**——
// 它不假装是人工维护的语义版本，但满足一个关键性质：
// 策略变了哈希一定变，同一次提交永远同哈希，可以据此归因。
// 拿不到就明确写 `unversioned`，不编一个好看的号。
//
// Failure cases：
//   F1 没有 lineage 就查 tag → 返回空串，不抛异常（事件写入不能被它弄崩）；
//   F2 history 文件损坏 → 跳过坏行，保留已解析记录；
//   F3 sessionId 含路径字符 → 文件名用哈希，不拼原始字符串（不越出工作区）；
//   F4 拿不到模型信息 → 记 `unversioned`，不猜。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { harnessTag } from './harness.js';

export const LINEAGE_SCHEMA = 1;

const DIR = 'protocol/lineage';
const HISTORY = 'protocol/lineage.jsonl';

/** 六个行为版本维度 + 独立管理的状态 schema 版本。 */
export const DIMENSIONS = Object.freeze([
  'modelRef',
  'harnessVersion',
  'authorModelVersion',
  'controllerPolicyVersion',
  'retrievalPolicyVersion',
  'writerPolicyVersion',
  'stateSchemaVersion',
]);

/** 作者画像的落盘文件（数据，不是代码）。 */
const AUTHOR_MODEL_FILES = [
  'vault/style-vector.json',
  'vault/write-style.json',
  'vault/read-style.json',
  'vault/style-fingerprint.json',
  'vault/edits.jsonl',
];

const short = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);

/** 正在运行的那个策略文件的内容哈希——这才是"当前生效的策略"。 */
function runningPolicyRef(specifier, label) {
  try {
    return `${label}@${short(fs.readFileSync(fileURLToPath(new URL(specifier, import.meta.url))))}`;
  } catch {
    return `${label}@unversioned`;
  }
}

/** 作者画像版本：把所有画像文件的字节拼起来算一个哈希。一个都没有 → unversioned。 */
function authorModelVersion(workspace) {
  const chunks = [];
  for (const rel of AUTHOR_MODEL_FILES) {
    try {
      chunks.push(fs.readFileSync(path.join(workspace, rel)));
    } catch {
      /* 没有就是没有 */
    }
  }
  if (!chunks.length) return 'unversioned';
  return `author@${short(Buffer.concat(chunks))}`;
}

/** 模型标识：优先用调用方给的，否则读进程配置；拿不到就 unversioned。 */
export function defaultModelRef(cfg = null) {
  try {
    const c = cfg || {};
    if (c.provider && c.model) return `${c.provider}:${c.model}`;
  } catch {
    /* 落到下面 */
  }
  return 'unversioned';
}

/** 算出一组组件版本（不做任何写盘）。 */
export function componentVersions(workspace, { modelRef = '' } = {}) {
  const st = safeState(workspace);
  return {
    modelRef: modelRef || 'unversioned',
    harnessVersion: harnessTag(workspace),
    authorModelVersion: authorModelVersion(workspace),
    controllerPolicyVersion: runningPolicyRef('./actions.js', 'actions'),
    retrievalPolicyVersion: runningPolicyRef('../rag.js', 'rag'),
    writerPolicyVersion: runningPolicyRef('../write.js', 'write'),
    stateSchemaVersion: `state-schema@${st}`,
  };
}

function safeState(workspace) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(workspace, 'protocol', 'state.json'), 'utf8'));
    return j.schemaVersion ?? 1;
  } catch {
    return 1;
  }
}

function fileFor(workspace, sessionId) {
  // sessionId 可能包含任意字符（含路径分隔符），用它算文件名而不是直接拼
  const key = short(String(sessionId || 'default'));
  return path.join(workspace, DIR, `${key}.json`);
}

export function historyFile(workspace) {
  return path.join(workspace, HISTORY);
}

/** 构建一个不可变的 lineage manifest（纯函数，不落盘）。 */
export function buildLineage(workspace, { modelRef = '', sessionId = 'default', channel = '', taskId = '' } = {}) {
  return {
    lineageSchema: LINEAGE_SCHEMA,
    lineageId: taskId || `L-${crypto.randomUUID().slice(0, 12)}`,
    createdAt: new Date().toISOString(),
    sessionId: String(sessionId || 'default'),
    channel: String(channel || ''),
    ...componentVersions(workspace, { modelRef }),
  };
}

/** 任务开始时登记：写当前快照 + 追加历史。 */
export function startLineage(workspace, opts = {}) {
  const m = buildLineage(workspace, opts);
  fs.mkdirSync(path.join(workspace, DIR), { recursive: true });
  fs.writeFileSync(fileFor(workspace, m.sessionId), JSON.stringify(m, null, 2) + '\n');
  fs.appendFileSync(historyFile(workspace), JSON.stringify(m) + '\n');
  return m;
}

export function currentLineage(workspace, sessionId = 'default') {
  try {
    return JSON.parse(fs.readFileSync(fileFor(workspace, sessionId), 'utf8'));
  } catch {
    return null;
  }
}

/** 给事件打标用：任何情况下都不抛异常，没有记录就是空串。 */
export function lineageTag(workspace, sessionId = 'default') {
  try {
    return currentLineage(workspace, sessionId)?.lineageId || '';
  } catch {
    return '';
  }
}

/** 全部历史（损坏行跳过，不崩）。 */
export function readHistory(workspace) {
  try {
    return fs
      .readFileSync(historyFile(workspace), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** 两次运行之间哪些维度变了——归因的基本操作。 */
export function diffLineage(a, b) {
  const changed = [];
  for (const k of DIMENSIONS) {
    if ((a?.[k] ?? null) !== (b?.[k] ?? null)) changed.push({ dimension: k, from: a?.[k] ?? null, to: b?.[k] ?? null });
  }
  return changed;
}

export function renderLineage(m) {
  if (!m) return '（没有 lineage 记录：这个会话还没跑过 runTask）';
  const lines = [`Lineage ${m.lineageId} · 会话 ${m.sessionId}${m.channel ? ` · 通道 ${m.channel}` : ''}`];
  lines.push(`  记录时间: ${m.createdAt}`);
  for (const k of DIMENSIONS) lines.push(`  ${k}: ${m[k]}`);
  return lines.join('\n');
}

export function renderHistory(workspace, { limit = 10 } = {}) {
  const h = readHistory(workspace);
  if (!h.length) return '（还没有任何 lineage 记录）';
  const lines = [`共 ${h.length} 条记录，最近 ${Math.min(limit, h.length)} 条：`];
  for (const m of h.slice(-limit)) {
    lines.push(`  ${m.createdAt}  ${m.lineageId}  ${m.modelRef}  ${m.harnessVersion}  ${m.writerPolicyVersion}`);
  }
  return lines.join('\n');
}
