#!/usr/bin/env node
// Stylotrace Studio Web（v1.0）：零依赖 Node HTTP 服务。
// 把 Stylotrace 导演状态机（agentStep）包成 REST，前端提供完整写作工作台：
//   多会话持久化（web-data/sessions/，可列表/改名/删除/续写）
//   作品库（vault/library 跨会话聚合，按文体分类展示）
//   风格肖像（write/read 14+7 维 + 复合风格向量 + 人物侧写）
//   知识库可视化（vault/knowledge 条目列表/删除）
//   导出：md / docx / pptx（python-docx / python-pptx 可用时）
// STYLOTRACE_MOCK_LLM=1 时用内置 mock（离线验证）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 5177);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PUBLIC = path.resolve(HERE, 'public');
const DATA_ROOT = path.resolve(process.env.STYLOTRACE_WEB_DATA || path.resolve(HERE, '..', 'web-data'));

// ── 最小密码门：设置 STYLOTRACE_WEB_PASSWORD 即启用，未设置则开放（个人/演示）──
const AUTH_PASSWORD = String(process.env.STYLOTRACE_WEB_PASSWORD || '');
const AUTH_COOKIE = 'stylotrace_auth';

function authToken() {
  return crypto.createHash('sha256').update(`stylotrace:${AUTH_PASSWORD}`).digest('hex');
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isAuthed(req) {
  if (!AUTH_PASSWORD) return true;
  const cookies = parseCookies(req.headers.cookie);
  const token = req.headers['x-auth-token'] || cookies[AUTH_COOKIE] || '';
  return token === authToken();
}

// ── 公网防滥用：请求体上限 + 每 IP 限流 ──
// 本机（127.0.0.1/::1）不设限，本地开发和自动化测试不受影响；
// 一旦从公网访问，默认按 IP 限流，防止有人连点把宿主自己的 LLM 额度烧光。
// 可用 STYLOTRACE_WEB_RATE=0 关闭限流，STYLOTRACE_WEB_MAX_BODY 调整体积上限。
const MAX_BODY = Math.max(64 * 1024, Number(process.env.STYLOTRACE_WEB_MAX_BODY || 8 * 1024 * 1024));
const RATE_PER_MIN = Math.max(0, Number(process.env.STYLOTRACE_WEB_RATE ?? 60));
const rateBuckets = new Map();

function clientIp(req) {
  const direct = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  // 隧道/反向代理（cloudflared、Render 等）会把真实来访地址放在头部。
  // 只有当直连方本身是"内网/本机"时才采信头部——否则公网访客可以伪造 XFF 绕过限流。
  if (!direct || isPrivate(direct)) {
    const fwd = String(req.headers['cf-connecting-ip'] || '').split(',')[0].trim()
      || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (fwd) return fwd.replace(/^::ffff:/, '');
  }
  return direct;
}

function isLoopback(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip.startsWith('127.');
}

function isPrivate(ip) {
  if (!ip) return true;
  if (isLoopback(ip)) return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  return false;
}

function rateLimited(ip) {
  // 拿不到来源地址就不限流：分不清是谁发的，限流只会误伤（例如进程内直调 handler）。
  if (RATE_PER_MIN <= 0 || !ip || isLoopback(ip)) return false;
  const now = Date.now();
  const b = rateBuckets.get(ip) || { n: 0, reset: now + 60000 };
  if (now > b.reset) {
    b.n = 0;
    b.reset = now + 60000;
  }
  b.n += 1;
  rateBuckets.set(ip, b);
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) if (now > v.reset) rateBuckets.delete(k);
  }
  return b.n > RATE_PER_MIN;
}

// ── 按机器隔离用户：一台机器一个 machineId，数据各归各的（web-data/machines/<id>/）──
const machineCtx = new AsyncLocalStorage();

function currentMachine() {
  return machineCtx.getStore() || 'default';
}

function sessionsRoot(mid) {
  const safe = String(mid || 'default').replace(/[^a-z0-9-]/gi, '') || 'default';
  return path.join(DATA_ROOT, 'machines', safe, 'sessions');
}

function machineIdOf(req, url) {
  const raw = String(req.headers['x-machine-id'] || url.searchParams.get('machineId') || '').trim();
  return raw.replace(/[^a-z0-9-]/gi, '').slice(0, 64) || 'default';
}

// 离线 mock（与单测同一套）：STYLOTRACE_MOCK_LLM=1 时启用，用于本地/CI 验证
if (process.env.STYLOTRACE_MOCK_LLM === '1') {
  const { respond } = await import(
    pathToFileURL(path.resolve(HERE, '..', 'agent', 'test', 'mock-llm.mjs')).href
  );
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body || '{}');
    const content = respond(body.messages || []);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { role: 'assistant', content } }] }) };
  };
}

const { loadConfig } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'config.js')).href
);
const { academicNorm } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'academic-norm.js')).href
);
const { docTranslate, docRestyle } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'doc-pipeline.js')).href
);
const { agentStep } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'director.js')).href
);
// Phase 3：Web 也走统一认知入口（Application Adapter → CSLA Runtime）
const cslAdapter = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'csl', 'adapter.js')).href
);
const { makeLlm, chat: chatFn } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'llm.js')).href
);
const decision = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'csl', 'decision.js')).href
);
const ws = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'workspace.js')).href
);
const { humanMetrics } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'experiment.js')).href
);
const { styleProgress } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'style.js')).href
);
const { recentPulses } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'style-pulse.js')).href
);
const { thinkingBrief } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'thinking.js')).href
);
const { rhythmCurve } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'style-pulse.js')).href
);
const { modulatorStatus, modulate } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'modulator.js')).href
);
const { checkConsistency } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'consistency.js')).href
);
const { readVector, vectorSummary } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'style-vector.js')).href
);
const { readPersona } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'persona.js')).href
);
const { listEntries, removeEntry, normTitle } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'knowledge.js')).href
);
const { importWork, addPiece } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'library.js')).href
).catch(() => ({ importWork: null, addPiece: null }));
const { checklistOf } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'clarify.js')).href
);
const { outlineProgress } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'outline-state.js')).href
);
const { exportDocx, docxAvailable } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'io.js')).href
);
const { extractInput } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'io.js')).href
);
const { pointEdit } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'point-edit.js')).href
);
const { rewriteVariants } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'point-edit.js')).href
);
const { listHistory, rollback } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'history.js')).href
);
const { roundtripCheck, renderRoundtrip } = await import(
  pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'roundtrip.js')).href
);
const {
  searchOnline,
  ingestSearchResults,
  pendingDataNeeds,
  ragStatus,
} = await import(pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'rag.js')).href);

// Web 端默认收紧 LLM 超时与重试（避免"慢响应 + 长重试"叠加成几十秒的等待）；
// CLI/Agent 端不受影响（保持默认 300s / 4 次重试）。
if (!process.env.STYLOTRACE_LLM_TIMEOUT_MS) process.env.STYLOTRACE_LLM_TIMEOUT_MS = '120000';
if (!process.env.STYLOTRACE_LLM_RETRIES) process.env.STYLOTRACE_LLM_RETRIES = '2';
// Web 端默认开启内置免费检索（DuckDuckGo → 维基兜底），"帮我查一查"在部署即能用；
// CLI 端不设默认（保持"未配置→排队宿主代检"的原行为）。
if (!process.env.STYLOTRACE_SEARCH_PROVIDER) process.env.STYLOTRACE_SEARCH_PROVIDER = 'builtin';

