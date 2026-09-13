#!/usr/bin/env node
// HRME 红队伪造化实验（H1–H8，确定性、零 token、可复现）。
// 用法：node scripts/experiments/redteam-hrmr.mjs
// 每个 H 都是一次"试图打坏"的攻击，pass 表示攻击被模块挡住/缺陷不存在。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'agent', 'src');
const ws = await import(path.join(SRC, 'workspace.js'));
const hr = await import(path.join(SRC, 'csl', 'hrmr.js'));

const results = [];
const record = (name, pass, evidence) => results.push({ name, pass, evidence });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'redteam-hrmr-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// ── H1 分离攻击：仅一动词之差的经历必须保持独立 episode，support 各自递增 ──
hr.addEpisode(w, { text: '小猪吃玉米', outcome: 1, goal: 'g1' });
hr.addEpisode(w, { text: '小猪闻玉米', outcome: 1, goal: 'g2' });
hr.addEpisode(w, { text: '小猪吃玉米', outcome: 0, goal: 'g3' }); // 同文本、不同结果
const h1 = hr.retrieve(w, '小猪');
const h1Corn = h1.filter((i) => i.relationText.includes('玉米'));
const eatEp = h1Corn.find((i) => i.relationText.startsWith('小猪—吃→'));
const sniffEp = h1Corn.find((i) => i.relationText.includes('闻'));
record(
  'H1 分离：吃/闻不合并，同文本 support 累加',
  h1Corn.length >= 2 && eatEp?.support === 2 && Boolean(sniffEp),
  `eat.support=${eatEp?.support}, sniff.support=${sniffEp?.support}`,
);

// ── H2 泛化门槛攻击：单次经历不得升 M3；transfer=0 不得升 M4 ──
const w2 = ws.ensureWorkspace(path.join(tmp, 'w2'), { create: true });
const single = hr.addEpisode(w2, { text: '猫吃鱼', outcome: 1, goal: 'g' });
const singleLevel = single.episode.level;
// 同一 typed schema 刷 5 次支持但从未迁移
for (let i = 0; i < 5; i++) hr.addEpisode(w2, { text: '猫吃鱼', outcome: 1, goal: 'g' + i });
const catSchema = hr.retrieve(w2, '鱼').find((i) => i.kind === 'schema');
record(
  'H2 门槛：单次经历 <M3，无迁移证据不得 M4',
  singleLevel < 3 && catSchema.level < 4,
  `single.level=${singleLevel}, schema.level=${catSchema.level}, transfer=${catSchema?.transfer}`,
);

// ── H3 顽固错误攻击：反例必须持续降置信/降级，少量正面支持不得立即回 M4 ──
const w3 = ws.ensureWorkspace(path.join(tmp, 'w3'), { create: true });
for (let i = 0; i < 5; i++) hr.addEpisode(w3, { text: '小猪吃玉米', outcome: 1, goal: 'g' + i });
hr.markTransfer(w3, '小猪吃玉米');
for (let i = 0; i < 5; i++) hr.challengeSchema(w3, '小猪吃玉米', `反例${i}`);
let h3schema = hr.retrieve(w3, '玉米').find((i) => i.kind === 'schema');
const demotedLevel = h3schema.level;
const demotedConf = h3schema.confidence;
// 再补 3 次正面支持，看是否会"错误复活"
for (let i = 0; i < 3; i++) hr.addEpisode(w3, { text: '小猪吃玉米', outcome: 1, goal: 'r' + i });
h3schema = hr.retrieve(w3, '玉米').find((i) => i.kind === 'schema');
record(
  'H3 顽固错误：5 反例降级降置信，补 3 正例不得回 M4',
  demotedLevel <= 3 && demotedConf < 0.3 && h3schema.level < 4,
  `demoted.level=${demotedLevel}, conf=${demotedConf}, after3more.level=${h3schema.level}, conf=${h3schema.confidence}`,
);

// ── H4 选择性遗忘攻击：decay 不得删 M3/M4 结构与近期高效用；低效用必须清 ──
const w4 = ws.ensureWorkspace(path.join(tmp, 'w4'), { create: true });
for (let i = 0; i < 5; i++) hr.addEpisode(w4, { text: '牛吃粮食', outcome: 1, goal: 'g' + i });
hr.markTransfer(w4, '牛吃粮食');
hr.addEpisode(w4, { text: '昨天看到一只鸟飞过', outcome: 1 }); // 低效用
// 模拟时间流逝：把低效用经历改为 10 天前（近期保护是特性，不是缺陷）
const memFile = path.join(w4, 'vault', 'csl-memory.json');
const mem4 = JSON.parse(fs.readFileSync(memFile, 'utf8'));
for (const it of mem4.items) if (it.relationText.includes('鸟')) it.updatedAt = Date.now() - 10 * 86400000;
fs.writeFileSync(memFile, JSON.stringify(mem4, null, 2) + '\n');
const before4 = hr.retrieve(w4, '').length;
hr.decay(w4, { timeWeight: 0.1 });
const after4 = hr.retrieve(w4, '');
const schemaKept = after4.some((i) => i.kind === 'schema' && i.relationText.startsWith('mammal'));
const birdGone = !after4.some((i) => i.relationText.includes('鸟'));
record(
  'H4 遗忘：结构存活、陈旧低效用清除',
  schemaKept && birdGone,
  `before=${before4}, after=${after4.length}, schemaKept=${schemaKept}, birdGone=${birdGone}`,
);

