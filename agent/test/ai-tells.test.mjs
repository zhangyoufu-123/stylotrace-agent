// AI 腔模式目录（25 类）验收：
//   1) 必须能区分"AI 腔段落"和"人写的段落"，不能两边都报一堆
//   2) 诊断要指到具体是哪一句、属于哪一类（用户看得懂，模型改得动）
//   3) 能生成"定点爆破"改写指令，且指令里只列本文真的出现的模式
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = await import(path.join(HERE, '..', 'src', 'ai-tells.js'));
const { audit } = await import(path.join(HERE, '..', 'src', 'redteam.js'));

let passed = 0;
const ok = (n) => {
  passed += 1;
  console.log(`✓ ${n}`);
};

const AI_TEXT =
  '在当今社会，手机已成为中学生生活中不可或缺的一部分。有人认为手机会影响学习，但其实，问题不在于手机本身，而在于我们如何使用它。它既是获取知识的窗口、也是沟通世界的桥梁、更是自我管理的试金石。值得注意的是，合理使用手机能够培养学生的自律能力，彰显了现代教育的智慧。因此，学会与手机共处，才是这个时代真正的必修课。';

const HUMAN_TEXT =
  '我们班去年把手机收了。头两周大家像戒糖，第三周开始有人偷偷带，藏在笔袋里。我其实也觉得没必要收——我查资料就是用手机，但我也承认，我查完资料会顺手刷十分钟视频。这事没那么容易一刀切。';

const rAI = T.tellScan(AI_TEXT);
const rHuman = T.tellScan(HUMAN_TEXT);

// 1) 区分度：AI 腔段落必须明显低于人写的段落
assert.ok(rAI.index <= 60, `AI 腔段落应低分（实际 ${rAI.index}）`);
assert.ok(rHuman.index >= 90, `人写段落应高分（实际 ${rHuman.index}）`);
assert.ok(rHuman.index - rAI.index >= 30, `区分度应 ≥30（实际 ${rHuman.index - rAI.index}）`);
ok(`区分度：AI 腔 ${rAI.index} vs 人写 ${rHuman.index}`);

// 2) 人写段落不该出现"严重"档误报
assert.equal(rHuman.strong, 0, `人写段落不该有严重档误报：${rHuman.list.join('、')}`);
ok('人写段落零严重档误报');

// 3) 命中的模式必须带出处（哪一句话）
for (const f of rAI.found) {
  assert.ok(f.id >= 1 && f.id <= 25, `节号必须落在 §1–§25（实际 §${f.id}）`);
  assert.ok(f.evidence.length > 0, `§${f.id} 必须给出原文出处`);
}
ok('每条命中都带节号与原文出处');

// 4) 人话诊断：说清是哪一类 + 怎么改
const rep = T.renderTellReport(AI_TEXT);
assert.ok(rep.lines.length > 0, '应给出诊断行');
assert.ok(/§\d+/.test(rep.lines[0]) && rep.lines[0].includes('：'), `诊断行格式不对：${rep.lines[0]}`);
assert.ok(T.renderTellReport(HUMAN_TEXT).lines.length === 0, '人写段落不该给诊断行');
ok('人话诊断：指出类别 + 怎么改');

// 5) 定点爆破指令只列本文真的出现的模式
const dir = T.deAiDirective(AI_TEXT);
assert.ok(dir.includes('必须逐条改掉'), '应生成改写指令');
assert.ok(dir.includes('§'), '指令里应带节号');
assert.equal(T.deAiDirective(HUMAN_TEXT), '', '人写段落不该生成改写指令');
ok('定点爆破指令只针对本文真的出现的问题');

// 6) 接进红队审计：报告里要能看到这一节，且不改变原有分数口径
const r = audit(AI_TEXT);
assert.ok(r.aiTells && typeof r.aiTells.index === 'number', 'audit 报告应含 aiTells');
assert.ok(r.aiTells.list.length > 0, 'aiTells 应列出命中的模式');
assert.ok(r.suggestions.some((s) => s.includes('结构性 AI 腔')), '应给出结构性 AI 腔建议');
const rNat = audit(HUMAN_TEXT);
assert.ok(!rNat.suggestions.some((s) => s.includes('结构性 AI 腔')), '人写段落不该报结构性 AI 腔');
ok('已接入红队审计，且不误报人写段落');

console.log(`\nai-tells.test.mjs 全部通过 (${passed} 项)`);
