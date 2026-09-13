// Phase 3 验收：Web 经统一认知入口（Application Adapter → CSLA Runtime）
// 覆盖：csl/state · csl/turn（Fast→Ask）· csl/checkpoint（Deep 恢复）· csl/action · 跨通道共享同一 canonical state。
// 用法: node web/test/csl-web-qa.mjs（不监听端口，直接捕获 handler）
import http from 'node:http';
import { Writable } from 'node:stream';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'stylotrace-csl-web-'));

process.env.STYLOTRACE_MOCK_LLM = '1';
process.env.STYLOTRACE_WEB_DATA = TMP;

let handler = null;
http.createServer = (h) => {
  handler = h;
  return { listen() {} };
};

await import(pathToFileURL(path.join(REPO, 'web', 'server.mjs')).href);
const adapter = await import(pathToFileURL(path.join(REPO, 'agent', 'src', 'csl', 'adapter.js')).href);

function fakeRes() {
  const chunks = [];
  const res = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); } });
  res.statusCode = 200;
  res._headers = {};
  res.writeHead = (code, headers) => { res.statusCode = code; res._headers = headers || {}; };
  res._body = () => Buffer.concat(chunks).toString('utf8');
  return res;
}

function call(urlStr, method = 'GET', payload) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = urlStr;
    req.headers = { host: 'localhost' };
    const res = fakeRes();
    const timer = setTimeout(() => reject(new Error(`timeout: ${method} ${urlStr}`)), 60000);
    res.on('finish', () => { clearTimeout(timer); resolve(res); });
    res.on('error', (e) => { clearTimeout(timer); reject(e); });
    handler(req, res);
    if (payload !== undefined) req.emit('data', Buffer.from(JSON.stringify(payload)));
    req.emit('end');
  });
}

let passed = 0;
const assert = (cond, msg) => { if (!cond) throw new Error(`断言失败: ${msg}`); console.log(`  PASS ${msg}`); passed += 1; };
const j = (res) => JSON.parse(res._body());

console.log('Phase 3 · Web → Application Adapter → CSLA（mock LLM）');

