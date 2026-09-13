// 真实浏览器验收：刷新后能不能回到原来的项目。
//
// 为什么必须用真浏览器：这一整类问题（localStorage、刷新、会话恢复）在
// "进程内直调 handler" 的 mock 测试里根本碰不到——正是这个盲区让
// "刷新就丢项目" 一直没被发现。所以这里起真服务 + 真 Chrome（CDP 驱动）。
//
// 覆盖：
//   1) 建项目后 sessionId 落进 localStorage
//   2) 刷新页面 → 自动回到同一个项目（聊天记录、标题都还在）
//   3) 顶部项目切换器能列出项目
//   4) 全程无页面 JS 报错
//
// 运行: node web/test/persistence-qa.mjs（找不到 Chrome 时跳过，返回 0）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];
const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME) {
  console.log('⚠ 未找到 Chrome，跳过刷新恢复验收（不影响其他测试）');
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

const APP_PORT = 8800 + Math.floor(Math.random() * 500);
const CDP_PORT = 9400 + Math.floor(Math.random() * 400);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'st-persist-'));
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'st-chrome-'));

const server = spawn(process.execPath, [path.join(REPO, 'web', 'server.mjs')], {
  env: {
    ...process.env,
    STYLOTRACE_MOCK_LLM: '1',
    STYLOTRACE_WEB_DATA: DATA,
    PORT: String(APP_PORT),
  },
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

async function getWsUrl() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then((r) => r.json());
      const target =
        pages.find((p) => p.type === 'page' && (p.url || '').includes(`127.0.0.1:${APP_PORT}`)) ||
        pages.find((p) => p.type === 'page');
      if (target?.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('无法连接 Chrome CDP');
}

/** 等某个表达式返回真值（页面异步逻辑多，必须等而不是猜）。 */
async function waitFor(expr, { timeout = 15000, step = 250 } = {}) {
  const t0 = Date.now();
  for (;;) {
    try {
      if (await evaluate(expr)) return true;
    } catch {}
    if (Date.now() - t0 > timeout) return false;
    await sleep(step);
  }
}

try {
  // 先确认服务真的起来了：否则后面的失败会全部指向错误的地方
  let health = null;
  for (let i = 0; i < 40; i += 1) {
    try {
      health = await fetch(`http://127.0.0.1:${APP_PORT}/health`).then((r) => r.json());
      break;
    } catch {}
    await sleep(250);
  }
  if (!health) throw new Error(`服务未启动（端口 ${APP_PORT}），无法继续`);
  ok(`服务已启动（mode=${health.mode}）`);

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

  // 等应用真正就绪（脚本绑完按钮、恢复完会话），不是只等 DOM 出现
  if (!(await waitFor('window.__STYLOTRACE_READY__ === true', { timeout: 20000 }))) {
    throw new Error('应用未进入就绪状态（__STYLOTRACE_READY__ 一直为 false）');
  }
  ok('页面加载完成');

  // 1) 建一个项目
  await evaluate(`
    (() => {
      const el = document.getElementById('seedInput');
      el.value = '刷新之后我还要看到这一条';
      // 程序化赋值不会触发 input 事件，按钮还是 disabled —— 必须手动派发
      el.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('seedSend').click();
      return true;
    })()
  `);
  const created = await waitFor('!!localStorage.getItem("stylotrace.lastSessionId")', { timeout: 30000 });
  if (created) ok('建项目后 sessionId 已写入 localStorage');
  else {
    const diag = await evaluate(`
      JSON.stringify({
        disabled: document.getElementById('seedSend')?.disabled,
        seedVal: document.getElementById('seedInput')?.value,
        chat: document.getElementById('chat')?.children.length,
        chatText: (document.getElementById('chat')?.innerText || '').slice(0, 200),
        lsKeys: Object.keys(localStorage),
      })
    `);
    fail('sessionId 持久化', `localStorage 里没有 stylotrace.lastSessionId｜现场：${diag}`);
  }

  const sid = await evaluate('localStorage.getItem("stylotrace.lastSessionId")');
  const titleBefore = await evaluate('document.getElementById("sessionPill").textContent');
  const msgsBefore = await evaluate('document.getElementById("chat").children.length');

  // 2) 刷新，看能不能自己回来
  await send('Page.reload', { ignoreCache: false });
  if (!(await waitFor('window.__STYLOTRACE_READY__ === true', { timeout: 20000 }))) {
    throw new Error('刷新后应用未进入就绪状态');
  }

  const restored = await waitFor(
    `document.getElementById('chat').children.length > 0`,
    { timeout: 20000 },
  );
  if (restored) ok('刷新后自动恢复到原项目（聊天记录已重新渲染）');
  else fail('刷新恢复', '刷新后聊天区是空的——没有回到原来的项目');

  const sidAfter = await evaluate('localStorage.getItem("stylotrace.lastSessionId")');
  assertEqual(sidAfter, sid, '刷新后项目 id 应保持不变');

  const titleAfter = await evaluate('document.getElementById("sessionPill").textContent');
  if (titleAfter && titleAfter.trim() && titleAfter !== '未选择项目 ▾') ok('刷新后顶栏仍显示当前项目');
  else fail('顶栏项目名', `刷新后顶栏是「${titleAfter}」`);

  const msgsAfter = await evaluate('document.getElementById("chat").children.length');
  if (msgsAfter >= msgsBefore) ok(`聊天记录条数未丢失（刷新前 ${msgsBefore} → 刷新后 ${msgsAfter}）`);
  else fail('聊天记录', `刷新前 ${msgsBefore} 条，刷新后只剩 ${msgsAfter} 条`);

  // 3) 项目切换器
  await evaluate('document.getElementById("sessionPill").click()');
  const menuOpen = await waitFor('!document.getElementById("projectMenu").hidden');
  if (menuOpen) ok('顶栏项目切换器能打开');
  else fail('项目切换器', '点顶栏后下拉没出现');
  const listed = await waitFor('document.querySelectorAll("#projectMenuList .pm-item").length > 0');
  if (listed) ok('切换器里列出了项目');
  else fail('项目切换器', '下拉里没有项目条目');

  // 4) 新建项目会清掉当前指针
  await evaluate('document.getElementById("projectMenuNew").click()');
  const cleared = await waitFor('!localStorage.getItem("stylotrace.lastSessionId")');
  if (cleared) ok('「新建项目」会切到干净状态（旧项目仍在列表里，可随时切回）');
  else fail('新建项目', '新建后仍指向旧项目');

  // 5) 无页面报错
  const real = consoleErrors.filter((e) => !/favicon|404/i.test(e));
  if (!real.length) ok('全程无页面 JS 报错');
  else fail('页面报错', real.slice(0, 3).join(' | '));
} catch (e) {
  fail('验收中断', String(e.message || e));
}

function assertEqual(a, b, label) {
  if (a === b) ok(label);
  else fail(label, `期望 ${b}，实际 ${a}`);
}

console.log(`\n刷新恢复验收: ${pass} 通过 / ${failed} 失败`);
cleanup();
process.exit(failed ? 1 : 0);
