// 引用（回答哪个问题 / 针对哪一段）必须一路走到模型提示里。
//
// 这是"AI 更好识别用户思维"的落点：用户说"改一下"和"针对「门槛上他等了很久」
// 改一下"，对模型是两回事。UI 上有引用条不代表模型看得到——必须验证到最后一步。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const { composeQuotedInput, agentStep } = await import(path.join(HERE, '..', 'src', 'director.js'));

// ── 1) 拼装规则 ──────────────────────────────────────────
const q = composeQuotedInput('我想写"等不到"这件事', { kind: 'question', text: '这篇最想说的核心是什么？' });
assert.ok(q.includes('我在回答你刚才这个问题'), '回答问题的引用要标明在回答问题');
assert.ok(q.includes('这篇最想说的核心是什么？'), '引用里要带原问题');
assert.ok(q.includes('我想写"等不到"这件事'), '引用里要带用户的回答');
console.log('PASS 回答问题：问题 + 回答都在');

const t = composeQuotedInput('这句太满了', { kind: 'text', text: '门槛上他等了很久。' });
assert.ok(t.includes('针对下面这段文字提修改意见'), '针对文字要标明是改哪一段');
assert.ok(t.includes('门槛上他等了很久。'), '引用里要带原文');
assert.ok(t.includes('只动这一段'), '要明确"别顺手改别处"，否则模型会全文重写');
console.log('PASS 针对段落：原文 + 意见 + 边界都在');

assert.equal(composeQuotedInput('随便说一句', null), '随便说一句', '没有引用时必须原样返回');
assert.equal(composeQuotedInput('随便说一句', { kind: 'text', text: '   ' }), '随便说一句', '空引用不生效');
assert.ok(composeQuotedInput('嗯', { kind: 'text', text: '啊'.repeat(600) }).length < 700, '超长引用要截断');
console.log('PASS 无引用/空引用/超长引用的边界');

// ── 2) 端到端：引用真的进了模型提示 ─────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'quote-input-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
ws.writeState(w, {
  phase: 'clarify',
  confirmed: { topic: '故乡的门槛', genre: '散文' },
  materials: ['门槛'],
  director: { stage: 'clarify' },
});

const seen = [];
globalThis.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body || '{}');
  const prompt = (body.messages || []).map((m) => String(m.content || '')).join('\n');
  seen.push(prompt);
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { role: 'assistant', content: '{"question":"再具体一点？","options":[]}' } }],
    }),
  };
};

await agentStep(
  { apiKey: 'mock', retries: 1, concurrency: 4 },
  w,
  {
    lastInput: '重点不是门槛本身，是等人回来那段时间',
    quote: { kind: 'question', text: '这篇最想说的核心是什么？' },
  },
);

assert.ok(seen.length > 0, '应该至少调用过一次模型');
const joined = seen.join('\n');
assert.ok(joined.includes('这篇最想说的核心是什么？'), '模型提示里必须能看到被回答的问题');
assert.ok(
  joined.includes('重点不是门槛本身，是等人回来那段时间'),
  '模型提示里必须能看到用户的原话',
);
console.log('PASS 端到端：引用确实进了模型提示（不是只在界面上）');

// ── 3) 风格采集不能被引用污染 ───────────────────────────
// 引用的往往是 AI 的提问或文稿原文，把 AI 的话当成用户文风会污染档案。
const vs = ws.readJson(path.join(w, 'vault', 'style-vector.json')) || {};
const blob = JSON.stringify(vs);
assert.ok(!blob.includes('这篇最想说的核心是什么？'), '风格向量里不该出现被引用的 AI 提问原文');
console.log('PASS 风格采集只吃用户自己说的话');

console.log('\nquote-input.test.mjs 全部通过');
