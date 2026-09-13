# CSLA × Stylotrace — 总览（00）

**状态：** v1.4（2026-08-28 冻结）· 本文档是 docs/csla/ 的入口与单一真相索引。
**实施基线：** 以 `CSLA_v1_4_MAINSTREAM_INTEGRATION.md` 为准——站在主流 LLM/agent runtime 之上，
不重造推理/检索/工具/多模态；新增组件必须按 `15-mainstream-baseline-matrix.md` 分类为
Existing / Integration / Actual Novelty。
**执行入口：** `16-handoff-v1-4.md`。

## 项目一句话

Stylotrace 是 JCC/CSLA 的第一实验场与产品载体：一个从"作者修改"升级为"人机联合认知系统"的
深度写作 Agent。CSLA 研究"AI 如何从经验中改变自己"；JCC 研究"Human+AI 如何共同改变联合认知状态"；
Stylotrace 同时承载两者。

## 目标架构

```text
Human
  ↕ Joint Cognitive Interface
Shared Cognitive State (J_t)
  ↕ CSLA Cognitive Runtime
  ├── CognitiveStateStore（版本化 S^C + Θ）
  ├── EventStore / CognitiveTrace
  ├── InnovationElicitor
  ├── LLMOperatorPool + ContextRouter
  ├── Evaluation / Deliberation
  ├── OutcomeLedger + BasicCredit
  ├── Replay / Consolidation（二期）
  └── Authority Controller（二期）
  ↕ LLM / Tools / Web / Multimodal
```

## 冻结的 MVP 运行链（CSLA Milestone 0）

```text
vague idea
→ Cognitive State
→ InnovationElicitor（问一个高价值问题）
→ Core Idea（保护 Human ownership of K）
→ Context Router
→ LLM Operators（A/B/C 并行，各看不同上下文）
→ Candidates
→ Evaluation（验证/矛盾/反例）
→ Human Choice（决策门）
→ Synthesis（(K,F)→Content →(K,F,Goal)→Presentation）
→ Final Work
→ Outcome
→ Cognitive Trace
→ Basic Credit
→ State / Memory Update
→ Next Session
```

里程碑验收：同一任务重复 N 次，若行为/产出无可见变化则学习失败；第一次犯错后若永远重复则信用失败。

## 文档索引

| 文件 | 内容 |
| --- | --- |
| 01 | 研究目标（CSLA / JCC 双线） |
| 02 | 神经科学原则（只取计算原则，不做脑区映射） |
| 03 | 认知状态（S^C/Θ 拆分，C1） |
| 04 | 记忆（M^E/M^S/M^W，C5） |
| 05 | 世界模型（结构化优先，C4） |
| 06 | 推理算子（统一接口） |
| 07 | 元认知（采样代理，C6） |
| 08 | 信用分配（C(i,t,e\|B)，C3/C7） |
| 09 | 巩固（replay≠retrieval，证据链） |
| 10 | **JCC（单一权威定义）** |
| 11 | 人机交互（快/深双循环，决策门） |
| 12 | 多模态（模态选择原则） |
| 13 | 实验协议（failure-case-first，E1–E8） |
| 14 | 开放问题（M1–M16 状态） |
| 15 | 主流能力基线矩阵（Existing/Integration/Novelty） |
| CSLA_v1_4_MAINSTREAM_INTEGRATION.md | v1.4 主文件（实施基线） |
| 16 | Codex 交接提示词 v1.4（执行入口） |

设计修订记录：`../design_notes/C1-C8-revisions.md`。
