# 主流能力基线矩阵（15）

> 对应 v1.4 硬要求：每个新组件必须分类为 Existing / Integration / Actual Novelty。

## 基线矩阵（对照实验必跑）

| 基线 | 代表实现 | 对照目的 |
| --- | --- | --- |
| Vanilla LLM | 直接 prompt 生成 | 最低线 |
| OpenAI-style agent runtime | Responses/Agents：compaction + parallel + tools | 主流编排上限 |
| Claude-style context/agent workflow | context engineering + subagents + plan mode | 上下文工程上限 |
| Gemini-style deep research workflow | 多步研究 + MCP + 多模态 | 研究任务上限 |

## 分类标签

- `[E] Existing Capability`：直接吸收，不写进创新 claim。
- `[I] Integration`：把已有能力编排进 CSLA 流程，配集成测试。
- `[N] Actual Research Novelty`：进入研究 claim，必须有 baseline + 消融 + 统计。

新增模块/机制时，在代码头部或设计笔记中标注 `[E]/[I]/[N]`。
