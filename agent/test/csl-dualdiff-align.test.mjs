// 双色 diff 的句子对齐回归（来自真实 A/B 实验的失败样本）。
//
// 背景：原来的 dualDiff 按"第 i 句 vs 第 i 句"配对。语言模型改写时几乎一定
// 会拆句/并句，一旦句数变了，从拆句处开始整体错位，于是把两句毫不相干的话
// 拿来比极性 —— 实测真实中文改写 3/3 全部被误判成"改了事实"而遭拒绝。
//
// 这个测试锁住修复后的行为：拆句/并句必须判成 style_only，
// 同时"改数字 / 翻否定 / 升模态 / 丢事实"必须继续被判成 fact。
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const D = await import(path.join(HERE, '..', 'src', 'csl', 'dual-diff.js'));

// ── 真实样本 1：模型把长句拆成三句，并挪动了"不是手机本身可怕" ──
const cn1Before =
  '在当今社会，手机既是便捷的信息工具，也是潜在的校园干扰。中学生该不该带手机进校园，不能一概而论，却必须明确边界。不是手机本身可怕，而是失度使用可能分散注意力、诱发攀比、冲击课堂。值得注意的是，中学阶段正是自律养成、专注培养、价值观塑造的关键期。因此，与其简单禁绝，不如家校协同、疏堵结合：教学时段统一保管，紧急联系提供替代渠道，违规使用及时引导。综上所述，手机进校园应以规则为先、以成长为本，让技术服务于教育，而非让教育迁就技术。';
const cn1After =
  '如今，手机是便捷的信息工具，也是校园里潜在的干扰。中学生该不该带手机进校园？不能一概而论。可边界，必须明确。不是手机本身可怕；失度使用，可能分散注意力，诱发攀比，冲击课堂。中学阶段，正是关键期：自律养成，专注培养，价值观塑造。所以，与其简单禁绝，不如家校协同、疏堵结合——教学时段，统一保管；紧急联系，提供替代渠道；违规使用，及时引导。说到底，手机进校园，应以规则为先，以成长为本。让技术服务于教育，而非让教育迁就技术。';

const g1 = D.styleOnlyGuard(cn1Before, cn1After);
assert.equal(
  g1.ok,
  true,
  `拆句改写必须放行，不能因为句子错位就报事实改动：${JSON.stringify(g1.factChanges.slice(0, 3))}`,
);
assert.equal(g1.stats.factChanges, 0);

// ── 真实样本 2：模型把一句话拆成两句、把最后一个顿号改成逗号 ──
const cn3Before =
  '在当今社会，普通人的一生常被宏大叙事遮蔽，仿佛只有非凡者才配进入历史。然而，记录的意义不是筛选传奇，而是保存真实；不是制造崇拜，而是安放记忆。值得注意的是，一顿晚饭、一次通勤、一场争吵、一封短信，看似琐碎，却共同构成一个人最坚实的存在证据。';
const cn3After =
  '在当今社会，普通人的一生，常被宏大叙事遮住。仿佛只有非凡者，才配进历史。记录的意义不是筛选传奇。是保存真实。不是制造崇拜，是安放记忆。一顿晚饭，一次通勤，一场争吵，一封短信。它们看似琐碎，却共同构成一个人最坚实的存在证据。';
assert.equal(D.styleOnlyGuard(cn3Before, cn3After).ok, true, '拆句 + 换标点必须放行');

// ── 拆句的同时数字必须原样保留 ──
const numBefore = '数据显示 2024 年有 22% 的用户放弃了写作。第二步很清楚。';
const numAfter = '数据显示，2024 年有 22% 的用户放弃了写作。第二步，很清楚。';
assert.equal(D.styleOnlyGuard(numBefore, numAfter).ok, true, '拆句但数字不变 → 放行');

// ── 拆句的同时数字被改了 → 必须拦住 ──
const numBad = '数据显示 2024 年有 22% 的用户放弃了写作。第二步很清楚。';
const numBadAfter = '数据显示，2024 年有 37% 的用户放弃了写作。第二步，很清楚。';
const gBad = D.styleOnlyGuard(numBad, numBadAfter);
assert.equal(gBad.ok, false, '拆句时改数字必须被拒');
assert.ok(gBad.factChanges.some((f) => f.evidence.some((e) => e.startsWith('number_changed'))));

// ── 整段删除一个带数字的主张 → 丢掉事实 ──
const dropBefore = '受访者中 68% 反对延长课时。其余人没有表态。';
const dropAfter = '其余人没有表态。';
const gDrop = D.styleOnlyGuard(dropBefore, dropAfter);
assert.equal(gDrop.ok, false, '整句删掉带数字的主张必须被拒');
assert.ok(gDrop.factChanges.some((f) => f.evidence.some((e) => e.startsWith('dropped_fact'))));

// ── 否定/模态的安全网不能被对齐修复削弱 ──
assert.equal(D.styleOnlyGuard('门槛是阻隔。', '门槛不是阻隔。').ok, false, '翻否定必须被拒');
assert.equal(D.styleOnlyGuard('这可能导致问题。', '这必然导致问题。').ok, false, '升模态必须被拒');
assert.equal(D.styleOnlyGuard('这必然导致问题。', '这可能导致问题。').ok, false, '降模态必须被拒');
assert.equal(D.dualDiff('一模一样。', '一模一样。').verdict, 'identical', '完全相同');

// ── 新增一句带新数字的话 → 凭空加事实 ──
const addBefore = '门槛上他等了很久。';
const addAfter = '门槛上他等了很久。调查说 87% 的人会转身离开。';
const gAdd = D.styleOnlyGuard(addBefore, addAfter);
assert.equal(gAdd.ok, false, '凭空加进新数字必须被拒');
assert.ok(gAdd.factChanges.some((f) => f.evidence.some((e) => e.startsWith('added_fact'))));

// ── 纯加一句不带事实的话（碎句/补语气）→ 仍算风格层 ──
assert.equal(
  D.styleOnlyGuard('门槛上他等了很久。', '门槛上他等了很久。就那么站着。').ok,
  true,
  '补一句不带事实的碎句 → 放行',
);

console.log('✓ csl-dualdiff-align.test.mjs 全部通过（拆句/并句不再误判，改事实仍被拦）');
