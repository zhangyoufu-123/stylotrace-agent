// 数据安全验收：原子写 + 损坏与缺失的区分。
//
// 背景（OpenCodeReview 审出来的真问题）：
//   · state / brief / canonical / credit / baseline / 调制器权重 全是"只能读不能修"的持久状态，
//     原来一律 writeFileSync 直接覆盖——**写到一半崩溃就整份报废**。
//   · 全仓大量 `catch {}` 把"文件损坏"和"文件不存在"吞成一回事，
//     用户看到的是"我的决断/风格不见了"，而不是"文件坏了"。
// 这个测试锁住两件事：① 写盘要么全成要么全不成；② 损坏必须被认出来并留痕。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const dec = await import(path.join(HERE, '..', 'src', 'csl', 'decision.js'));
const brief = await import(path.join(HERE, '..', 'src', 'csl', 'brief.js'));

let n = 0;
const ok = (m) => {
  n += 1;
  console.log(`  ✓ ${m}`);
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'datasafe-'));
const W = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
const tmpFiles = (dir) => fs.readdirSync(dir).filter((f) => f.includes('.tmp-'));

// ── 1) 原子写：覆盖成功、不留临时文件 ───────────────────
{
  const f = path.join(tmp, 'a.json');
  ws.writeJson(f, { v: 1 });
  ws.writeJson(f, { v: 2 });
  assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).v, 2, '覆盖写入应生效');
  assert.equal(tmpFiles(tmp).length, 0, '不该留下临时文件');
  ok('原子写：覆盖生效且不留临时文件');
}

// ── 2) 序列化失败时，原文件必须完好 ─────────────────────
{
  const f = path.join(tmp, 'b.json');
  ws.writeJson(f, { keep: 'original' });
  let threw = false;
  try {
    ws.writeJson(f, { bad: 1n }); // BigInt 无法 JSON 序列化
  } catch {
    threw = true;
  }
  assert.ok(threw, '序列化失败应抛出（不能静默）');
  assert.equal(
    JSON.parse(fs.readFileSync(f, 'utf8')).keep,
    'original',
    '写入失败后原文件必须完好——这正是原子写的意义',
  );
  assert.equal(tmpFiles(tmp).length, 0, '失败后不该留下临时文件');
  ok('写入失败：原文件完好、无临时残留');
}

// ── 3) 缺失 vs 损坏：必须区分开 ──────────────────────────
{
  const missing = ws.readJsonChecked(path.join(tmp, 'nope.json'));
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'missing', '不存在的文件应报 missing');

  const bad = path.join(tmp, 'corrupt.json');
  fs.writeFileSync(bad, '{ 这不是 JSON');
  const corrupt = ws.readJsonChecked(bad);
  assert.equal(corrupt.ok, false);
  assert.equal(corrupt.reason, 'corrupt', '存在的坏文件必须报 corrupt，不能混为 missing');
  ok('缺失 / 损坏 被区分开（missing ≠ corrupt）');
}

// ── 4) 状态文件损坏：报错说人话，并且留下痕迹 ────────────
{
  const w2 = ws.ensureWorkspace(path.join(tmp, 'w2'), { create: true });
  fs.writeFileSync(path.join(w2, 'protocol', 'state.json'), '{ 坏掉的 JSON');
  let msg = '';
  try {
    ws.readState(w2);
  } catch (e) {
    msg = String(e.message);
  }
  assert.ok(/损坏/.test(msg), `state 损坏应明确说"损坏"，实际：${msg}`);
  assert.ok(/doctor/.test(msg), '应告诉用户怎么进一步查看');

  const integ = path.join(w2, 'protocol', 'integrity.jsonl');
  assert.ok(fs.existsSync(integ), '损坏事件应写进 protocol/integrity.jsonl');
  const rec = JSON.parse(fs.readFileSync(integ, 'utf8').trim().split('\n').pop());
  assert.equal(rec.reason, 'corrupt');
  assert.equal(rec.file, 'state.json');
  ok('state 损坏：说人话 + 留痕（integrity.jsonl）');
}

// ── 5) 正常业务流程不再留下临时文件 ─────────────────────
{
  dec.addDecision(
    W,
    dec.createDecisionCard({ spanText: '门槛上他等了很久。', object: 'x', comparisonSet: 'y' }).card,
  );
  brief.syncBrief(W);
  const proto = path.join(W, 'protocol');
  const vault = path.join(W, 'vault');
  const litter = [...tmpFiles(proto), ...(fs.existsSync(vault) ? tmpFiles(vault) : [])];
  assert.equal(litter.length, 0, `正常流程不该留临时文件，实际：${litter.join(',')}`);
  ok('决断卡 + 简报写入后无临时文件残留');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\ndata-safety.test.mjs 全部通过 (${n} 项)`);
