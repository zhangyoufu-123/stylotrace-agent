// LLM 客户端：OpenAI 兼容 chat/completions（DeepSeek / GLM / OpenAI / 本地服务均可）。
// 可靠性：超时、指数退避重试、空响应重试（推理模型可能把 token 用尽）。
export class LlmError extends Error {
  constructor(message, { status = 0, retryable = false } = {}) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
    this.retryable = retryable;
  }
}

export class LlmEmptyError extends LlmError {
  constructor(message = 'LLM 返回空内容（推理模型可能把 token 用尽）') {
    super(message, { retryable: true });
    this.name = 'LlmEmptyError';
  }
}

export async function chatDetailed(cfg, messages, opts = {}) {
  const { maxTokens = cfg.maxTokens, temperature = 0.8, json = false } = opts;
  const url = `${cfg.baseUrl}/chat/completions`;
  const body = { model: cfg.model, messages, max_tokens: maxTokens, temperature };
  if (json) body.response_format = { type: 'json_object' };

  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new LlmError(`网络请求失败: ${err.message}`, { retryable: true });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new LlmError(`LLM API ${res.status}: ${text.slice(0, 300)}`, {
      status: res.status,
      retryable: res.status >= 500 || res.status === 429,
    });
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message || {};
  let content = msg.content;
  // 推理模型（如 deepseek-v4-flash）在思考 token 耗尽预算时可能只返回 reasoning_content，
  // 此时把推理尾部作为兜底内容，避免把有效回答误判为"空响应"。
  if (typeof content !== 'string' || !content.trim()) {
    if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
      content = msg.reasoning_content.trim();
    }
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new LlmEmptyError();
  }
  const usage = data.usage || {};
  return {
    content,
    usage: {
      input_tokens: usage.prompt_tokens ?? 0,
      output_tokens: usage.completion_tokens ?? 0,
      total_tokens: usage.total_tokens ?? 0,
    },
    id: String(data.id || ''),
    model: String(data.model || cfg.model || ''),
    latencyMs: Date.now() - t0,
  };
}

export async function chat(cfg, messages, opts = {}) {
  const r = await chatDetailed(cfg, messages, opts);
  return r.content;
}

export async function chatDetailedWithRetry(cfg, messages, opts = {}) {
  const retries = opts.retries ?? cfg.retries ?? 4;
  const baseDelay = opts.baseDelay ?? 1500;
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await chatDetailed(cfg, messages, opts);
    } catch (err) {
      lastErr = err;
      if (!err.retryable) throw err;
      if (i === retries - 1) break;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** i));
    }
  }
  throw lastErr;
}

export async function chatWithRetry(cfg, messages, opts = {}) {
  const retries = opts.retries ?? cfg.retries ?? 4;
  const baseDelay = opts.baseDelay ?? 1500;
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await chat(cfg, messages, opts);
    } catch (err) {
      lastErr = err;
      if (!err.retryable) throw err;
      if (i === retries - 1) break;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** i));
    }
  }
  throw lastErr;
}

function parseJsonSafe(content, label = 'LLM 输出') {
  try {
    return parseJsonContent(content, label);
  } catch {
    return null;
  }
}

/**
 * OpenAI 兼容适配器（DeepSeek / OpenAI / GLM / Qwen / Gemini-compat / 本地服务）。
 * 返回可调用函数（messages→string，兼容旧调用），并附带：
 *   .run({operator, input, context, state, budget}) → 统一算子接口（含 usage/latency/id）
 *   .provider / .model
 */
function openaiAdapter(cfg, opts = {}) {
  const temperature = opts.temperature ?? 0.6;
  const maxTokens = opts.maxTokens;
  const call = async (messages, callOpts = {}) => {
    const r = await chatDetailedWithRetry(cfg, messages, { temperature, maxTokens, ...callOpts });
    call.last = { usage: r.usage, latencyMs: r.latencyMs, id: r.id, model: r.model };
    return r.content;
  };
  call.provider = 'openai';
  call.model = cfg.model || '';
  call.run = async ({ operator = 'chat', input, context, state, temperature: t, maxTokens: m } = {}) => {
    const payload = input ?? state ?? {};
    const content =
      typeof payload === 'string'
        ? payload
        : `${context ? `${context}\n` : ''}${JSON.stringify(payload)}`;
    const r = await chatDetailedWithRetry(cfg, [{ role: 'user', content }], {
      temperature: t ?? temperature,
      maxTokens: m ?? maxTokens,
    });
    return {
      output: r.content,
      usage: r.usage,
      model: r.model || cfg.model || '',
      provider: call.provider,
      latencyMs: r.latencyMs,
      rawId: r.id,
      structured: parseJsonSafe(r.content),
    };
  };
  return call;
}

/** provider 适配器注册表：CSLA/runtime 不感知具体 provider，只认 makeLlm 返回的统一接口。 */
export const LLM_ADAPTERS = {
  openai: openaiAdapter,
};

/**
 * 唯一 provider factory：makeLlm(config) → 统一 LLM Adapter。
 * runtime 禁止自己读 API key / 判断 provider；一切经此工厂。
 * 目前实现 OpenAI 兼容协议（DeepSeek/OpenAI/GLM/Qwen/Gemini 兼容端点均走此）；
 * Anthropic 等协议适配留作 provider 扩展点（不强行新增无实际需求的实现）。
 */
export function makeLlm(cfg = {}, opts = {}) {
  const provider = String(cfg.provider || 'openai').toLowerCase();
  const adapter = LLM_ADAPTERS[provider];
  if (!adapter) {
    throw new Error(`不支持的 LLM provider: ${provider}（可用: ${Object.keys(LLM_ADAPTERS).join(', ')}）`);
  }
  return adapter(cfg, opts);
}

// 从 LLM 文本中提取 JSON（容忍代码围栏与前后缀）。
export function parseJsonContent(content, label = 'LLM 输出') {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {}
    }
    // 宽容提取（v0.57）：LLM 输出被 max_tokens 截断导致 JSON 不完整时，
    // 至少抢救顶层关键字段（question/recommendation 等），
    // 避免把"本来问得很好"的问题整段扔掉、退化成模板兜底问句。
    const rescued = {};
    const grab = (key) => {
      const m = cleaned.match(new RegExp(`"${key}"\\s*:\\s*"([^"]{3,})`));
      if (m) rescued[key] = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    };
    for (const k of [
      'question',
      'recommendation',
      'intent',
      'summary',
      'article',
      'tension',
      'readerTakeaway',
    ]) {
      grab(k);
    }
    if (rescued.question || Object.keys(rescued).length) return rescued;
    throw new LlmError(`${label} 不是合法 JSON: ${cleaned.slice(0, 200)}`);
  }
}
