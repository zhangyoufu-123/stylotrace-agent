// CLI 参数解析回归测试：布尔 flag 不再吞位置参数、各命令工作区解析正确。
// 运行: node test/cli-args.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'stylotrace.js');
const cli = await import(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'cli.js'));

let passed = 0;
const ok = (name) => { passed++; console.log(`✓ ${name}`); };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-cli-'));
const ws = path.join(tmp, 'ws');
// init 工作区
let r = spawnSync(process.execPath, [BIN, 'init', ws], { encoding: 'utf8' });
assert.equal(r.status, 0, `init 失败: ${r.stderr}`);

const env = { ...process.env, STYLOTRACE_LLM_API_KEY: '', STYLOTRACE_CREDENTIALS: 'off' };
const run = (args) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', env });

// 1. 布尔 flag + 位置工作区：--signals 不再吞 /tmp 路径
r = run(['style', '--signals', ws]);
assert.equal(r.status, 0, `style --signals ws 失败: ${r.stderr}`);
assert.ok(!/工作区不存在/.test(r.stdout + r.stderr), `--signals 吞掉了工作区: ${r.stderr}`);
assert.ok(/风格档案进度/.test(r.stdout), 'style 读到正确工作区档案');
ok('布尔 flag(--signals) 不再吞位置工作区');

// 2. transform <预设> <工作区>(positional[1])
fs.writeFileSync(path.join(ws, 'protocol', 'state.json'), JSON.stringify({ outline: { sections: [{ heading: '一', words: 100 }] }, confirmed: { topic: 't', genre: '散文' } }));
r = run(['transform', 'polish', ws]);
assert.ok(!/工作区不存在/.test(r.stdout + r.stderr), 'transform positional[1] 工作区解析失败');
ok('transform 支持 positional[1] 工作区');

// 3. history <工作区>
r = run(['history', ws]);
assert.ok(!/工作区不存在/.test(r.stdout + r.stderr), 'history positional[0] 工作区解析失败');
assert.ok(/版本快照|还没有版本快照/.test(r.stdout), 'history 输出正常');
ok('history 支持 positional[0] 工作区');

// 4. rollback N <工作区>
r = run(['rollback', '1', ws]);
assert.ok(!/工作区不存在/.test(r.stdout + r.stderr), 'rollback positional[1] 工作区解析失败');
ok('rollback 支持 positional[1] 工作区');

// 5. academic <工作区>
r = run(['academic', ws]);
assert.ok(!/工作区不存在/.test(r.stdout + r.stderr), 'academic positional[0] 工作区解析失败');
assert.ok(/学术论证链/.test(r.stdout), 'academic 输出正常');
ok('academic 支持 positional[0] 工作区');

// 6. point-edit 任意目录：自动创建默认工作区(不再报"工作区不存在")
const cwd = path.join(tmp, 'anywhere');
fs.mkdirSync(cwd, { recursive: true });
r = spawnSync(process.execPath, [BIN, 'point-edit', '不存在的句子。', '改一下'], {
  encoding: 'utf8', env, cwd,
});
assert.ok(!/工作区不存在/.test(r.stdout + r.stderr), `point-edit 仍报工作区不存在: ${r.stderr}`);
assert.ok(/找不到引用的原文/.test(r.stdout + r.stderr), 'point-edit 进入正常流程(找不到原文=工作区已建好)');
ok('point-edit 任意目录自动创建默认工作区');

// 7. 取值 flag 仍正常:--topic "带空格的 主题"
r = run(['synthesize', '--project', tmp, '--topic', '带空格的 主题', '--target', 'readme', ws]);
assert.equal(r.status, 0, `synthesize 取值 flag 失败: ${r.stderr}`);
assert.ok(/readme/.test(r.stdout), 'synthesize --topic/--target 取值正常');
ok('取值 flag(--project/--topic/--target) 仍正确消费参数');

// 8. csl --answer 必须消费下一个参数（真实 token 接入回归：否则会被当成布尔 true）
const pa = cli.parseArgs(['csl', '写门槛', '--answer', '门槛是外婆家的旧木门槛', '--workspace', ws]);
assert.equal(pa.flags.answer, '门槛是外婆家的旧木门槛', '--answer 应取值而非布尔 true');
assert.deepEqual(pa.positional, ['csl', '写门槛'], '--answer 的值不得混入位置参数');
ok('csl --answer 取值 flag 正确消费参数');

// 9. 取值 flag 后面跟"以 -- 开头的正文"（Markdown 前言 ---）也必须当取值
const pa2 = cli.parseArgs(['absorb-sample', '--text', '---\ntitle: 旧稿\n---\n正文', '--source', '旧稿-1', ws]);
assert.equal(typeof pa2.flags.text, 'string', '--text 为 --- 开头的正文时不应退化成布尔 true');
assert.ok(pa2.flags.text.startsWith('---'), `--text 正文被丢弃: ${JSON.stringify(pa2.flags.text)}`);
assert.equal(pa2.flags.source, '旧稿-1', '--source 应取值而非布尔 true');
assert.deepEqual(pa2.positional, ['absorb-sample', ws], '位置参数只应剩命令与工作区');
ok('取值 flag 接 --- 开头的正文仍正确消费参数');

// 10. absorb-sample 端到端：正文与出处都正确落盘（回归：曾被写成 "true"）
const seed = '---\ntitle: 旧稿\n---\n\n那节课没人说话。手抬到一半，又放下了。';
r = run(['absorb-sample', '--text', seed, '--source', '旧稿-1', '--workspace', ws]);
assert.equal(r.status, 0, `absorb-sample 失败: ${r.stderr}`);
const sampleDir = path.join(ws, 'vault', 'style-samples');
const sampleFiles = fs.readdirSync(sampleDir);
const sampleBody = fs.readFileSync(path.join(sampleDir, sampleFiles[sampleFiles.length - 1]), 'utf8');
assert.ok(sampleBody.includes('那节课没人说话'), `样本正文缺失: ${sampleBody}`);
assert.ok(sampleBody.includes('出处：旧稿-1'), `--source 未写入样本: ${sampleBody}`);
assert.ok(!/^\s*true\s*$/m.test(sampleBody), `样本被写成字符串 true: ${sampleBody}`);
ok('absorb-sample 正文以 --- 开头时正确落盘（含出处）');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\ncli-args.test.mjs 全部通过 (${passed} 项)`);
