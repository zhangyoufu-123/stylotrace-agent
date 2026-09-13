# LLM Operator 协议（10）

## 模型无关（Model Agnostic）

支持 OpenAI / Anthropic / Gemini / Qwen / DeepSeek / GLM / Kimi / MiniMax / Local，
模型更换不要求理论或 runtime 重写（ADR-001、ADR-009）。

## LLM = 高速认知算子

可执行 Generate / Reason / Compare / Abstract / Induce / Deduce / Abduce / Analogize /
Critique / SearchPlan / Simulate / Verify / Write / Visualize。

CSLA 负责 When / Why / Which / HowMany / WithWhatContext / WhatToRemember / WhatToUpdate。

## 协议

```text
Task/Goal + Current State + Relevant Memory + Evidence + Constraints
+ Cognitive Mode + Expected Output + Uncertainty + Budget + Provenance
→ Context Router → LLM（不塞全部历史）
```

实现：`llm.js`（单网关，需扩展 provider 抽象）、`operators.js`（上下文打包）。
