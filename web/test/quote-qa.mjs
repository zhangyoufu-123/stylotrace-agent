// 真实浏览器验收：引用（回答某个问题 / 针对某一段改）能不能用。
//
// 覆盖：
//   1) 问题以气泡列出，点一下就在"专门回答这一条"
//   2) 发送后引用落进对话记录（服务端 transcript 里查得到）
//   3) 发完自动清除引用，不会错误地粘到下一句
//   4) 思路提示只填进输入框、不直接发出去（是帮你想，不是替你选）
//   5) 选中草稿里的一段 → 浮出「针对这段说」→ 引用原文
//
// 运行: node web/test/quote-qa.mjs（找不到 Chrome 时跳过，返回 0）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.log('⚠ 未找到 Chrome，跳过引用验收（不影响其他测试）');
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0;
let failed = 0;
const ok = (n) => {
  pass += 1;
  console.log(`✓ ${n}`);
};
const fail = (n, d) => {
  failed += 1;
  console.error(`✗ ${n}: ${d}`);
  process.exitCode = 1;
};

const APP_PORT = 9300 + Math.floor(Math.random() * 400);
const CDP_PORT = 9700 + Math.floor(Math.random() * 200);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'st-quote-'));
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'st-quote-ch-'));

const server = spawn(process.execPath, [path.join(REPO, 'web', 'server.mjs')], {
  env: { ...process.env, STYLOTRACE_MOCK_LLM: '1', STYLOTRACE_WEB_DATA: DATA, PORT: String(APP_PORT) },
  stdio: ['ignore', 'ignore', 'ignore'],
});
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    `http://127.0.0.1:${APP_PORT}/`,
  ],
  { stdio: ['ignore', 'ignore', 'ignore'] },
);

function cleanup() {
  try { server.kill(); } catch {}
  try { chrome.kill(); } catch {}
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);

