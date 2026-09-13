// 功能全景验收：能力目录必须可读、状态诚实（live/planned 不混淆）、能反映会话实时状态。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const C = await import(path.join(HERE, '..', 'src', 'csl', 'capabilities.js'));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));
const dc = await import(path.join(HERE, '..', 'src', 'csl', 'decision.js'));

// 1) 目录结构完整
assert.ok(C.CAPABILITIES.length >= 15, `能力项应 ≥15（实际 ${C.CAPABILITIES.length}）`);
for (const c of C.CAPABILITIES) {
  assert.ok(c.id && c.name && c.layer && c.status && c.evidence, `每项要有 id/名称/层/状态/证据：${c.id}`);
  assert.ok(['live', 'planned'].includes(c.status), `状态只能 live/planned：${c.id}=${c.status}`);
  assert.ok(c.entry && 'cli' in c.entry && 'web' in c.entry && 'api' in c.entry, `每项要写清三端入口：${c.id}`);
}

// 2) 关键能力必须在列（这就是"整合梳理"的验收）
const ids = new Set(C.CAPABILITIES.map((c) => c.id));
for (const need of ['clarify', 'question-policy', 'fast-deep', 'writer-gate', 'decision-card', 'prism', 'dual-diff', 'falsify', 'anti-lockin', 'outcome-credit', 'style-learning', 'style-judge', 'memory', 'search', 'cross-channel', 'audit-trail']) {
  assert.ok(ids.has(need), `能力目录缺少 ${need}`);
}

// 3) 未实现的必须诚实标注（不能冒充完成）
for (const planned of ['sidecar', 'longitudinal']) {
  const item = C.CAPABILITIES.find((c) => c.id === planned);
  assert.equal(item.status, 'planned', `${planned} 应标为 planned`);
}

// 4) 实时状态：反映会话的版本/核心/决断卡/事件数
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-cap-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
const s0 = C.capabilityStatus(w, { sessionId: 'default' });
assert.equal(s0.session.stateVersion, 0);
assert.equal(s0.session.decisions, 0);
st.commit(w, { delta: { coreIdea: '先想后写' }, event: { eventType: 'core_idea.set' } });
dc.addDecision(w, { object: '门槛', comparisonSet: '乡愁散文', spanText: '门槛不是阻隔' });
const s1 = C.capabilityStatus(w, { sessionId: 'default' });
assert.ok(s1.session.stateVersion >= 1, '状态版本应前进');
assert.equal(s1.session.coreIdea, '先想后写');
assert.equal(s1.session.decisions, 1);
assert.ok(s1.session.events >= 2, `事件账本应计数（实际 ${s1.session.events}）`);
assert.equal(s1.live, C.CAPABILITIES.filter((c) => c.status === 'live').length);

// 5) 可读渲染
const txt = C.renderCapabilities(s1);
assert.ok(txt.includes('功能全景'), '报告应有标题');
assert.ok(txt.includes('当前会话'), '报告应含实时状态');

console.log(`PASS csl-capabilities（${C.CAPABILITIES.length} 项能力 · 真实可用 ${s1.live} · 状态实时可读）`);
