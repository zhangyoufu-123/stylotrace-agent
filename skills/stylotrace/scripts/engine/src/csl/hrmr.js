// HRME — Hippocampal-inspired Relational Memory Engine（第一攻坚模块，最小闭环）
// 生命周期：Observe→Encode→Bind→Separate→Store→Compare→Generalize→Challenge
//          →Validate→Consolidate→Replay→Reconsolidate→Decay/Preserve
// 复用 events.js（episodic）、reasoning.js（compare/counterexample/abstract）、
//       replay.js（schema 置信度/策略）。
// 原则：工程模拟"记忆生命周期"，不是脑区映射；全部确定性、零 token（语义 KB 注入）。
import path from 'node:path';
import fs from 'node:fs';
import * as ev from './events.js';
import { compare, counterexample, abstract } from './reasoning.js';

const MEM_FILE = 'vault/csl-memory.json';
const TAU_SCHEMA = 2.5;
const TAU_CORE = 4.0;

// 语义 KB（确定性；LLM 可选作 Semantic Decomposer，缺省用此表）
const KB = {
  小猪: { type: 'mammal', omnivore: true, plantFood: true },
  狗: { type: 'mammal', omnivore: true, plantFood: true },
  猫: { type: 'mammal', carnivore: true },
  牛: { type: 'mammal', herbivore: true, plantFood: true },
  羊: { type: 'mammal', herbivore: true, plantFood: true },
  玉米: { type: 'plantfood' },
  粮食: { type: 'plantfood' },
  肉: { type: 'meat' },
  鱼: { type: 'meat' },
};

function readMem(workspace) {
  try {
    return JSON.parse(fs.readFileSync(path.join(workspace, MEM_FILE), 'utf8'));
  } catch {
    return { items: [] };
  }
}

function writeMem(workspace, mem) {
  fs.mkdirSync(path.join(workspace, 'vault'), { recursive: true });
  fs.writeFileSync(path.join(workspace, MEM_FILE), JSON.stringify(mem, null, 2) + '\n');
}

/** 关系绑定（M2）：确定性子句抽取（主语 吃/是/在 宾语）。 */
export function bind(sentence) {
  const t = String(sentence || '');
  // 被动句（被）无法确定主谓 → 拒绝绑定，避免垃圾关系
  if (/被/.test(t)) return [];
  const m = t.match(/([\u4e00-\u9fff]{1,4})(吃|食用|摄入|是|属于|会|喜欢)([\u4e00-\u9fff]{1,6})/);
  if (!m) return [];
  let subject = m[1];
  const verb = m[2];
  let object = m[3];
  // 主语尾部的否定词（不/没/未/别/无）→ 整句为否定，不产生正绑定
  if (/[不没未别无]$/.test(subject)) return [];
  // 宾语含连接词或第二个动词 → 截断到第一处，防止把整句后半段吞进宾语
  object = object.split(/[也和还，、以及]/)[0];
  // 模态动词（会）后跟真动词时，去掉宾语开头的动词词干（"会吃骨头"→"骨头"）
  object = object.replace(/^(?:吃|食用|摄入|喜欢|会)+/, '');
  if (!object) return [];
  const sbjType = KB[subject]?.type || 'unknown';
  const objType = KB[object]?.type || 'unknown';
  return [
    { subject, verb, object },
    { subject, type: sbjType },
    { object, type: objType },
  ];
}

function consolidateScore(item) {
  const s = item;
  return Number(
    (
      1.0 * (s.support || 0) +
      0.8 * (s.diversity || 0) +
      0.6 * (s.prediction || 0) +
      0.6 * (s.transfer || 0) +
      0.4 * (s.replay || 0) -
      0.8 * (s.exceptions || 0)
    ).toFixed(3),
  );
}

function itemConfidence(item) {
  return Number(
    Math.max(0, Math.min(1, 0.3 + 0.15 * (item.support || 0) - 0.25 * (item.exceptions || 0) + 0.08 * (item.diversity || 0))).toFixed(3),
  );
}