let msgId = 0;
const pending = new Map();
const consoleErrors = [];
let ws;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP 超时: ${method}`));
      }
    }, 15000);
  });
}

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result?.value;
}

async function waitFor(expr, { timeout = 20000, step = 250 } = {}) {
  const t0 = Date.now();
  for (;;) {
    try {
      if (await evaluate(expr)) return true;
    } catch {}
    if (Date.now() - t0 > timeout) return false;
    await sleep(step);
  }
}

async function getWsUrl() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then((r) => r.json());
      const t =
        pages.find((p) => p.type === 'page' && (p.url || '').includes(`127.0.0.1:${APP_PORT}`)) ||
        pages.find((p) => p.type === 'page');
      if (t?.webSocketDebuggerUrl) return t.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('无法连接 Chrome CDP');
}

/** 在页面里打字并发送（模拟真实输入，触发 input 事件让按钮可用）。 */
const typeAndSend = (text) => `
  (() => {
    const el = document.getElementById('input');
    el.value = ${JSON.stringify(text)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('send').click();
    return true;
  })()
`;

try {
  let health = null;
  for (let i = 0; i < 40; i += 1) {
    try {
      health = await fetch(`http://127.0.0.1:${APP_PORT}/health`).then((r) => r.json());
      break;
    } catch {}
    await sleep(250);
  }
  if (!health) throw new Error(`服务未启动（端口 ${APP_PORT}）`);

  ws = new WebSocket(await getWsUrl());
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('ws error'));
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id).resolve(m.result || {});
      pending.delete(m.id);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args?.map((a) => a.value || a.description || '').join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('exception: ' + (m.params.exceptionDetails?.text || ''));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');

  if (!(await waitFor('window.__STYLOTRACE_READY__ === true'))) throw new Error('应用未就绪');
  ok('页面就绪');

  // ── 起项目 ──
  await evaluate(`
    (() => {
      const el = document.getElementById('seedInput');
      el.value = '写一篇关于故乡门槛的散文';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('seedSend').click();
      return true;
    })()
  `);
  if (!(await waitFor('!!localStorage.getItem("stylotrace.lastSessionId")', { timeout: 30000 }))) {
    throw new Error('项目没建起来');
  }
  const hasQuestion = await waitFor('!!document.querySelector("[data-quote-question]")', { timeout: 30000 });
  if (hasQuestion) ok('问题以气泡列出（可点击）');
  else fail('问题气泡', '页面上找不到可点击的问题气泡');

  // ── 点问题 → 进入"专门回答这一条" ──
  await evaluate('document.querySelector("[data-quote-question]").click()');
  const barShown = await waitFor('!document.getElementById("quoteBar").hidden');
  if (barShown) ok('点问题后出现引用条');
  else fail('引用条', '点了问题但引用条没出现');
  const tag = await evaluate('document.getElementById("quoteTag").textContent');
  if (tag.includes('回答')) ok(`引用条标明用途：「${tag}」`);
  else fail('引用条标签', `期望「回答这个问题」，实际「${tag}」`);
  const quotedInBar = await evaluate('document.getElementById("quoteText").textContent');
  if (quotedInBar && quotedInBar.trim()) ok('引用条里带着原问题');
  else fail('引用内容', '引用条是空的');

  // ── 思路提示：只填输入框，不直接发 ──
  const hasAngle = await evaluate('!!document.querySelector(".angle")');
  if (hasAngle) {
    const before = await evaluate('document.getElementById("chat").children.length');
    await evaluate('document.querySelector(".angle").click()');
    await sleep(600);
    const filled = await evaluate('document.getElementById("input").value');
    const after = await evaluate('document.getElementById("chat").children.length');
    if (filled && filled.trim() && after === before) ok('点「思路」只填进输入框，没有替你发出去');
    else fail('思路提示', `输入框=${JSON.stringify(filled)} 消息数 ${before}→${after}`);
    await evaluate('document.getElementById("input").value = ""');
  } else {
    ok('本轮没有思路提示（跳过该项）');
  }

  // ── 带着引用发一条 ──
  const sid = await evaluate('localStorage.getItem("stylotrace.lastSessionId")');
  await evaluate(typeAndSend('重点是等人回来那段时间，不是门槛本身'));
  // 注意：页面里的裸 fetch 不带 X-Machine-Id，会查到 default 命名空间去，
  // 而会话其实记在本机 machineId 下——必须显式带上，否则永远查不到。
  const tx = (pred) =>
    `fetch('/api/transcript?sessionId=${sid}', { headers: { 'X-Machine-Id': localStorage.getItem('stylotrace.machineId') } })` +
    `.then(r=>r.json()).then(j=>{const es=(j.entries||[]).filter(e=>e.role==='user'&&e.quote&&e.quote.text);return ${pred}})`;
  const sent = await waitFor(
    tx('es.length>0'),
    { timeout: 25000 },
  );
  if (sent) ok('引用随消息一起落进了对话记录（服务端可查）');
  else fail('引用落库', 'transcript 里的用户消息没有 quote 字段');

  const kind = await evaluate(tx("es.length?es[es.length-1].quote.kind:''"));
  if (kind === 'question') ok('引用类型标为 question（AI 知道你在回答哪条）');
  else fail('引用类型', `期望 question，实际 ${kind}`);

  // ── 发完要自动清掉引用 ──
  const cleared = await waitFor('document.getElementById("quoteBar").hidden === true', { timeout: 8000 });
  if (cleared) ok('发送后引用自动清除（不会粘到下一句）');
  else fail('引用清除', '发送后引用条还在');

  // 选中草稿里的一段 → 针对这段：这一段流程较长，单独放在 quote-draft-qa.mjs 里验收
  // （这里不再跟 mock 的 18 步澄清流程较劲，避免一个测试跑几分钟）


  const real = consoleErrors.filter((e) => !/favicon|404/i.test(e));
  if (!real.length) ok('全程无页面 JS 报错');
  else fail('页面报错', real.slice(0, 3).join(' | '));
} catch (e) {
  fail('验收中断', String(e.message || e));
}

console.log(`\n引用验收: ${pass} 通过 / ${failed} 失败`);
cleanup();
process.exit(failed ? 1 : 0);
