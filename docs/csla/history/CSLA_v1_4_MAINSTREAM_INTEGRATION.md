# CSLA v1.4 — Mainstream Integration & Executable Cognitive Runtime

**状态：** 实施基线（2026-08-28 冻结）· 本文档是 v1.4 主文件，执行入口见 `16-handoff-v1-4.md`。

## 0. 核心判断

CSLA **不再重造 Claude/GPT**。主流 LLM/agent runtime 已提供的能力一律吸收为底层基础设施；
CSLA 只做这些能力之上的一层：**什么时候用谁、给它什么、为什么再搜索、为什么再问人、
什么结果应该留下、一次结果之后系统应该学什么**。

```text
Human
  → JCC / Shared Cognitive State
    → CSLA（认知运行时）
      → LLM / Agent Runtime（GPT / Claude / Gemini / Local，作为 Cognitive Operators）
        → Tools / World（MCP / 搜索 / 文件 / 多模态）
```

## 1. 直接吸收的主流能力（不视为创新）

Reasoning、Context/Compaction、Multi-agent、Search、Tool use、MCP、Multimodality、
long context、RAG、personalization——以上全部视为底层基础设施。

事实依据（2026-08 核验）：

- OpenAI：长任务、持久 reasoning、compaction、并行编排、程序化工具调用、沙箱；
- Anthropic：context engineering、plan/agent workflows、subagents、动态工具；
- Google Gemini Deep Research：多步研究、MCP、多模态分析；
- MCP：resources/prompts/tools 标准化连接。

## 2. 真正剩下的核心

```text
Desire/Goal
+ Shared Cognitive State
+ Innovation Elicitation
+ Cognitive Context Routing
+ Human/AI Authority
+ Outcome Ledger
+ Cross-module Credit
+ Credit-weighted Consolidation
+ Experience-to-Learning
```

主线：

```text
Human Insight → Shared State → LLM Deliberation → Outcome → Credit → Future Adaptation
```

## 3. 工程决定（写死）

- 第一阶段不训练模型，不改 Transformer，不做大规模基础模型微调；
- 直接用 GPT / Claude / Gemini / Local LLM 作为 Cognitive Operators；
- 优先复用现成 LLM API 与 agent runtime，不重复实现推理/检索/工具/多模态。

## 4. 冻结的第一版最小链路

```text
模糊想法
→ Goal / Desire State
→ Innovation Elicitation
→ Shared Cognitive State
→ Context Router
→ 多个 LLM Operators
→ 候选思想
→ Hypothesis Abstraction
→ Search / Evidence
→ Critique / Counterexample
→ Human Alignment
→ Synthesis
→ Final Artifact
→ Outcome
→ Cognitive Trace
→ Basic Credit
→ Memory / Schema Update
→ 下一次协作
```

## 5. 第一批实现（v1.4 清单）

```text
CognitiveStateStore        ✅ 已实现（agent/src/csl/state.js）
EventStore/CognitiveTrace  ✅ 已实现（csl/events.js，已接线 absorbEdit）
Goal/Desire State          🔗 复用 governance.js + intent.js（集成，非新建）
InnovationElicitor         ✅ 已实现（csl/elicit.js）
ContextRouter              ✅ 已实现（csl/operators.js）
LLMOperatorPool            ✅ 已实现（csl/operators.js）
Search/Tool adapters       🔗 复用 rag.js + mcp.js + llm.js（集成，非新建）
OutcomeLedger              ✅ 已实现（csl/ledger.js）
BasicCredit                ✅ 已实现（csl/ledger.js，B0/B1/B2）
```

## 6. 能力基线矩阵（硬要求）

以后每增加一个东西，必须先判断它属于哪一类，并写进设计/报告：

| 类别 | 含义 | 处理 |
| --- | --- | --- |
| Existing Capability | 主流 runtime 已提供 | 吸收，不写进创新 |
| Integration | 把已有能力编排进 CSLA 流程 | 写为集成项，配集成测试 |
| Actual Research Novelty | 尚未被验证的认知机制 | 才允许进入研究 claim，必须有 baseline+消融 |

对照基线至少包含：

```text
Vanilla LLM
OpenAI-style agent runtime
Claude-style context/agent workflow
Gemini-style deep research workflow
```

CSLA 的对照实验必须等算力/等预算地跑这些基线，才允许报告增量。

## 7. 与已有文档的关系

- JCC 单一权威：`10-jcc.md`（对应交接提示词中的 `CSLA_v1_3_JCC_SPEC.md`，已合并为本文档体系）。
- C1–C8 修订：`../design_notes/C1-C8-revisions.md`。
- 实验协议（含 failure-case-first 与 E1–E8）：`13-experiment-protocol.md`。
