// EventStore / CognitiveTrace failure-case 测试。
// F1 缺 state_version 拒绝写入；F2 损坏行跳过不崩溃；F3 查询按 step 有序。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const ev = await import(path.join(HERE, '..', 'src', 'csl', 'events.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-events-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// F1
assert.throws(() => ev.appendEvent(w, { event_type: 'x' }), /state_version/);
assert.throws(() => ev.appendEvent(w, { state_version: 's_1' }), /event_type/);

// 正常写入
ev.appendEvent(w, { event_type: 'human.edit', state_version: 's_1', session_id: 'sessA', step: 1 });
ev.appendEvent(w, { event_type: 'credit.update', state_version: 's_2', session_id: 'sessA', step: 2 });
ev.appendEvent(w, { event_type: 'goal.set', state_version: 's_1', session_id: 'sessB', step: 1 });

// F3: 有序
const t = ev.traceForSession(w, 'sessA');
assert.deepEqual(t.map((e) => e.step), [1, 2]);
assert.equal(ev.traceForSession(w, 'sessB').length, 1);

// F2: 损坏行跳过，不崩溃
fs.appendFileSync(ev.eventsFile(w), '{bad json}\n');
const all = ev.listEvents(w);
assert.ok(all.length >= 3);

// replay 概要存在
const rp = ev.replayEvents(w, 'sessA');
assert.equal(rp.length, 2);
assert.ok('state_version' in rp[0]);

// traceHumanEdit + absorbEdit 接线：修改产生 human.edit 事件
ev.traceHumanEdit(w, { original: '风景很美', changed: '风把枯叶推进门缝', intent: '改具体' });
assert.ok(ev.traceForSession(w, '').some((e) => e.event_type === 'human.edit'));
const w2 = ws.ensureWorkspace(path.join(tmp, 'w2'), { create: true });
ws.absorbEdit(w2, { original: 'a', changed: 'b', intent: '改短' });
assert.ok(ev.listEvents(w2).some((e) => e.event_type === 'human.edit' && e.action.changed === 'b'));

console.log('PASS csl-events（F1 拒绝 / F2 容错 / F3 有序回放）');