/** 添加一条经历 → 更新 episode(M1)/typed-relation(M2)/schema-candidate(M3 聚合)。 */
export function addEpisode(workspace, { text, outcome = 1, goal = '' }) {
  const mem = readMem(workspace);
  const relations = bind(text);
  const r0 = relations[0];
  const literalKey = r0 ? `${r0.subject}—${r0.verb}→${r0.object}` : text;
  // 关系抽象到类型层（小猪/牛 → mammal，玉米/粮食 → plantfood）
  const typedKey = r0 ? `${relations[1]?.type || 'unknown'}—${r0.verb}→${relations[2]?.type || 'unknown'}` : '';

  // M1 字面 episode（F1：相似经历保持分离）
  let ep = mem.items.find((i) => i.relationText === literalKey);
  if (!ep) {
    ep = { id: `m${mem.items.length + 1}`, level: 1, relationText: literalKey, text, support: 0, diversity: 0, prediction: 0, transfer: 0, replay: 0, exceptions: 0, strength: 0.8, confidence: 0, accessCount: 0, updatedAt: Date.now(), kind: 'episode' };
    mem.items.push(ep);
  }
  ep.support += 1;
  if (goal) ep.diversity = Math.min(3, ep.diversity + 1);
  if (Number(outcome) >= 0.5) ep.prediction += 1;
  ep.confidence = itemConfidence(ep);
  ep.updatedAt = Date.now();

  // M2/M3 类型级 schema 候选（Generalization→Schema，跨实例聚合）
  if (typedKey) {
    let sc = mem.items.find((i) => i.relationText === typedKey);
    if (!sc) {
      sc = { id: `s${mem.items.length + 1}`, level: 2, relationText: typedKey, text, support: 0, diversity: 0, prediction: 0, transfer: 0, replay: 0, exceptions: 0, strength: 0.6, confidence: 0, accessCount: 0, updatedAt: Date.now(), kind: 'schema' };
      mem.items.push(sc);
    }
    sc.support += 1;
    sc.goals = sc.goals || [];
    if (goal && !sc.goals.includes(goal)) sc.goals.push(goal);
    // diversity 有上限（与 episode 一致，防置信被无限制的新目标灌水）
    sc.diversity = Math.min(3, sc.goals.length || sc.diversity);
    if (Number(outcome) >= 0.5) sc.prediction += 1;
    sc.confidence = itemConfidence(sc);
    sc.updatedAt = Date.now();
    maybeUpgrade(sc);
  }
  writeMem(workspace, mem);
  ev.appendEvent(workspace, { event_type: 'memory.add', state_version: `m_${ep.id}`, session_id: goal, step: 0, action: { relationText: literalKey, level: ep.level } });
  return { episode: ep, schemaCandidate: typedKey ? mem.items.find((i) => i.relationText === typedKey) : null };
}

/** 反例（F3）：schema 被反例命中 → 置信下降，必要时降级。 */
export function challengeSchema(workspace, ruleText, counter) {
  const mem = readMem(workspace);
  const r = bind(ruleText)[0];
  const subjectType = r ? KB[r.subject]?.type || 'unknown' : '';
  const hit = mem.items.find(
    (i) => i.kind === 'schema' && i.level >= 2 && subjectType && i.relationText.startsWith(`${subjectType}—`),
  );
  if (hit) {
    hit.exceptions += 1;
    hit.confidence = itemConfidence(hit);
    if (hit.confidence < 0.3 && hit.level > 1) hit.level -= 1; // 允许降级
    writeMem(workspace, mem);
    return hit;
  }
  return null;
}

function maybeUpgrade(item) {
  const score = consolidateScore(item);
  // M4 必须同时满足：分数过阈 + 置信足够 + 有迁移证据（迁移成功才升入 M4）
  if (score > TAU_CORE && item.confidence >= 0.6 && item.transfer > 0 && item.level < 4) item.level = 4;
  // M3 必须分数过阈 + 置信足够（防"高支持但大量反例"的顽固错误复活）
  else if (score > TAU_SCHEMA && item.confidence >= 0.5 && item.level < 3) item.level = 3;
  // 单次支持（support<=1）不得升 M3（F2）
  if (item.support <= 1 && item.level >= 3) item.level = 2;
}

/** 迁移证据（M4 门槛）：验证过 novel 任务后标记，schema 才可升 M4。 */
export function markTransfer(workspace, relationText) {
  const mem = readMem(workspace);
  const r = bind(relationText)[0];
  const subjectType = r ? KB[r.subject]?.type || 'unknown' : '';
  let hit = null;
  for (const i of mem.items) {
    if (i.kind === 'schema' && i.level >= 2 && subjectType && i.relationText.startsWith(`${subjectType}—`)) {
      i.transfer = Math.min(1, (i.transfer || 0) + 1);
      maybeUpgrade(i);
      hit = i;
      break;
    }
  }
  if (hit) writeMem(workspace, mem);
  return hit;
}

/** 选择性遗忘（F4）：低效用经历衰减，贡献过 schema 的保留结构。 */
export function decay(workspace, { timeWeight = 0.1 } = {}) {
  const mem = readMem(workspace);
  const now = Date.now();
  mem.items = mem.items.filter((i) => {
    const age = (now - i.updatedAt) / 86400000;
    const utility = i.support + i.prediction + (i.level >= 3 ? 2 : 0);
    const keep = i.level >= 3 || utility > 2 || i.strength - timeWeight * age > 0.3;
    if (!keep) {
      ev.appendEvent(workspace, { event_type: 'memory.decay', state_version: `m_${i.id}`, session_id: '', step: 0, action: { forgotten: i.relationText } });
    }
    return keep;
  });
  writeMem(workspace, mem);
  return mem.items.length;
}

/** 目标条件记忆检索（PFC→Memory）：按 query 与 level 排序。 */
export function retrieve(workspace, query, { max = 5 } = {}) {
  const mem = readMem(workspace);
  return mem.items
    .map((i) => {
      const rel = i.relationText || '';
      const q = String(query || '');
      // query 命中优先于层级：查具体事物时，具体 episode 不得被通用 schema 压过
      const qHit = Boolean(q) && rel.includes(q);
      const score = qHit ? 3 + i.level + i.confidence : i.confidence;
      return { ...i, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ score, ...rest }) => rest);
}

export { consolidateScore, itemConfidence, TAU_SCHEMA, TAU_CORE, KB };
