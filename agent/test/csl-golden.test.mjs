// Phase 3A — Golden Cognitive Test：小猪吃玉米。
// 验收（Module → State → Behavior）：结构化认知变化（entities/relations/hypotheses/counterexamples/schema/confidence），
// 不是"一句流畅解释"；Memory→ChangedReasoning、Reasoning→ChangedHypothesis、Schema→NovelTask 均有状态证据。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));
const hrmr = await import(path.join(HERE, '..', 'src', 'csl', 'hrmr.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-golden-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
const mockLlm = async () => '（mock）哺乳动物吃植物粮，schema 候选。';

// 预置记忆：4 条同构 episode → mammal—吃→plantfood schema
for (const [t, g] of [['小猪吃玉米', 's1'], ['小猪吃粮食', 's2'], ['牛吃玉米', 's3'], ['羊吃粮食', 's4']]) {
  hrmr.addEpisode(w, { text: t, outcome: 1, goal: g });
}

// 1) Golden 管线：Observation→Relation→Memory→Compare→Abstract→Counterexample→Schema
const v0 = st.stateVersion(w, { sessionId: 'golden' });
const g = await rt.goldenCognition(w, { input: '小猪吃玉米。', llm: mockLlm });

// 结构化输出（不得只是一句话）
assert.ok(g.entities.length >= 2, `entities: ${JSON.stringify(g.entities)}`);
assert.ok(g.relations.length >= 1, 'relations 应存在');
assert.ok(g.hypotheses.length >= 1, 'hypotheses 应存在');
assert.ok(g.comparison && 'relationalDifference' in g.comparison, '结构化比较应存在');
assert.ok(Array.isArray(g.counterexamples), 'counterexamples 应为数组');
assert.ok(g.schema && g.schema.relationText.includes('mammal'), `schema 应泛化到类型层: ${g.schema?.relationText}`);
assert.ok(g.confidence > 0.5, `confidence 应可读: ${g.confidence}`);

// 2) 状态变化：版本前进 + workingMemory 提交 canonical
assert.equal(g.stateVersionAfter, v0 + 1, '状态版本应前进');
const csGolden = st.readCanonicalState(w, { sessionId: 'golden' });
assert.ok(csGolden.workingMemory.relations?.length >= 1, 'relations 应入 canonical workingMemory');
assert.ok(csGolden.workingMemory.schema?.relationText.includes('mammal'), 'schema 应入 canonical workingMemory');

// 3) Module → State 证据：memory 后 memoryRefs 出现；compare 后假设增加（Reasoning → ChangedHypothesis）
const memStep = g.trace.find((t) => t.action === 'memory');
const cmpStep = g.trace.find((t) => t.action === 'compare');
assert.ok(memStep.memoryRefsAfter >= 1, `memory 应写入 memoryRefs: ${memStep?.memoryRefsAfter}`);
assert.ok(cmpStep.hypothesesAfter > 0, `compare 应产生精化假设: ${cmpStep?.hypothesesAfter}`);
assert.ok(g.trace.map((t) => t.action).join('→') === 'memory→compare→abstract→counterexample', `golden 链: ${g.trace.map((t) => t.action)}`);

// 4) Memory → ChangedReasoning：泛化（abstract）看到 schema 候选（记忆约束泛化）
assert.ok(csGolden.workingMemory.schema.support >= 5, `schema support 含新经历: ${csGolden.workingMemory.schema?.support}`);

// 5) Schema → NovelTask：未见过的"牛吃粮食"能命中既有 schema（归纳迁移）
const novel = await rt.goldenCognition(w, { input: '牛吃粮食。', llm: mockLlm });
assert.ok(novel.schema && novel.schema.relationText.includes('mammal'), `novel 任务应命中 schema: ${novel.schema?.relationText}`);
assert.ok(novel.entities.some((e) => e.name === '牛'), 'novel 实体应解析');

// 6) Counterexample → Refinement：反例挑战 schema → 置信下降（schema 被降级=精化正确工作）
const beforeConf = hrmr.retrieve(w, '小猪').find((i) => i.kind === 'schema').confidence;
for (let i = 0; i < 4; i++) {
  hrmr.challengeSchema(w, '小猪吃玉米', `反例${i}：狗是哺乳动物但不吃植物粮`);
}
const afterSchema = hrmr.retrieve(w, '小猪').find((i) => i.kind === 'schema');
const afterConf = afterSchema?.confidence ?? 0;
assert.ok(afterConf < beforeConf, `反例应降置信: ${beforeConf} -> ${afterConf}`);

// 7) 事件流：cognition.golden 事件落账（可审计）
const evt = fs.readFileSync(path.join(w, 'protocol', 'csl-canonical-events.jsonl'), 'utf8');
assert.ok(evt.includes('cognition.golden'), 'golden 认知事件应入统一事件流');

console.log('PASS csl-golden（小猪吃玉米：entities/relations/hypotheses/comparison/counterexamples/schema/confidence + Memory→Reasoning→Hypothesis→Schema→NovelTask）');
