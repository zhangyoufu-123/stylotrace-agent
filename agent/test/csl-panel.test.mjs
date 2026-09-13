// 状态面板验收：自包含单文件（无外链）、六个板块齐全、能反映真实状态、可写盘。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = await import(path.join(HERE, '..', 'src', 'csl', 'panel.js'));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));
const dc = await import(path.join(HERE, '..', 'src', 'csl', 'decision.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-panel-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
st.commit(w, { delta: { coreIdea: '写作的第一步不是写，是想' }, event: { eventType: 'core_idea.set' } });
st.commit(w, { delta: { addHypothesis: '先想后写' }, event: { eventType: 'hypothesis.add' } });
dc.addDecision(w, { object: '门槛', comparisonSet: '乡愁散文', spanText: '门槛不是阻隔，是记忆的承重' });

const html = P.buildPanelHtml(w, { sessionId: 'default' });

// 1) 六个板块齐全（这就是"能查看当前状态"的验收）
for (const section of ['① 认知状态', '② 学到的风格', '③ 写过的作品', '④ 冻结的决断', '⑤ 最近事件', '⑥ 能力全景']) {
  assert.ok(html.includes(section), `面板应含板块：${section}`);
}

// 2) 自包含：无外链、无外部脚本
assert.ok(!/https?:\/\//.test(html), '面板不得引用外部 URL（必须自包含）');
assert.ok(!/<script/i.test(html), '面板不依赖脚本');
assert.ok(html.includes('<style>'), '样式应内联');

// 3) 反映真实状态
assert.ok(html.includes('写作的第一步不是写，是想'), '应显示核心想法');
assert.ok(html.includes('门槛不是阻隔，是记忆的承重'), '应显示冻结的决断句');
assert.ok(html.includes('乡愁散文'), '应显示比较集');
assert.ok(/v\d+/.test(html), '应显示状态版本');

// 4) 采集数据可复用（MCP/Web 共用）
const snap = P.collectPanel(w, { sessionId: 'default' });
assert.equal(snap.cognitive.coreIdea, '写作的第一步不是写，是想');
assert.equal(snap.decisions.length, 1);
assert.ok(snap.capabilities.total >= 18, '能力总数应 ≥18');
assert.ok(snap.events.length >= 2, '事件账本应至少含 2 条');

// 5) 写盘
const out = path.join(tmp, 'panel.html');
const r = P.writePanel(w, { sessionId: 'default', out });
assert.ok(fs.existsSync(out) && r.bytes > 500, `应写出面板文件：${r.bytes} 字节`);

console.log('PASS csl-panel（自包含单文件 · 六板块 · 真实状态 · 可写盘）');
