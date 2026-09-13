// Phase 3 — Application Adapter 验收：
// 契约（跨通道同输入→同认知动作/同状态）· 跨通道共享会话 · Checkpoint 恢复 · Writer 门一致 ·
// 动作一致性（selected==executed）· MCP 工具注册与真实调用。
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const ad = await import(path.join(HERE, '..', 'src', 'csl', 'adapter.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-adapter-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
const mockLlm = async () => '（mock）作者倾向从具体小事切进大观点。';
const TASK = '我想写一篇关于故乡门槛的散文，核心是记忆';

// ── 1) 契约：同输入不同通道 → 同一认知动作/状态模型 ──
const c1 = await ad.runTask({ workspace: w, sessionId: 'S', input: TASK, channel: 'cli', llm: mockLlm });
assert.equal(c1.cognitiveAction, 'askHuman', `无核心应先问: ${c1.cognitiveAction}`);
assert.equal(c1.app.app, 'ask');
// 跨通道（mcp/web）在同一会话 → 同一状态版本（cognition 与通道无关）
const c2 = await ad.runTask({ workspace: w, sessionId: 'S', input: TASK, channel: 'mcp', llm: mockLlm });
assert.equal(c2.stateVersion, c1.stateVersion, '同会话跨通道状态版本一致');
assert.equal(c2.cognitiveAction, 'askHuman');
const c3 = await ad.runTask({ workspace: w, sessionId: 'S', input: TASK, channel: 'web', llm: mockLlm });
assert.equal(c3.stateVersion, c1.stateVersion);

// ── 2) 跨通道共享会话：cli ask → mcp checkpoint → web deep ──
const chk = await ad.answerCheckpoint(w, { sessionId: 'S', answer: '门槛是外婆家的旧木门槛，被磨矮了', input: TASK, llm: mockLlm });
assert.equal(chk.kind, 'deep', `回答后应恢复深层: ${chk.kind}`);
assert.ok(chk.state.coreIdea.includes('门槛'), '跨通道后 coreIdea 可见');
const web2 = await ad.runTask({ workspace: w, sessionId: 'S', input: TASK, channel: 'web', llm: mockLlm });
assert.ok(web2.stateVersion > chk.stateVersion, '跨通道状态版本单调');
assert.ok(web2.state.coreIdea.includes('门槛'), 'web 通道看到同一 coreIdea');
assert.equal(ad.canonicalSnapshot(w, 'S').stateVersion, web2.stateVersion, '快照一致');

// ── 3) Writer 门一致性（跨入口同一规则）──
const wG = ws.ensureWorkspace(path.join(tmp, 'wg'), { create: true });
const dEmpty = ad.decideTask(wG, { input: '写点什么', sessionId: 'G' });
assert.equal(dEmpty.writerGate.blocked, true, '无核心 Writer 应 BLOCK');
const dFull = ad.decideTask(w, { input: TASK, sessionId: 'S' });
assert.equal(dFull.writerGate.blocked, false, '有核心 Writer 放行');

// ── 4) 动作一致性：selected == executed（search 真实排队）──
const act = await ad.runAction(w, { action: 'search', input: TASK, sessionId: 'S' });
assert.equal(act.executed, true);
assert.deepEqual(act.events.map((e) => e.event_type), ['search']);
const reqFile = path.join(w, 'protocol', 'requests.jsonl');
assert.ok(fs.existsSync(reqFile) && fs.readFileSync(reqFile, 'utf8').includes('csl-search'), 'search 真实执行');

// ── 5) MCP：tools/list 含 4 个 csl 工具；csl_state 真实返回快照 ──
const BIN = path.join(HERE, '..', 'bin', 'stylotrace.js');
const p = spawn(process.execPath, [BIN, 'mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
const lines = [];
const waitLine = (pred, timeout = 8000) =>
  new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const found = lines.find(pred);
      if (found) {
        clearInterval(iv);
        resolve(found);
      } else if (Date.now() - t0 > timeout) {
        clearInterval(iv);
        reject(new Error('MCP 响应超时'));
      }
    }, 50);
  });
p.stdout.on('data', (d) => lines.push(...String(d).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))));
try {
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n');
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
  const list = await waitLine((l) => l.id === 2 && l.result?.tools);
  const names = list.result.tools.map((t) => t.name);
  for (const n of ['csl_turn', 'csl_action', 'csl_checkpoint', 'csl_state']) {
    assert.ok(names.includes(n), `MCP 应注册 ${n}`);
  }
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'csl_state', arguments: { workspace: w, session: 'S' } } }) + '\n');
  const st = await waitLine((l) => l.id === 3 && l.result?.content);
  const snap = JSON.parse(st.result.content[0].text);
  assert.ok(snap.coreIdea.includes('门槛'), 'MCP csl_state 返回同一快照');
} finally {
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'shutdown', params: {} }) + '\n');
  p.stdin.end();
  p.kill();
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 2000);
    p.once('exit', () => {
      clearTimeout(t);
      resolve();
    });
  });
}

console.log('PASS csl-adapter（契约/跨通道共享会话/Checkpoint 恢复/Writer 门/动作一致/MCP 工具）');
