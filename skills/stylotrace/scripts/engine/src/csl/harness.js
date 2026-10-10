// CSLA Harness Release Manager（v1.0）
// 冻结模型、进化 Harness：运行时只使用"已发布"的 Harness 版本；
// 进化系统负责提出候选 → 离线评估 → 发布或回滚。两者只通过"版本号"连接。
//
// 为什么不是"自进化算法"：ACE 管上下文组织、GEPA 管候选指令优化、记忆管存取、
// CSLA 管动作选择、本模块只管**哪个配置允许被发布**。混在一起就没法归因。
//
// 三条硬设计（对应规范 §4 / §6.6 / §9.4）：
//   1. 只有**数据**可进化：白名单里的键，值是标量或标量数组。
//      函数、表达式、代码片段一律拒收——否则"进化"会退化成任意代码注入。
//   2. 冻结区不是"警告"而是**拒收**。执法靠白名单：不认识的键进不来。
//      §4 第 9 条说"证据门的非安全性配置"可进化，但那条边界无法机械判定，
//      所以 v1 把证据门整层冻结（evidence.*），等有评估数据再单独开。
//   3. 发布必须过门：配对比对 + 留出集 + 样本量下限 + 零回归。
//      样本量下限是刻意加的——3 个任务上的"提升"不算提升。
//
// Failure cases：
//   F1 候选的 parentVersion 不等于当前版本 → 拒绝入队（防基于旧版本叠加改动）；
//   F2 候选触碰冻结区 / 用了白名单外的键 / 值不是标量 → 拒绝入队；
//   F3 未评估、未过门或没有审批人的候选 → 拒绝发布；
//   F4 回滚到不存在的版本 → 拒绝，且当前版本保持不变。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const HARNESS_DIR = 'protocol/harness';
const CURRENT_FILE = 'current.json';
const LEDGER_FILE = 'releases.jsonl';

export const HARNESS_SCHEMA = 1;
export const BASELINE_VERSION = 'H0';

/**
 * 可进化的键（白名单）= **已接线**的键：有真实消费点，改了会进到执行路径。
 *
 * 2026-10-10 静态消费点审计（§11.3 第一层，脚本 `scripts/audit-harness-keys.mjs` 可复跑）：
 * 原先 13 个键里只有这 4 个真的被读。其余 9 个设置之后什么都不会发生——
 * 它们不是"还没验证"，是**根本没有消费点**。按主提示词 §4.4/§11.3 的裁决，
 * 这类参数应当移出候选进化空间，而不是留着让优化器去搜一个不存在的空间。
 * 它们被移到 DECLARED_NOT_WIRED，逐条写明缺哪段接线，修好后移回本表。
 *
 * 值只能是字符串/有限数字/布尔，或它们的数组。
 */
export const EVOLVABLE_KEYS = Object.freeze([
  'question.weights.informationGain',
  'question.weights.cost',
  'question.weights.intrusion',
  'question.weights.repetition',
]);

/**
 * 接线登记表：每个白名单键必须声明"它被哪个符号消费"。
 *
 * 存在的理由：光看键名会误判。提问权重不是以 `question.weights.cost` 这个字符串被读的，
 * 而是经 `questionWeights()` 投影成 `{wIg, lambda, mu, rho}` 再注入 `chooseQuestion`。
 * 早先的审计脚本只搜键名，于是把 4 个真的接线的键判成了"没消费点"。
 * 所以"接线"不能靠注释声称，也不能靠字符串巧合——必须登记，并由 `scripts/audit-harness-keys.mjs` 验证符号真的存在。
 */
export const WIRING = Object.freeze({
  'question.weights.informationGain': 'questionWeights',
  'question.weights.cost': 'questionWeights',
  'question.weights.intrusion': 'questionWeights',
  'question.weights.repetition': 'questionWeights',
});

/**
 * 已声明但**未接线**：提案一律拒收（reason=`no_consumer`）。
 * 这份表的作用是把"我们打算让它可调"和"它真的可调"分开，防止把声明当能力。
 */
