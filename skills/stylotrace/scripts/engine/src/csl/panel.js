// 单文件状态面板：把"这个 agent 现在记住了什么"做成一页 HTML。
// 用途：放进 IDE / Codex / 浏览器查看——当前认知状态、学到的风格、写过的作品、冻结的决断、事件账本、自证结果。
// 特点：**自包含**（内联 CSS，无外链、无脚本依赖），拷到任何地方都能打开；由 CLI/MCP/Web 三端共用同一份实现。
import fs from 'node:fs';
import path from 'node:path';
import * as st from './state.js';
import * as br from './brief.js';
import * as dc from './decision.js';
import * as cap from './capabilities.js';
import * as ws from '../workspace.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function tailEvents(workspace, limit = 12) {
  try {
    const raw = fs.readFileSync(path.join(workspace, 'protocol', 'csl-canonical-events.jsonl'), 'utf8');
    return raw.trim().split('\n').filter(Boolean).slice(-limit).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean).reverse();
  } catch {
    return [];
  }
}

function styleSummary(workspace) {
  const w = readJsonSafe(path.join(workspace, 'vault', 'write-style.json'));
  const r = readJsonSafe(path.join(workspace, 'vault', 'read-style.json'));
  const fp = readJsonSafe(path.join(workspace, 'vault', 'style-fingerprint.json'));
  const dims = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.keys(o).length : Array.isArray(o) ? o.length : 0);
  let edits = 0;
  try {
    edits = fs.readFileSync(path.join(workspace, 'vault', 'edits.jsonl'), 'utf8').trim().split('\n').filter(Boolean).length;
  } catch {}
  return { writeDims: dims(w), readDims: dims(r), hasFingerprint: Boolean(fp), edits };
}

function worksList(workspace, limit = 8) {
  try {
    const lib = readJsonSafe(path.join(workspace, 'vault', 'library.json'));
    const items = Array.isArray(lib) ? lib : Array.isArray(lib?.items) ? lib.items : [];
    return items.slice(-limit).reverse().map((i) => ({
      title: i.title || i.name || '（未命名）',
      category: i.category || i.genre || '',
      at: i.archivedAt || i.updatedAt || '',
    }));
  } catch {
    return [];
  }
}

/** 采集面板数据（三端共用）。 */
export function collectPanel(workspace, { sessionId = 'default' } = {}) {
  const cs = st.readCanonicalState(workspace, { sessionId });
  const brief = br.readBrief(workspace);
  const decisions = dc.listDecisions(workspace);
  const capabilities = cap.capabilityStatus(workspace, { sessionId });
  const events = tailEvents(workspace);
  const actions = events.filter((e) => /action\.executed|cognitive\.run/.test(e.type || '')).slice(0, 5)
    .map((e) => (e.payload?.action ? `${e.payload.action}` : String(e.type)));
  // 节奏体检数据（由 director 交付前写入 state.quality.rhythm）
  let rhythm = { present: false };
  try {
    const stq = ws.readState(workspace) || {};
    const r = stq.quality && stq.quality.rhythm;
    if (r && !r.skipped) rhythm = { present: true, ...r };
  } catch {}

  return {
    generatedAt: ws.nowIso(),
    rhythm,
    sessionId,
    cognitive: {
      stateVersion: cs.stateVersion,
      coreIdea: cs.coreIdea || '',
      goal: cs.goal?.inferred || cs.goal?.confirmed || '',
      hypotheses: (cs.hypotheses || []).length,
      evidence: (cs.evidence || []).length,
      memoryRefs: (cs.memoryRefs || []).length,
      recentActions: actions,
      decisionCount: (cs.decisions || []).length,
    },
    style: styleSummary(workspace),
    works: worksList(workspace),
    decisions: decisions.map((d) => ({
      spanText: d.spanText,
      object: d.object,
      comparisonSet: d.comparisonSet,
      frozen: d.frozen !== false,
    })),
    brief,
    events: events.map((e) => ({ type: e.type, at: e.timestamp, actor: e.actor })),
    capabilities: { live: capabilities.live, total: capabilities.total },
  };
}

