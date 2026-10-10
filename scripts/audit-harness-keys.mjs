#!/usr/bin/env node
// Harness 可进化键的「静态消费点审计」（主提示词 §11.3 第一层）。
//
// 为什么要有这个脚本：白名单曾经写着 13 个键，但只有 4 个真的被读——
// 其余 9 个设置之后什么都不会发生。声明和能力必须分开，而且这件事要能复跑、能进 CI，
// 不能靠"我记得审过"。
//
// 用法: node scripts/audit-harness-keys.mjs [--json]
// 退出码: 0 = 所有白名单键都有消费点；1 = 存在没有消费点的白名单键（CI 应视为失败）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const h = await import(new URL('../agent/src/csl/harness.js', import.meta.url).href);

// 扫描范围：所有可能读到配置的运行时文件
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      walk(p, acc);
    } else if (/\.(js|mjs|html)$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const targets = [
  ...walk(path.join(ROOT, 'agent/src')),
  path.join(ROOT, 'web/server.mjs'),
  path.join(ROOT, 'web/public/index.html'),
  path.join(ROOT, 'web/public/assets/app.js'),
].filter((f) => fs.existsSync(f));

const corpus = targets.map((f) => ({ file: path.relative(ROOT, f), src: fs.readFileSync(f, 'utf8') }));
const SELF = 'agent/src/csl/harness.js';

/**
 * "接线"的判定只有一条：`WIRING[key]` 声明的消费符号，必须真的在 harness 之外出现。
 *
 * 不搜键名——提问权重从来不以键名的形式被读，而是经 `questionWeights()` 投影后注入。
 * 也不接受"末段同名"这种巧合命中（`cost` 在 cadence/credit 里到处都是）。
 * 于是"接线"变成一条可验证的声明：要么有消费符号，要么它就是没接线。
 */
function inspect(key) {
  const symbol = h.WIRING[key];
  const hits = symbol
    ? corpus.filter((c) => c.file !== SELF && new RegExp(`\\b${symbol}\\b`).test(c.src)).map((c) => c.file)
    : [];
  return { key, symbol: symbol || null, consumers: hits, wired: hits.length > 0 };
}

const wired = h.EVOLVABLE_KEYS.map(inspect);
const declared = Object.entries(h.DECLARED_NOT_WIRED).map(([key, why]) => ({ key, why }));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ wired, declared }, null, 2));
} else {
  console.log('Harness 可进化键 · 静态消费点审计\n');
  console.log(`白名单（${wired.length} 个）：`);
  for (const w of wired) {
    console.log(`  ${w.wired ? '✓' : '✗'} ${w.key}`);
    if (!w.symbol) console.log('      未在 WIRING 里登记消费符号');
    else console.log(`      消费符号 ${w.symbol} 出现于：${w.consumers.join(', ') || '（无——声明了但没人读）'}`);
  }
  console.log(`\n已声明未接线（${declared.length} 个，提案会被拒收）：`);
  for (const d of declared) console.log(`  - ${d.key} —— ${d.why}`);
}

const broken = wired.filter((w) => !w.wired);
if (broken.length) {
  console.error(`\n✗ ${broken.length} 个白名单键没有可验证的消费点：${broken.map((b) => b.key).join(', ')}`);
  console.error('  要么在 WIRING 里登记真实消费符号并补上消费点，要么移入 DECLARED_NOT_WIRED。');
  process.exit(1);
}
console.log(`\n✓ 白名单 ${wired.length} 个键的消费符号全部真实存在；未接线 ${declared.length} 个已单列。`);
