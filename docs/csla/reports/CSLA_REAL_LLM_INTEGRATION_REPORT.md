# CSLA Real LLM Integration Report

**日期：** 2026-08-29 · **范围：** P0 Real LLM Runtime Integration
**验证方式：** 真实 token 冒烟（opt-in）+ 确定性测试（mock/fake）+ CLI 实测
**诚实声明：** 以下所有 token/延迟数字来自真实 DeepSeek 调用；对照实验样本量小（3 题），
只作工程观测，不构成任何统计性结论。

---

## 1. Architecture Bridge

```text
CLI input
   ↓
csl command（agent/src/cli.js）
   ↓
makeLlm(cfg)（agent/src/llm.js —— 唯一 provider factory）
   ↓
OpenAI 兼容适配器（DeepSeek / OpenAI / GLM / Qwen / Gemini-compat / 本地）
   ↓
CSLA runtime（agent/src/csl/runtime.js runTurn）
   ↓
Fast/DeepGate → ActionDispatcher → 真实算子执行（actions.js dispatch → llm.run）
   ↓
stateDelta → state store commit（state.js transition/persist，版本单调）
   ↓
CLI 输出（--debug 显示 mode/action/tokens/latency/state）
```

关键边界：**runtime 不读 API key、不判断 provider**；一切经 `makeLlm` 返回的统一接口。

## 2. makeLlm design

```js
makeLlm({ provider, model, apiKey, baseUrl, timeout, ... }) → LLM Adapter
```

- 返回**可调用函数**（messages→string，兼容语言层旧调用），并附带：
  - `.run({ operator, input, context, state, temperature, maxTokens })` —— 统一算子接口
  - `.provider` / `.model` / `.last`（最近一次调用的 usage/latency/id）
- `LLM_ADAPTERS` 注册表：目前实现 `openai`（OpenAI 兼容协议）；未知 provider 明确报错，不静默回退。
  Anthropic 等协议留作扩展点——不强行新增没有实际需求的实现（规格第 3 节）。

## 3. Provider mapping

| Provider | 协议 | 适配器 | 状态 |
| --- | --- | --- | --- |
| DeepSeek / OpenAI / GLM / Qwen / Gemini-compat / 本地服务 | OpenAI 兼容 chat/completions | `openai` | 已实现，实测通过 |
| Anthropic | messages API | — | 未实现（扩展点，凭据发现仅提示不自动采用） |

provider 改变不影响 State / Runtime / Operators（规格第 19 节）。

## 4. CLI design

```bash
stylotrace csl "<输入>" [--answer "…"] [--deep] [--interactive] [--debug]
                        [--provider 提供商] [--model 模型] [--workspace 工作区] [--json]
```

- 单发：`csl "…"`，`--answer` 回答追问后重跑进深层；`--deep` 强制深通道（TEST A 用）。
- 交互：`csl --interactive`，human → fast(ask) → deep → human → deep，`exit/quit/退出` 退出。
- 调试：`--debug` 输出 Mode / Score+reasons / Action / Provider / Model / Tokens / Latency / State v。
- provider/model 在现有 `loadConfig` 凭据发现之上覆盖，不绕过配置系统。
- 凭据：自动发现（实测 `codex-config:deepseek`），或 `STYLOTRACE_LLM_API_KEY`；key 永不落日志。

## 5. Real token smoke test（实测数据）

运行 `CSL_REAL_LLM=1 npm run test:csl-real`，provider=openai（DeepSeek 兼容端点），model=deepseek-v4-flash。

| 测试 | kind | 动作 | input_tok | output_tok | total | calls | latency | state before→after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fast-smoke | fast | fast | 86 | 40 | 126 | 1 | 1.6s | v0→v0（快通道不动状态，符合设计） |
| TEST A 小猪吃玉米 | deep | abstract→search→generate | 363 | 2039 | 2402 | 4 | 25.9s | v1→v2 |
| TEST B 人机写作 | ask→deep | abstract→search→generate | 432 | 3628 | 4060 | 4 | 44.3s | v0→v2 |
| TEST C 状态续接 | fast | fast | — | — | — | 1 | — | v2（可读上次状态） |

TEST B 细节：第一轮 `Fast→AskHuman`（追问"你最想说的那件事是什么？"），回答后 `acceptAnswer`
把 Core Idea 写入状态（`coreIdea = 问题在思想：AI 太快开始写，没有先想清楚要说什么`），
第二轮进深层，**产出结构化假设，而不是直接成稿**。TEST A 的 3 个假设为真实 LLM 输出
（发散/分析/质疑三个算子各一次），状态版本 +1。

## 6. Cognitive action selected / operator executed

真实轨迹（TEST A/B 相同模式）：

```text
abstract(0.91) → search(0.67) → generate(0.84)
```

`search` 当前为确定性占位（真实 RAG 未接）；`abstract`/`generate`/`native_reasoning` 走真实 LLM。
每个 action 只执行自己被选中的 executor（Cognitive Theater，见第 12 节）。