// 0) 前端确实挂了认知状态卡（UI 契约）
const html = fs.readFileSync(path.join(REPO, 'web', 'public', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(REPO, 'web', 'public', 'assets', 'app.js'), 'utf8');
assert(html.includes('cslStrip') && html.includes('cslRunBtn'), '前端含认知状态卡与"认知一轮"按钮');
assert(js.includes('refreshCslState') && js.includes('/api/csl/turn'), '前端调用统一认知入口');

// 1) 新建会话（不带 topic：验证"无核心 → Writer 门 BLOCK"）
const start = await call('/api/start', 'POST', {});
assert(start.statusCode === 200, '/api/start 可用');
const sid = j(start).sessionId;
assert(Boolean(sid), `拿到会话 id: ${sid}`);

// 2) 初始认知状态（同一会话）
const s0 = await call(`/api/csl/state?sessionId=${sid}`);
assert(s0.statusCode === 200, '/api/csl/state 可用');
assert(j(s0).stateVersion === 0, `初始 stateVersion=0（实际 ${j(s0).stateVersion}）`);

// 3) Fast→Ask（无 coreIdea 必须先问）
const task = '我想写一篇关于故乡门槛的散文，核心是记忆';
const turn = await call('/api/csl/turn', 'POST', { sessionId: sid, message: task, mode: 'auto' });
assert(turn.statusCode === 200, '/api/csl/turn 可用');
const tr = j(turn);
assert(tr.cognitiveAction === 'askHuman' && tr.app.app === 'ask', `无核心 → AskHuman（实际 ${tr.cognitiveAction}/${tr.app?.app}）`);
assert(tr.writerGate && tr.writerGate.blocked === true, 'Writer 门 BLOCK（无 coreIdea）');

// 4) Checkpoint 回答 → 恢复深层
const chk = await call('/api/csl/checkpoint', 'POST', { sessionId: sid, answer: '门槛是外婆家的旧木门槛，被磨矮了', input: task });
assert(chk.statusCode === 200, '/api/csl/checkpoint 可用');
const cr = j(chk);
assert(cr.kind === 'deep', `回答后恢复深层（实际 ${cr.kind}）`);
assert(cr.writerGate && cr.writerGate.blocked === false, 'Writer 门放行（coreIdea 已确认）');
assert(typeof cr.state?.coreIdea === 'string' && cr.state.coreIdea.includes('门槛'), 'coreIdea 进入规范状态');

// 5) 状态推进 + 动作执行
const s1 = j(await call(`/api/csl/state?sessionId=${sid}`));
assert(s1.stateVersion >= 1, `stateVersion 前进（${s1.stateVersion}）`);
const act = j(await call('/api/csl/action', 'POST', { sessionId: sid, action: 'search', input: task }));
assert(act.executed === true, 'csl/action 执行单一认知动作');

// 6) 跨通道：CLI/MCP 用同一 workspace+sessionId 应看到同一状态
const dirs = fs.readdirSync(path.join(TMP, 'machines'));
const wsDir = path.join(TMP, 'machines', dirs[0], 'sessions', sid);
assert(fs.existsSync(wsDir), `会话工作区存在: ${path.relative(TMP, wsDir)}`);
const cliView = await adapter.runTask({ workspace: wsDir, sessionId: sid, input: task, channel: 'cli', mode: 'auto' });
assert(cliView.stateVersion >= s1.stateVersion, `CLI 通道看到同一状态（web=${s1.stateVersion} cli=${cliView.stateVersion}）`);
assert(cliView.state.coreIdea.includes('门槛'), 'CLI 通道看到同一 coreIdea（跨通道共享）');
const snap = adapter.canonicalSnapshot(wsDir, sid);
assert(snap.stateVersion === cliView.stateVersion, '快照与通道视图一致');

// 7) 决断卡：比较集必填 → 冻结 → 校验（改了必须报违规）→ 解除
const noCompare = await call('/api/csl/decision', 'POST', { sessionId: sid, spanText: '门槛不是阻隔，是记忆的承重', object: '门槛' });
assert(noCompare.statusCode === 400, '缺比较集必须拒绝');
const card = await call('/api/csl/decision', 'POST', {
  sessionId: sid,
  spanText: '门槛不是阻隔，是记忆的承重',
  object: '门槛——被磨矮的木头',
  comparisonSet: '乡愁散文 / 伤痕叙事',
});
assert(card.statusCode === 200 && j(card).ok, '决断卡可冻结');
const decList = await call(`/api/csl/decisions?sessionId=${sid}`);
assert((j(decList).items || []).length === 1, '决断列表可查');
const verifyOk = await call('/api/csl/verify', 'POST', { sessionId: sid, text: '院子里的门槛矮了一截。门槛不是阻隔，是记忆的承重，它记得每一双脚。' });
assert(j(verifyOk).ok === true, '保留冻结句 → 通过');
const verifyBad = await call('/api/csl/verify', 'POST', { sessionId: sid, text: '门槛不再是阻隔，而成了记忆的载体。' });
assert(j(verifyBad).ok === false && j(verifyBad).violations.length === 1, '改写冻结句 → 报违规');
const del = await call(`/api/csl/decision?sessionId=${sid}&decisionId=${encodeURIComponent(j(card).card.decisionId)}`, 'DELETE');
assert(j(del).ok === true, '可解除冻结');

// 8) 可证伪演示 + 双色 diff（Web 端）
const fal = await call('/api/csl/falsify');
assert(fal.statusCode === 200 && j(fal).allPass === true, `自证电池应全过（${j(fal).passed}/${j(fal).total}）`);
const dd = await call('/api/csl/dual-diff', 'POST', { before: '数据显示 22% 的用户放弃写作。', after: '数据显示 37% 的用户放弃写作。' });
assert(j(dd).stats.factChanges >= 1, '改数字应判事实层');
const dd2 = await call('/api/csl/dual-diff', 'POST', { before: '数据显示 22% 的用户放弃写作。', after: '数据显示，22% 的用户放弃了写作。' });
assert(j(dd2).verdict === 'style_only', '只改标点应判 style_only');

// 9) 棱镜三视图 + 就地转换（事实锁定）
const pv = await call('/api/csl/prism', 'POST', { sessionId: sid, text: '数据显示，2024 年有 22% 的用户放弃了写作。这可能与 AI 的普及有关。' });
assert(pv.statusCode === 200 && j(pv).fact.numbers.length >= 2, '棱镜事实层应抓出数字');
assert(j(pv).style.sentenceCount >= 1, '棱镜风格层应有句式统计');
const pvHtml = fs.readFileSync(path.join(REPO, 'web', 'public', 'index.html'), 'utf8');
assert(pvHtml.includes('prismPanel') && pvHtml.includes('cslPrismBtn'), '前端含棱镜面板与入口按钮');

console.log(`\n✓ csl-web-qa 全部通过（${passed} 项）`);
