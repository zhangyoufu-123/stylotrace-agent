// 真实浏览器验收：选中草稿里的一段 → 「针对这段说」→ 带上原文引用。
//
// 单独一个文件的原因：这条路径要先把成稿弄出来。用"导入已有草稿"这条真实路径
// 比跑完 mock 的 18 步澄清快得多，测试才跑得稳、跑得快。
//
// 运行: node web/test/quote-draft-qa.mjs（找不到 Chrome 时跳过，返回 0）
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
  console.log('⚠ 未找到 Chrome，跳过选中引用验收（不影响其他测试）');
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

const APP_PORT = 9350 + Math.floor(Math.random() * 300);
const CDP_PORT = 9750 + Math.floor(Math.random() * 150);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'st-qd-'));
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'st-qd-ch-'));

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

const SAMPLE = '门槛被踩出一道凹痕。雨天会渗水，木头颜色变深。外婆站在门槛上目送我，一直到巷口拐弯。';

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
    if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('exception: ' + (m.params.exceptionDetails?.text || ''));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');

  if (!(await waitFor('window.__STYLOTRACE_READY__ === true'))) throw new Error('应用未就绪');
  ok('页面就绪');

  // 建项目 + 导入成稿（走真实的 /api/start + /api/import-draft）
  await evaluate(`
    (() => {
      const el = document.getElementById('seedInput');
      el.value = '故乡的门槛';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('seedSend').click();
      return true;
    })()
  `);
  if (!(await waitFor('!!localStorage.getItem("stylotrace.lastSessionId")', { timeout: 30000 }))) {
    throw new Error('项目没建起来');
  }
  const sid = await evaluate('localStorage.getItem("stylotrace.lastSessionId")');
  const imported = await evaluate(`
    fetch('/api/import-draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Machine-Id': localStorage.getItem('stylotrace.machineId'),
      },
      body: JSON.stringify({ sessionId: '${sid}', title: '门槛', text: ${JSON.stringify(SAMPLE)} }),
    }).then((r) => r.ok)
  `);
  if (imported) ok('成稿已就绪（真实导入路径）');
  else fail('准备成稿', 'import-draft 失败');

  // 刷新（顺便再验一次刷新恢复）→ 切到成稿视图
  await send('Page.reload', { ignoreCache: false });
  await waitFor('window.__STYLOTRACE_READY__ === true', { timeout: 20000 });
  await evaluate(`
    (() => {
      const b = document.querySelector('.stage-item[data-stage="deliver"]');
      if (b) b.click();
      return true;
    })()
  `);
  const draftReady = await waitFor('(document.getElementById("draftPaper")?.innerText||"").trim().length > 5', {
    timeout: 20000,
  });
  if (draftReady) ok('成稿视图渲染出可选中的文字');
  else fail('成稿视图', 'draftPaper 里没有可选文字');

  if (draftReady) {
    // 选中第一段 → 应浮出「针对这段说」
    await evaluate(`
      (() => {
        const paper = document.getElementById('draftPaper');
        const node = paper.querySelector('p') || paper;
        const range = document.createRange();
        range.selectNodeContents(node);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        return true;
      })()
    `);
    const bar = await waitFor('!!document.querySelector(".sel-bar")', { timeout: 8000 });
    if (bar) ok('选中草稿文字后浮出「针对这段说」');
    else fail('选中浮标', '选中文字后没有出现浮标');

    if (bar) {
      await evaluate(
        `document.querySelector('.sel-bar').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`,
      );
      const wired = await waitFor(
        `!document.getElementById('quoteBar').hidden && document.getElementById('quoteTag').textContent.includes('针对')`,
        { timeout: 8000 },
      );
      if (wired) ok('引用条切到「针对这段」');
      else fail('针对段落引用', '点击浮标后引用条没切到"针对这段"');

      const quoted = await evaluate('document.getElementById("quoteText").textContent');
      if (quoted && SAMPLE.includes(quoted.trim().slice(0, 8))) ok('引用条里带着被选中的原文');
      else fail('引用原文', `引用条内容是「${quoted}」`);

      // 带着这段引用发一条修改意见 → 服务端要能查到这个 text 引用
      await evaluate(`
        (() => {
          const el = document.getElementById('input');
          el.value = '这句太满了，收一点';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          document.getElementById('send').click();
          return true;
        })()
      `);
      const stored = await waitFor(
        `fetch('/api/transcript?sessionId=${sid}', { headers: { 'X-Machine-Id': localStorage.getItem('stylotrace.machineId') } })
          .then(r=>r.json())
          .then(j=>(j.entries||[]).some(e=>e.role==='user'&&e.quote&&e.quote.kind==='text'&&e.quote.text))`,
        { timeout: 25000 },
      );
      if (stored) ok('「针对这段」的修改意见带着原文落进了对话记录');
      else fail('段落引用落库', 'transcript 里没有 kind=text 的引用');
    }
  }

  const real = consoleErrors.filter((e) => !/favicon|404/i.test(e));
  if (!real.length) ok('全程无页面 JS 报错');
  else fail('页面报错', real.slice(0, 3).join(' | '));
} catch (e) {
  fail('验收中断', String(e.message || e));
}

console.log(`\n选中引用验收: ${pass} 通过 / ${failed} 失败`);
cleanup();
process.exit(failed ? 1 : 0);
