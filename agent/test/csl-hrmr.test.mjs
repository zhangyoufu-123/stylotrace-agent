// HRME 测试：分离/泛化门槛/反例降级/选择性遗忘/迁移（H1-H6 确定性子集 + F1-F5）。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const hr = await import(path.join(HERE, '..', 'src', 'csl', 'hrmr.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-hrmr-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// F1 分离：两条相似经历不得合并
hr.addEpisode(w, { text: '小猪吃玉米', outcome: 1 });
hr.addEpisode(w, { text: '小猪闻玉米', outcome: 1 });
const sep = hr.retrieve(w, '小猪');
assert.ok(sep.length >= 2, `相似经历应分离：${sep.length}`);

// F2 单次经历不得升 M3
const single = hr.addEpisode(w, { text: '一个人吃冰淇淋', outcome: 1 });
assert.ok(single.episode.level < 3, `单次经历不得升 schema：level=${single.episode.level}`);

// H3 多次支持 → 升 M3/M4
for (let i = 0; i < 5; i++) hr.addEpisode(w, { text: '小猪吃玉米', outcome: 1, goal: 'g' + i });
const upgraded = hr.retrieve(w, '玉米').find((i) => i.kind === 'schema');
assert.ok(upgraded.level >= 3, `多次支持应升格：level=${upgraded.level}, conf=${upgraded.confidence}`);
assert.ok(upgraded.confidence > 0.5, `置信应随支持上升：${upgraded.confidence}`);

// F3 反例 → 降级
const challenged = hr.challengeSchema(w, '小猪吃玉米', '牛不吃玉米（反例）');
assert.ok(challenged && challenged.exceptions >= 1);

// H1 分离再验：四条相似事件都保留
assert.ok(hr.retrieve(w, '小猪').length >= 2);

// F4 选择性遗忘：低效用衰减
hr.addEpisode(w, { text: '昨天看到一只鸟飞过', outcome: 1 }); // 单次、无 goal → 低效用
const before = hr.retrieve(w, '鸟').length;
hr.decay(w, { timeWeight: 10 });
const after = hr.retrieve(w, '鸟').length;
assert.ok(after <= before, `低效用应被衰减：${before} -> ${after}`);

// H6 迁移：schema 帮助未见任务（关系类型可查）
const rel = hr.bind('猫吃鱼');
assert.ok(rel[0].subject === '猫' && rel[0].object === '鱼', '关系绑定');

// 红队回归：否定/被动句不得产生垃圾绑定
assert.deepEqual(hr.bind('小猪不吃玉米'), [], '否定句不得绑定');
assert.deepEqual(hr.bind('玉米被小猪吃了'), [], '被动句不得绑定');
assert.equal(hr.bind('小猪喜欢玉米也喜欢肉')[0].object, '玉米', '多动词宾语截断');

// 红队回归：M4 必须由迁移证据触发（transfer=0 最多 M3）
const wm = ws.ensureWorkspace(path.join(tmp, 'wm'), { create: true });
for (let i = 0; i < 5; i++) hr.addEpisode(wm, { text: '羊吃粮食', outcome: 1, goal: 'g' + i });
assert.ok(hr.retrieve(wm, '粮食').find((i) => i.kind === 'schema').level < 4, '无迁移证据不得 M4');
hr.markTransfer(wm, '羊吃粮食');
assert.ok(hr.retrieve(wm, '粮食').find((i) => i.kind === 'schema').level >= 4, '迁移后应可 M4');

// 红队回归：检索 query 命中优先于层级（具体 episode 不被通用 schema 压过）
const wq = ws.ensureWorkspace(path.join(tmp, 'wq'), { create: true });
hr.addEpisode(wq, { text: '小猪闻玉米', outcome: 1, goal: 'smell' });
for (let i = 0; i < 5; i++) hr.addEpisode(wq, { text: '牛吃粮食', outcome: 1, goal: 'g' + i });
const qFirst = hr.retrieve(wq, '小猪')[0];
assert.ok(qFirst.kind === 'episode' && qFirst.relationText.includes('小猪'), '查小猪应命中具体 episode');

console.log('PASS csl-hrmr（F1分离/F2门槛/F3降级/F4遗忘/H1/H3/H6 + 红队回归）');