## 7. Vanilla vs CSLA（规格第 18 节，3 题观测）

| 题目 | vanilla tokens / 延迟 | CSLA kind / 动作 | CSLA tokens / calls / 延迟 | 状态 |
| --- | --- | --- | --- | --- |
| 小猪吃玉米说明什么 | 5168 / 54.4s | fast | 8095 / 1 / 84.0s | v1 |
| 为什么 AI 写作同质化 | 1146 / 12.6s | deep | 6568 / 4 / 77.6s | v2 |
| 门槛展开成写作方向 | 4537 / 58.7s | fast | 3009 / 1 / 38.3s | v1 |

诚实结论：

- **一次性成本 CSLA > vanilla**（多算子编排 + 语言层），这是预期代价，换取结构化假设、动作轨迹与状态。
- **DeepGate 欠调**：第 1、3 题被路由到 fast（p_deep 0.44 / 0.33 < 0.5），但 fast 层语言提示不受约束，
  模型回答长文导致成本反而高。这是真实发现的调参问题（见 Known Limitations），不是声称修复了。
- 样本量 3，不宣称任何统计结论。

## 8. 错误处理（规格第 20 节）

- 语言层失败 → `kind:'error'` + `cognitive.error` 事件 + 状态版本不变；
- 深循环失败 → `kind:'error'` + failure event + 不提交部分结果；
- 单元测试用抛错 mock 验证：失败后 `state.sVersion === 0`，状态文件无写入。

## 9. Existing tests（全部通过）

`node --test`：**58/58**；`npm test`：全部通过（含新增 csl 套件与 llm-bridge）。

## 10. New tests

- `test/llm-bridge.test.mjs`：makeLlm 工厂 / `.run()` 接口 / usage 字段 / provider 映射 / 错误路径（mock fetch，零 token）
- `test/csl-actions.test.mjs` 扩展：认知剧场（askHuman 不成稿、compare 不偷偷检索、stop 后零 LLM 调用）、
  usage 聚合、第 17 节（10 次闲聊 0 次深层算子；复杂任务 ≥3 次）
- `test/csl-runtime.test.mjs` 扩展：错误恢复、Fast 层澄清（任务信号先问、闲聊不追问）、forceDeep
- `test/csl-real.test.mjs`：opt-in 真实冒烟（`CSL_REAL_LLM=1 npm run test:csl-real`），默认跳过，不进常规 CI
- `scripts/experiments/csl-vs-vanilla.mjs`：Vanilla vs CSLA 对照（opt-in）

## 11. Known limitations

1. `search` 仍是确定性占位；证据不来自真实检索（规格允许第一版最小算子集，search 已接接口）。
2. **DeepGate 欠调**：部分推理/创意类输入（如"小猪吃玉米说明什么"）被路由到 fast，且 fast 语言层
   不受"简短回应"约束，长回答成本高。下一步应校准入深信号或给 fast 语言层加预算。
3. 追问问题来自通用 elicitor，不是按任务定制的多轮问题生成（规格 TEST B 的"理想行为"是方向，
   当前通用问题同样满足 Fast→AskHuman→deep 链路）。
4. Anthropic 协议适配未实现（扩展点）。
5. 真实冒烟与对照为手动/opt-in，不在 CI；数据受模型波动影响。

## 12. Cognitive Theater status

断言（全部通过）：

- `CognitiveAction=askHuman` → stateDelta 无 artifact/taskComplete（不成稿）
- `CognitiveAction=compare` → stateDelta 无 evidence（不偷偷检索）
- `CognitiveAction=stop` → 不再有任何 LLM 调用
- 10 次闲聊 → 0 次深层算子；1 次复杂任务 → ≥3 次（浅层不被深层吞掉）

---

## Definition of Done 核对

- [x] makeLlm() 完成（统一工厂 + 适配器注册表 + `.run()` 接口）
- [x] 复用现有真实 provider（OpenAI 兼容，DeepSeek 实测）
- [x] CSLA runtime 可注入真实 LLM
- [x] csl CLI 可运行（one-shot / --answer / --deep / --json）
- [x] interactive mode 可运行（human→fast→deep→human→deep，PTY 与管道均验证）
- [x] Fast layer 可运行（含 Fast 层澄清）
- [x] Deep layer 可运行（ActionDispatcher 真实执行所选动作）
- [x] 真实 cognitive action dispatch（abstract→search→generate 实测）
- [x] state delta 真实提交（v0→v2，版本单调）
- [x] real token smoke test 通过（fast + TEST A + TEST B + 状态续接）
- [x] 小猪测试通过（TEST A）
- [x] 人机写作测试通过（TEST B）
- [x] mock/fake 测试全绿（58/58 + npm test）
- [x] real smoke test 有日志（报告第 5 节）
- [x] 无 secrets 泄漏（key 只脱敏显示，工作区在 /tmp，未入 git）
- [x] Native Model Escape 保留（A5 + `.run({operator:'native_reasoning'})`）
- [x] Cognitive Theater 检测通过（第 12 节）
- [x] 生成本报告
