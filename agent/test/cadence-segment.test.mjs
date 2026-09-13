// CADENCE · 分句层测试（规格 §11.1：这一层 bug 会污染整个模块，最值得写测试）
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = await import(path.join(HERE, '..', 'src', 'cadence', 'segment.js'));

let n = 0;
const ok = (m) => {
  n += 1;
  console.log(`  ✓ ${m}`);
};

// 1) 正常句读
assert.deepEqual(S.splitSentences('我来。你走。'), ['我来。', '你走。']);
ok('正常句读切分');

// 2) 数字小数点不是句号（规格 §4.3）
assert.deepEqual(S.splitSentences('增长 12.5%。'), ['增长 12.5%。']);
ok('小数点不误切（12.5%）');

// 3) 省略号算一个终结标点
assert.deepEqual(S.splitSentences('他说……我懂了。'), ['他说……', '我懂了。']);
ok('省略号 … 是一个终结标点');

// 4) 连续标点计一处
assert.deepEqual(S.splitSentences('真的吗？！他没说。'), ['真的吗？！', '他没说。']);
ok('连续标点计一处（？！）');

// 5) 书名号内的句号不切
const book = S.splitSentences('他读了《论语。学而》。然后走了。');
assert.equal(book.length, 2, `书名号内不应切分，实际 ${JSON.stringify(book)}`);
ok('书名号内的句号不切分');

// 6) 引号内不切
const quoted = S.splitSentences('他说“我先走。你等等”。然后离开了。');
assert.equal(quoted.length, 2, `引号内不应切分，实际 ${JSON.stringify(quoted)}`);
ok('引号内的句号不切分');

// 7) 中英混排：英文句点也要认
const mixed = S.splitSentences('Hello world. 你好世界。');
assert.equal(mixed.length, 2);
ok('中英混排都能切');

// 8) 短句也要算一个句读（规格 §4.2 第六条）
const short = S.splitSentences('是的。走。我明白。');
assert.equal(short.length, 3, '短句不能因为短就被丢掉，否则 CV 会被误读');
ok('短句同样计为一个句读');

// 9) 只计书写单位：标点不算字
assert.equal(S.countUnits('你好，世界。'), 4);
assert.equal(S.countUnits('12.5%'), 1, '数字串算一个书写单位');
assert.equal(S.countUnits('hello world'), 2, '英文按词计');
ok('计数口径：标点不计，数字串算 1，英文按词');

// 10) 全角字母数字转换，但**中文标点必须原样保留**
assert.equal(S.toHalfWidth('ＡＢＣ１２３'), 'ABC123');
assert.equal(S.toHalfWidth('你好，世界。'), '你好，世界。', '中文标点绝不能被转成 ASCII');
ok('全角字母数字转换，中文标点原样保留');

// 11) 小句切分
const clauses = S.splitClauses('他站着，没动，也没说话。');
assert.equal(clauses.length, 3);
ok('小句切分（逗号/顿号级）');

// 12) 换行也是句读边界
assert.equal(S.splitSentences('第一行\n第二行').length, 2);
ok('换行也是句读边界');

// 13) 空文本不炸
assert.deepEqual(S.splitSentences(''), []);
assert.deepEqual(S.splitSentences('   '), []);
ok('空文本安全返回');

// 14) 分句结果不会被 normalize 篡改标点
const para = '他说：“好，我知道。”然后走了。';
const segs = S.splitSentences(para);
assert.ok(segs.join('').includes('，'), '原文中文逗号必须原样保留');
assert.ok(segs.join('').includes('“'), '引号必须保留');
ok('归一化不改用户标点');

console.log(`\ncadence-segment.test.mjs 全部通过 (${n} 项)`);
