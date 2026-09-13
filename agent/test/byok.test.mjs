// BYOK 端到端测试：读取 API key（env / 工作区凭据）+ 请求任意 OpenAI 兼容 LLM API。
// 覆盖 CLI 与 MCP 共用的 LLM 路径（loadConfig → llm.chat/chatWithRetry）。
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { loadConfig } = await import(path.join(HERE, '..', 'src', 'config.js'));
const { chat, chatWithRetry } = await import(path.join(HERE, '..', 'src', 'llm.js'));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const cred = await import(path.join(HERE, '..', 'src', 'credentials.js'));

// 起一个本地 OpenAI 兼容 mock 端点，校验 Authorization 头
let receivedAuth = '';
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    receivedAuth = req.headers.authorization || '';
    const parsed = JSON.parse(body);
    assert.ok(parsed.model, 'mock 应收到 model');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'pong:BYOK' } }],
      }),
    );
  });
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}/v1`;

try {
  // 1) env 显式 key + 自定义 baseUrl + 自定义 model → 被 loadConfig 读取
  const cfg = loadConfig({
    STYLOTRACE_LLM_API_KEY: 'sk-test-123',
    STYLOTRACE_LLM_BASE_URL: baseUrl,
    STYLOTRACE_LLM_MODEL: 'mock-model',
  });
  assert.equal(cfg.apiKey, 'sk-test-123');
  assert.equal(cfg.baseUrl, baseUrl);
  assert.equal(cfg.model, 'mock-model');

  // 2) chat 命中 mock，且带上 Bearer（BYOK 请求链路）
  const out = await chat(cfg, [{ role: 'user', content: 'ping' }], { temperature: 0 });
  assert.equal(out, 'pong:BYOK');
  assert.equal(receivedAuth, 'Bearer sk-test-123', '请求必须携带 API key');

  // 3) chatWithRetry 同样可用
  const out2 = await chatWithRetry(cfg, [{ role: 'user', content: 'ping' }], { retries: 2 });
  assert.equal(out2, 'pong:BYOK');

  // 4) 工作区凭据回退：无 env key 时，saveCredentials 后 loadConfig 采用它
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'byok-'));
  const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
  const saved = cred.saveCredentials(w, {
    baseUrl,
    apiKey: 'sk-workspace',
    model: 'mock-model',
    source: 'manual',
  });
  assert.ok(saved);
  const cfg2 = loadConfig({
    STYLOTRACE_WORKSPACE: w,
    STYLOTRACE_CREDENTIALS: 'auto',
  });
  assert.equal(cfg2.apiKey, 'sk-workspace', '工作区凭据应被回退读取');
  assert.equal(cfg2.baseUrl, baseUrl);

  // 5) 显式关闭凭据发现后无 key，本地端点可免鉴权请求
  const cfg3 = loadConfig({
    STYLOTRACE_LLM_BASE_URL: baseUrl,
    STYLOTRACE_LLM_MODEL: 'mock-model',
    STYLOTRACE_CREDENTIALS: 'off',
  });
  assert.equal(cfg3.apiKey, '');
  const out3 = await chat(cfg3, [{ role: 'user', content: 'ping' }]);
  assert.equal(out3, 'pong:BYOK');
} finally {
  server.close();
}

console.log('PASS BYOK（env key / 自定义端点 / 工作区凭据回退 / 无 key 免鉴权）');
