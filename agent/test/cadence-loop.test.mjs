// CADENCE · 气群 / 反模式 / 闭环 / 平仄 测试（规格 §11.3–11.5）
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const C = await import(path.join(HERE, '..', 'src', 'cadence', 'index.js'));
const M = await import(path.join(HERE, '..', 'src', 'cadence', 'meter.js'));
const S = await import(path.join(HERE, '..', 'src', 'cadence', 'ssml.js'));

let n = 0;
const ok = (m) => {
  n += 1;
  console.log(`  ✓ ${m}`);
};

// 一段典型的"均匀 AI 腔"：句句差不多长、标点单一、长句里塞多个气群
const AI_ISH =
  '在当今社会，手机已经成为中学生生活中不可或缺的一部分，它既是获取知识的工具也是沟通世界的桥梁。' +
  '我们必须要认识到，手机的使用需要理性的引导和规范的管理。首先我们要重视这个问题，其次我们要解决这个问题。' +
  '家长和学校应该共同协作，帮助学生建立良好的使用习惯。只有这样，学生才能在数字时代健康成长。' +
  '因此，合理使用手机对于中学生来说是非常重要的。相关研究表明，适度使用能够提升学习效率，过度使用则会带来负面影响。' +
  '学校应当制定明确的规章制度，引导学生正确使用。家长也应当以身作则，减少自身的手机依赖。' +
  '值得注意的是，沟通与陪伴同样是解决问题的关键所在。综上所述，只有各方共同努力，才能营造良好的成长环境。';

// ── 1) 短文本必须拒绝判定（规格 §6.3，写成断言） ─────────
{
  const r = C.analyze('很短。就两句。');
  assert.equal(r.verdict, 'insufficient', '句读 < 8 必须返回 insufficient');
  assert.deepEqual(r.antipatterns, [], '不足以判定时不得给出任何反模式结论');
  assert.ok(r.notes.some((x) => x.includes('不足以判定')), '必须写明为什么不下结论');
  ok('句读 < 8 → 明确拒绝判定，不给任何节奏结论');
}

// ── 2) 气群划分与边界错位 ───────────────────────────────
{
  const r = C.analyze(AI_ISH);
  assert.ok(r.breath_level.groups.length > r.sentence_level.n, '长句应被切成多个气群');
  assert.ok(r.misalignments.length > 0, '应检出"一句塞多个气群"的边界错位');
  const m0 = r.misalignments[0];
  assert.ok(m0.groups >= 2 && Number.isFinite(m0.breakAfter), '错位要给出具体断点位置');
  ok(`气群划分生效（${r.sentence_level.n} 句 → ${r.breath_level.groups.length} 气群，${r.misalignments.length} 处边界错位）`);
}

// ── 3) 反模式：构造样本必须命中，且理由是人话 ────────────
{
  const r = C.analyze(AI_ISH);
  const types = r.antipatterns.map((a) => a.type);
  assert.ok(types.includes('boundary_misalign'), '应命中边界错位');
  assert.ok(types.includes('punctuation_monotony'), '应命中标点单一化');
  for (const a of r.antipatterns) {
    assert.ok(a.evidence && a.hint, '每条反模式都要有证据与解释');
    assert.ok(!/AI|人工智能|机器/.test(a.hint), '不得输出"这是 AI 写的"这类判定');
  }
  ok(`反模式命中：${[...new Set(types)].join('、')}（每条都带证据）`);
}

// ── 4) 负样本：不能乱报 ─────────────────────────────────
{
  const good =
    '他站在门口。风很大——那种能把人吹得睁不开眼的大。' +
    '屋里的灯亮着，饭在锅里温着；他却没有推门。' +
    '为什么？因为推开门，就等于承认自己错了。' +
    '十年了。他在这道门槛前来回过无数次，每次都停在这里，然后转身。' +
    '这一次不一样。他抬起手，敲了三下。';
  const r = C.analyze(good);
  const types = r.antipatterns.map((a) => a.type);
  assert.ok(!types.includes('punctuation_monotony'), '标点丰富的段落不该被判标点单一');
  ok(`负样本不被误报（检出 ${types.length} 类：${types.join('、') || '无'}）`);
}

// ── 5) 建议：可解释、可锁定 ─────────────────────────────
{
  const r = C.analyze(AI_ISH);
  const all = C.suggest(r);
  assert.ok(all.length > 0, '应给出建议');
  assert.ok(all.some((s) => s.type === 'split'), '边界错位应产出"拆分"建议');
  const split = all.find((s) => s.type === 'split');
  assert.ok(/气群/.test(split.reason), `拆分建议的理由必须说"这句塞了两个气群"，实际：${split.reason}`);
  assert.ok(!/太长|太短/.test(split.reason), '理由不能只说"太长"');

  const locked = C.suggest(r, { lockedSpans: [[1, 1]] });
  assert.ok(
    locked.every((s) => !(s.span.start === 1 && s.span.end === 1)),
    '被锁定的 span 不得再出现建议',
  );
  ok('建议可解释（说"塞了两个气群"而非"太长"）且可锁定');
}

