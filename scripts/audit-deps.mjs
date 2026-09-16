#!/usr/bin/env node
// 真实依赖图审计：谁引用谁、哪些模块没被引用、分层是否如文档所述。
//
// 为什么要有它：文档里的"架构图"容易写成愿望而不是事实。
// 这个脚本只读代码，把 import / 再导出 / 动态 import 全部扫出来，用事实说话。
//
// 用法: node scripts/audit-deps.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'agent', 'src');
const rel = (p) => path.relative(ROOT, p);

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(ROOT);

// 三种引用形式都要抓：静态 import、再导出 export ... from、动态 import()
const RE_IMPORT = /(?:^|\s)(?:import|export)[\s\S]{0,200}?from\s*['"]([^'"]+)['"]/g;
const RE_DYN = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const edges = new Map(files.map((f) => [f, new Set()]));
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const re of [RE_IMPORT, RE_DYN]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      if (!m[1].startsWith('.')) continue;
      const t = path.resolve(path.dirname(f), m[1]);
      if (edges.has(t)) edges.get(f).add(t);
    }
  }
}

const referenced = new Map(files.map((f) => [f, []]));
for (const [f, ts] of edges) {
  for (const t of ts) referenced.get(t).push(rel(f));
}

// 入口：由 bin / web / skills 引用，或文件名本身是入口
const ENTRY_HINTS = ['cli.js', 'mcp.js', 'director.js'];
const orphans = files
  .filter((f) => referenced.get(f).length === 0)
  .map(rel)
  .filter((r) => !ENTRY_HINTS.includes(path.basename(r)));

const byDir = {};
for (const f of files) {
  const d = path.dirname(rel(f)) === '.' ? '(根)' : path.dirname(rel(f));
  byDir[d] = (byDir[d] || 0) + 1;
}

const top = [...referenced.entries()]
  .map(([f, rs]) => ({ file: rel(f), refs: rs.length }))
  .sort((a, b) => b.refs - a.refs);

const lines = (f) => fs.readFileSync(f, 'utf8').split('\n').length;
const totalLines = files.reduce((a, f) => a + lines(f), 0);

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        total: files.length,
        totalLines,
        byDir,
        orphans,
        topReferenced: top.slice(0, 15),
        leaves: files.filter((f) => edges.get(f).size === 0).map(rel),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log(`agent/src：${files.length} 个模块 / ${totalLines} 行`);
console.log('\n按目录：');
for (const [d, n] of Object.entries(byDir).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${d}`);
}
console.log(`\n没有任何模块引用（真孤儿）：${orphans.length}`);
for (const o of orphans) console.log(`  · ${o}`);
console.log('\n被引用最多（越靠上越是地基）：');
for (const t of top.slice(0, 12)) console.log(`  ${String(t.refs).padStart(3)} × ${t.file}`);
console.log(`\n不引用别人（叶子模块/纯工具）：${files.filter((f) => edges.get(f).size === 0).length}`);
