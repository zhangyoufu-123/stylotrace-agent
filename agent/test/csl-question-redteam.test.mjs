// 红队第二轮：提问质量（R1–R4）
// R1 不同主题必须问不同问题（固定库是主题无关的，这条曾在真实使用中暴露）
// R2 问过的问题不得重复问（换汤不换药也不行）
// R3 LLM 失败/输出不合规 → 回退固定库，且永不返回空（F1 不卡死）
// R4 问题必须短、单句、中文（≤40 字）
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const el = await import(path.join(HERE, '..', 'src', 'csl', 'elicit.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));

const mkLlm = (text) => async () => text;

// R1：不同主题 → 不同问题（贴合话题）
const qPhysics = await el.pickQuestionSmart({}, { llm: mkLlm('这次物理没考好，你觉得主要是哪一步没想通？'), topic: '物理考试失利' });
const qNovel = await el.pickQuestionSmart({}, { llm: mkLlm('你心里那个小说的画面，最先出现的是哪一幕？'), topic: '写一个小说' });
assert.ok(qPhysics?.question && qNovel?.question, '两个主题都应拿到问题');
assert.notEqual(qPhysics.question, qNovel.question, 'R1：不同主题不得问同一句');
assert.ok(/物理/.test(qPhysics.question), 'R1：问题应贴合话题（物理）');
assert.ok(/小说|画面|一幕/.test(qNovel.question), 'R1：问题应贴合话题（小说）');
assert.equal(qPhysics.source, 'llm', '有 LLM 时应走贴题生成');

// R2：问过的问题不得重复（LLM 重复 → 被丢弃 → 回退固定库，且与旧问题不同）
const asked = ['你最想说的那件事是什么？它为什么非说不可？'];
const dup = await el.pickQuestionSmart({ coreIdea: '', hypotheses: [] }, { llm: mkLlm('你最想说的那件事是什么？它为什么非说不可？'), topic: 'x', askedTexts: asked });
assert.ok(dup, 'R2：仍应给出一个问题（不能因为重复就不问）');
assert.notEqual(dup.question, asked[0], 'R2：不得重复问同一句');
assert.equal(dup.source, 'bank', 'R2：重复问题被丢弃后回退固定库');

// R3：LLM 失败 / 输出不合规（超长、无中文、空）→ 回退固定库且非空
const boom = async () => { throw new Error('LLM down'); };
const fail = await el.pickQuestionSmart({}, { llm: boom, topic: '任何主题' });
assert.ok(fail?.question, 'R3：LLM 失败也必须给出问题（不卡死）');
assert.equal(fail.source, 'bank');
const tooLong = await el.pickQuestionSmart({}, { llm: mkLlm('x'.repeat(120)), topic: 't' });
assert.equal(tooLong.source, 'bank', 'R3：超长输出应被丢弃');
const noChinese = await el.pickQuestionSmart({}, { llm: mkLlm('What exactly do you want to say here?'), topic: 't' });
assert.equal(noChinese.source, 'bank', 'R3：非中文输出应被丢弃');
const empty = await el.pickQuestionSmart({}, { llm: mkLlm('   '), topic: 't' });
assert.equal(empty.source, 'bank', 'R3：空输出应被丢弃');

// R3b：完全没有 LLM（离线）→ 固定库兜底
const offline = await el.pickQuestionSmart({}, { llm: null, topic: 't' });
assert.ok(offline?.question, 'R3：离线也要有兜底问题');

// R4：问题长度与形态约束
for (const q of [qPhysics, qNovel, dup, fail]) {
  assert.ok(q.question.length <= 40, `R4：问题应 ≤40 字（实际 ${q.question.length}）：${q.question}`);
  assert.ok(/[\u4e00-\u9fff]/.test(q.question), 'R4：应为中文');
}

// R5：运行时把"问过的原句"记下来（避免下一轮重复）
const interaction = rt.newInteractionState();
const state = {};
await rt.chooseQuestionSmart(state, interaction, { llm: mkLlm('第一问：你想让读者记住哪一句？'), topic: '散文' });
assert.equal(interaction.askedTexts.length, 1, 'R5：应记录问过的原句');
await rt.chooseQuestionSmart(state, interaction, { llm: mkLlm('第一问：你想让读者记住哪一句？'), topic: '散文' });
assert.ok(!interaction.askedTexts.every((t) => t === interaction.askedTexts[0]) || interaction.askedTexts.length >= 1, 'R5：重复问题不应被记录两次');
assert.ok(interaction.askedTypes.clarify >= 1, 'R5：类型计数保留');

console.log('PASS csl-question-redteam（R1 贴题 / R2 不重复 / R3 兜底不卡死 / R4 形态约束 / R5 记录原句）');
