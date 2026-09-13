// CognitiveStateStore failure-case 测试（先 failure case 再实现）。
// F1 损坏状态可恢复；F2 无事件变更被拒绝；F3 版本回退被拒绝。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-state-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// F2: 无事件的状态变更被拒绝
assert.throws(() => st.transition(st.emptyCognitiveState(), null, { goal: 'x' }), /event/);
// F2: 非法 action key 被拒绝
assert.throws(
  () => st.transition(st.emptyCognitiveState(), { event_type: 't' }, { evil: 1 }),
  /not allowed/,
);

// 正常转移 + 版本单调
const r1 = st.transition(st.emptyCognitiveState(), { event_type: 'goal.set' }, { goal: '写一篇散文' });
assert.equal(r1.nextState.sVersion, 1);
assert.equal(r1.ledgerEvent.state_version, 's_1');
st.persistState(w, r1.nextState, r1.ledgerEvent);

const r2 = st.transition(r1.nextState, { event_type: 'core_idea.set' }, { coreIdea: '故乡的门槛' });
assert.equal(r2.nextState.sVersion, 2);
st.persistState(w, r2.nextState, r2.ledgerEvent);
assert.equal(st.readState(w).sVersion, 2);

// F3: 版本回退被拒绝
assert.throws(() => st.persistState(w, { ...r2.nextState, sVersion: 1 }, {}), /regression/);

// F1: 损坏文件 → 默认状态 + 不崩溃
fs.writeFileSync(st.stateFile(w), '{broken json');
const recovered = st.readState(w);
assert.equal(recovered.sVersion, 0);
assert.equal(recovered.coreIdea, '');

console.log('PASS csl-state（F1 恢复 / F2 拒绝 / F3 版本单调）');
