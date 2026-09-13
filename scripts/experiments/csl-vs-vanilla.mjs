#!/usr/bin/env node
// Vanilla LLM vs LLM+CSLA 最小对照（真实 token，opt-in）。
// 用法：CSL_REAL_LLM=1 node scripts/experiments/csl-vs-vanilla.mjs
// 对比：correctness（人工读）/ token cost / latency / action appropriateness。
// 不做统计宣称——样本量小，只做工程观测。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'agent', 'src');
const { loadConfig } = await import(path.join(SRC, 'config.js'));
const { makeLlm } = await import(path.join(SRC, 'llm.js'));
const ws = await import(path.join(SRC, 'workspace.js'));
const rt = await import(path.join(SRC, 'csl', 'runtime.js'));

if (process.env.CSL_REAL_LLM !== '1') {
  console.log('需要 CSL_REAL_LLM=1 显式开启（真实 token）');
  process.exit(1);
}

const cfg = loadConfig();
if (!cfg.apiKey) throw new Error('未配置 LLM 凭据');
const llm = makeLlm(cfg);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-vs-vanilla-'));

const ITEMS = [
  { input: '小猪吃玉米，牛也吃粮食，这说明什么？', core: '动物食性与植物粮的关系', task: '抽象归纳' },
  { input: '为什么 AI 写作容易同质化？', core: 'AI 写作同质化的原因分析', task: '因果分析' },
  { input: '把「门槛被磨矮了」展开成一个写作方向', core: '门槛意象的写作展开', task: '创意发散' },
];

const rows = [];
for (const item of ITEMS) {
  // Vanilla：直接问
  const v = await llm.run({ operator: 'vanilla', input: item.input });
  // CSLA：先固化 coreIdea，再走运行时（真实动作循环）
  const w = ws.ensureWorkspace(path.join(tmp, 'w' + rows.length), { create: true });
  rt.acceptAnswer(w, null, item.core);
  const c = await rt.runTurn(w, { input: item.input, llm, sessionId: 'vs' + rows.length });
  rows.push({
    input: item.input,
    task: item.task,
    vanilla: {
      tokens: v.usage.total_tokens,
      latencyMs: v.latencyMs,
      preview: String(v.output).slice(0, 60),
    },
    csl: {
      kind: c.kind,
      action: c.actionTrace ? c.actionTrace.map((t) => t.action).join('→') : c.kind,
      tokens: c.usage?.total_tokens,
      calls: c.usage?.calls,
      latencyMs: c.usage?.latencyMs,
      stateVersion: c.state?.sVersion,
      hypotheses: (c.hypotheses || []).length,
      preview: (c.hypotheses || []).map((h) => String(h.claim).slice(0, 40)).join(' | '),
    },
  });
  const out = rows[rows.length - 1];
  console.log(
    `\n[${item.task}] ${item.input}\n  vanilla: tokens=${out.vanilla.tokens}, ${(out.vanilla.latencyMs / 1000).toFixed(1)}s\n  csl:     ${out.csl.kind} ${out.csl.action} tokens=${out.csl.tokens}, ${out.csl.calls} calls, ${(out.csl.latencyMs / 1000).toFixed(1)}s, state=v${out.csl.stateVersion}`,
  );
}

const outPath = path.join(tmp, 'csl-vs-vanilla.json');
fs.writeFileSync(outPath, JSON.stringify({ provider: cfg.provider, model: cfg.model, rows }, null, 2));
console.log(`\n对照结果 → ${outPath}`);
