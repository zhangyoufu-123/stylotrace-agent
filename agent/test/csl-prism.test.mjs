// 棱镜三视图验收：事实层/风格层可分离；"只改说法"放行、改事实被拒（含重试后仍失败则拒绝）。
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = await import(path.join(HERE, '..', 'src', 'csl', 'prism.js'));

const SRC = '数据显示，2024 年有 22% 的用户放弃了写作。这可能与 AI 的普及有关，但也反映了表达焦虑。';

// 1) 事实层视图：数字/年份/模态强度必须抓出来
const p = P.analyzePrism(null, SRC);
assert.ok(p.fact.numbers.includes('2024 年') && p.fact.numbers.includes('22%'), `数字应被识别: ${JSON.stringify(p.fact.numbers)}`);
assert.equal(p.fact.modalStrength, 'weak', '“可能”应是弱模态');
assert.ok(p.fact.claims.length >= 1, '应提取出显式主张句');

// 2) 风格层视图：句数/平均句长/节奏可读
assert.equal(p.style.sentenceCount, 2);
assert.ok(p.style.avgSentenceLen > 0, '平均句长可算');
assert.ok(['flat', 'even', 'wavy'].includes(p.style.rhythm), `节奏标签: ${p.style.rhythm}`);

// 3) 强模态（必然/一定）应被标为 strong
const strong = P.analyzePrism(null, '这必然导致问题，也一定会被记录。');
assert.equal(strong.fact.modalStrength, 'strong');

// 4) 只改说法 → 放行（事实层零改动）
const styleMock = async () => '数据显示：2024 年有 22% 的用户放弃了写作——这或许与 AI 的普及有关，同时也反映了表达焦虑。';
const okRun = await P.restyleOnly({ text: SRC, llm: styleMock, direction: '更克制' });
assert.equal(okRun.ok, true, `只改说法应放行: ${okRun.reason || ''}`);
assert.equal(okRun.guard.ok, true);
assert.equal(okRun.guard.factChanges.length, 0, '事实层必须零改动');

// 5) 篡改数字 → 必须拒绝（两次尝试后仍失败 → 不给结果）
const tamperMock = async () => '数据显示，2024 年有 37% 的用户放弃了写作。这可能与 AI 的普及有关。';
const badRun = await P.restyleOnly({ text: SRC, llm: tamperMock });
assert.equal(badRun.ok, false, '改数字必须被拒');
assert.equal(badRun.reason, 'fact_layer_changed');
assert.equal(badRun.attempts, 2, '应重试后再拒绝');
assert.ok(badRun.guard.factChanges.length >= 1, '应给出具体哪一处被改');

// 6) 把"可能"改成"必然" → 同样必须拒绝（立场强度不能偷偷升级）
const modalMock = async () => '数据显示，2024 年有 22% 的用户放弃了写作。这必然与 AI 的普及有关。';
const modalRun = await P.restyleOnly({ text: SRC, llm: modalMock });
assert.equal(modalRun.ok, false, '可能→必然必须被拒');

// 7) 无 LLM / 空文本 → 明确失败，不静默通过
assert.equal((await P.restyleOnly({ text: SRC, llm: null })).reason, 'no_llm');
assert.equal((await P.restyleOnly({ text: '   ', llm: styleMock })).reason, 'empty_text');

// 8) 冻结句进入三视图（可被 UI 标注）
const dc = await import(path.join(HERE, '..', 'src', 'csl', 'decision.js'));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const fs = await import('node:fs');
const os = await import('node:os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-prism-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
dc.addDecision(w, { object: '门槛', comparisonSet: '乡愁散文', spanText: '门槛不是阻隔，是记忆的承重' });
const withFrozen = P.analyzePrism(w, '院子里的门槛矮了。门槛不是阻隔，是记忆的承重。');
assert.equal(withFrozen.frozenSpans.length, 1, '冻结句应被三视图标出');

console.log('PASS csl-prism（三视图分离 + 只改说法放行 + 改事实/升强度被拒 + 冻结标注）');