/** 渲染成自包含 HTML（内联 CSS，无外链）。 */
export function buildPanelHtml(workspace, { sessionId = 'default', title = 'Stylotrace 状态面板' } = {}) {
  const p = collectPanel(workspace, { sessionId });
  const card = (name, body, cls = '') => `<section class="card ${cls}"><h2>${esc(name)}</h2>${body}</section>`;
  const kv = (k, v) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
  const chips = (arr, cls = '') => (arr.length ? arr.map((x) => `<span class="chip ${cls}">${esc(x)}</span>`).join('') : '<span class="muted">（无）</span>');

  const cogBody = [
    kv('状态版本', `v${p.cognitive.stateVersion}`),
    kv('核心想法', p.cognitive.coreIdea || '（未确认）'),
    kv('写作目标', p.cognitive.goal || '（未设定）'),
    kv('假设 / 证据', `${p.cognitive.hypotheses} / ${p.cognitive.evidence}`),
    kv('记忆引用', String(p.cognitive.memoryRefs)),
    kv('最近认知动作', p.cognitive.recentActions.join(' → ') || '（无记录）'),
  ].join('');

  const styleBody = [
    kv('写作风格维度', String(p.style.writeDims)),
    kv('阅读风格维度', String(p.style.readDims)),
    kv('风格指纹', p.style.hasFingerprint ? '已生成' : '未生成'),
    kv('吸收的亲手修改', `${p.style.edits} 处`),
    p.brief.authorSchemas?.length ? kv('学到的作者模式', p.brief.authorSchemas.map((s) => `${s.relationText}(conf=${s.confidence})`).join('；')) : '',
  ].join('');

  const worksBody = p.works.length
    ? `<ul class="list">${p.works.map((w) => `<li><b>${esc(w.title)}</b>${w.category ? ` <span class="chip">${esc(w.category)}</span>` : ''}${w.at ? ` <span class="muted">${esc(String(w.at).slice(0, 10))}</span>` : ''}</li>`).join('')}</ul>`
    : '<p class="muted">还没有归档作品。</p>';

  // 结果账本（预测 → 实际 → 反事实归因）。
  // 之前它只被 runtime 写进磁盘、没有任何读取入口——能力清单却写着"可逐条导出核查"，
  // 等于写了盘读不出来。这里补上：面板同步读一次（collectPanel 是同步函数，不能 await）。
  let outcomesBody = '<p class="muted">还没有结果记录。给出一次反馈后产生。</p>';
  try {
    const raw = fs.readFileSync(path.join(workspace, 'protocol', 'csl-outcomes.jsonl'), 'utf8');
    const list = raw
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    if (list.length) {
      outcomesBody =
        list
          .slice(-6)
          .map((o) => {
            const dims = o.evaluation?.dimensions || {};
            const top = Object.entries(dims).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
            return (
              `<div class="kv"><span class="k">${esc(String(o.timestamp || '').slice(5, 16))}</span>` +
              `<span class="v">预测 ${esc(String(o.prediction?.expected ?? '—'))} → 实际 ` +
              `${esc(String(o.actual?.value ?? '—'))}${top ? ` ｜ ${esc(top[0])} ${esc(String(top[1]))}` : ''}</span></div>`
            );
          })
          .join('') + `<p class="muted">共 ${list.length} 条 · 运行 stylotrace outcomes 看全部</p>`;
    }
  } catch {}

  const rq = p.rhythm || {};
  const rhythmBody = rq.present
    ? [
        kv('上次成稿 CV', String(rq.cv ?? '—')),
        kv('气群 / 句读', `${rq.breathGroups ?? '—'} / ${rq.sentences ?? '—'}`),
        kv('边界错位', String(rq.misalignments ?? '—')),
        kv('基线来源', rq.baselineSource === 'author' ? `你自己（${rq.authorCorpus} 篇）` : rq.baselineSource || '—'),
        rq.deviation ? kv('相对你自己', rq.deviation) : '',
        rq.baselineNote ? `<p class="muted">${esc(rq.baselineNote)}</p>` : '',
      ].join('')
    : '<p class="muted">还没有节奏体检记录。写完成稿后自动生成（零 API 调用）。</p>';

  const decBody = p.decisions.length
    ? `<ul class="list">${p.decisions.map((d) => `<li><b class="frozen">🔒 ${esc(d.spanText)}</b><div class="muted">对象：${esc(d.object || '—')} ｜ 比较集：${esc(d.comparisonSet || '—')}</div></li>`).join('')}</ul>`
    : '<p class="muted">还没有冻结的决断。冻结后的句子，AI 不能改写。</p>';

  const evBody = p.events.length
    ? `<ul class="list">${p.events.map((e) => `<li><span class="chip">${esc(e.type)}</span> <span class="muted">${esc(String(e.at || '').slice(11, 19))} ${esc(e.actor || '')}</span></li>`).join('')}</ul>`
    : '<p class="muted">还没有事件记录。</p>';

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --ink:#22201d; --gold:#b8860b; --blue:#3c78c8; --purple:#8c5ac8; --line:#e8e2d5; }
  * { box-sizing: border-box; }
  body { margin:0; padding:28px; background:#fbf9f4; color:var(--ink);
    font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif; line-height:1.7; }
  header { border-bottom:2px solid var(--gold); padding-bottom:12px; margin-bottom:18px; }
  h1 { margin:0 0 4px; font-size:22px; }
  .sub { color:#7a736a; font-size:13px; }
  .grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); }
  .card { background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .card h2 { margin:0 0 10px; font-size:14px; color:#6b6357; letter-spacing:.03em; }
  .card.cog { border-left:3px solid var(--gold); }
  .card.style { border-left:3px solid var(--purple); }
  .card.dec { border-left:3px solid #c0392b; }
  .card.cap { border-left:3px solid var(--blue); }
  .kv { display:flex; gap:10px; padding:3px 0; border-bottom:1px dashed #f0ece2; }
  .k { color:#8a8377; min-width:104px; font-size:13px; }
  .v { flex:1; font-size:13px; }
  .chip { display:inline-block; padding:1px 8px; border-radius:10px; background:#f3f0e8; border:1px solid var(--line); font-size:12px; margin:2px 4px 2px 0; }
  .muted { color:#8a8377; font-size:12px; }
  .frozen { color:#8a5b00; }
  .list { margin:6px 0 0 16px; padding:0; }
  .list li { margin:5px 0; font-size:13px; }
  footer { margin-top:20px; color:#8a8377; font-size:12px; }
</style></head>
<body>
<header>
  <h1>Stylotrace · 状态面板</h1>
  <div class="sub">这个 agent 现在记住了什么：认知状态 · 学到的风格 · 写过的作品 · 冻结的决断 · 事件账本<br>
  会话 <code>${esc(p.sessionId)}</code> ｜ 生成于 ${esc(p.generatedAt)} ｜ 能力 ${p.capabilities.live}/${p.capabilities.total} 可用</div>
</header>
<div class="grid">
  ${card('① 认知状态', cogBody, 'cog')}
  ${card('② 学到的风格', styleBody, 'style')}
      ${card('③ 写过的作品', worksBody)}
      ${card('④ 节奏与气群 · CADENCE', rhythmBody, 'rhythm')}
      ${card('⑤ 冻结的决断（AI 不能改）', decBody, 'dec')}
      ${card('⑥ 最近事件（可审计）', evBody)}
      ${card('⑦ 结果账本（可审计）', outcomesBody, 'out')}
      ${card('⑧ 能力全景', `<p class="muted">真实可用 ${p.capabilities.live}/${p.capabilities.total}。运行 <code>stylotrace capabilities</code> 或 <code>stylotrace falsify</code> 查看全部与自证结果。</p>`, 'cap')}
</div>
<footer>由 Stylotrace 生成（自包含单文件，可直接放进 IDE / 浏览器查看；无外链、无脚本依赖）。</footer>
</body></html>`;
}

/** 写出面板文件；默认写到工作区 panel.html。 */
export function writePanel(workspace, { sessionId = 'default', out = '' } = {}) {
  const file = out || path.join(workspace, 'panel.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buildPanelHtml(workspace, { sessionId }));
  return { file, bytes: fs.statSync(file).size };
}
