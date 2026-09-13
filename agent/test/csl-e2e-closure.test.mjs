// FULL E2E PRODUCT VALIDATION 门禁（离线 mock；真实 LLM 用 CSL_REAL_LLM=1 运行同一引擎）。
// 验收：Closure ≥ 0.9；Gate A/B 过；Gate C 诚实未过（机制级行为改变已证明，性能提升需 longitudinal）。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const e2e = await import(path.join(HERE, '..', 'src', 'csl', 'e2e.js'));
const { loadConfig } = await import(path.join(HERE, '..', 'src', 'config.js'));
const { makeLlm } = await import(path.join(HERE, '..', 'src', 'llm.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-e2e-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

let llm = null;
let cfg = null;
let oldFetch = null;
if (process.env.CSL_REAL_LLM === '1') {
  cfg = loadConfig();
  assert.ok(cfg.apiKey, '真实 E2E 需要 LLM 凭据');
  llm = makeLlm(cfg);
} else {
  // 离线：fetch stub 供 Writer 步骤使用
  oldFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: 'req_e2e', model: 'm',
      choices: [{ message: { content: '（mock 段落）门槛被磨矮了，它不说话，却记得每双脚。' } }],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
    }),
  });
  cfg = { baseUrl: 'https://fake', model: 'm', targetWords: 60 };
  // 运行后恢复（引擎内不依赖持久 stub）
}

const r = await e2e.runFullE2E(w, { llm, cfg });
if (!process.env.CSL_REAL_LLM) globalThis.fetch = oldFetch;

// Closure：真实证据 ≥ 0.9（11 条链）
assert.ok(r.closure.score >= 0.9, `Closure 应 ≥0.9: ${r.closure.score}`);
assert.equal(r.closure.observed, r.closure.required, '11 条链全部有证据');

// Gates
assert.equal(r.gates.A_runtimeClosed, true, 'Gate A Runtime Closed');
assert.equal(r.gates.B_writingClosed, true, 'Gate B Writing Closed');
assert.equal(r.gates.C_learningClosed, false, 'Gate C 诚实未过（无 longitudinal 性能证据）');
assert.equal(r.gates.C_learningMechanism, true, 'Learning 机制级行为改变已证明');

// Cognitive Theater 检查
assert.equal(r.theater.searchActuallyExecutes, true, 'search 真执行');
assert.equal(r.theater.creditNegativeChangesPolicy, true, 'credit<0 → 政策真变');
assert.equal(r.theater.checkpointPauseResume, true, 'Deep→Human→Deep 恢复');

// 关键行为断言
const step = (n) => r.steps.find((s) => s.name === n);
assert.equal(step('1 FastChat').ok, true);
assert.equal(step('3 DeepReasoning').actual, 'deep:abstract→search→generate');
assert.equal(step('7 Writer').ok, true);
assert.equal(step('12 SecondTask').ok, true, '第二任务 ask→deep');

console.log(`PASS csl-e2e-closure（Closure ${r.closure.score} · Gate A/B ✅ C 诚实未过 · 13 步全链${process.env.CSL_REAL_LLM ? '（真实 LLM）' : '（离线 mock）'}）`);