// ── 6) 闭环：应用 → 重算 → 实际效果 vs 预期（规格 §11.5）──
{
  const r = C.analyze(AI_ISH);
  const sug = C.suggest(r);
  const out = C.apply(AI_ISH, sug);
  assert.ok(out.applied.length > 0, '至少应应用成功一条');
  assert.notEqual(out.text, AI_ISH, '文本必须真的变了');
  assert.ok(out.text.includes('，'), '应用后必须保留中文标点（不能被转成 ASCII）');
  assert.ok(
    out.report.breath_level.groups.length >= r.breath_level.groups.length,
    '拆分之后气群数不应减少',
  );
  assert.ok(
    out.report.misalignments.length <= r.misalignments.length,
    '应用拆分后边界错位应减少',
  );
  for (const e of out.effects) {
    assert.ok(e.expected && e.actual, '实际效果必须与预期并列记录（不许只报好听的）');
  }
  ok(
    `闭环成立：应用 ${out.applied.length} 条 → CV ${r.sentence_level.cv}→${out.report.sentence_level.cv}，` +
      `边界错位 ${r.misalignments.length}→${out.report.misalignments.length}`,
  );
}

// ── 7) 事实保护：拆分不得改动任何事实字符 ───────────────
{
  const t =
    '某机构 2024 年调查全国 3200 名中学生，58.6% 每天用 AI 写作业，其中 1180 余人几乎每科依赖。' +
    '这一现象值得关注。数据背后是习惯的改变。家庭教育同样面临挑战。学校的角色也在发生变化。' +
    '我们需要更细致的观察。技术从来不是中立的。关键在于使用它的人。';
  const r = C.analyze(t);
  const out = C.apply(t, C.suggest(r));
  for (const fact of ['2024', '3200', '58.6%', '1180']) {
    assert.ok(out.text.includes(fact), `事实「${fact}」必须一字不动`);
  }
  ok('拆分只动断句，数字/年份/百分比一字不动');
}

// ── 8) 平仄：缺表时必须老实标 unknown（规格 §7 红线）────
{
  const poem = '两个黄鹂鸣翠柳\n一行白鹭上青天\n窗含西岭千秋雪\n门泊东吴万里船';
  const mr = M.metricalReport(poem, { standard: 'pingshui' });
  assert.equal(mr.poem_type, 'qijue', `七绝应被识别，实际 ${mr.poem_type}`);
  assert.equal(mr.structure_score, 1, '结构层不依赖字音表，应给真实结果');
  assert.equal(mr.tonal_score, null, '缺字音表时绝不能编一个平仄分数');
  assert.ok(mr.unverified_chars.length > 0, '未验证的字必须列出来');
  assert.ok(mr.notes.some((x) => x.includes('未附带')), '必须说明为什么不做平仄判定');
  ok('平仄：结构层真实判定，缺表时老实 unknown（不编分数）');
}

// ── 9) 平仄规则引擎：用内存夹具验证（夹具不是韵书，不会混进产物）──
{
  const table = { standard: 'xinyun', chars: { 风: '平', 月: '仄', 重: ['平', '仄'] }, source: 'test-fixture', size: 3 };
  assert.deepEqual(M.toneOf('风', table), { char: '风', tone: '平', source: 'table' });
  const duo = M.toneOf('重', table);
  assert.equal(duo.tone, 'unknown');
  assert.ok(Array.isArray(duo.candidates), '多音字要列出候选');
  assert.equal(M.toneOf('无', table).tone, 'unknown');
  ok('规则引擎：多音字与未收录字一律 unknown，绝不猜');
}

// ── 10) 孤平 / 三平调 ───────────────────────────────────
{
  assert.equal(M.detectGuping(['仄', '仄', '仄', '平', '平'])?.type, 'guping');
  assert.equal(M.detectGuping(['平', '平', '仄', '仄', '平']), null);
  assert.equal(M.detectGuping(['unknown', '仄', '仄', '平', '平']), null, '有未确定的字时不得判定孤平');
  assert.equal(M.detectSanping(['仄', '仄', '平', '平', '平'])?.type, 'sanping');
  assert.equal(M.detectSanping(['仄', '仄', '仄', '平', '平']), null);
  ok('孤平 / 三平调判定正确，且有 unknown 时不下结论');
}

// ── 11) 未收录体式不猜 ──────────────────────────────────
{
  assert.equal(M.detectPoemType(['春风', '又绿', '江南']).poem_type, 'unknown');
  assert.equal(M.detectPoemType(['五言五言五', '五言五言六']).poem_type, 'unknown');
  ok('未收录体式返回 unknown，不做猜测性判定');
}

// ── 12) SSML 导出与降级 ────────────────────────────────
{
  const r = C.analyze(AI_ISH);
  const out = S.toSsml(r);
  assert.ok(out.ssml.startsWith('<speak'), 'SSML 必须是合法根元素');
  assert.ok(out.ssml.includes('<break'), '气群之间应有停顿标记');
  assert.equal(out.plan.length, r.breath_level.groups.length, '计划要与气群一一对应');
  const degraded = S.toSsml(r, { engine: 'minimal' });
  assert.ok(degraded.degraded.length > 0, '降级必须被标注出来');
  assert.ok(!degraded.ssml.includes('<break'), '不支持的引擎不该出现该标签');
  ok('SSML 导出正常，引擎不支持时降级并如实标注 degraded');
}

console.log(`\ncadence-loop.test.mjs 全部通过 (${n} 项)`);
