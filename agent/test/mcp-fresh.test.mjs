// 回归：IDE（Codex/Claude Code 等）第一次通过 MCP 调用时，不能要求先手工 init。
//
// 踩过的坑：宿主拿到一个新工作区路径直接调 agent_step，返回的是
//   {"isError":true, "content":[{"text":"[stylotrace] 工作区不存在…"}]}
// 也就是说用户"在 IDE 里用不了"——必须先知道去调 init 工具。宿主不该被这样要求。
// 更隐蔽的是：MCP handler 里虽然补了 ensureWorkspace(create)，但写在调用之后，
// 被调函数自己先抛了，等于没补。这个测试就是锁住"第一次调用即可用"。
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(HERE, '..', 'bin', 'stylotrace.js');

const WS = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-fresh-'));
const child = spawn(process.execPath, [ENTRY, 'mcp'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, STYLOTRACE_WORKSPACE: WS },
});

let buf = '';
const waiters = new Map();
child.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id && waiters.has(msg.id)) {
      waiters.get(msg.id)(msg);
      waiters.delete(msg.id);
    }
  }
});
let stderr = '';
child.stderr.on('data', (d) => (stderr += d));

let id = 0;
const call = (method, params, timeoutMs = 40000) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    waiters.set(n, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n');
    setTimeout(() => {
      if (waiters.has(n)) {
        waiters.delete(n);
        reject(new Error(`超时: ${method}`));
      }
    }, timeoutMs);
  });

/** 模型调用会随网络快慢波动，超时重试一次；协议类调用不需要重试。 */
async function callLlmTool(name, args) {
  try {
    return await call('tools/call', { name, arguments: args }, 90000);
  } catch (e) {
    console.log(`· ${name} 首次超时，重试一次（网络波动，不是协议问题）`);
    return call('tools/call', { name, arguments: args }, 90000);
  }
}

try {
  // 1) 握手：IDE 加载 MCP 服务器的第一步
  const init = await call('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0' },
  });
  assert.ok(init.result?.serverInfo?.name, `initialize 应返回 serverInfo，实际 ${JSON.stringify(init).slice(0, 120)}`);
  console.log('PASS MCP 握手（initialize）');

  // 2) 工具清单
  const list = await call('tools/list', {});
  const tools = (list.result?.tools || []).map((t) => t.name);
  assert.ok(tools.length >= 40, `工具数应 ≥40，实际 ${tools.length}`);
  for (const must of ['agent_step', 'clarify_step', 'redteam', 'panel']) {
    assert.ok(tools.includes(must), `工具清单应包含 ${must}`);
  }
  console.log(`PASS 工具清单（${tools.length} 个，含 agent_step/clarify_step/redteam/panel）`);

  // 3) 关键：全新工作区，第一次就调 agent_step，必须能用
  const step = await callLlmTool('agent_step', {
      workspace: WS,
      lastInput: '想写故乡的门槛',
      quote: { kind: 'text', text: '门槛被踩出一道凹痕' },
  });
  const text = String(step.result?.content?.[0]?.text || '');
  assert.notEqual(
    step.result?.isError,
    true,
    `第一次调用就报错，IDE 里等于不可用：${text.slice(0, 160)}`,
  );
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {}
  assert.ok(payload?.kind, `agent_step 应返回决策结果（kind），实际：${text.slice(0, 160)}`);
  console.log(`PASS 全新工作区首次 agent_step 即可用（kind=${payload.kind}）`);

  // 4) 引用要真的被用上：模型的问题里应出现被引用的原文
  const asked = `${payload.question || ''}${payload.recommendation || ''}`;
  assert.ok(
    asked.includes('门槛') || asked.includes('凹痕'),
    `引用没被用上——模型提问里看不到被引用的原文：${asked.slice(0, 120)}`,
  );
  console.log('PASS 引用内容出现在模型的提问里（不是只传了参数）');

  assert.ok(!stderr.trim(), `stderr 应为空：${stderr.slice(0, 200)}`);
  console.log('PASS MCP 全程无 stderr 噪声');
} catch (e) {
  console.error(`✗ ${e.message}`);
  if (stderr) console.error('stderr:', stderr.slice(0, 400));
  process.exitCode = 1;
} finally {
  child.kill();
  fs.rmSync(WS, { recursive: true, force: true });
}

if (!process.exitCode) console.log('\nmcp-fresh.test.mjs 全部通过');
