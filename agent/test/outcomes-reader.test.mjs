// 结果账本「读得出来」的验收。
//
// 背景（真实性问题，已修）：runtime 一直在把"预测 → 实际 → 反事实归因"写进
// protocol/csl-outcomes.jsonl，但 CLI / MCP / Web **都没有读取入口**——
// 能力清单却写着"结果账本，可逐条导出核查"。写进去不等于能拿出来。
//
// 这个测试锁住三件事：① CLI 能读出；② 状态面板能显示；③ 一份测试保证"不再退回去"。
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, '..', 'bin', 'stylotrace.js');
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const credit = await import(path.join(HERE, '..', 'src', 'csl', 'credit.js'));
const panel = await import(path.join(HERE, '..', 'src', 'csl', 'panel.js'));

let n = 0;
const ok = (m) => {
  n += 1;
  console.log(`  ✓ ${m}`);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'outcomes-'));
const W = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// ── 1) 空账本：说人话，不报错 ────────────────────────────
{
  const out = execFileSync(process.execPath, [CLI, 'outcomes', '--workspace', W], {
    encoding: 'utf8',
    cwd: tmp,
  });
  assert.ok(/（空）/.test(out), `空账本应明确说空，实际：${out.slice(0, 120)}`);
  assert.ok(/怎么产生/.test(out), '空账本要告诉用户怎么产生记录');
  assert.ok(/csl-outcomes\.jsonl/.test(out), '空账本要给出文件位置');
  ok('空账本：说人话 + 给出文件位置');
}

// ── 2) 有记录：CLI 能逐条读出 ────────────────────────────
{
  credit.recordOutcome(W, {
    sessionId: 's1',
    traceId: 'tr-1',
    prediction: { expected: 0.937 },
    actual: { value: 0.3, source: 'user-correct' },
    evaluation: { dimensions: { operators: -0.06, router: -0.03, memory: 0.01 } },
  });
  const out = execFileSync(process.execPath, [CLI, 'outcomes', '--workspace', W], {
    encoding: 'utf8',
    cwd: tmp,
  });
  assert.ok(/结果账本：1 条/.test(out), `应读出 1 条，实际：${out.slice(0, 160)}`);
  assert.ok(/0\.937/.test(out) && /0\.3/.test(out), '预测与实际都要显示');
  assert.ok(/operators/.test(out), '应显示主要偏差维度');
  ok('有记录：CLI 逐条读出（预测 → 实际 → 主要偏差）');

  const json = execFileSync(process.execPath, [CLI, 'outcomes', '--workspace', W, '--json'], {
    encoding: 'utf8',
    cwd: tmp,
  });
  const parsed = JSON.parse(json);
  assert.equal(parsed.length, 1, '--json 应给出完整记录');
  assert.equal(parsed[0].evaluation.dimensions.operators, -0.06, '维度数据要完整保留');
  ok('--json 输出完整数据（可导出核查）');
}

// ── 3) 状态面板也能显示（不是只有 CLI 能看） ─────────────
{
  const html = panel.buildPanelHtml(W, { sessionId: 's1' });
  assert.ok(html.includes('结果账本'), '状态面板应有结果账本卡');
  assert.ok(html.includes('0.937'), '面板应显示预测值');
  assert.ok(html.includes('stylotrace outcomes'), '面板应提示用哪条命令看全部');
  ok('状态面板 ⑦ 也能看到结果账本');
}

// ── 4) 会话过滤（按 sessionId 只读自己的） ───────────────
{
  credit.recordOutcome(W, {
    sessionId: 's2',
    prediction: { expected: 0.5 },
    actual: { value: 0.5 },
  });
  const out = execFileSync(process.execPath, [CLI, 'outcomes', '--workspace', W, '--session', 's2'], {
    encoding: 'utf8',
    cwd: tmp,
  });
  assert.ok(/结果账本：1 条/.test(out), `按会话过滤应只看到 1 条，实际：${out.slice(0, 120)}`);
  assert.ok(!/0\.937/.test(out), '不该看到别的会话的记录');
  ok('按会话过滤：只看自己的记录');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\noutcomes-reader.test.mjs 全部通过 (${n} 项)`);