export const DECLARED_NOT_WIRED = Object.freeze({
  'action.weights.search': '动作价值表在 csl/actions.js 里写死，不读 Harness',
  'action.weights.askHuman': '同上',
  'action.weights.stop': '同上',
  'action.weights.generate': '同上',
  'memory.retrieval.topK': 'csl/replay.js:109 是函数默认参数，不读 Harness',
  'memory.retrieval.decay': 'csl/hrmr.js:178 是函数默认参数，不读 Harness',
  'writer.candidateCount': '写作候选数写死在调用处，无消费点',
  'writer.stopPolicy': '无消费点',
  'prompt.systemSuffix': '无消费点',
});

/**
 * 冻结区。真正的执法是白名单；这份清单的用途是：
 *   1. 让"什么不许动"写在代码里而不是口头约定；
 *   2. 结构性测试断言冻结名永远不会出现在白名单里；
 *   3. 候选如果显式写了这些键，错误原因是 frozen_zone 而不是 not_evolvable——
 *      报错信息要能让人看出"你踩的是红线"，而不是"你拼错了"。
 */
export const FROZEN_ZONE = Object.freeze([
  'state.schema',
  'auth.*',
  'tool.permissions',
  'events.integrity',
  'safety.*',
  'evaluator.*',
  'eval.heldOutSet',
  'gate.frozenZone',
  'evidence.*',
]);

/** 各键的内置默认值。默认值本身不在进化面内——它只能通过发布新版本被覆盖。 */
export const DEFAULTS = Object.freeze({
  'question.weights.informationGain': 1,
  'question.weights.cost': 0.2,
  'question.weights.intrusion': 0.25,
  'question.weights.repetition': 0.3,
  'action.weights.search': 1,
  'action.weights.askHuman': 1,
  'action.weights.stop': 1,
  'action.weights.generate': 1,
  'memory.retrieval.topK': 5,
  'memory.retrieval.decay': 0.9,
  'writer.candidateCount': 3,
  'writer.stopPolicy': 'utility',
  'prompt.systemSuffix': '',
});

/**
 * 权限边界（理论 v1.1 第 1 条：**自动循环的权限由写入范围决定**）。
 *
 * 本 Harness 存在**用户自己的工作区**里（`protocol/harness/`），所以它天然只影响这一位作者。
 * 规范里那套 shadow / canary / 灰度发布，是"服务端改一次影响所有用户"才需要的；
 * 对一个 BYOK 本地 Agent，影响其他使用者的改动**在构造上就是代码发布**，
 * 只能由人改代码、发版本，运行时循环碰不到。所以本模块不做灰度——不是省事，是范围不同。
 *
 * 这也决定了留出集测的是什么：**这位作者未来的任务**，不是别的用户。
 */
export const AUTHORITY = Object.freeze({
  scope: 'workspace',
  affects: '仅本工作区的作者',
  generalizationTarget: '同一位作者、未参与提案的后续任务',
  outOfScope: '任何会影响其他使用者的改动（提示词库、候选库、评估器、安全规则）→ 属于代码发布，必须由人做',
});

/**
 * 评估器阶梯（理论 v1.1 第 5 条）：**能机械判定的，不许用模型评审代替**。
 *
 * 顺序即优先级。`llm_judge` 排在最后，而且不允许作为唯一证据——
 * 否则优化器会把"让评委模型喜欢"当成目标，而这正是本项目早就明确拒绝的方向。
 */
export const EVIDENCE_LADDER = Object.freeze([
  { id: 'mechanical', rank: 1, desc: '确定性可判定：事实层有没有被改、冻结句有没有被碰、写作门拦不拦得住' },
  { id: 'recomputable', rank: 2, desc: '同输入同输出、可复算：提问重复率、动作轨迹是否随状态变化' },
  { id: 'blind_human', rank: 3, desc: '作者盲选（不知道哪个是哪个）' },
  { id: 'llm_judge', rank: 4, desc: '模型评审——最后手段，不得作为唯一证据' },
]);

