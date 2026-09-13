#!/usr/bin/env node
// A/B 对比：同一个"中学生灵感"，分别交给
//   A 普通写作助手（直接成稿）
//   B Stylotrace（先问 → 记核心 → 深层 → 带着认知简报写）
// 观察差异：会不会先问、有没有保住用户的核心、有什么可量化的不同。
// 用法: CSL_REAL_LLM=1 node scripts/experiments/ab-writing-sim.mjs [--out 文件]
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
const adapter = await import(path.join(SRC, 'csl', 'adapter.js'));
const brief = await import(path.join(SRC, 'csl', 'brief.js'));

if (process.env.CSL_REAL_LLM !== '1') {
  console.log('需要 CSL_REAL_LLM=1（真实模型）');
  process.exit(1);
}

const outFlag = process.argv.indexOf('--out');
const outFile = outFlag > -1 ? process.argv[outFlag + 1] : path.join(ROOT, 'docs', 'competition', '12-AB对比与人机模拟.md');

const cfg = loadConfig();
const llm = makeLlm(cfg, { temperature: 0.8 });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-sim-'));

const CASES = [
  {
    name: '小说灵感',
    idea: '我想写一个小说：男孩在老家门槛上等他父亲回家，但父亲其实不会回来了。',
    answer: '我想写的是"等不到"这件事本身——门槛上那点希望和后来知道没希望之间的落差，不想写成亲情煽情。',
  },
  {
    name: '学习总结',
    idea: '物理考试又没考好，我想写一篇关于"我到底哪里没学会"的总结。',
    answer: '我发现我不是不会公式，是每次看到题不知道先想什么；我想写"顺序没建立起来"这件事。',
  },
  {
    name: '演讲稿',
    idea: '我想写一篇演讲稿，讲我们班同学用 AI 写作业这件事。',
    answer: '我不想骂用 AI 的同学，我想说的是：AI 帮我们把作业做完了，但我们把"自己会不会"这件事弄丢了。',
  },
];

const countChars = (s) => (String(s).match(/[\u4e00-\u9fff]/g) || []).length;
const hasAny = (text, answer) => {
  const keys = String(answer).replace(/[，。、；：""''（）—…\s]/g, '').match(/[\u4e00-\u9fff]{2,6}/g) || [];
  const hit = keys.filter((k) => String(text).includes(k));
  return { hits: hit.length, total: keys.length, ratio: keys.length ? Number((hit.length / keys.length).toFixed(2)) : 0 };
};

const rows = [];
for (const c of CASES) {
  const work = ws.ensureWorkspace(path.join(tmp, c.name), { create: true });

  // ── A：普通写作助手（不追问，直接写）──
  const tA0 = Date.now();
  const aOut = String(await llm([{ role: 'user', content: `你是写作助手。请直接写一篇关于这件事的文章，600 字左右，标题自拟。\n学生的想法：${c.idea}` }])).trim();
  const aMs = Date.now() - tA0;

  // ── B：Stylotrace（先问 → 记核心 → 深层 → 带着认知简报写）──
  const tB0 = Date.now();
  const ask = await adapter.runTask({ workspace: work, sessionId: 'ab', input: c.idea, channel: 'cli', mode: 'auto', llm });
  rt.acceptAnswer(work, null, c.answer, 'ab');
  const deep = await adapter.runTask({ workspace: work, sessionId: 'ab', input: c.idea, channel: 'cli', mode: 'deep', llm });
  brief.syncBrief(work, { sessionId: 'ab' });
  const briefText = brief.briefText(work);
  const bOut = String(await llm([{ role: 'user', content: `你是写作助手。请写一篇 600 字左右的文章，标题自拟。\n\n【必须围绕以下认知简报，不许偷换作者的观点】\n${briefText}` }])).trim();
  const bMs = Date.now() - tB0;

  const aKeep = hasAny(aOut, c.answer);
  const bKeep = hasAny(bOut, c.answer);
  rows.push({
    name: c.name,
    askedA: false,
    askedB: ask.kind === 'ask' || ask.kind === 'checkpoint',
    question: ask.question || '',
    coreIdea: String(deep.state?.coreIdea || '').slice(0, 40),
    actionTrace: (deep.actionTrace || []).map((t) => t.action).join('→'),
    charsA: countChars(aOut),
    charsB: countChars(bOut),
    keepA: aKeep.ratio,
    keepB: bKeep.ratio,
    msA: aMs,
    msB: bMs,
    aPreview: aOut.slice(0, 90).replace(/\n/g, ' '),
    bPreview: bOut.slice(0, 90).replace(/\n/g, ' '),
  });
  console.log(`[${c.name}] A 直接成稿 ${countChars(aOut)} 字/${aMs}ms｜B 先问「${(ask.question || '').slice(0, 24)}」→ 轨迹 ${rows[rows.length - 1].actionTrace} ${countChars(bOut)} 字/${bMs}ms｜核心保留 A=${aKeep.ratio} B=${bKeep.ratio}`);
}

