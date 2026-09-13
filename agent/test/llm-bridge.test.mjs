// makeLlm 统一接口单元测试：provider 工厂 / run() 算子接口 / usage 可读 / 错误路径。
// 全程 mock fetch，零 token、零网络。
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const llmMod = await import(path.join(HERE, '..', 'src', 'llm.js'));

function fakeFetch(payload) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  });
}

const payload = {
  id: 'req_fake_1',
  model: 'fake-model',
  choices: [{ message: { content: '你好，这是回复。' } }],
  usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
};

// 1) makeLlm 返回可调用对象，且带 .run 统一算子接口
const llm = llmMod.makeLlm({ provider: 'openai', model: 'fake-model', baseUrl: 'https://fake.test/v1', apiKey: 'sk-test' });
assert.equal(typeof llm, 'function', 'makeLlm 应返回可调用函数');
assert.equal(typeof llm.run, 'function', 'makeLlm 应提供 .run 统一算子接口');
assert.equal(llm.provider, 'openai');
assert.equal(llm.model, 'fake-model');

// 2) .run 返回统一结构：output/usage/model/provider/latencyMs/rawId
const oldFetch = globalThis.fetch;
globalThis.fetch = fakeFetch(payload);
try {
  const r = await llm.run({ operator: 'abstract', input: { coreIdea: 'x' }, context: '发散生成' });
  assert.ok(r.output.includes('你好'), `output=${r.output}`);
  assert.equal(r.provider, 'openai');
  assert.equal(r.model, 'fake-model');
  assert.equal(r.rawId, 'req_fake_1');
  assert.equal(r.usage.input_tokens, 12);
  assert.equal(r.usage.output_tokens, 7);
  assert.equal(r.usage.total_tokens, 19);
  assert.ok(r.latencyMs >= 0);

  // 3) 可调用兼容：messages→string，且记录 last（语言层可观测）
  const text = await llm([{ role: 'user', content: 'ping' }]);
  assert.ok(text.includes('你好'));
  assert.equal(llm.last.usage.total_tokens, 19);
  assert.equal(llm.last.id, 'req_fake_1');
} finally {
  globalThis.fetch = oldFetch;
}

// 4) provider 映射：未知 provider 明确报错，不静默回退
assert.throws(() => llmMod.makeLlm({ provider: 'not-a-provider' }), /不支持的 LLM provider/);

// 5) 错误路径：网络失败抛出 LlmError（retryable），run 不吞错
globalThis.fetch = async () => {
  throw new Error('ECONNREFUSED');
};
try {
  await llm.run({ operator: 'search', input: 'x' });
  assert.fail('网络失败应抛出');
} catch (err) {
  assert.ok(err instanceof llmMod.LlmError, `应为 LlmError: ${err.name}`);
  assert.ok(err.retryable, '网络错误应可重试');
}
globalThis.fetch = oldFetch;

console.log('PASS llm-bridge（makeLlm 工厂 / run() 接口 / usage / provider 映射 / 错误路径）');
