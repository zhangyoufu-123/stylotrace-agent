// Canonical State Kernel 测试（P0-1）：readCanonical / commitDelta / syncCoreIdea / 双写镜像 / 版本单调。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const cn = await import(path.join(HERE, '..', 'src', 'csl', 'canonical.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-canonical-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// 空状态：coreIdea 未确认
const c0 = cn.readCanonical(w);
assert.equal(c0.coreIdeaConfirmed, false, '空状态不应确认 coreIdea');
assert.equal(c0.version, 0);

// commitDelta：版本 +1、事件落账、镜像到产品视图
const r1 = cn.commitDelta(w, { delta: { coreIdea: '故乡的门槛被磨矮了' }, eventType: 'core_idea.set', event: { action: { source: 'test' } } });
assert.equal(r1.version, 1, 'commitDelta 应使 csl 版本前进');
const c1 = cn.readCanonical(w);
assert.equal(c1.coreIdea, '故乡的门槛被磨矮了');
assert.equal(c1.coreIdeaConfirmed, true);
assert.equal(c1.version, 1);
const ps1 = ws.readState(w);
assert.equal(ps1.cslVersion, 1, '产品视图应镜像 cslVersion');
assert.ok(ps1.confirmed?.topic, '产品视图应补 topic 提示');
const events = fs.readFileSync(path.join(w, 'protocol', 'csl-canonical-events.jsonl'), 'utf8');
assert.ok(events.includes('core_idea.set'), '统一事件应落账（EventStore）');
const evtLine = JSON.parse(events.trim().split('\n').pop());
assert.ok(evtLine.eventId && evtLine.stateVersionBefore === 0 && evtLine.stateVersionAfter === 1, '统一事件应含 eventId/versionBefore/versionAfter');

// 版本单调：再次提交 → v2
const r2 = cn.commitDelta(w, { delta: { uncertainty: 0.3 }, eventType: 'uncertainty.update' });
assert.equal(r2.version, 2);

// syncCoreIdea：已有 coreIdea 幂等；空 csl + 产品有 topic → 补齐
const w2 = ws.ensureWorkspace(path.join(tmp, 'w2'), { create: true });
const ps2 = ws.readState(w2);
ps2.confirmed = { topic: 'AI 写作同质化' };
ws.writeState(w2, ps2);
const sy = cn.syncCoreIdea(w2);
assert.equal(sy.synced, true, '应从产品已确认信息补齐 csl coreIdea');
assert.equal(st.readState(w2).coreIdea, 'AI 写作同质化');
const sy2 = cn.syncCoreIdea(w2);
assert.equal(sy2.synced, false, '已有 coreIdea 应幂等');

// 产品写路径版本化（P0-1 可追溯性）：每次 writeState 递增 stateVersion 并落事件行
const w3 = ws.ensureWorkspace(path.join(tmp, 'w3'), { create: true });
ws.writeState(w3, ws.readState(w3));
ws.writeState(w3, ws.readState(w3));
assert.equal(ws.readState(w3).stateVersion, 2, '产品状态应版本化');
const sev = fs.readFileSync(path.join(w3, 'protocol', 'state-events.jsonl'), 'utf8').trim().split('\n');
assert.equal(sev.length, 2, '状态事件行应落账');

console.log('PASS csl-canonical（readCanonical / commitDelta / syncCoreIdea / 版本化双写）');