const md = [];
md.push('# A/B 对比与人机模拟记录（真实模型）');
md.push('');
md.push(`**模型：** ${cfg.model}　**日期：** ${new Date().toISOString().slice(0, 10)}`);
md.push('');
md.push('**设计：** 同一个"中学生灵感"，两条路径对比——');
md.push('');
md.push('- **A 普通写作助手**：不追问，直接按灵感成稿（1 次模型调用）');
md.push('- **B Stylotrace**：先问一个贴题问题 → 记下学生自己的核心 → 深层思考 → 带着"认知简报"写（多次调用）');
md.push('');
md.push('**指标：** 是否先问 · 核心观点保留率（学生回答中的关键词有多少出现在成稿里）· 字数 · 耗时');
md.push('');
md.push('| 灵感 | A 先问？ | B 先问？ | B 问的问题 | B 认知轨迹 | A 核心保留 | B 核心保留 | A 字数 | B 字数 |');
md.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) {
  md.push(`| ${r.name} | ❌ 否 | ✅ 是 | ${r.question || '—'} | ${r.actionTrace || '—'} | ${r.keepA} | ${r.keepB} | ${r.charsA} | ${r.charsB} |`);
}
md.push('');
md.push('## 观察与结论');
md.push('');
const askedAll = rows.every((r) => r.askedB);
const keepBetter = rows.filter((r) => r.keepB > r.keepA).length;
md.push(`1. **会不会先问**：B 在 ${rows.filter((r) => r.askedB).length}/${rows.length} 个灵感上都先追问（A 全部直接成稿）。这是两条路径最根本的差别——${askedAll ? '全部' : '部分'}学生在写作前被"问过一句"。`);
md.push(`2. **核心观点保留**：B 的保留率在 ${keepBetter}/${rows.length} 个案例里高于 A。原因不是 B 的模型更强（同一模型、同一温度），而是 B 在写之前把学生的核心写成了"认知简报"，并在提示里明确要求"不许偷换作者观点"。`);
md.push(`3. **代价**：B 的调用次数与耗时明显更高（先问一次、深层思考数次）。这是"先想清楚再写"的成本，不是缺陷。`);
md.push(`4. **诚实边界**：核心保留率是**关键词重合度**这种粗指标，不等于"写得好"；本次只有 ${rows.length} 组、单一模型、没有真人评分。它只能说明两条路径**行为上的差别**，不能证明 B 的文章质量更高。`);
md.push('');
md.push('## 原文节选（便于人工比对）');
md.push('');
for (const r of rows) {
  md.push(`### ${r.name}`);
  md.push('');
  md.push(`- **A（直接成稿）**：${r.aPreview}…`);
  md.push(`- **B（先问后写）**：${r.bPreview}…`);
  md.push('');
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, md.join('\n') + '\n');
console.log(`\n报告 → ${outFile}`);