// ── H5 迁移有效性攻击：M4 必须由 transfer 证据触发（w3 已隐含；此处显式对照） ──
const w5a = ws.ensureWorkspace(path.join(tmp, 'w5a'), { create: true });
const w5b = ws.ensureWorkspace(path.join(tmp, 'w5b'), { create: true });
for (let i = 0; i < 5; i++) {
  hr.addEpisode(w5a, { text: '羊吃粮食', outcome: 1, goal: 'a' + i });
  hr.addEpisode(w5b, { text: '羊吃粮食', outcome: 1, goal: 'b' + i });
}
hr.markTransfer(w5b, '羊吃粮食');
const noTransfer = hr.retrieve(w5a, '粮食').find((i) => i.kind === 'schema');
const withTransfer = hr.retrieve(w5b, '粮食').find((i) => i.kind === 'schema');
record(
  'H5 迁移：transfer=0 停 M3，有 transfer 才 M4',
  noTransfer.level === 3 && withTransfer.level === 4,
  `noTransfer.level=${noTransfer.level}, withTransfer.level=${withTransfer.level}`,
);

// ── H6 绑定鲁棒性攻击：否定/被动/多动词句不得产生垃圾绑定 ──
const neg = hr.bind('小猪不吃玉米');
const passive = hr.bind('玉米被小猪吃了');
const multiVerb = hr.bind('小猪喜欢玉米也喜欢肉');
const negClean = Array.isArray(neg) && neg.length === 0;
const passiveClean = Array.isArray(passive) && passive.length === 0;
const multiOk = multiVerb.length > 0 && multiVerb[0].subject === '小猪' && multiVerb[0].object === '玉米';
record(
  'H6 绑定：否定/被动拒绝，多动词截断',
  negClean && passiveClean && multiOk,
  `neg=${JSON.stringify(neg)}, passive=${JSON.stringify(passive)}, multi=${JSON.stringify(multiVerb)}`,
);

// ── H7 检索目标条件攻击：query 命中的低层 episode 必须压过未命中的高层 schema ──
const w7 = ws.ensureWorkspace(path.join(tmp, 'w7'), { create: true });
for (let i = 0; i < 5; i++) hr.addEpisode(w7, { text: '牛吃粮食', outcome: 1, goal: 'g' + i });
hr.markTransfer(w7, '牛吃粮食');
hr.addEpisode(w7, { text: '小猪闻玉米', outcome: 1, goal: 'smell' });
const r7 = hr.retrieve(w7, '小猪');
const first = r7[0];
record(
  'H7 检索：查"小猪"命中的 episode 优先于通用 schema',
  first.kind === 'episode' && first.relationText.includes('小猪'),
  `first=${first.relationText}(${first.kind},L${first.level})`,
);
// 通用 query（"吃"）应回到 schema 优先
const r7b = hr.retrieve(w7, '吃');
record(
  'H7 检索：通用查询"吃"schema 优先',
  r7b[0]?.kind === 'schema',
  `first=${r7b[0]?.relationText}(${r7b[0]?.kind})`,
);

// ── H8 生命周期完整性攻击：同文本幂等；confidence 随支持单调、随反例单调 ──
const w8 = ws.ensureWorkspace(path.join(tmp, 'w8'), { create: true });
const firstAdd = hr.addEpisode(w8, { text: '狗吃骨头', outcome: 1, goal: 'g1' });
const secondAdd = hr.addEpisode(w8, { text: '狗吃骨头', outcome: 1, goal: 'g2' });
const items8 = hr.retrieve(w8, '狗');
const dogEpisodes = items8.filter((i) => i.relationText === '狗—吃→骨头');
const idemOk = firstAdd.episode.id === secondAdd.episode.id && dogEpisodes.length === 1;
const confUp = dogEpisodes[0].confidence >= firstAdd.episode.confidence;
const w8b = ws.ensureWorkspace(path.join(tmp, 'w8b'), { create: true });
hr.addEpisode(w8b, { text: '狗吃骨头', outcome: 1, goal: 'g' });
const c0 = hr.retrieve(w8b, '狗')[0].confidence;
for (let i = 0; i < 3; i++) hr.challengeSchema(w8b, '狗吃骨头', `反例${i}`);
const c3 = hr.retrieve(w8b, '狗').find((i) => i.kind === 'schema').confidence;
record(
  'H8 生命周期：幂等、置信随支持不降、随反例不升',
  idemOk && confUp && c3 <= c0,
  `sameId=${idemOk}, confUp=${confUp}, c0=${c0}, c3=${c3}`,
);

// ── 输出 ──
const passed = results.filter((r) => r.pass).length;
console.log(`\n=== HRME 红队实测（H1–H8，确定性/零 token） ===\n通过 ${passed}/${results.length}\n`);
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}\n      evidence: ${r.evidence}`);
}
const outPath = path.join(tmp, 'redteam-hrmr-results.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\nresults → ${outPath}`);
if (passed !== results.length) process.exit(1);
