// CSLA OutcomeLedger + BasicCredit（v1.0）
// 结果账本：prediction → action → outcome → error → human feedback → credit。
// Basic Credit（用户冻结：先 Explicit Counterfactual，不先做 learned）：
//
// ⚠️ LEGACY（2026-09 标注）：本模块**不在生产路径上**。
//   生产用的是 csl/credit.js（runtime.js 直接 import 它）。两者功能重复：
//   都有 recordOutcome 与 B0/B1/B2 信用基线。
//   保留原因：3 个测试与 1 个实验脚本仍在引用它。
//   正确处理：要么删除，要么把引用它的测试迁到 credit.js 后删除。
//   在此之前，请勿在新功能里使用本模块。

//   C(i,t,e|B) := L_future(do(i,t,e=B)) − L_future(real)
//   MVP 实现：B0 冻结 / B1 替换 / B2 匹配替代的显式基线，误差启发式归因；
//   不训练 neural credit estimator。
// Failure cases：
//   F1 无 outcome 的 credit → 拒绝（不能无中生有归因）；
//   F2 归因到无作用的模块 → 拒绝（防错误归因）；
//   F3 同输入同输出。
import * as ev from './events.js';

/** 记录 outcome 到事件账本（回填 prediction 的 error；可携带反事实 credit 与来源）。 */
export function recordOutcome(workspace, { sessionId, step, prediction, outcome, credit, source = '' }) {
  if (outcome === undefined || outcome === null) {
    throw new Error('recordOutcome requires outcome');
  }
  const error = {
    magnitude: Number(Math.abs(Number(outcome) - Number(prediction || 0)).toFixed(4)),
  };
  ev.appendEvent(workspace, {
    event_type: 'outcome.observed',
    state_version: `s_${step || 0}`,
    session_id: sessionId || '',
    step: step || 0,
    prediction: { value: prediction },
    outcome: { value: outcome },
    error,
    credit: credit || {},
    provenance: {
      source,
      intervention: credit
        ? { baseline: credit.baseline, off: credit.off, method: credit.method, confidence: credit.confidence }
        : undefined,
    },
  });
  return { error, credit: credit || null };
}

const MODULE_ROLES = {
  elicitor: '决定问什么问题、是否捕获 core idea',
  router: '决定给哪个 operator 什么上下文',
  operators: '生成候选',
  evaluator: '验证/拒绝候选',
  synthesizer: '综合成稿',
};

/**
 * Basic credit（DEPRECATED）：把结果误差按基线模式均分归因到模块——P0 禁则，勿在 runtime 使用。
 * baseline: 'B0' 冻结 / 'B1' 替换 / 'B2' 匹配替代。
 * 保留仅为向后兼容（既有测试/调用）；新代码一律用 creditFromCounterfactual。
 */
export function basicCredit({ outcome, prediction, baseline = 'B0', involvedModules = [] }) {
  if (outcome === undefined || outcome === null) {
    throw new Error('credit requires outcome (F1)');
  }
  for (const m of involvedModules) {
    if (!MODULE_ROLES[m]) throw new Error(`unknown module for credit: ${m} (F2)`);
  }
  const error = Number(Math.abs(Number(outcome) - Number(prediction || 0)).toFixed(4));
  const credit = {};
  for (const m of involvedModules) {
    // 启发式：误差按参与模块均分；基线模式只影响记录口径，不影响 MVP 均分
    credit[m] = Number((error / Math.max(1, involvedModules.length)).toFixed(4));
  }
  return { baseline, error, credit };
}

export const CREDIT_BASELINES = ['B0', 'B1', 'B2'];

/**
 * 反事实 Credit（P0-5 正式路径）：
 * C_i = Performance^{counterfactual(移除 i)} − Performance^{actual}。
 * off[i] 由调用方给出（配对干预/确定性仿真），必须记录 baseline/intervention/result/confidence。
 */
export function creditFromCounterfactual({ real, off = {}, baseline = 'B0', modules = [], confidence = 0.5 }) {
  if (real === undefined || real === null) {
    throw new Error('creditFromCounterfactual requires real outcome (F1)');
  }
  if (!Array.isArray(modules) || !modules.length) {
    throw new Error('creditFromCounterfactual requires modules');
  }
  const r = Number(real);
  const credit = {};
  for (const m of modules) {
    const offVal = off[m] === undefined ? r : Number(off[m]);
    credit[m] = Number((r - offVal).toFixed(4));
  }
  return {
    baseline,
    real: r,
    off,
    credit,
    confidence: Number(confidence),
    method: 'counterfactual',
  };
}

/**
 * 真实反事实 Credit（红队修复 #2）：不是标签，是真的 do() 干预。
 * simulate({active, seed}) 必须可重放且同种子确定性；对每个模块关闭后重跑，
 * credit[m] = L_future(real) − L_future(do(移除 m))（配对运行，隔离单模块差异）。
 */
export function interveneAndCredit({ simulate, modules = [], baseline = 'B0', seed = 1 }) {
  if (!modules.length) throw new Error('interveneAndCredit requires modules');
  const real = simulate({ active: modules, seed });
  const credit = {};
  for (const m of modules) {
    const off = simulate({ active: modules.filter((x) => x !== m), seed });
    credit[m] = Number((Number(real) - Number(off)).toFixed(4));
  }
  return { baseline, real, credit };
}
