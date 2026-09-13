// CADENCE ←→ agent 集成验收。
//
// 这一条最要紧：**CADENCE 的样本来自我们自己的 agent，不去外面找文章**。
// agent 本来就在持续收集作者的写作（归档作品库 / 亲手改后的文本 / 当前成稿），
// 所以基线应该是"你自己"的：
//   · 作品库空 → 诚实说 0/5 篇，不下结论
//   · 攒够 5 篇 → 自动切成作者基线，并给出"相对你自己"的偏离
//   · 作者冻结的决断（决断卡）→ 自动进入锁定集合，永不建议修改
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const C = await import(path.join(HERE, '..', 'src', 'cadence', 'index.js'));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const lib = await import(path.join(HERE, '..', 'src', 'library.js'));
const dec = await import(path.join(HERE, '..', 'src', 'csl', 'decision.js'));

let n = 0;
const ok = (m) => {
  n += 1;
  console.log(`  ✓ ${m}`);
};

const AI_ISH =
  '在当今社会，手机已经成为中学生生活中不可或缺的一部分，它既是获取知识的工具也是沟通世界的桥梁。' +
  '我们必须要认识到，手机的使用需要理性的引导和规范的管理。首先我们要重视这个问题，其次我们要解决这个问题。' +
  '家长和学校应该共同协作，帮助学生建立良好的使用习惯。只有这样，学生才能在数字时代健康成长。' +
  '因此，合理使用手机对于中学生来说是非常重要的。相关研究表明，适度使用能够提升学习效率，过度使用则会带来负面影响。' +
  '学校应当制定明确的规章制度，引导学生正确使用。家长也应当以身作则，减少自身的手机依赖。' +
  '值得注意的是，沟通与陪伴同样是解决问题的关键所在。综上所述，只有各方共同努力，才能营造良好的成长环境。';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cad-integ-'));
const W = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// ── 1) 空工作区：诚实说攒了多少，不下结论 ───────────────
{
  const r = C.analyze(AI_ISH, { workspace: W });
  assert.equal(r.baseline_source, 'insufficient', '没有作者语料时必须标 insufficient');
  assert.equal(r.author_corpus.pieces, 0);
  assert.ok(/0\/5/.test(r.baseline.note), `应说明 0/5 篇，实际：${r.baseline.note}`);
  assert.ok(/你自己/.test(r.baseline.note), '应说明基线将来取自"你自己"');
  ok('空工作区：如实报告 0/5 篇，不给作者基线');
}

// ── 2) 归档作者作品 → 基线自动切到"你自己" ──────────────
const WORKS = [
  ['门槛', '他站在门槛上。风很大，吹得眼睛睁不开。屋里的灯亮着，饭在锅里温着；他却没有推门。为什么？因为推开门，就等于承认自己错了。十年了，他在这道门槛前来回过无数次。'],
  ['杏树', '春天来了。院子里的杏树开了花，白得像雪；蜜蜂在花间嗡嗡地飞。外婆搬了把椅子坐在树下，眯着眼睛晒太阳，手里还捏着没纳完的鞋底。她说，这样的日子一年也就那么几天。'],
  ['雨夜', '雨下了一夜。早上起来，青石板路上积着水洼，映着天光。我踩着水洼去上学，鞋子湿透了也不在乎。那时候觉得什么都新鲜，连雨都是甜的。现在想想，大概是因为没什么可失去的。'],
  ['父亲', '父亲很少说话。他修门槛那次用了半下午，锯末撒了一地，汗顺着下巴往下滴。我蹲在旁边看，问他为什么不找人帮忙。他说，自己的东西自己修，心里踏实。'],
  ['月亮', '月亮升起来了。院墙的影子拉得很长，一直伸到井台边。母亲在屋里纳鞋底，针脚一下一下，很匀。我趴在窗台上看星星，数着数着就睡着了。梦里还是那片星星。'],
  ['巷子', '巷子很窄。两个人并排走都要侧身，挑担子的得先让路。墙根下长着青苔，滑溜溜的，小孩子跑起来常常摔跤。摔了也不哭，爬起来接着跑，膝盖上的疤一层叠一层。'],
];
for (const [title, body] of WORKS) {
  fs.writeFileSync(path.join(W, 'draft.md'), `# ${title}\n${body}\n`);
  lib.archiveDraft(W, { confirmed: { topic: title } });
}
{
  const r = C.analyze(AI_ISH, { workspace: W });
  assert.equal(r.baseline_source, 'author', `作品库有 ${WORKS.length} 篇后应切到作者基线`);
  assert.ok(r.baseline.samples >= 5, `样本数应 ≥5，实际 ${r.baseline.samples}`);
  assert.ok(Number.isFinite(r.baseline.cv), '作者基线应给出 CV');
  assert.ok(Array.isArray(r.baseline.cvRange) && r.baseline.cvRange.length === 2, '应给出作者的 CV 区间');
  ok(`作者基线生效：${r.baseline.samples} 篇 · CV ${r.baseline.cv} · 区间 ${r.baseline.cvRange.join('–')}`);
}

// ── 3) 相对"你自己"的偏离（唯一的对外口径） ─────────────
{
  const r = C.analyze(AI_ISH, { workspace: W });
  assert.equal(r.deviation.ok, true, '有作者基线后应能判断偏离');
  assert.ok(/你自己/.test(r.deviation.note), `偏离说明必须是"相对你自己"，实际：${r.deviation.note}`);
  assert.ok(
    ['within', 'below', 'above'].includes(r.deviation.position),
    '偏离位置只能是 within/below/above',
  );
  ok(`相对自己：${r.deviation.note}`);
}

// ── 4) 决断卡自动保护：作者冻结的句子永不被建议修改 ─────
{
  const r = C.analyze(AI_ISH, { workspace: W });
  const before = C.suggest(r, { workspace: W });
  const target = r.sentence_level.segments[0];
  const hitBefore = before.filter((s) => s.span.start === target.index && s.span.end === target.index).length;
  assert.ok(hitBefore > 0, '这个前置条件必须成立，否则本测试是假通过：本来就有针对第 1 句的建议');

  const card = dec.createDecisionCard({
    spanText: target.text,
    object: '我自己的表达',
    comparisonSet: '和常见的"手机利弊"套话相比',
    alternatives: '别人会写成"手机是双刃剑"',
    cost: '改了就变味',
  });
  assert.equal(card.ok, true, `决断卡应能建立：${card.reason || ''}`);
  const added = dec.addDecision(W, card.card);
  assert.equal(added.ok, true, '决断卡应能写入');

  const after = C.suggest(r, { workspace: W });
  const hitAfter = after.filter((s) => s.span.start === target.index && s.span.end === target.index).length;
  assert.equal(hitAfter, 0, '冻结之后，不得再对这句提任何建议');
  ok(`决断卡自动保护：冻结前对第 1 句有 ${hitBefore} 条建议，冻结后 0 条`);
}

// ── 5) 作者语料的变化能被看见（不是黑箱） ───────────────
{
  const r = C.analyze(AI_ISH, { workspace: W });
  assert.ok(r.author_corpus, '报告里应带上作者语料概况');
  assert.ok(r.author_corpus.pieces >= 5, '语料篇数应可读');
  assert.ok(r.author_corpus.bySource.library >= 5, '应标明样本来自作品库');
  assert.ok(typeof r.author_corpus.cv === 'number', '应给出语料整体 CV');
  ok(`语料可读：${r.author_corpus.pieces} 篇（作品库 ${r.author_corpus.bySource.library}）`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\ncadence-agent-integration.test.mjs 全部通过 (${n} 项)`);
