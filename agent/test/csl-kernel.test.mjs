// Phase 1 — Canonical Cognitive State Kernel 验收（C1–C13）。
// 单一事实源：Fast / Deep / Director / Writer 都经 Canonical Kernel 读写；版本单调；快照可恢复；会话隔离。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));
const cn = await import(path.join(HERE, '..', 'src', 'csl', 'canonical.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-kernel-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
const mockLlm = async () => '（mock）好。';

// C1 — Canonical State creation（schema 分区齐全）
const cs0 = st.createCanonicalState('s1');
for (const k of ['session', 'interaction', 'motivation', 'goal', 'task', 'workingMemory', 'beliefs', 'hypotheses', 'evidence', 'uncertainty', 'memoryRefs', 'reasoning', 'humanModel', 'jointState', 'styleState', 'artifactState', 'policy', 'resources']) {
  assert.ok(k in cs0, `schema 应含 ${k}`);
}

// C2 — patch：纯合并、不持久化、不升版本
const p1 = st.patch(cs0, { goal: '写一篇关于门槛的文章', workingMemory: { candidates: ['a'] } });
assert.equal(p1.goal, '写一篇关于门槛的文章');
assert.equal(p1.sVersion, 0, 'patch 不升版本');
assert.deepEqual(p1.workingMemory, { candidates: ['a'] });

// C3/C4 — commit：持久化 + 版本单调 + 统一事件
const c1 = st.commit(w, { delta: { coreIdea: '故乡的门槛被磨矮了', traceId: 'tr-1' }, event: { eventType: 'core_idea.set', payload: { from: 'user' } }, sessionId: 'default', actor: 'user' });
assert.equal(c1.version, 1);
const c2 = st.commit(w, { delta: { addHypothesis: 'H1' }, event: { eventType: 'hypothesis.add' } });
assert.equal(c2.version, 2, '版本必须单调');
const evtFile = fs.readFileSync(path.join(w, 'protocol', 'csl-canonical-events.jsonl'), 'utf8');
const evt = JSON.parse(evtFile.trim().split('\n')[0]);
assert.ok(evt.eventId && evt.traceId === 'tr-1' && evt.stateVersionBefore === 0 && evt.stateVersionAfter === 1, '统一事件模型');

// C5/C6 — snapshot / restore：快照 → 变更 → 恢复 → 等价
st.snapshot(w); // v2
st.commit(w, { delta: { addHypothesis: 'H2（污染）' }, event: { eventType: 'hypothesis.add' } });
assert.equal(st.stateVersion(w), 3);
const restored = st.restore(w, 2);
assert.equal(restored.version, 2, '恢复后版本回 2');
assert.deepEqual(st.readCanonicalState(w).hypotheses, ['H1'], '恢复后假设应等于快照');

// C7 — compare：Goal/Hypothesis/Evidence/Decision/Style/Artifact 变化可答
const vA = st.readState(w);
st.commit(w, { delta: { coreIdea: '门槛与新想法', addEvidence: 'E1', addDecision: 'D1', styleState: { writeDims: { x: 1 } }, artifactState: { note: 'draft-v1' } }, event: { eventType: 'state.test' } });
const vB = st.readState(w);
const cmp = st.compare(vA, vB);
assert.equal(cmp.goalChanged, true);
assert.equal(cmp.evidenceChanged, true);
assert.equal(cmp.decisionChanged, true);
assert.equal(cmp.styleChanged, true);
assert.equal(cmp.artifactChanged, true);
assert.ok(Array.isArray(cmp.version) && cmp.version[1] > cmp.version[0]);

// C8 — 会话隔离：S1/S2 独立文件，互不污染
const s1 = st.commit(w, { delta: { coreIdea: '会话一的核心' }, event: { eventType: 'core_idea.set' }, sessionId: 'S1' });
const s2 = st.commit(w, { delta: { coreIdea: '会话二的核心' }, event: { eventType: 'core_idea.set' }, sessionId: 'S2' });
assert.equal(st.readCanonicalState(w, { sessionId: 'S1' }).coreIdea, '会话一的核心');
assert.equal(st.readCanonicalState(w, { sessionId: 'S2' }).coreIdea, '会话二的核心');
assert.ok(fs.existsSync(path.join(w, 'protocol', 'csl-state-S1.json')));
assert.ok(fs.existsSync(path.join(w, 'protocol', 'csl-state-S2.json')));
assert.ok(s1.version >= 1 && s2.version >= 1);

// C9 — Fast Interaction → Canonical State（interaction 分区经 Adapter 可见）
const w9 = ws.ensureWorkspace(path.join(tmp, 'w9'), { create: true });
const askR = await rt.runTurn(w9, { input: '我觉得 AI 写作越来越同质化', llm: mockLlm });
assert.equal(askR.kind, 'ask');
const c9 = st.readCanonicalState(w9);
assert.ok(c9.interaction && Object.keys(c9.interaction).length > 0, 'Fast 交互应写入 canonical interaction 分区');

// C10 — CSLA Runtime → Canonical State（深循环产出假设入内核）
rt.acceptAnswer(w9, null, '问题在思想：AI 太快开始写');
const deepR = await rt.runTurn(w9, { input: '我觉得 AI 写作越来越同质化', llm: mockLlm });
assert.equal(deepR.kind, 'deep');
const c10 = st.readCanonicalState(w9);
assert.ok(c10.hypotheses.length >= 1, '深循环假设应入 canonical');
assert.ok(c10.coreIdea.includes('思想'), 'coreIdea 镜像应可见');

// C11 — Director → Canonical State（syncCoreIdea 产品→内核 + 产品视图镜像）
const w11 = ws.ensureWorkspace(path.join(tmp, 'w11'), { create: true });
const ps11 = ws.readState(w11);
ps11.confirmed = { topic: 'AI 教育公平' };
ws.writeState(w11, ps11);
cn.syncCoreIdea(w11);
assert.equal(st.readCanonicalState(w11).coreIdea, 'AI 教育公平');
assert.equal(ws.readState(w11).cslVersion, st.stateVersion(w11), '产品视图应镜像 cslVersion');

// C12 — Writer → Canonical State（canWrite + 分区读路径）
const w12 = ws.ensureWorkspace(path.join(tmp, 'w12'), { create: true });
const g0 = cn.canWrite(w12);
// 两档门（2026-09-12 升级）：硬阻断只有 coreIdea 缺失时触发，且返回 warn 字段（有主题无主张时为 missing_core_claim）
assert.equal(g0.blocked, true, '无核心应 BLOCK');
assert.equal(g0.reason, 'missing_core_idea');
assert.equal(g0.nextAction, 'askHuman');
assert.equal(g0.warn, '');
cn.commitDelta(w12, { delta: { coreIdea: '门槛的沉默与倔强' }, eventType: 'core_idea.set' });
const g1 = cn.canWrite(w12);
assert.equal(g1.blocked, false, '有核心应放行');
const c12 = st.readCanonicalState(w12);
assert.ok('styleState' in c12 && 'artifactState' in c12 && 'policy' in c12 && 'jointState' in c12, 'Writer 读路径分区齐全');
assert.equal(typeof c12.artifactState.hasDraft, 'boolean');

// C13 — Legacy Adapter 兼容：旧 readState/transition 继续可用（同一事实源）
const legacy = st.readState(w);
assert.ok(legacy.coreIdea && legacy.sVersion >= 1, 'legacy readState 应读到同一内核');
const legacyTx = st.transition(legacy, { event_type: 'legacy.test' }, { addHypothesis: 'legacy-h' });
assert.ok(legacyTx.nextState.sVersion > legacy.sVersion, 'legacy transition 版本仍单调');

console.log('PASS csl-kernel（C1 schema / C2 patch / C3 commit / C4 单调 / C5 snapshot / C6 restore / C7 compare / C8 会话隔离 / C9 Fast / C10 Runtime / C11 Director / C12 Writer / C13 Legacy 兼容）');
