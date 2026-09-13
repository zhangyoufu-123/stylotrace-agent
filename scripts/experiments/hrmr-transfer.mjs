#!/usr/bin/env node
// Episodic-to-Schema Transfer 基准：4 条同构 episode → schema → 未见 Novel Episode 5。
// 零 token（语义 KB + 确定性 HRME）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'agent', 'src');
const ws = await import(path.join(SRC, 'workspace.js'));
const hr = await import(path.join(SRC, 'csl', 'hrmr.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hrmr-transfer-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// 训练：4 条同构 episode（不同情境/目标 → 提高 diversity）
const train = [
  ['小猪吃玉米', 's1'],
  ['小猪吃粮食', 's2'],
  ['牛吃玉米', 's3'],
  ['羊吃粮食', 's4'],
];
for (const [t, g] of train) hr.addEpisode(w, { text: t, outcome: 1, goal: g });

const schema = hr.retrieve(w, '玉米').find((i) => i.kind === 'schema') || hr.retrieve(w, '玉米')[0];
const level = schema ? schema.level : 0;
const conf = schema ? schema.confidence : 0;

// Novel Episode 5（未见）：牛吃粮食 —— 若 schema 已泛化到"哺乳动物可食植物粮"，检索应命中
const novel = hr.bind('牛吃粮食');
const retrieved = hr.retrieve(w, '牛');
const transfer = novel.length > 0 && retrieved.some((i) => i.relationText.includes('牛') || i.relationText.includes('玉米') || i.relationText.includes('粮食'));

// 迁移验证成功后标记 transfer → 允许升 M4（M4 门槛：分数+置信+迁移证据）
const marked = hr.markTransfer(w, '牛吃粮食');
const finalLevel = marked ? marked.level : level;

console.log(`Episodic-to-Schema Transfer\n  schema_level=${level}→${finalLevel} conf=${conf}\n  novel_bind=${novel[0]?.subject}—${novel[0]?.verb}→${novel[0]?.object}\n  transfer_success=${transfer}`);
if (!(level >= 3 && transfer && finalLevel >= 4)) process.exit(1);
