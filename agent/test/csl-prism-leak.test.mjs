// 棱镜就地转换的"输出卫生"回归。
//
// 背景（真实 A/B 实验中抓到的）：模型偶尔不输出改写正文，而是把整段推理过程
// 吐出来（实测一次 13310 字，而原文只有 242 字），成品直接被污染，
// 用户拿到手的是一堆自我分析。这类输出必须被识别为坏尝试并重来，不能当候选稿。
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = await import(path.join(HERE, '..', 'src', 'csl', 'prism.js'));

const SRC =
  '在当今社会，中学生每天用AI写作业的比例越来越高。某机构2024年调查全国3200名中学生，58.6%每天用AI写作业。';

let passed = 0;
const ok = (n) => {
  passed += 1;
  console.log(`✓ ${n}`);
};

// 真实泄漏样本的开头
const LEAKED = `我们需要回答用户。需要作为风格层改写器。必须只改风格，不能改事实、数字、年份、百分比。

原文：
${SRC}

让我逐句分析……`;
assert.equal(P.looksLeaked(LEAKED, SRC), true, '推理泄漏必须被识别');
ok('识别推理泄漏');

// 正常改写必须放行（长度与原文相当）
assert.equal(
  P.looksLeaked('如今，中学生用 AI 写作业的越来越多。某机构 2024 年调查了全国 3200 名中学生，58.6% 每天用 AI 写作业。', SRC),
  false,
  '正常改写不能被误判',
);
ok('正常改写不误判');

// 长度失控也必须算坏输出
assert.equal(P.looksLeaked('啊'.repeat(SRC.length * 4), SRC), true, '长度失控必须判坏');
ok('长度失控拦截');

assert.equal(P.looksLeaked('', SRC), true, '空输出必须判坏');
ok('空输出拦截');

// 走一遍 restyleOnly：第一轮泄漏 → 第二轮严格版拿到好稿 → 仍然交付
const good = '如今，中学生用 AI 写作业的越来越多。某机构 2024 年调查了全国 3200 名中学生，58.6% 每天用 AI 写作业。';
let call = 0;
const fakeLlm = async () => {
  call += 1;
  return call === 1 ? LEAKED : good;
};
const r = await P.restyleOnly({ text: SRC, llm: fakeLlm, attempts: 2 });
assert.equal(r.ok, true, '泄漏后应重试并成功交付');
assert.equal(r.attempts, 2, '应走满两轮');
assert.equal(r.tries[0].verdict, 'leaked_reasoning', '第一轮应记为泄漏');
ok('泄漏后自动重试并交付');

// 两轮都泄漏 → 明确拒绝，且把泄漏内容放 rejected 而不是当成品
const alwaysLeak = async () => LEAKED;
const bad = await P.restyleOnly({ text: SRC, llm: alwaysLeak, attempts: 2 });
assert.equal(bad.ok, false, '两轮都泄漏必须拒绝交付');
assert.equal(bad.reason, 'leaked_reasoning', `拒绝原因应为泄漏（实际 ${bad.reason}）`);
ok('两轮都泄漏时明确拒绝');

console.log(`\ncsl-prism-leak.test.mjs 全部通过 (${passed} 项)`);