/** 发布门（v0，作用于本工作区）。数值是保守起点，不是"调好的参数"。 */
export const GATE_V0 = Object.freeze({
  requirePairedComparison: true,
  requireHeldOut: true,
  minSampleSize: 8,
  minHeldOutDelta: 0.02,
  maxRegressionRate: 0,
  maxCostDelta: 0.25,
});

// ── 存储 ──────────────────────────────────────────────────────────────

export function harnessDir(workspace) {
  return path.join(workspace, HARNESS_DIR);
}

export function currentFile(workspace) {
  return path.join(harnessDir(workspace), CURRENT_FILE);
}

export function ledgerFile(workspace) {
  return path.join(harnessDir(workspace), LEDGER_FILE);
}

function nowIso() {
  return new Date().toISOString();
}

function readCurrentFile(workspace) {
  try {
    return JSON.parse(fs.readFileSync(currentFile(workspace), 'utf8'));
  } catch {
    return null;
  }
}

function writeCurrentFile(workspace, state) {
  fs.mkdirSync(harnessDir(workspace), { recursive: true });
  const tmp = `${currentFile(workspace)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, currentFile(workspace));
}

function appendLedger(workspace, record) {
  fs.mkdirSync(harnessDir(workspace), { recursive: true });
  fs.appendFileSync(ledgerFile(workspace), JSON.stringify({ at: nowIso(), ...record }) + '\n');
}

/** 全量发布账本（损坏行跳过，不崩）。 */
export function releaseLog(workspace) {
  try {
    return fs
      .readFileSync(ledgerFile(workspace), 'utf8')
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

// ── 当前版本 ──────────────────────────────────────────────────────────

export function baselineState() {
  return {
    schema: HARNESS_SCHEMA,
    version: BASELINE_VERSION,
    releaseId: BASELINE_VERSION,
    parentVersion: null,
    config: {},
    publishedAt: null,
    approvedBy: null,
  };
}

export function current(workspace) {
  if (!workspace) return baselineState();
  const j = readCurrentFile(workspace);
  if (!j || !j.version || j.schema !== HARNESS_SCHEMA) return baselineState();
  return j;
}

export function currentVersion(workspace) {
  return current(workspace).version;
}

/** 给事件打标用：任何情况下都不抛异常，读不到就是基线 H0。 */
export function harnessTag(workspace) {
  try {
    return currentVersion(workspace);
  } catch {
    return BASELINE_VERSION;
  }
}

/** 生效配置 = 内置默认 + 已发布版本的覆盖项。 */
export function activeConfig(workspace) {
  return { ...DEFAULTS, ...current(workspace).config };
}

/** 浅层提问权重：把 Harness 里那组数字翻译成 q* 公式要的形式。 */
export function questionWeights(workspace) {
  const c = activeConfig(workspace);
  return {
    wIg: Number(c['question.weights.informationGain']),
    lambda: Number(c['question.weights.cost']),
    mu: Number(c['question.weights.intrusion']),
    rho: Number(c['question.weights.repetition']),
  };
}

// ── 校验 ──────────────────────────────────────────────────────────────

function isScalar(v) {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function matchesFrozen(key) {
  return FROZEN_ZONE.some((p) => (p.endsWith('.*') ? key.startsWith(p.slice(0, -1)) : key === p));
}

/** 候选配置的机械校验：白名单 + 值类型。这是冻结区的唯一执法点。 */
export function checkCandidate(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { ok: false, violations: [{ key: '(root)', reason: 'not_an_object' }] };
  }
  // 空候选 = 什么都不改的版本。放进去只会在版本史里制造一个无法归因的噪声点。
  if (Object.keys(config).length === 0) {
    return { ok: false, violations: [{ key: '(root)', reason: 'empty_config' }] };
  }
  const violations = [];
  for (const [key, value] of Object.entries(config)) {
    // 先判"有没有消费点"：没接线的键连值类型都不必看——
    // 报 no_consumer 才能让人明白"设置它不会有任何效果"，而不是以为写错了类型。
    if (Object.prototype.hasOwnProperty.call(DECLARED_NOT_WIRED, key)) {
      violations.push({ key, reason: 'no_consumer', detail: DECLARED_NOT_WIRED[key] });
      continue;
    }
    if (!EVOLVABLE_KEYS.includes(key)) {
      violations.push({ key, reason: matchesFrozen(key) ? 'frozen_zone' : 'not_evolvable' });
      continue;
    }
    if (isScalar(value)) {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        violations.push({ key, reason: 'non_finite_number' });
      }
      continue;
    }
    if (Array.isArray(value) && value.length > 0 && value.every(isScalar)) continue;
    violations.push({ key, reason: 'unsupported_value_type' });
  }
  return { ok: violations.length === 0, violations };
}

/** 发布门判定：只看评估结果，不看候选是谁提的。 */
export function judge(results = {}) {
  const reasons = [];
  if (GATE_V0.requirePairedComparison && results.paired !== true) reasons.push('missing_paired_comparison');
  if (GATE_V0.requireHeldOut && results.heldOut !== true) reasons.push('missing_held_out_eval');

  const sampleSize = Number(results.sampleSize ?? 0);
  if (!Number.isFinite(sampleSize) || sampleSize < GATE_V0.minSampleSize) {
    reasons.push(`sample_too_small(${Number.isFinite(sampleSize) ? sampleSize : 0}<${GATE_V0.minSampleSize})`);
  }

  const delta = Number(results.heldOutDelta);
  if (!Number.isFinite(delta)) reasons.push('missing_held_out_delta');
  else if (delta < GATE_V0.minHeldOutDelta) reasons.push(`held_out_delta_too_small(${delta}<${GATE_V0.minHeldOutDelta})`);

  const regression = Number(results.regressionRate);
  if (!Number.isFinite(regression)) reasons.push('missing_regression_rate');
  else if (regression > GATE_V0.maxRegressionRate) reasons.push(`regression(${regression}>${GATE_V0.maxRegressionRate})`);

  // 成本进门槛：不能靠多花 token 换指标
  const cost = Number(results.costDelta);
  if (!Number.isFinite(cost)) reasons.push('missing_cost_delta');
  else if (cost > GATE_V0.maxCostDelta) reasons.push(`cost_too_high(${cost}>${GATE_V0.maxCostDelta})`);

  // 证据种类：机械可判定优先；模型评审不得单独作为依据
  const ev = EVIDENCE_LADDER.find((e) => e.id === results.evidence);
  if (!ev) reasons.push('missing_evidence_kind');
  else if (ev.id === 'llm_judge' && !results.corroboratedBy) reasons.push('llm_judge_cannot_stand_alone');

  return { passed: reasons.length === 0, reasons, gate: GATE_V0 };
}

// ── 发行流程 ──────────────────────────────────────────────────────────

/** 把某条 releaseId 的账本记录折叠成一个状态对象。 */
export function findRelease(workspace, releaseId) {
  const recs = releaseLog(workspace).filter((r) => r.releaseId === releaseId);
  if (!recs.length) return null;
  const rel = { releaseId, status: 'proposed' };
  for (const r of recs) {
    if (r.type === 'harness.proposed') {
      Object.assign(rel, {
        parentVersion: r.parentVersion,
        config: r.config,
        targetFailure: r.targetFailure,
        rationale: r.rationale,
        origin: r.origin,
        proposedAt: r.at,
      });
    } else if (r.type === 'harness.rejected') {
      Object.assign(rel, { status: 'rejected', violations: r.violations });
    } else if (r.type === 'harness.evaluated') {
      Object.assign(rel, { status: 'evaluated', results: r.results, passed: r.passed, reasons: r.reasons });
    } else if (r.type === 'harness.published') {
      Object.assign(rel, { status: 'published', version: r.version, approvedBy: r.approvedBy, publishedAt: r.at });
    } else if (r.type === 'harness.rolled_back') {
      Object.assign(rel, { status: 'rolled_back', rolledBackFrom: r.from, rolledBackTo: r.to });
    }
  }
  return rel;
}

/** 提出候选。触碰红线时**不返回候选**，直接抛错并记账。 */
export function propose(workspace, { config, targetFailure = 'unclassified', rationale = '', origin = 'offline', parentVersion = '' } = {}) {
  const cur = current(workspace);
  const parent = parentVersion || cur.version;
  if (parent !== cur.version) {
    throw new Error(`候选必须从当前版本派生：parentVersion=${parent}，当前=${cur.version}`);
  }

  const check = checkCandidate(config);
  if (!check.ok) {
    appendLedger(workspace, {
      type: 'harness.rejected',
      releaseId: `R-rejected-${crypto.randomUUID().slice(0, 8)}`,
      parentVersion: parent,
      config,
      violations: check.violations,
    });
    const detail = check.violations.map((v) => `${v.key}:${v.reason}`).join(', ');
    const err = new Error(`候选被拒收（${detail}）`);
    err.code = 'frozen_zone_violation';
    err.violations = check.violations;
    throw err;
  }

  const releaseId = `R-${crypto.randomUUID().slice(0, 8)}`;
  appendLedger(workspace, {
    type: 'harness.proposed',
    releaseId,
    parentVersion: parent,
    config,
    targetFailure,
    rationale,
    origin,
  });
  return { releaseId, parentVersion: parent, status: 'proposed', config, gate: GATE_V0 };
}

/** 记录离线评估结果并过门。未过门的候选不会因此消失——它留在账本里作为负证据。 */
export function evaluate(workspace, releaseId, results = {}) {
  const rel = findRelease(workspace, releaseId);
  if (!rel) throw new Error(`找不到候选 ${releaseId}`);
  if (rel.status === 'published') throw new Error(`候选 ${releaseId} 已发布，不能重新评估`);

  const verdict = judge(results);
  appendLedger(workspace, {
    type: 'harness.evaluated',
    releaseId,
    results,
    passed: verdict.passed,
    reasons: verdict.reasons,
  });
  return { releaseId, ...verdict, results };
}

/** 发布：只有"已评估 + 过门 + 有审批人 + 仍从当前版本派生"四件事同时成立才写。 */
export function publish(workspace, releaseId, { approvedBy = '' } = {}) {
  const rel = findRelease(workspace, releaseId);
  if (!rel) throw new Error(`找不到候选 ${releaseId}`);
  if (rel.status !== 'evaluated') {
    const err = new Error(`候选 ${releaseId} 尚未评估（当前状态 ${rel.status}），拒绝发布`);
    err.code = 'gate_not_passed';
    throw err;
  }
  if (!rel.passed) {
    const err = new Error(`候选 ${releaseId} 未过门：${(rel.reasons || []).join(', ')}`);
    err.code = 'gate_not_passed';
    err.reasons = rel.reasons || [];
    throw err;
  }
  if (!approvedBy) throw new Error('发布需要审批人（approvedBy）');

  const cur = current(workspace);
  if (rel.parentVersion !== cur.version) {
    throw new Error(`候选基于 ${rel.parentVersion}，当前已是 ${cur.version}，需重新提案`);
  }

  const published = releaseLog(workspace).filter((r) => r.type === 'harness.published').length;
  const version = `H${published + 1}`;
  // 版本是**叠加**的：本次只写了 cost，上一版的 repetition 仍然生效。
  // 否则每发一版都会静默回退掉之前所有的改进（这个 bug 就是被 csl-harness 测试抓出来的）。
  const config = { ...cur.config, ...rel.config };
  writeCurrentFile(workspace, {
    schema: HARNESS_SCHEMA,
    version,
    releaseId,
    parentVersion: rel.parentVersion,
    config,
    publishedAt: nowIso(),
    approvedBy,
  });
  // 账本里存**累积后**的配置：回滚直接按它还原，不再回头拼 proposal 的增量。
  appendLedger(workspace, { type: 'harness.published', releaseId, version, parentVersion: rel.parentVersion, approvedBy, config });
  return { version, releaseId, parentVersion: rel.parentVersion, config };
}

/**
 * 回滚。默认回到当前版本的父版本；也可显式指定历史版本。
 * 目标不存在时**拒绝并保持现状**——回滚失败不能把系统留在半路。
 */
export function rollback(workspace, { toVersion = '', reason = '' } = {}) {
  const cur = current(workspace);
  const target = toVersion || cur.parentVersion || BASELINE_VERSION;

  let next;
  if (target === BASELINE_VERSION) {
    next = baselineState();
  } else {
    const pub = releaseLog(workspace)
      .filter((r) => r.type === 'harness.published' && r.version === target)
      .pop();
    if (!pub) throw new Error(`版本 ${target} 不存在，拒绝回滚`);
    next = {
      schema: HARNESS_SCHEMA,
      version: target,
      releaseId: pub.releaseId,
      parentVersion: pub.parentVersion || null,
      config: pub.config || {},
      publishedAt: pub.at,
      approvedBy: pub.approvedBy,
    };
  }

  writeCurrentFile(workspace, next);
  appendLedger(workspace, { type: 'harness.rolled_back', from: cur.version, to: target, reason });
  return { from: cur.version, to: target, config: next.config };
}

// ── 渲染 ──────────────────────────────────────────────────────────────

export function renderHarness(workspace) {
  const cur = current(workspace);
  const cfg = activeConfig(workspace);
  const log = releaseLog(workspace);
  const byType = (t) => log.filter((r) => r.type === t).length;

  const lines = [];
  lines.push('Harness 发行状态');
  lines.push(`  当前版本: ${cur.version}${cur.releaseId !== cur.version ? ` （来自 ${cur.releaseId}）` : ''}`);
  lines.push(`  父版本  : ${cur.parentVersion || '—'}`);
  lines.push(`  发布时间: ${cur.publishedAt || '（基线，未发布过新版本）'}`);
  lines.push(`  审批人  : ${cur.approvedBy || '—'}`);
  lines.push('');
  lines.push(`  生效配置（${Object.keys(cur.config).length} 项覆盖 / 共 ${EVOLVABLE_KEYS.length} 个**已接线**键）:`);
  for (const k of EVOLVABLE_KEYS) {
    const overridden = Object.prototype.hasOwnProperty.call(cur.config, k);
    lines.push(`    ${overridden ? '*' : ' '} ${k} = ${JSON.stringify(cfg[k])}`);
  }
  lines.push('');
  const declared = Object.keys(DECLARED_NOT_WIRED);
  lines.push(`  已声明但未接线（${declared.length} 个，提案会被拒收 reason=no_consumer）:`);
  for (const k of declared) lines.push(`    - ${k} —— ${DECLARED_NOT_WIRED[k]}`);
  lines.push('');
  lines.push('  发布门（v0）:');
  lines.push(`    配对对照 ${GATE_V0.requirePairedComparison ? '必须' : '不要求'} · 留出集 ${GATE_V0.requireHeldOut ? '必须' : '不要求'}`);
  lines.push(
    `    样本量 ≥ ${GATE_V0.minSampleSize} · 留出集提升 ≥ ${GATE_V0.minHeldOutDelta} · 回归率 ≤ ${GATE_V0.maxRegressionRate} · 成本增幅 ≤ ${GATE_V0.maxCostDelta}`,
  );
  lines.push(`    证据种类（按优先级）: ${EVIDENCE_LADDER.map((e) => e.id).join(' > ')}（llm_judge 不得单独作证）`);
  lines.push('');
  lines.push(`  权限边界: 作用范围 ${AUTHORITY.affects}；留出集测的是「${AUTHORITY.generalizationTarget}」`);
  lines.push(`            ${AUTHORITY.outOfScope}`);
  lines.push('');
  lines.push(`  账本: 提案 ${byType('harness.proposed')} · 拒收 ${byType('harness.rejected')} · 评估 ${byType('harness.evaluated')} · 发布 ${byType('harness.published')} · 回滚 ${byType('harness.rolled_back')}`);
  lines.push('');
  lines.push(`  冻结区（${FROZEN_ZONE.length} 类，白名单外一律拒收）: ${FROZEN_ZONE.join('  ')}`);
  return lines.join('\n');
}
