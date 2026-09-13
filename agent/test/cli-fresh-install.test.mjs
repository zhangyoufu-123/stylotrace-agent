// 回归：全新安装（空目录、零状态）下，任何命令都不许抛原始 JS 错误。
//
// 为什么要有它：用户报"装完之后崩溃无法使用"。查下来是三个真问题——
//   · author-sheet：新工作区没有作者信号时，sheetFromState 返回 {ok:false}，
//     调用方直接读 .length → "Cannot read properties of undefined"
//   · panel：状态文件还不存在时直接 readJson → 原始 ENOENT
//   · cite：没给条目时 JSON.parse("undefined") → "undefined is not valid JSON"
// 它们在"有状态的开发机"上永远复现不出来，只有干净环境才会踩到。
// 所以这个测试专门模拟"刚装完第一次用"：新目录、什么都不给。
//
// 判据：命令可以因为"缺少前置条件"退出非 0，但输出必须是给人看的话，
// 不能是 JS 运行时错误（Cannot read / TypeError / ENOENT / not valid JSON…）。
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, '..', 'bin', 'stylotrace.js');

// 全部命令（含 help 里没列的）
const CMDS = [
  'init', 'panel', 'status', 'governance', 'audience', 'debate', 'fact-check', 'proofread',
  'norm', 'doc', 'originality', 'review', 'rag', 'persona', 'bible', 'emotion', 'curve',
  'consistency', 'diagnose', 'experiment', 'style-adapter', 'modulator', 'author-sheet',
  'profile', 'quote', 'hook', 'checklist', 'style', 'style-vector', 'outline',
  'outline-review', 'style-eval', 'write', 'restyle', 'transform', 'history', 'rollback',
  'genre', 'library', 'knowledge', 'recommend', 'academic', 'character', 'ingest', 'dictate',
  'export', 'cite', 'citations', 'redteam', 'dissect', 'absorb', 'absorb-sample',
  'fingerprint', 'diagnose-sentence', 'doctor', 'version', 'synthesize', 'polish', 'preset',
  'credentials', 'point-edit', 'rewrite', 'roundtrip', 'probe', 'csl', 'run', 'falsify',
  'prism', 'capabilities',
  // 交互类命令也要能在非 TTY 下"说人话"：它们是"装完不能用的重灾区"，
  // 一开始只修了 agent，漏了 clarify/interview/credentials/csl/run。
  'agent', 'clarify', 'interview',
];

// 原始 JS 运行时报错的特征。注意："[stylotrace] Cannot read properties…" 这种
// 带前缀的同样是崩溃——之前 author-sheet 就是这么伪装过去的。
const RAW_CRASH =
  /Cannot read|TypeError|ReferenceError|is not a function|is not valid JSON|Unexpected token|ENOENT: no such file|readline was closed/;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stylotrace-fresh-'));
const crashes = [];

/** 跑一条命令并把 stdout+stderr 一起拿回来（非 0 退出不算异常，这是预期内的）。 */
function run(args, cwd, timeout = 25000) {
  try {
    return execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd, timeout });
  } catch (e) {
    return String(e.stdout || '') + String(e.stderr || '');
  }
}

for (const c of CMDS) {
  const out = run([c], dir);
  if (RAW_CRASH.test(out)) {
    crashes.push({ cmd: c, msg: out.split('\n').filter(Boolean).slice(0, 2).join(' ').slice(0, 160) });
  }
}

assert.equal(
  crashes.length,
  0,
  `全新环境下有命令抛原始 JS 错误（用户会看到"崩溃"）：\n${crashes
    .map((c) => `  · stylotrace ${c.cmd} → ${c.msg}`)
    .join('\n')}`,
);
console.log(`✓ 全新环境 ${CMDS.length} 条命令零崩溃（缺前置条件时给的是人话，不是栈）`);

// 顺带锁住几个具体命令的空状态话术，免得以后又被改回抛错。
// 注意分两种"空"：还没 init（工作区不存在）和 init 了但没内容（状态是空的）。
const noInit = fs.mkdtempSync(path.join(os.tmpdir(), 'stylotrace-noinit-'));

const panelOut = run(['panel'], noInit);
assert.ok(
  /还没有任何工作区状态/.test(panelOut),
  `panel 在无工作区时应给人话提示，实际：${panelOut.slice(0, 120)}`,
);

const asNoInit = run(['author-sheet'], noInit);
assert.ok(
  /工作区不存在/.test(asNoInit),
  `author-sheet 在无工作区时应提示先 init，实际：${asNoInit.slice(0, 120)}`,
);

// init 之后：工作区存在但没有内容 —— author-sheet 不抛错，而是要说明怎么才有内容
run(['init'], noInit);
const asEmpty = run(['author-sheet'], noInit);
assert.ok(
  /还没有可归纳的信号/.test(asEmpty),
  `author-sheet 空状态应给人话提示，实际：${asEmpty.slice(0, 120)}`,
);
console.log('✓ panel / author-sheet 的空状态提示正确（含 init 前后两种空）');
fs.rmSync(noInit, { recursive: true, force: true });

// 非交互环境（无 TTY）下不能甩一句 readline was closed 就退出。
// 每个交互入口都要说清原因 + 给出替代命令。
for (const [cmd, hint] of [
  ['agent', /agent --once/],
  ['clarify', /clarify --once/],
  ['interview', /interview --once/],
]) {
  const out = run([cmd], dir);
  assert.ok(
    /没有可交互的终端/.test(out) && hint.test(out),
    `非 TTY 下 ${cmd} 应说明替代命令，实际：${out.slice(0, 140)}`,
  );
}
console.log('✓ 无 TTY 时 agent / clarify / interview 都给出可用的替代命令');

// --once 要能直接吃参数（宿主 agent / 脚本没法交互输入）
const onceOut = run(['agent', '--once', '想写故乡的门槛', '--workspace', dir], dir, 30000);
assert.ok(
  /"kind"/.test(onceOut),
  `agent --once 带参数应返回决策 JSON，实际：${onceOut.slice(0, 120)}`,
);
console.log('✓ agent --once 可直接带参数（无需交互输入）');

fs.rmSync(dir, { recursive: true, force: true });
console.log('\ncli-fresh-install.test.mjs 全部通过');
