// Lineage（版本谱系）failure-case 测试。
// F1 没有记录时打标返回空串不抛异常；F2 历史文件损坏跳过坏行；
// F3 sessionId 含路径字符不越出工作区；F4 拿不到模型信息记 unversioned，不猜。
// 核心验收：H0 与 H1 的混合运行必须能正确区分与归因。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const L = await import(path.join(HERE, '..', 'src', 'csl', 'lineage.js'));
const h = await import(path.join(HERE, '..', 'src', 'csl', 'harness.js'));
const ev = await import(path.join(HERE, '..', 'src', 'csl', 'events.js'));
const ad = await import(path.join(HERE, '..', 'src', 'csl', 'adapter.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-lineage-'));
const mk = (n) => ws.ensureWorkspace(path.join(tmp, n), { create: true });

// ── F1 没有记录时打标不崩 ──
const w0 = mk('empty');
assert.equal(L.lineageTag(w0, 's'), '', '没有 lineage 时返回空串');
assert.equal(L.currentLineage(w0, 's'), null);
assert.equal(L.renderLineage(null).includes('没有 lineage'), true);
assert.equal(L.readHistory(w0).length, 0);

// ── 七个维度齐全 ──
const w1 = mk('dims');
const m1 = L.startLineage(w1, { modelRef: 'openai:test-model', sessionId: 'S1', channel: 'cli' });
for (const k of L.DIMENSIONS) {
  assert.ok(m1[k], `维度 ${k} 不能为空`);
}
assert.equal(m1.modelRef, 'openai:test-model');
assert.equal(m1.harnessVersion, 'H0', '没发过版本就是基线 H0');
assert.equal(m1.stateSchemaVersion, 'state-schema@1', '状态 schema 版本独立管理');
// 策略版本是"正在运行的那个文件的哈希"，不是编出来的语义版本
assert.ok(/^actions@[0-9a-f]{12}$/.test(m1.controllerPolicyVersion), `策略版本应是内容哈希：${m1.controllerPolicyVersion}`);
assert.ok(/^rag@[0-9a-f]{12}$/.test(m1.retrievalPolicyVersion));
assert.ok(/^write@[0-9a-f]{12}$/.test(m1.writerPolicyVersion));
// 新建工作区自带画像模板，所以这里是一个真实哈希；"完全没有画像文件"的情况下面单独测
assert.ok(/^author@[0-9a-f]{12}$/.test(m1.authorModelVersion), `作者画像版本应是内容哈希：${m1.authorModelVersion}`);
assert.ok(L.renderLineage(m1).includes('controllerPolicyVersion'));

// ── F4 作者画像：一个文件都没有 → unversioned，不编 ──
const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-bare-'));
assert.equal(L.componentVersions(bare).authorModelVersion, 'unversioned', '没有画像文件时必须记 unversioned');

// ── F4 拿不到模型信息不猜 ──
const m4 = L.buildLineage(w1, { sessionId: 'S1' });
assert.equal(m4.modelRef, 'unversioned');
assert.equal(L.defaultModelRef({}), 'unversioned');
assert.equal(L.defaultModelRef({ provider: 'openai', model: 'x' }), 'openai:x');

// ── F3 sessionId 含路径字符：不许越出工作区 ──
const m3 = L.startLineage(w1, { sessionId: '../../etc/passwd', modelRef: 'x:y' });
assert.equal(m3.sessionId, '../../etc/passwd', '原始 sessionId 要原样记进记录里');
const lineageDir = path.join(w1, 'protocol', 'lineage');
for (const f of fs.readdirSync(lineageDir)) {
  assert.ok(/^[0-9a-f]{12}\.json$/.test(f), `文件名必须是哈希，实际 ${f}`);
}
assert.ok(fs.existsSync(lineageDir));
assert.ok(!fs.existsSync(path.join(w1, 'protocol', 'etc')), '不得因 sessionId 造出目录');
assert.equal(L.currentLineage(w1, '../../etc/passwd').modelRef, 'x:y', '仍能按原 key 取回');

// ── 同会话 H0 → H1：混合运行可归因 ──
const w2 = mk('h01');
const a = L.startLineage(w2, { modelRef: 'openai:m', sessionId: 'S' });
const c = h.propose(w2, { config: { 'question.weights.repetition': 0.1 } });
h.evaluate(w2, c.releaseId, { paired: true, heldOut: true, sampleSize: 20, heldOutDelta: 0.1, regressionRate: 0, costDelta: 0.05, evidence: 'mechanical' });
h.publish(w2, c.releaseId, { approvedBy: 'tester' });
const b = L.startLineage(w2, { modelRef: 'openai:m', sessionId: 'S' });
assert.equal(a.harnessVersion, 'H0');
assert.equal(b.harnessVersion, 'H1');
const changed = L.diffLineage(a, b);
assert.equal(changed.length, 1, `只应有一个维度变化，实际 ${JSON.stringify(changed)}`);
assert.equal(changed[0].dimension, 'harnessVersion');
assert.equal(changed[0].from, 'H0');
assert.equal(changed[0].to, 'H1');
// 换模型也要能被指出来
const c2 = L.buildLineage(w2, { modelRef: 'openai:other', sessionId: 'S' });
assert.deepEqual(L.diffLineage(b, c2).map((x) => x.dimension), ['modelRef']);

// ── F2 历史文件损坏：跳过坏行，保留好记录 ──
fs.appendFileSync(L.historyFile(w2), '{坏行\n');
const hist = L.readHistory(w2);
assert.ok(hist.length >= 2, `损坏行应被跳过，实际保留 ${hist.length} 条`);
assert.ok(hist.every((r) => r.lineageId), '保留下来的每条都要有 lineageId');
assert.ok(L.renderHistory(w2).includes('共 '));

// ── 事件带 lineage_id，且能对上当前记录 ──
const w3 = mk('stamp');
L.startLineage(w3, { modelRef: 'openai:m', sessionId: 'S9' });
ev.appendEvent(w3, { event_type: 'x', state_version: 's_1', session_id: 'S9' });
assert.equal(ev.listEvents(w3)[0].lineage_id, L.currentLineage(w3, 'S9').lineageId);
// 别的会话没登记过 → 空串，不是别人的 id
ev.appendEvent(w3, { event_type: 'y', state_version: 's_2', session_id: 'other' });
assert.equal(ev.listEvents(w3)[1].lineage_id, '');

// ── runTask 端到端：返回值带 lineage，事件也能对上 ──
const w4 = mk('runtask');
const mockLlm = async () => '（mock）';
const out = await ad.runTask({ workspace: w4, sessionId: 'S', input: '想写故乡的门槛', channel: 'cli', llm: mockLlm, metadata: { modelRef: 'openai:test' } });
assert.ok(out.lineageId && out.lineage, 'runTask 必须返回 lineage');
assert.equal(out.lineage.modelRef, 'openai:test');
const evs = ev.listEvents(w4).filter((e) => e.session_id === 'S');
assert.ok(evs.length > 0, '这一轮应产生事件');
assert.ok(evs.every((e) => e.lineage_id === out.lineageId), '这一轮的事件必须都指向同一条 lineage');

console.log('PASS csl-lineage（F1 无记录不崩 / F2 坏行跳过 / F3 会话名不越界 / F4 不猜模型 + 七维度齐全 + H0/H1 可归因 + 事件带 lineage）');
