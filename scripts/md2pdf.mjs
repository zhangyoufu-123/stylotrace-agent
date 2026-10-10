#!/usr/bin/env node
// Markdown → 打印级 PDF（零依赖）：自写 Markdown 子集渲染 + Chrome 无头打印。
// 用法: node scripts/md2pdf.mjs <in.md> <out.pdf> ["标题"]
// 支持: h1-h4 / 段落 / 粗体 / 斜体 / 行内代码 / 代码块 / 表格 / 有序无序列表 / 引用 / 分隔线
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
}

function markdownToHtml(md) {
  const lines = String(md).split('\n');
  const out = [];
  let i = 0;
  let listType = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    if (/^```/.test(line)) {
      closeList();
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // 表格
    if (/^\|/.test(line) && /^\|[\s:|-]+\|$/.test(lines[i + 1] || '')) {
      closeList();
      const head = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i += 1;
      }
      out.push('<table><thead><tr>' + head.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>');
      for (const r of rows) out.push('<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
      out.push('</tbody></table>');
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // 分隔线
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      closeList();
      out.push('<hr>');
      i += 1;
      continue;
    }

    // 引用
    if (/^\s*>/.test(line)) {
      closeList();
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${buf.map((b) => `<p>${inline(b)}</p>`).join('')}</blockquote>`);
      continue;
    }

    // 列表
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ul || ol) {
      const want = ul ? 'ul' : 'ol';
      if (listType !== want) {
        closeList();
        out.push(`<${want}>`);
        listType = want;
      }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      i += 1;
      continue;
    }

    // 空行
    if (!line.trim()) {
      closeList();
      i += 1;
      continue;
    }

    // 段落
    closeList();
    out.push(`<p>${inline(line)}</p>`);
    i += 1;
  }
  closeList();
  return out.join('\n');
}

const CSS = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "PingFang SC", "Hiragino Sans GB", "Songti SC", "Microsoft YaHei", serif;
  font-size: 10.5pt; line-height: 1.85; color: #1a1a1a; margin: 0;
  text-align: justify; }
h1 { font-size: 18pt; font-weight: 700; margin: 0 0 10pt; color: #111;
  border-bottom: 1px solid #333; padding-bottom: 6pt; text-align: left; }
h2 { font-size: 13.5pt; font-weight: 700; margin: 18pt 0 7pt; color: #111; text-align: left; }
h3 { font-size: 11.5pt; font-weight: 700; margin: 13pt 0 5pt; color: #111; text-align: left; }
h4 { font-size: 10.5pt; font-weight: 700; margin: 10pt 0 4pt; color: #111; text-align: left; }
p { margin: 6pt 0; }
ul, ol { margin: 6pt 0 6pt 20pt; padding: 0; }
li { margin: 3pt 0; }
table { width: 100%; border-collapse: collapse; margin: 9pt 0; font-size: 9.5pt; }
th, td { border: 1px solid #bbb; padding: 4pt 6pt; text-align: left; vertical-align: top; }
th { background: #f2f2f2; font-weight: 700; }
code { background: #f4f4f4; padding: 1pt 3pt; border-radius: 2px; font-family: "SF Mono", Menlo, monospace; font-size: 9pt; }
pre { background: #fafafa; border: 1px solid #e2e2e2; padding: 9pt 10pt; overflow-x: auto;
  font-size: 9pt; line-height: 1.6; text-align: left; break-inside: avoid; page-break-inside: avoid; }
pre code { background: none; padding: 0; }
blockquote { margin: 8pt 0 8pt 12pt; padding: 0; color: #222; }
blockquote p { margin: 4pt 0; }
hr { border: none; border-top: 1px solid #d5d5d5; margin: 14pt 0; }
strong { font-weight: 700; }
h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }
tr, li { break-inside: avoid; }
`;

function buildHtml(md, title) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${CSS}</style></head><body>${markdownToHtml(md)}</body></html>`;
}

function chromeBin() {
  for (const c of CHROME_CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('未找到 Chrome/Edge/Chromium，无法生成 PDF');
}

const [inFile, outFile, title = ''] = process.argv.slice(2);
if (!inFile || !outFile) {
  console.error('用法: node scripts/md2pdf.mjs <in.md> <out.pdf> ["标题"]');
  process.exit(1);
}
const md = fs.readFileSync(inFile, 'utf8');
const htmlFile = path.join(os.tmpdir(), `md2pdf-${Date.now()}.html`);
fs.writeFileSync(htmlFile, buildHtml(md, title || path.basename(inFile, '.md')));
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });

execFileSync(chromeBin(), [
  '--headless',
  '--disable-gpu',
  '--no-pdf-header-footer',
  `--print-to-pdf=${path.resolve(outFile)}`,
  `file://${htmlFile}`,
], { stdio: ['ignore', 'ignore', 'pipe'] });

const size = fs.statSync(outFile).size;
console.log(`✓ ${outFile}（${(size / 1024).toFixed(0)} KB）`);
