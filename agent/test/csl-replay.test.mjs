// Hippocampal Replay 测试（R1–R5 + DoD）。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const ev = await import(path.join(HERE, '..', 'src', 'csl', 'events.js'));
const rp = await import(path.join(HERE, '..', 'src', 'csl', 'replay.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-replay-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// 造两条经历：ep1（creative，draft 失败，误差大）；ep2（academic，ask 成功）
ev.appendEvent(w, { event_type: 'cognitive.run', state_version: 's_1', session_id: 'sessX', step: 1, goal: '散文', action: { action: 'draft', question: '展开核心观点' }, prediction: { value: 0.8 }, outcome: { value: 0.2 }, error: { magnitude: 0.6 }, credit: { operators: 0.3 } });
ev.appendEvent(w, { event_type: 'cognitive.run', state_version: 's_2', session_id: 'sessX', step: 2, goal: '论文', action: { action: 'ask', question: '你的假设是什么' }, prediction: { value: 0.5 }, outcome: { value: 0.9 }, error: { magnitude: 0.4 }, credit: { router: 0.1 } });

// R3: 高误差经验优先（ep1 的 delta 0.6 > ep2 的 0.4 → 重放顺序 ep1 在前）
const episodes = rp.reconstructEpisodes(w, 'sessX');
const pri = episodes.map((e) => rp.replayPriority(e));
assert.ok(pri[0] >= pri[1], `高误差应优先：${pri}`);

// R1: 幂等——同事件重放两次，policy 签名相同（无状态重算）
const r1 = rp.replayOnce(w, { sessionId: 'sessX', credit: 'weighted' });
const r2 = rp.replayOnce(w, { sessionId: 'sessX', credit: 'weighted' });
assert.deepEqual(r1.policy, r2.policy, 'R1 幂等：两次重放 stats 相等');

// R4 + DoD: 重放后 creative（有 draft 失败）策略从 draft 变 ask；research（无失败）保持基线 draft
assert.equal(rp.policyFor(w, 'creative'), 'ask', 'creative 有失败经历 → 应改为先问');
assert.equal(rp.policyFor(w, 'research'), 'draft', 'research 无失败 → 保持基线');

// R5: 任务模式隔离——creative 的失败不影响 academic 统计
const pol = JSON.parse(fs.readFileSync(path.join(w, 'vault', 'csl-policy.json'), 'utf8'));
assert.ok(pol.modes.creative.failures >= 1);
assert.equal(pol.modes.research.failures, 0, 'R5 无关经验不污染');

// R2: 新 outcome 更新 schema（reconsolidation：失败记录进 schema 证据链）
const schema = JSON.parse(fs.readFileSync(path.join(w, 'vault', 'csl-schema.json'), 'utf8'));
assert.ok(schema.schemas.length >= 1);
assert.ok(schema.schemas.some((s) => s.evidence.includes('failed')), 'R2 失败已进 schema');

console.log('PASS csl-replay（R1 幂等 / R2 再巩固 / R3 优先级 / R4 策略改变 / R5 隔离 + DoD）');