// 自动加载仓库根目录 .env.local（DEEPSEEK_* 等），让 `npm start` 开箱即用。
function loadEnvLocal(file) {
  try {
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnvLocal(path.resolve(HERE, '..', '.env.local'));

// Web 端默认使用 deepseek-v4-flash（快、省），显式 STYLOTRACE_LLM_MODEL 仍可覆盖为 pro。
if (!process.env.STYLOTRACE_LLM_MODEL) process.env.STYLOTRACE_LLM_MODEL = 'deepseek-v4-flash';

// 服务端兜底凭据（本地/开发者自用）：仅在没有 BYOK key 时使用。
// 对外部署时建议不配 STYLOTRACE_LLM_API_KEY，强制用户自带 key，避免烧服务端额度。
const serverCfg = loadConfig();

// ── BYOK：用户带自己的 LLM key 调用，key 既是身份也是计费凭证 ──
const cfgCtx = new AsyncLocalStorage();

function currentCfg() {
  return cfgCtx.getStore() || serverCfg;
}

function byokKeyOf(req, url) {
  const auth = String(req.headers.authorization || '').trim();
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  if (m) return m[1];
  return String(url.searchParams.get('apiKey') || '').trim();
}

function userNamespace(req, url) {
  const key = byokKeyOf(req, url);
  if (key) {
    return 'key-' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  }
  return machineIdOf(req, url);
}

function cfgForRequest(req, url) {
  const key = byokKeyOf(req, url);
  if (!key) return serverCfg;
  const model =
    String(req.headers['x-llm-model'] || url.searchParams.get('model') || '').trim();
  const baseUrl =
    String(req.headers['x-llm-base-url'] || url.searchParams.get('baseUrl') || '').trim();
  return loadConfig({
    ...process.env,
    STYLOTRACE_LLM_API_KEY: key,
    STYLOTRACE_CREDENTIALS: 'off',
    ...(model ? { STYLOTRACE_LLM_MODEL: model } : {}),
    ...(baseUrl ? { STYLOTRACE_LLM_BASE_URL: baseUrl } : {}),
  });
}

const IO_SCRIPTS = path.resolve(HERE, '..', 'agent', 'scripts', 'io');

const GENRE_CATEGORY = {
  散文: '散文', 议论文: '议论文', 记叙文: '记叙文', 说明文: '说明文',
  学术论文: '论文', 论文: '论文', 公文: '公文', 通知: '公文', 请示: '公文',
  报告: '公文', 讲话稿: '发言稿', 发言稿: '发言稿', 演讲稿: '发言稿',
  合同: '合同', 协议: '合同', 小说: '小说', 剧本: '剧本',
  视频脚本: '视频脚本', 脚本: '视频脚本', 新闻稿: '新闻稿', 通讯: '新闻稿',
  诗歌: '诗歌', 书信: '书信', 游记: '散文', 随笔: '散文',
};

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve) => {
    let raw = '';
    let tooLarge = false;
    req.on('data', (c) => {
      if (tooLarge) return;
      raw += c;
      // 流式兜底：Content-Length 缺失或撒谎时也不会把内存吃光
      if (raw.length > MAX_BODY) {
        tooLarge = true;
        raw = '';
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) return resolve({ __tooLarge: true });
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// ── 会话持久化（web-data/sessions/<id>/：meta.json + transcript.jsonl + Stylotrace 工作区）──
function sessionDir(id) {
  const root = sessionsRoot(currentMachine());
  const safe = String(id || '').replace(/[^a-z0-9-]/gi, '');
  // 非法/空 id：返回必然不存在的路径（各端点随后走 404），绝不抛异常打崩服务。
  if (!safe) return path.join(root, '__invalid__');
  const dir = path.resolve(root, safe);
  if (!dir.startsWith(path.resolve(root))) return path.join(root, '__invalid__');
  return dir;
}

function readMeta(id) {
  return readJsonSafe(path.join(sessionDir(id), 'meta.json'));
}

function writeMeta(id, meta) {
  const dir = sessionDir(id);
  fs.mkdirSync(dir, { recursive: true });
  meta.updatedAt = ws.nowIso();
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
}

function appendTranscript(id, entry) {
  const dir = sessionDir(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(
    path.join(dir, 'transcript.jsonl'),
    JSON.stringify({ ...entry, ts: ws.nowIso() }) + '\n',
  );
}

function readTranscript(id) {
  try {
    return fs
      .readFileSync(path.join(sessionDir(id), 'transcript.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

function listSessions() {
  const root = sessionsRoot(currentMachine());
  let ids = [];
  try {
    ids = fs.readdirSync(root).filter((f) => f !== '.DS_Store');
  } catch {
    return [];
  }
  return ids
    .map((id) => readMeta(id))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function stateBrief(state, meta) {
  return {
    id: meta.id,
    title: meta.title,
    category: meta.category,
    status: meta.status,
    phase: state.phase || 'clarify',
    stage: state.director?.stage || '',
    topic: state.confirmed?.topic || state.outline?.title || '',
    genre: state.confirmed?.genre || '',
    confirmed: Object.keys(state.confirmed || {}).filter((k) => state.confirmed[k]).length,
    materials: (state.materials || []).length,
    arguments: (state.confirmed?.arguments || []).length,
    outlineTitle: state.outline?.title || '',
    sections: state.outline?.sections?.length || 0,
    hasDraft: fs.existsSync(path.join(sessionDir(meta.id), 'draft.md')),
    styleNote: state.confirmed?.styleNote || '',
    updatedAt: meta.updatedAt,
  };
}

function metaFromState(meta, state) {
  const stage = state.director?.stage || '';
  const phase = state.phase || 'clarify';
  let status = '澄清中';
  if (phase === 'plan' || stage === 'outline') status = '大纲中';
  else if (phase === 'write' || stage === 'write') status = '写作中';
  else if (['revise', 'redteam', 'quality', 'style_fix', 'audience', 'rewrite_gaps'].includes(stage)) status = '打磨中';
  else if (stage === 'deliver') status = '已交付';
  const genre = state.confirmed?.genre || '';
  if (genre && GENRE_CATEGORY[genre]) meta.category = GENRE_CATEGORY[genre];
  if (state.outline?.title && meta.title === '新写作') meta.title = state.outline.title.slice(0, 30);
  meta.status = status;
  return meta;
}

function botText(r) {
  const parts = [];
  if (r.kind === 'ask') {
    parts.push(r.question || '');
    if (r.recommendation) parts.push(`我的建议：${r.recommendation}`);
    if (r.knowledgeSuggestion) parts.push(r.knowledgeSuggestion);
    if (r.dataSuggestion) parts.push(r.dataSuggestion);
    if (r.searchSuggestion) parts.push(r.searchSuggestion);
    if (r.recommendSuggestion) parts.push(r.recommendSuggestion);
    if (r.academicHint) parts.push(r.academicHint);
    if (r.options?.length) parts.push(`选项：${r.options.map((o, i) => `${'ABC'[i]}. ${o}`).join('  ')}`);
  } else {
    parts.push(r.message || '');
  }
  return parts.filter(Boolean).join('\n');
}

function newSession(topic) {
  fs.mkdirSync(sessionsRoot(currentMachine()), { recursive: true });
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const dir = sessionDir(id);
  fs.mkdirSync(dir, { recursive: true });
  ws.ensureWorkspace(dir, { create: true });
  const title = String(topic || '').replace(/\s+/g, ' ').slice(0, 30) || '新写作';
  writeMeta(id, {
    id,
    title,
    category: '',
    status: '澄清中',
    createdAt: ws.nowIso(),
    updatedAt: ws.nowIso(),
  });
  if (topic) appendTranscript(id, { role: 'user', text: String(topic) });
  return id;
}

function safeInside(root, target) {
  const r = path.resolve(root);
  const t = path.resolve(r, String(target || '').replace(/^\/+/, ''));
  return t.startsWith(r + path.sep) || t === r ? t : null;
}

function staticFile(urlPath, res) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = safeInside(PUBLIC, rel);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  const ext = path.extname(file);
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

function sendFile(res, file, name, type) {
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
  });
  const stream = fs.createReadStream(file);
  stream.pipe(res);
  stream.on('end', () => fs.rmSync(file, { force: true }));
  stream.on('error', () => fs.rmSync(file, { force: true }));
}

/** 大纲/成稿 → pptx（python-pptx；零模板，标题行分页）。 */
function exportPptx(mdText, outFile) {
  const tmpMd = path.join(os.tmpdir(), `.stylotrace-ppt-${Date.now()}.md`);
  fs.writeFileSync(tmpMd, mdText);
  try {
    execFileSync(
      'python3',
      [path.join(IO_SCRIPTS, 'write_pptx.py'), tmpMd, path.resolve(outFile)],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
  } finally {
    fs.rmSync(tmpMd, { force: true });
  }
  return path.resolve(outFile);
}

async function runStepAndRespond(res, id, message, quote = null) {
  const dir = sessionDir(id);
  if (!fs.existsSync(path.join(dir, 'protocol', 'state.json'))) {
    return json(res, 404, { error: '会话不存在，请刷新页面' });
  }
  // 引用一并落进对话记录：既让用户回看时知道"当时在回答哪个问题 / 改哪一段"，
  // 也是 agent 侧识别"这句话指向哪里"的依据。
  const q = quote && String(quote.text || '').trim()
    ? { kind: quote.kind === 'text' ? 'text' : 'question', text: String(quote.text).slice(0, 500) }
    : null;
  if (message) appendTranscript(id, { role: 'user', text: String(message), quote: q });
  try {
    const r = await agentStep(currentCfg(), dir, { lastInput: String(message || ''), quote: q });
    const state = ws.readState(dir);
    const meta = metaFromState(readMeta(id) || { id, title: '新写作', createdAt: ws.nowIso() }, state);
    writeMeta(id, meta);
    appendTranscript(id, {
      role: 'bot',
      text: botText(r),
      kind: r.kind,
      outline: r.outline || null,
      draftFile: r.draftFile || '',
    });
    json(res, 200, {
      sessionId: id,
      kind: r.kind,
      question: r.question,
      warn: r.warn || '',
      outlineGap: r.outlineGap || false,
      recommendation: r.recommendation,
      options: r.options,
      knowledgeSuggestion: r.knowledgeSuggestion || '',
      dataSuggestion: r.dataSuggestion || '',
      searchSuggestion: r.searchSuggestion || '',
      recommendSuggestion: r.recommendSuggestion || '',
      academicHint: r.academicHint || '',
      checklist: r.checklist || null,
      liveOutline: r.liveOutline || null,
      message: r.message,
      phase: r.phase,
      outline: r.outline,
      progress: r.progress,
      decision: state.decision || null,
      audience: r.audience,
      draftFile: r.draftFile,
      meta: stateBrief(state, meta),
    });
  } catch (err) {
    json(res, 500, { error: String(err.message || err).slice(0, 300) });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const mid = userNamespace(req, url);
  return machineCtx.run(mid, () => cfgCtx.run(cfgForRequest(req, url), () => handleRequest(req, res, url)));
});

async function handleRequest(req, res, url) {
  const p = url.pathname;

  // ── 鉴权：设置 STYLOTRACE_WEB_PASSWORD 时，所有 /api/* 需登录（health/静态资源除外）──
  const publicPath = p === '/health' || p === '/api/auth/status' || p === '/api/auth/login';
  if (AUTH_PASSWORD && p.startsWith('/api/') && !publicPath && !isAuthed(req)) {
    return json(res, 401, { error: '需要密码' });
  }

  // 公网来源按 IP 限流（本机不限，避免影响本地开发与自动化测试）
  const ip = clientIp(req);
  if (p.startsWith('/api/') && rateLimited(ip)) {
    return json(res, 429, { error: '请求过于频繁，请稍后再试' });
  }

  // 请求体上限：先看 Content-Length，缺失时由 body() 流式兜底
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > MAX_BODY && p.startsWith('/api/')) {
    return json(res, 413, { error: `请求体过大（上限 ${MAX_BODY} 字节）` });
  }

  if (req.method === 'GET' && p === '/api/auth/status') {
    return json(res, 200, { required: Boolean(AUTH_PASSWORD), ok: isAuthed(req) });
  }
  // ── 测连接：拿当前请求的 Key/模型/端点真发一次最小请求 ──
  // 目的很实际：用户在设置里粘完 Key，先点一下就知道对不对，
  // 而不是等到写完一大段才报错——那时代价已经付出了。
  if (req.method === 'POST' && p === '/api/llm/test') {
    const cfg = cfgForRequest(req, url);
    if (!cfg.apiKey) {
      return json(res, 200, { ok: false, error: '没有可用的 Key：请在上方填入你的 API Key' });
    }
    const t0 = Date.now();
    try {
      // 走引擎自己的 chat（不是手写 fetch）：这样超时/重试/推理模型空内容的兜底
      // 与真正写作时完全一致。之前手写 fetch 给推理模型 16 个 token，
      // 全被思考吃掉，结论就成了"连上了但返回空"——那是测法的问题，不是 Key 的问题。
      const reply = String(
        await chatFn(cfg, [{ role: 'user', content: '只回复两个字：可用' }], {
          maxTokens: 128,
          temperature: 0,
        }),
      ).trim();
      const ms = Date.now() - t0;
      return json(res, 200, {
        ok: Boolean(reply),
        ms,
        model: cfg.model,
        reply: reply.slice(0, 40),
        error: reply ? '' : '连上了，但模型返回了空内容',
      });
    } catch (e) {
      return json(res, 200, {
        ok: false,
        ms: Date.now() - t0,
        model: cfg.model,
        error: `连不上：${String(e?.message || e).slice(0, 160)}`,
      });
    }
  }
  if (req.method === 'POST' && p === '/api/auth/login') {
    const { password } = await body(req).catch(() => ({}));
    if (String(password || '') === AUTH_PASSWORD) {
      const token = authToken();
      res.setHeader('Set-Cookie', `${AUTH_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
      return json(res, 200, { ok: true, token });
    }
    return json(res, 401, { error: '密码错误' });
  }
  if (req.method === 'GET' && p === '/health') {
    return json(res, 200, {
      ok: true,
      mode: process.env.STYLOTRACE_MOCK_LLM === '1' ? 'mock' : 'live',
      model: currentCfg().model,
      key: currentCfg().apiKey ? 'configured' : 'missing',
      byok: true,
    });
  }

  if (req.method === 'GET' && (p === '/' || p.startsWith('/assets/'))) {
    staticFile(p, res);
    return;
  }

  // ── 会话管理 ──────────────────────────────────────────
  if (req.method === 'GET' && p === '/api/sessions') {
    // v0.58：会话列表附带各自进度（阶段/大纲节数/素材/风格底稿），
    // 便于"检查项目进展"——每个对话是独立工作流，互不影响。
    const sessions = listSessions().map((m) => {
      try {
        const state = ws.readState(sessionDir(m.id));
        return { ...m, ...stateBrief(state, m) };
      } catch {
        return m;
      }
    });
    return json(res, 200, { sessions });
  }
  if (req.method === 'POST' && p === '/api/start') {
    const { topic, quote } = await body(req);
    const id = newSession(topic || '');
    return runStepAndRespond(res, id, topic || '', quote);
  }
  if (req.method === 'POST' && p === '/api/step') {
    const { sessionId, message, quote } = await body(req);
    return runStepAndRespond(res, String(sessionId || ''), String(message || ''), quote);
  }
  // ── Phase 3：统一认知入口（Web → Application Adapter → CSLA Runtime）──
  // 与 CLI/MCP 同一 adapter；sessionId 用 Web 会话 id，因此跨通道共享同一 canonical state。
  if (req.method === 'POST' && p === '/api/csl/turn') {
    const { sessionId, message, mode } = await body(req);
    const id = String(sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    const r = await cslAdapter.runTask({
      workspace: sessionDir(id),
      sessionId: id,
      input: String(message || ''),
      mode: String(mode || 'auto'),
      channel: 'web',
      llm: makeLlm(currentCfg()),
    });
    appendTranscript(id, { role: 'csl', kind: r.kind, action: r.cognitiveAction, stateVersion: r.stateVersion });
    return json(res, 200, r);
  }
  if (req.method === 'POST' && p === '/api/csl/checkpoint') {
    const { sessionId, answer, input } = await body(req);
    const id = String(sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    const r = await cslAdapter.answerCheckpoint(sessionDir(id), {
      sessionId: id,
      answer: String(answer || ''),
      input: String(input || ''),
      llm: makeLlm(currentCfg()),
    });
    appendTranscript(id, { role: 'csl', kind: r.kind, action: r.cognitiveAction, stateVersion: r.stateVersion });
    return json(res, 200, r);
  }
  if (req.method === 'POST' && p === '/api/csl/action') {
    const { sessionId, action, input } = await body(req);
    const id = String(sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    const r = await cslAdapter.runAction(sessionDir(id), {
      action: String(action || ''),
      input: String(input || ''),
      sessionId: id,
      llm: makeLlm(currentCfg()),
    });
    return json(res, 200, r);
  }
  if (req.method === 'GET' && p === '/api/csl/state') {
    const id = String(url.searchParams.get('sessionId') || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    return json(res, 200, cslAdapter.canonicalSnapshot(sessionDir(id), id));
  }
  // ── 决断卡（创新保护）：标记作者决断 → 冻结 → 写作时逐字保留 ──
  if (req.method === 'POST' && p === '/api/csl/decision') {
    const b = await body(req);
    const id = String(b.sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    const r = decision.addDecision(sessionDir(id), {
      object: b.object, oldDomain: b.oldDomain, newDomain: b.newDomain, link: b.link,
      comparisonSet: b.comparisonSet, expectedEffect: b.expectedEffect,
      counterEvidence: b.counterEvidence, spanText: b.spanText,
    }, { sessionId: id });
    if (!r.ok) {
      const msg = {
        missing_comparison_set: '必须填写「比较集」——没有比较集，新颖性无效',
        missing_span_text: '必须填写要保护的句子',
        missing_object: '必须填写这句话在写什么（对象）',
      }[r.reason] || r.reason;
      return json(res, 400, { error: msg, reason: r.reason });
    }
    return json(res, 200, { ok: true, card: r.card, count: r.count });
  }
  if (req.method === 'GET' && p === '/api/csl/decisions') {
    const id = String(url.searchParams.get('sessionId') || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    return json(res, 200, { items: decision.listDecisions(sessionDir(id)) });
  }
  if (req.method === 'DELETE' && p === '/api/csl/decision') {
    const id = String(url.searchParams.get('sessionId') || '');
    const decisionId = String(url.searchParams.get('decisionId') || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    return json(res, 200, decision.unfreezeDecision(sessionDir(id), decisionId, { sessionId: id }));
  }
  if (req.method === 'POST' && p === '/api/csl/verify') {
    const b = await body(req);
    const id = String(b.sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    return json(res, 200, decision.verifyFrozen(sessionDir(id), String(b.text || '')));
  }
  // ── 可证伪演示（系统自证）：故意制造违规，看是否真被拦住 ──
  if (req.method === 'GET' && p === '/api/csl/falsify') {
    const F = await import(
      pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'csl', 'falsify.js')).href
    );
    return json(res, 200, await F.runFalsification());
  }
  // ── 双色 diff：回答"AI 改了我什么——事实层还是风格层" ──
  if (req.method === 'POST' && p === '/api/csl/dual-diff') {
    const b = await body(req);
    const D = await import(
      pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'csl', 'dual-diff.js')).href
    );
    return json(res, 200, D.dualDiff(String(b.before || ''), String(b.after || '')));
  }
  // ── CADENCE 节奏与气群：零 API 调用，可以随便点 ──
  if (req.method === 'POST' && p === '/api/cadence') {
    const b = await body(req);
    const CD = await import(
      pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'cadence', 'index.js')).href
    );
    const sid = String(b.sessionId || '');
    let text = String(b.text || '');
    // 不传 text 就分析当前成稿——多数人想看的就是自己正在写的东西
    if (!text && sid) {
      const f = path.join(sessionDir(sid), 'draft.md');
      try {
        text = fs.readFileSync(f, 'utf8');
      } catch {}
    }
    if (!text.trim()) return json(res, 200, { ok: false, error: '没有可分析的文本（先写点东西，或把文本传进来）' });
    const mode = String(b.mode || 'report');
    try {
      if (mode === 'meter') {
        return json(res, 200, { ok: true, meter: CD.metricalReport(text, { standard: String(b.standard || 'pingshui') }) });
      }
      const report = CD.analyze(text, { workspace: sid ? sessionDir(sid) : null });
      if (mode === 'ssml') return json(res, 200, { ok: true, ssml: CD.toSsml(report) });
      const suggestions = CD.suggest(report, { lockedSpans: b.lockedSpans || [] });
      if (mode === 'apply') {
        const out = CD.apply(text, suggestions);
        return json(res, 200, { ok: true, text: out.text, applied: out.applied, skipped: out.skipped, total: out.total, effects: out.effects, report: out.report });
      }
      return json(res, 200, {
        ok: true,
        report,
        suggestions,
        prompt: CD.promptFor(report, suggestions),
        text: String(text).slice(0, 200),
      });
    } catch (e) {
      return json(res, 200, { ok: false, error: String(e?.message || e).slice(0, 200) });
    }
  }
  // ── 棱镜三视图：原文 / 事实层 / 风格层；restyle = 只改说法（事实层锁定）──
  if (req.method === 'POST' && p === '/api/csl/prism') {
    const b = await body(req);
    const P = await import(
      pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'csl', 'prism.js')).href
    );
    const w = String(b.sessionId || '') ? sessionDir(String(b.sessionId)) : null;
    return json(res, 200, P.analyzePrism(w, String(b.text || '')));
  }
  if (req.method === 'POST' && p === '/api/csl/prism/restyle') {
    const b = await body(req);
    const P = await import(
      pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'csl', 'prism.js')).href
    );
    const r = await P.restyleOnly({
      text: String(b.text || ''),
      direction: String(b.direction || ''),
      llm: makeLlm(currentCfg()),
    });
    return json(res, 200, r);
  }
  // ── 功能全景：真实可用能力清单 + 当前会话实时状态 ──
  if (req.method === 'GET' && p === '/api/csl/capabilities') {
    const C = await import(
      pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'csl', 'capabilities.js')).href
    );
    const id = String(url.searchParams.get('sessionId') || '');
    const w = id && readMeta(id) ? sessionDir(id) : null;
    return json(res, 200, { capabilities: C.CAPABILITIES, status: C.capabilityStatus(w, { sessionId: id || 'default' }) });
  }
  // ── 状态面板（自包含 HTML）：认知 / 风格 / 作品 / 决断 / 账本 ──
  if (req.method === 'GET' && p === '/api/csl/panel') {
    const P = await import(
      pathToFileURL(path.resolve(HERE, '..', 'agent', 'src', 'csl', 'panel.js')).href
    );
    const id = String(url.searchParams.get('sessionId') || '');
    const w = id && readMeta(id) ? sessionDir(id) : null;
    const html = P.buildPanelHtml(w || sessionDir(id || 'default'), { sessionId: id || 'default' });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
    return;
  }
  if (req.method === 'GET' && p === '/api/session') {
    const id = String(url.searchParams.get('sessionId') || '');
    const meta = readMeta(id);
    if (!meta) return json(res, 404, { error: '会话不存在' });
    const state = ws.readState(sessionDir(id));
    return json(res, 200, { meta: stateBrief(state, meta) });
  }
  if (req.method === 'GET' && p === '/api/context') {
    const id = String(url.searchParams.get('sessionId') || '');
    const dir = sessionDir(id);
    const meta = readMeta(id);
    if (!meta) return json(res, 404, { error: '会话不存在' });
    const state = ws.readState(dir);
    const answerLevels = Array.isArray(state.answerLevels) ? state.answerLevels.slice(-10) : [];
    const answerStats = { L0: 0, L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 };
    for (const a of state.answerLevels || []) answerStats['L' + a.level] = (answerStats['L' + a.level] || 0) + 1;
    const sections = state.outline?.sections || [];
    const lo = state.liveOutline;
    return json(res, 200, {
      id,
      phase: state.phase || 'clarify',
      stage: state.director?.stage || '',
      decision: state.decision || null,
      status: meta.status,
      title: meta.title,
      category: meta.category,
      intent: state.intent || null,
      thinking: thinkingBrief(state),
      pulses: recentPulses(dir, { limit: 6 }).map((p) => ({
        phase: p.phase,
        score: p.score,
        summary: p.summary || '',
        suggestion: p.suggestion || '',
      })),
      blueprint: state.blueprint || null,
      checklist: checklistOf(state),
      confirmed: state.confirmed || {},
      materials: (state.materials || []).slice(-8),
      styleProgress: styleProgress(dir),
      styleNote: state.confirmed?.styleNote || '',
      answerLevels,
      answerStats,
      hasDraft: fs.existsSync(path.join(dir, 'draft.md')),
      outline: state.outline
        ? {
            title: state.outline.title,
            parts: Array.isArray(state.outline.parts) ? state.outline.parts : null,
            sections: sections.map((s) => ({
              heading: s.heading,
              function: s.function,
              thesis: s.thesis || '',
              words: s.words,
              keyPoints: s.keyPoints || [],
              materials: s.materials || [],
            })),
          }
        : null,
      progress: {
        done: state.director?.writeIndex || 0,
        total: sections.length,
      },
      targetWords: Number(state.confirmed?.targetWords) || 0,
      seeds: Array.isArray(state.seeds) ? state.seeds.slice(-8) : [],
      constraints: Array.isArray(state.constraints) ? state.constraints.slice(-8) : [],
      coreThesis: state.coreThesis || '',
      overflowLog: Array.isArray(state.overflowLog) ? state.overflowLog.slice(-6) : [],
      liveOutline: lo || null,
      outlineComplete: Boolean(lo?.complete),
      outlineConfirmed: Boolean(state.confirmed?.outlineConfirmed),
      rag: ragStatus(dir, currentCfg()),
    });
  }
  if (req.method === 'POST' && p === '/api/outline') {
    const { sessionId, outline } = await body(req);
    const dir = sessionDir(String(sessionId || ''));
    if (!fs.existsSync(path.join(dir, 'protocol', 'state.json'))) {
      return json(res, 404, { error: '会话不存在' });
    }
    const state = ws.readState(dir);
    const secs = Array.isArray(outline?.sections) ? outline.sections : [];
    const sanitized = secs
      .slice(0, 12)
      .map((s) => ({
        heading: String(s?.heading || '').trim().slice(0, 40) || '未命名节',
        function: String(s?.function || '').trim().slice(0, 16),
        thesis: String(s?.thesis || '').trim().slice(0, 120),
        words: Number(s?.words) > 0 ? Math.min(Number(s.words), 2000) : 0,
        keyPoints: Array.isArray(s?.keyPoints)
          ? s.keyPoints.map((k) => String(k).trim().slice(0, 80)).filter(Boolean).slice(0, 6)
          : [],
        materials: Array.isArray(s?.materials)
          ? s.materials.map((m) => String(m).trim().slice(0, 80)).filter(Boolean).slice(0, 4)
          : [],
      }))
      .filter((s) => s.heading);
    const prev = state.liveOutline || {};
    const liveSections = sanitized.length ? sanitized : prev.sections || [];
    const progress = outlineProgress({ title: prev.title || '', sections: liveSections }, state);
    // 卷级分组（v0.42）：只做展示分组；heading 必须存在于当前节列表，未分组节自动收尾
    const validHeadings = new Set(liveSections.map((s) => s.heading));
    const rawParts = Array.isArray(outline?.parts) ? outline.parts : prev.parts || [];
    const parts = rawParts
      .map((p, i) => ({
        title: String(p?.title || `第 ${i + 1} 卷`).trim().slice(0, 40),
        sections: (Array.isArray(p?.sections) ? p.sections : [])
          .map((h) => String(h || '').trim())
          .filter((h) => validHeadings.has(h)),
      }))
      .filter((p) => p.sections.length > 0)
      .slice(0, 8);
    const grouped = new Set(parts.flatMap((p) => p.sections));
    const ungrouped = liveSections.map((s) => s.heading).filter((h) => !grouped.has(h));
    if (ungrouped.length) parts.push({ title: '未分组', sections: ungrouped });
    state.liveOutline = {
      title: String(outline?.title || state.confirmed?.topic || prev.title || '').trim().slice(0, 40),
      sections: liveSections,
      parts: parts.length ? parts : null,
      complete: Boolean(prev.complete),
      progress,
      updatedAt: ws.nowIso(),
    };
    // 编辑已即时生效，不扰动确认流程：完成度判定会自然决定下一问（缺口/确认）。
    ws.writeState(dir, state);
    ws.logContext(dir, 'outline', `用户手动编辑实时大纲（${state.liveOutline.sections.length} 节）`);
    return json(res, 200, { ok: true, liveOutline: state.liveOutline });
  }

  // ── RAG：待检索查询 / 联网检索 / 资料回灌（补齐 Web 与 agent+codex 的检索闭环）──
  if (req.method === 'GET' && p === '/api/rag/needs') {
    const id = String(url.searchParams.get('sessionId') || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    return json(res, 200, { pending: pendingDataNeeds(sessionDir(id)) });
  }
  if (req.method === 'POST' && p === '/api/rag/search') {
    const { sessionId, query } = await body(req);
    const id = String(sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    const dir = sessionDir(id);
    const pending = pendingDataNeeds(dir);
    const queries = (
      query
        ? [String(query).slice(0, 120)]
        : pending.flatMap((r) => r.queries || [])
    )
      .filter(Boolean)
      .slice(0, 6);
    if (!queries.length) {
      return json(res, 400, {
        error: '没有待检索的查询，也没有提供 query',
        hint: '可以直接把资料粘贴进"资料回灌"输入框。',
      });
    }
    const out = await searchOnline(currentCfg(), queries);
    if (!out.searched) {
      return json(res, 400, { error: '未配置检索端点或检索失败', hint: out.hint || '', queries });
    }
    try {
      const ing = ingestSearchResults(dir, out.results);
      return json(res, 200, { ok: true, ingested: ing.ingested, queries });
    } catch (err) {
      return json(res, 400, { error: String(err.message || err).slice(0, 200) });
    }
  }
  if (req.method === 'POST' && p === '/api/rag/ingest') {
    const { sessionId, results, text } = await body(req);
    const id = String(sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    const dir = sessionDir(id);
    let items = Array.isArray(results) ? results : [];
    if (!items.length && typeof text === 'string' && text.trim()) {
      const pending = pendingDataNeeds(dir);
      items = [
        {
          query: pending[0]?.queries?.[0] || '资料回灌',
          results: [
            { title: '用户粘贴资料', source: '手动回灌', snippet: text.slice(0, 8000) },
          ],
        },
      ];
    }
    if (!items.length) return json(res, 400, { error: '缺少 results 或 text' });
    try {
      const r = ingestSearchResults(dir, items);
      return json(res, 200, { ok: true, ingested: r.ingested, cached: r.cached });
    } catch (err) {
      return json(res, 400, { error: String(err.message || err).slice(0, 200) });
    }
  }

  // ── 多模态输入：文件上传（base64 → 会话 uploads → 提取成素材）──
  if (req.method === 'POST' && p === '/api/upload') {
    const { sessionId, filename, dataBase64 } = await body(req);
    const id = String(sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    if (typeof dataBase64 !== 'string' || !dataBase64) {
      return json(res, 400, { error: '缺少 dataBase64' });
    }
    const b64 = dataBase64.includes(',') ? dataBase64.slice(dataBase64.indexOf(',') + 1) : dataBase64;
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length || buf.length > 20 * 1024 * 1024) {
      return json(res, 400, { error: '文件为空或超过 20MB' });
    }
    const dir = sessionDir(id);
    const upDir = path.join(dir, 'uploads');
    fs.mkdirSync(upDir, { recursive: true });
    const safe =
      path
        .basename(String(filename || 'upload.bin'))
        .replace(/[^\w.\u4e00-\u9fa5-]/g, '_')
        .slice(0, 80) || 'upload.bin';
    const file = path.join(upDir, `${Date.now()}-${safe}`);
    fs.writeFileSync(file, buf);
    const state = ws.readState(dir);
    const ing = await extractInput(file, currentCfg());
    if (ing.kind === 'text' && ing.text) {
      state.materials = state.materials || [];
      state.materials.push(`[文件 ${safe}] ${ing.text.slice(0, 2000)}`);
      ws.writeState(dir, state);
      ws.logContext(dir, 'ingest', `Web 上传 ${safe}（${ing.source || 'text'}，${ing.text.length} 字）→ 素材`);
    } else {
      ws.logContext(dir, 'ingest', `Web 上传 ${safe}：${ing.hint || '未提取'}`);
    }
    return json(res, 200, {
      ok: true,
      file: safe,
      kind: ing.kind,
      text: ing.kind === 'text' ? (ing.text || '').slice(0, 500) : '',
      hint: ing.hint || '',
      source: ing.source || '',
    });
  }

  // ── 句子级点改：选中原文 → AI 只改这一句 → 吸收进风格档案 ──
  if (req.method === 'POST' && p === '/api/point-edit') {
    const { sessionId, quote, instruction, replacement } = await body(req);
    const id = String(sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    if (!String(quote || '').trim()) return json(res, 400, { error: '请先选中要改写的原文' });
    if (!String(instruction || '').trim()) return json(res, 400, { error: '缺少修改指令' });
    const dir = sessionDir(id);
    const draftFile = path.join(dir, 'draft.md');
    if (!fs.existsSync(draftFile)) return json(res, 400, { error: '还没有成稿，无法定点修改' });
    try {
      const out = await pointEdit(currentCfg(), dir, {
        quote: String(quote),
        instruction: String(instruction),
        replacement: typeof replacement === 'string' ? replacement : undefined,
        dir,
        file: draftFile,
      });
      return json(res, 200, { ok: true, ...out });
    } catch (err) {
      return json(res, 400, { error: String(err.message || err).slice(0, 300) });
    }
  }

  // ── 批注（v0.61）：选段批注 → 落库 → 查看/删除 → 一键 AI 按批注修改 ──
  const annFile = (dir) => path.join(dir, 'vault', 'annotations.jsonl');
  const readAnn = (dir) => {
    try {
      return fs
        .readFileSync(annFile(dir), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  };
  const writeAnn = (dir, list) => {
    fs.mkdirSync(path.join(dir, 'vault'), { recursive: true });
    fs.writeFileSync(annFile(dir), list.map((a) => JSON.stringify(a)).join('\n') + (list.length ? '\n' : ''));
  };
  if (req.method === 'POST' && p === '/api/annotations') {
    const { sessionId = '', file = 'draft.md', quote = '', comment = '' } = await body(req);
    const id = String(sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    if (!String(quote || '').trim() || !String(comment || '').trim()) {
      return json(res, 400, { error: '缺少选中原文或批注内容' });
    }
    const dir = sessionDir(id);
    const list = readAnn(dir);
    const entry = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      ts: ws.nowIso(),
      file: String(file).slice(0, 120),
      quote: String(quote).slice(0, 300),
      comment: String(comment).slice(0, 600),
      status: 'open',
    };
    list.push(entry);
    writeAnn(dir, list);
    return json(res, 200, { ok: true, annotation: entry });
  }
  if (req.method === 'GET' && p === '/api/annotations') {
    const id = String(url.searchParams.get('sessionId') || '');
    const file = String(url.searchParams.get('file') || '');
    const dir = sessionDir(id);
    let list = readAnn(dir);
    if (file) list = list.filter((a) => a.file === file);
    return json(res, 200, { annotations: list.sort((a, b) => String(a.ts).localeCompare(String(b.ts))) });
  }
  if (req.method === 'DELETE' && p === '/api/annotations') {
    const { sessionId = '', id: annId = '' } = await body(req);
    const dir = sessionDir(String(sessionId || ''));
    const list = readAnn(dir).filter((a) => a.id !== annId);
    writeAnn(dir, list);
    return json(res, 200, { ok: true, removed: annId });
  }
  if (req.method === 'POST' && p === '/api/annotations/apply') {
    const { sessionId = '' } = await body(req);
    const id = String(sessionId || '');
    const dir = sessionDir(id);
    if (!fs.existsSync(path.join(dir, 'draft.md'))) return json(res, 400, { error: '还没有成稿，无法按批注修改' });
    const list = readAnn(dir);
    const draftFile = path.join(dir, 'draft.md');
    const applied = [];
    const failed = [];
    for (const a of list) {
      if (a.status === 'done' || (a.file && a.file !== 'draft.md')) continue;
      const attempts = [a.quote, `**${a.quote}**`, `\`${a.quote}\``];
      let out = null;
      for (const q of attempts) {
        try {
          out = await pointEdit(currentCfg(), dir, { quote: q, instruction: a.comment, dir, file: draftFile });
          break;
        } catch (e) {
          out = null;
        }
      }
      if (out) {
        a.status = 'done';
        applied.push({ id: a.id, quote: a.quote.slice(0, 60) });
      } else {
        failed.push({ id: a.id, quote: a.quote.slice(0, 60), error: '未在原文中找到该片段，或修改失败' });
      }
    }
    writeAnn(dir, list);
    return json(res, 200, { ok: true, applied, failed, total: applied.length + failed.length });
  }

  // ── 候选改写（v0.46）：选中片段 → 3 个方向不同的候选（不落盘）──
  if (req.method === 'POST' && p === '/api/rewrite') {
    const { sessionId, quote, instruction } = await body(req);
    const id = String(sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    if (!String(quote || '').trim() || !String(instruction || '').trim()) {
      return json(res, 400, { error: '缺少选中原文或修改指令' });
    }
    const dir = sessionDir(id);
    const draftFile = path.join(dir, 'draft.md');
    if (!fs.existsSync(draftFile)) return json(res, 400, { error: '还没有成稿，无法改写' });
    try {
      const out = await rewriteVariants(currentCfg(), dir, {
        quote: String(quote),
        instruction: String(instruction),
        dir,
        file: draftFile,
      });
      return json(res, 200, { ok: true, ...out });
    } catch (err) {
      return json(res, 400, { error: String(err.message || err).slice(0, 300) });
    }
  }

  // ── 版本历史 / 回滚（v0.46）：每次 AI 改动都可回退 ──
  if (req.method === 'GET' && p === '/api/history') {
    const id = String(url.searchParams.get('sessionId') || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    return json(res, 200, { entries: listHistory(sessionDir(id)) });
  }
  if (req.method === 'POST' && p === '/api/rollback') {
    const { sessionId, index } = await body(req);
    const id = String(sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    try {
      const r = rollback(sessionDir(id), { index: Number(index || 1) });
      return json(res, 200, { ok: true, reason: r.reason, ts: r.ts, chars: r.chars });
    } catch (err) {
      return json(res, 400, { error: String(err.message || err).slice(0, 300) });
    }
  }

  // ── 回译校验（内容保真 + 风格对比）：一键入口 ──
  if (req.method === 'POST' && p === '/api/roundtrip') {
    const { sessionId } = await body(req);
    const id = String(sessionId || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    const dir = sessionDir(id);
    if (!fs.existsSync(path.join(dir, 'draft.md'))) {
      return json(res, 400, { error: '还没有成稿，无法回译校验' });
    }
    try {
      const r = await roundtripCheck(currentCfg(), dir, {});
      return json(res, 200, {
        ok: true,
        verdict: r.verdict,
        content: r.content,
        style: r.style,
        report: renderRoundtrip(r),
      });
    } catch (err) {
      return json(res, 500, { error: String(err.message || err).slice(0, 300) });
    }
  }
  if (req.method === 'GET' && p === '/api/overview') {
    const sessions = listSessions();
    let works = 0;
    let drafts = 0;
    let knowledge = 0;
    const byCat = {};
    for (const meta of sessions) {
      const dir = sessionDir(meta.id);
      const index = readJsonSafe(path.join(dir, 'vault', 'library', 'index.json'));
      for (const piece of index?.pieces || []) {
        works += 1;
        byCat[piece.category] = (byCat[piece.category] || 0) + 1;
      }
      try {
        knowledge += listEntries(dir).length;
      } catch {}
      if (fs.existsSync(path.join(dir, 'draft.md'))) drafts += 1;
    }
    return json(res, 200, { sessions: sessions.length, works, drafts, knowledge, byCat, recent: sessions.slice(0, 5) });
  }
  if (req.method === 'PATCH' && p === '/api/session') {
    const { sessionId, title, category } = await body(req);
    const meta = readMeta(String(sessionId || ''));
    if (!meta) return json(res, 404, { error: '会话不存在' });
    if (typeof title === 'string' && title.trim()) meta.title = title.trim().slice(0, 40);
    if (typeof category === 'string' && category.trim()) meta.category = category.trim().slice(0, 20);
    writeMeta(meta.id, meta);
    return json(res, 200, { ok: true, meta });
  }
  if (req.method === 'DELETE' && p === '/api/session') {
    const { sessionId } = await body(req);
    const dir = sessionDir(String(sessionId || ''));
    if (!fs.existsSync(dir)) return json(res, 404, { error: '会话不存在' });
    fs.rmSync(dir, { recursive: true, force: true });
    return json(res, 200, { ok: true, removed: sessionId });
  }
  if (req.method === 'GET' && p === '/api/transcript') {
    const id = String(url.searchParams.get('sessionId') || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    return json(res, 200, { entries: readTranscript(id) });
  }
  if (req.method === 'GET' && p === '/api/draft') {
    const id = String(url.searchParams.get('sessionId') || '');
    const dir = sessionDir(id);
    try {
      return json(res, 200, { text: fs.readFileSync(path.join(dir, 'draft.md'), 'utf8') });
    } catch {
      return json(res, 200, { text: '' });
    }
  }
  if (req.method === 'POST' && p === '/api/save-draft') {
    const { sessionId, text } = await body(req);
    const dir = sessionDir(String(sessionId || ''));
    if (!fs.existsSync(path.join(dir, 'protocol', 'state.json'))) {
      return json(res, 404, { error: '会话不存在' });
    }
    fs.writeFileSync(path.join(dir, 'draft.md'), String(text ?? ''));
    const meta = readMeta(sessionId);
    if (meta) writeMeta(meta.id, meta);
    return json(res, 200, { ok: true });
  }

  // ── 风格肖像 / 知识库 / 作品库 ────────────────────────
  if (req.method === 'GET' && p === '/api/style') {
    const id = String(url.searchParams.get('sessionId') || '');
    const dir = sessionDir(id);
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    const state = ws.readState(dir);
    return json(res, 200, {
      write: readJsonSafe(path.join(dir, 'vault', 'write-style.json')),
      read: readJsonSafe(path.join(dir, 'vault', 'read-style.json')),
      vector: readVector(dir),
      vectorSummary: vectorSummary(dir) || null,
      persona: readPersona(dir),
      progress: styleProgress(dir),
      styleNote: state.confirmed?.styleNote || '',
    });
  }
  if (req.method === 'GET' && p === '/api/modulator') {
    const id = String(url.searchParams.get('sessionId') || '');
    const dir = sessionDir(id);
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    const state = ws.readState(dir);
    const status = modulatorStatus(dir);
    const draftPath = path.join(dir, 'draft.md');
    const draft = fs.existsSync(draftPath) ? fs.readFileSync(draftPath, 'utf8').slice(0, 4000) : '';
    let breakdown = null;
    if (draft) {
      const m = modulate(dir, draft, { t: 0.5 });
      breakdown = {
        mode: m.mode,
        trained: m.trained,
        rationale: m.rationale || '',
        contributions: (m.contributions || []).map((c) => ({
          feature: c.feature,
          weight: Number(c.weight),
          value: Number(c.value),
          contrib: Number(c.contrib),
        })),
      };
    }
    return json(res, 200, { ...status, breakdown, lastDecode: state.lastDecode || null });
  }
  if (req.method === 'GET' && p === '/api/knowledge') {
    const id = String(url.searchParams.get('sessionId') || '');
    if (id) {
      if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
      return json(res, 200, { entries: listEntries(sessionDir(id)) });
    }
    // 个人知识库聚合视图（v0.58）：跨会话按标题去重合并，作为"你的个人知识库"。
    const byTitle = new Map();
    for (const s of listSessions()) {
      for (const e of listEntries(sessionDir(s.id))) {
        const key = normTitle(e.title);
        const prev = byTitle.get(key);
        if (!prev || Number(e.confidence || 0) > Number(prev.confidence || 0)) {
          byTitle.set(key, { ...e, sessionId: s.id });
        }
      }
    }
    return json(res, 200, { entries: [...byTitle.values()], shared: true });
  }
  if (req.method === 'DELETE' && p === '/api/knowledge') {
    const { sessionId, id } = await body(req);
    if (!readMeta(String(sessionId || ''))) return json(res, 404, { error: '会话不存在' });
    try {
      removeEntry(sessionDir(String(sessionId)), String(id || ''));
      return json(res, 200, { ok: true });
    } catch (err) {
      return json(res, 400, { error: String(err.message || err) });
    }
  }
  if (req.method === 'GET' && p === '/api/works') {
    const works = [];
    for (const meta of listSessions()) {
      const dir = sessionDir(meta.id);
      const index = readJsonSafe(path.join(dir, 'vault', 'library', 'index.json'));
      for (const piece of index?.pieces || []) {
        let chars = 0;
        try {
          chars = fs
            .readFileSync(path.join(dir, piece.file), 'utf8')
            .replace(/\s/g, '')
            .length;
        } catch {}
        works.push({
          sessionId: meta.id,
          sessionTitle: meta.title,
          file: piece.file,
          title: piece.title,
          category: piece.category,
          ts: piece.ts,
          source: piece.source || '',
          chars,
          draftOnly: false,
        });
      }
      if (fs.existsSync(path.join(dir, 'draft.md')) && !(index?.pieces || []).some((x) => x.source === 'draft.md')) {
        const state = ws.readState(dir);
        works.push({
          sessionId: meta.id,
          sessionTitle: meta.title,
          file: 'draft.md',
          title: state.outline?.title || state.confirmed?.topic || meta.title || '进行中的草稿',
          category: meta.category || '进行中',
          ts: meta.updatedAt,
          source: 'draft.md',
          draftOnly: true,
        });
      }
    }
    works.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')));
    return json(res, 200, { works });
  }
  // ── 作品同步 / 导入 / 管理（v0.60：全流程互操作）────────────────
  if (req.method === 'POST' && p === '/api/works/import') {
    const { sessionId = '', title = '', text = '', dataBase64 = '', filename = 'import.md', source = 'import' } = await body(req);
    let id = String(sessionId || '');
    if (!id || !fs.existsSync(sessionDir(id))) id = newSession(title || '作品库');
    const dir = sessionDir(id);
    let content = String(text || '');
    if (!content && dataBase64) content = Buffer.from(String(dataBase64), 'base64').toString('utf8');
    if (!content.trim()) return json(res, 400, { error: '没有可导入的内容' });
    if (!importWork) return json(res, 500, { error: 'library 模块不可用' });
    const r = importWork(dir, {
      title: title || String(filename || 'import.md').replace(/\.(docx|md|txt)$/i, ''),
      text: content,
      source,
    });
    try {
      const index = readJsonSafe(path.join(dir, 'vault', 'library', 'index.json'));
      if (index?.pieces) {
        for (const piece of index.pieces) if (r.pieces.some((x) => x.file === piece.file)) piece.session = id;
        fs.writeFileSync(path.join(dir, 'vault', 'library', 'index.json'), JSON.stringify(index, null, 2));
      }
    } catch {}
    return json(res, 200, {
      ok: true,
      sessionId: id,
      parts: r.parts,
      pieces: r.pieces.map((x) => ({ file: x.file, title: x.title, category: x.category })),
    });
  }
  if (req.method === 'POST' && p === '/api/works/sync') {
    let synced = 0;
    for (const meta of listSessions()) {
      const dir = sessionDir(meta.id);
      const draft = path.join(dir, 'draft.md');
      if (!fs.existsSync(draft) || !addPiece) continue;
      const index = readJsonSafe(path.join(dir, 'vault', 'library', 'index.json'));
      const existing = (index?.pieces || []).find((x) => x.source === 'draft.md');
      if (existing && fs.existsSync(path.join(dir, 'vault', 'library', existing.file))) continue;
      try {
        const state = ws.readState(dir);
        addPiece(dir, {
          title: state?.confirmed?.topic || state?.outline?.title || meta.title || '未命名作品',
          text: fs.readFileSync(draft, 'utf8'),
          source: 'draft.md',
          session: meta.id,
        });
        synced += 1;
      } catch {}
    }
    return json(res, 200, { ok: true, synced });
  }
  if (req.method === 'POST' && p === '/api/work') {
    const { sessionId = '', file = '', title = '', category = '' } = await body(req);
    const dir = sessionDir(String(sessionId));
    const indexFile = path.join(dir, 'vault', 'library', 'index.json');
    const index = readJsonSafe(indexFile);
    if (!index) return json(res, 404, { error: '作品索引不存在' });
    const piece = (index.pieces || []).find((x) => x.file === file);
    if (!piece) return json(res, 404, { error: '作品不存在' });
    if (title) piece.title = String(title).slice(0, 60);
    if (category) piece.category = String(category).slice(0, 20);
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
    return json(res, 200, { ok: true, piece });
  }
  if (req.method === 'DELETE' && p === '/api/work') {
    const { sessionId = '', file = '' } = await body(req);
    const dir = sessionDir(String(sessionId));
    const indexFile = path.join(dir, 'vault', 'library', 'index.json');
    const index = readJsonSafe(indexFile);
    if (!index) return json(res, 404, { error: '作品索引不存在' });
    index.pieces = (index.pieces || []).filter((x) => x.file !== file);
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
    const full = safeInside(dir, path.join('vault', 'library', String(file)));
    if (full && fs.existsSync(full)) fs.rmSync(full, { force: true });
    return json(res, 200, { ok: true, removed: file });
  }
  if (req.method === 'POST' && p === '/api/import-draft') {
    const { sessionId = '', title = '', text = '', dataBase64 = '', filename = 'draft.md' } = await body(req);
    const id = String(sessionId || '');
    const dir = sessionDir(id);
    if (!fs.existsSync(path.join(dir, 'protocol', 'state.json'))) return json(res, 404, { error: '会话不存在' });
    let content = String(text || '');
    if (!content && dataBase64) content = Buffer.from(String(dataBase64), 'base64').toString('utf8');
    if (!content.trim()) return json(res, 400, { error: '没有可导入的内容' });
    fs.writeFileSync(path.join(dir, 'draft.md'), content);
    const meta = readMeta(id) || { id, title: '新写作', createdAt: ws.nowIso() };
    meta.title = String(title || meta.title || filename.replace(/\.(docx|md|txt)$/i, '')).slice(0, 40);
    meta.status = '已导入草稿';
    meta.updatedAt = ws.nowIso();
    writeMeta(id, meta);
    appendTranscript(id, {
      role: 'bot',
      text: `已导入草稿（${content.replace(/\s/g, '').length} 字），可直接审计/导出/继续改写。`,
      kind: 'working',
    });
    return json(res, 200, { ok: true, chars: content.replace(/\s/g, '').length, title: meta.title });
  }
  // ── 多作品对比（v0.48，P2）：两篇作品的人类化指标并排 ──
  if (req.method === 'GET' && p === '/api/works/compare') {
    const read = (id, f) => {
      try {
        return fs.readFileSync(path.join(sessionDir(String(id || '')), String(f || '')), 'utf8');
      } catch {
        return '';
      }
    };
    const t1 = read(url.searchParams.get('sessionId'), url.searchParams.get('file'));
    const t2 = read(url.searchParams.get('sessionId2'), url.searchParams.get('file2'));
    return json(res, 200, {
      a: { ...humanMetrics(t1), chars: t1.replace(/\s/g, '').length },
      b: { ...humanMetrics(t2), chars: t2.replace(/\s/g, '').length },
    });
  }
  if (req.method === 'GET' && p === '/api/work') {
    const id = String(url.searchParams.get('sessionId') || '');
    const dir = sessionDir(id);
    const file = safeInside(dir, String(url.searchParams.get('file') || ''));
    if (!file || !fs.existsSync(file)) return json(res, 404, { error: '作品不存在' });
    return json(res, 200, {
      text: fs.readFileSync(file, 'utf8'),
      title: path.basename(file),
    });
  }

  // ── 导出 md / docx / pptx ────────────────────────────
  if (req.method === 'GET' && p === '/api/export') {
    const id = String(url.searchParams.get('sessionId') || '');
    const fmt = String(url.searchParams.get('fmt') || 'md');
    const what = String(url.searchParams.get('what') || 'draft');
    const dir = sessionDir(id);
    const meta = readMeta(id);
    if (!meta) return json(res, 404, { error: '会话不存在' });
    const draft = path.join(dir, 'draft.md');
    const fileParam = url.searchParams.get('file');
    const srcFile = fileParam ? safeInside(dir, String(fileParam)) : null;
    let mdText = '';
    if (what === 'outline') {
      const state = ws.readState(dir);
      const o = state.outline || state.liveOutline || {};
      mdText = `# ${o.title || meta.title || '大纲'}\n\n${
        (o.sections || [])
          .map((s, i) => `## ${i + 1}. ${s.heading}${s.thesis ? `｜${s.thesis}` : ''}\n\n${(s.keyPoints || []).map((k) => `- ${k}`).join('\n')}`)
          .join('\n\n')
      }\n`;
    } else if (what === 'report') {
      for (const f of ['norm-report.md', 'redteam-report.md', 'report.md']) {
        const rf = path.join(dir, 'vault', f);
        if (fs.existsSync(rf)) {
          mdText = fs.readFileSync(rf, 'utf8');
          break;
        }
      }
    } else if (what === 'style') {
      const w = readJsonSafe(path.join(dir, 'vault', 'write-style.json')) || {};
      const r = readJsonSafe(path.join(dir, 'vault', 'read-style.json')) || {};
      const dimLines = (obj) =>
        Object.entries(obj.dimensions || {})
          .filter(([, d]) => d && d.value)
          .map(([k, d]) => `- ${k}：${d.value}（置信 ${Math.round((Number(d.confidence) || 0) * 100)}%）`);
      mdText = ['# 风格肖像', '', '## write（人想写的）', '', ...dimLines(w), '', '## read（人想听的）', '', ...dimLines(r), ''].join('\n');
    } else if (what === 'knowledge') {
      mdText = ['# 个人知识库', '']
        .concat(
          listEntries(dir).map(
            (e) =>
              `## ${e.title}\n- 类型：${e.type}\n- 来源：${e.source}\n- 置信：${Math.round((e.confidence || 0) * 100)}%\n- 标签：${(e.tags || []).join('、') || '—'}\n${e.note ? `\n${e.note}\n` : ''}`,
          ),
        )
        .join('\n');
    } else {
      mdText = srcFile && fs.existsSync(srcFile)
        ? fs.readFileSync(srcFile, 'utf8')
        : fs.existsSync(draft)
        ? fs.readFileSync(draft, 'utf8')
        : (() => {
            const state = ws.readState(dir);
            if (!state.outline?.title) return '';
            const o = state.outline;
            return `# ${o.title}\n\n${(o.sections || [])
              .map((s, i) => `## ${i + 1}. ${s.heading}\n\n${(s.keyPoints || []).join('\n')}`)
              .join('\n\n')}\n`;
          })();
    }
    if (!mdText.trim()) return json(res, 400, { error: '还没有成稿或大纲，无法导出' });
    const base = `${meta.title || 'stylotrace'}-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === 'md') {
      const f = path.join(os.tmpdir(), `${base}.md`);
      fs.writeFileSync(f, mdText);
      return sendFile(res, f, `${base}.md`, 'text/markdown; charset=utf-8');
    }
    if (fmt === 'docx') {
      if (!docxAvailable()) return json(res, 400, { error: '本机没有 python-docx，请先导出 md' });
      try {
        const f = exportDocx(mdText, path.join(os.tmpdir(), `${base}.docx`));
        return sendFile(res, f, `${base}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      } catch (err) {
        return json(res, 500, { error: String(err.message || err) });
      }
    }
    if (fmt === 'pptx') {
      try {
        const f = exportPptx(mdText, path.join(os.tmpdir(), `${base}.pptx`));
        return sendFile(res, f, `${base}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      } catch (err) {
        return json(res, 500, { error: `导出 pptx 失败（${String(err.message || err).slice(0, 160)}），可先导出 md` });
      }
    }
    return json(res, 400, { error: '不支持的格式：md / docx / pptx' });
  }

  // ── 审计报告（保留） ──────────────────────────────────
  if (req.method === 'GET' && p === '/api/report') {
    const id = String(url.searchParams.get('sessionId') || '');
    const dir = sessionDir(id);
    try {
      const text = fs.readFileSync(path.join(dir, 'draft.md'), 'utf8');
      const m = humanMetrics(text);
      const state = ws.readState(dir);
      const issues = [];
      if (m.blacklistHits > 0) issues.push(`检出 ${m.blacklistHits} 处黑名单套话，已按你的风格修订`);
      if (m.repeatedMetaphors > 0) issues.push(`检出 ${m.repeatedMetaphors} 处重复比喻，已改为不同的意象`);
      if (m.repeatedPatterns > 0) issues.push(`检出 ${m.repeatedPatterns} 处句式复用，已调整节奏`);
      if (!issues.length) issues.push('未发现硬伤（黑名单 0 · 硬失败 0），人类化指标均在真人参考区间');
      return json(res, 200, {
        metrics: m,
        issues,
        passed: m.passed,
        roundtrip: state.quality?.roundtrip || null,
        fakeThinking: state.quality?.fakeThinking || null,
      });
    } catch {
      return json(res, 200, { metrics: {}, issues: ['（尚无成稿可审计）'], passed: false });
    }
  }

  // ── 节奏曲线 / 伏笔回收（v0.41：行业对齐——节奏分析 + 跨章一致性）──
  if (req.method === 'GET' && p === '/api/curve') {
    const id = String(url.searchParams.get('sessionId') || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    const c = rhythmCurve(sessionDir(id));
    return json(res, 200, { sections: c.sections, note: c.note || '', file: c.file || '' });
  }
  if (req.method === 'GET' && p === '/api/consistency') {
    const id = String(url.searchParams.get('sessionId') || '');
    if (!readMeta(id)) return json(res, 404, { error: '会话不存在' });
    try {
      const r = await checkConsistency(currentCfg(), sessionDir(id));
      return json(res, 200, r);
    } catch (e) {
      return json(res, 200, { score: 100, total: 0, recovered: [], unrecovered: [], note: String(e.message || '校验失败') });
    }
  }

  // ── 工具：学术规范审计 / 文档翻译 / 文档重写（v0.56）──
  if (req.method === 'POST' && p === '/api/norm') {
    const { sessionId } = await body(req);
    const dir = sessionDir(String(sessionId || ''));
    if (!fs.existsSync(path.join(dir, 'draft.md'))) {
      return json(res, 400, { error: '该会话还没有成稿，无法执行学术规范审计' });
    }
    let genre = '';
    try {
      genre = ws.readState(dir)?.confirmed?.genre || '';
    } catch {}
    const r = await academicNorm(currentCfg(), dir, { genre });
    return json(res, 200, {
      score: r.score,
      items: r.items,
      summary: r.summary,
      llmMode: r.llmMode,
      reason: r.llmReason || '',
    });
  }
  if (req.method === 'POST' && (p === '/api/doc/translate' || p === '/api/doc/restyle')) {
    const { sessionId = '', filename = 'upload.md', dataBase64 = '', lang = 'en', style = '' } = await body(req);
    const dir = sessionDir(String(sessionId || ''));
    fs.mkdirSync(dir, { recursive: true });
    const upDir = path.join(dir, 'uploads');
    fs.mkdirSync(upDir, { recursive: true });
    const name = path.basename(String(filename || 'upload.md')).slice(0, 80) || 'upload.md';
    const src = path.join(upDir, `tool-${Date.now()}-${name}`);
    fs.writeFileSync(src, Buffer.from(String(dataBase64 || ''), 'base64'));
    const toolsDir = path.join(dir, 'tools');
    fs.mkdirSync(toolsDir, { recursive: true });
    const outBase = path.join(toolsDir, `out-${Date.now()}`);
    const r = p === '/api/doc/translate'
      ? await docTranslate(currentCfg(), dir, { file: src, lang: String(lang || 'en'), out: outBase })
      : await docRestyle(currentCfg(), dir, { file: src, style: String(style || ''), out: outBase });
    return json(res, 200, {
      ok: r.ok,
      mode: r.mode,
      blocks: r.blocks,
      replaced: r.replaced,
      missing: r.missing || [],
      interpretation: r.interpretation || null,
      summary: r.summary || '',
      roundtrip: r.roundtrip || null,
      reason: r.reason || '',
      files: (r.files || []).map((f) => path.relative(dir, f)),
    });
  }
  if (req.method === 'GET' && p === '/api/doc/download') {
    const id = String(url.searchParams.get('sessionId') || '');
    const dir = sessionDir(id);
    const f = safeInside(dir, String(url.searchParams.get('file') || ''));
    if (!f || !fs.existsSync(f)) return json(res, 404, { error: '文件不存在' });
    const type = f.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : f.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : 'text/markdown; charset=utf-8';
    return sendFile(res, f, path.basename(f), type);
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not Found' }));
}

if (typeof server.on === 'function') {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`端口 ${PORT} 已被占用。请关闭占用进程，或改用其它端口：PORT=5178 npm start`);
    } else {
      console.error('服务器启动失败:', err.message);
    }
    process.exit(1);
  });
}

server.listen(PORT, () => {
  console.log(
    `Stylotrace Studio → http://localhost:${PORT}（${process.env.STYLOTRACE_MOCK_LLM === '1' ? '离线 mock 模式' : '真实 LLM 模式'}）`,
  );
  console.log(`  会话数据: ${DATA_ROOT}`);
  console.log(`  模型: ${currentCfg().model} · 密钥: ${currentCfg().apiKey ? '已配置' : '未配置（可在 .env.local 或环境变量里设）'}`);
});
