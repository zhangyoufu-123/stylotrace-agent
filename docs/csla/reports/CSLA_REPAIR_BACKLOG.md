# CSLA Repair Backlog

**日期：** 2026-08-29 · 来源：Full System Reality Audit · 本审计已执行 P0-1；其余等待开工令。

## P0（已修）

| # | 项 | 状态 |
| --- | --- | --- |
| P0-1 | search executor 占位字符串 → 真实检索通路（buildSearchQueries + requestHostSearch 排队；证据 pending 非伪造） | **已修**（本审计）；A1 + csl-integration 回归断言 |

## P1（核心能力不完整）

| # | 项 | 现状 |
| --- | --- | --- |
| P1-1 | Reasoning 算子补齐（Induce/Deduce/Abduce/Analogy/Causal/Counterfactual/Recombine/Simulate） | 4/12 真实，8 占位 |
| P1-2 | Induction 引擎（多假设→条件 schema，评分含 Exceptions/Complexity） | 类型级聚合 |
| P1-3 | HRME ↔ 产品记忆打通（edits/style/library → Episodic；检索供写作） | 平行未接 |
| P1-4 | ContextAssembler 贯穿产品（39 模块自拼 prompt → 统一组装） | csl 有，产品无 |
| P1-5 | Style 预测—误差闭环（Draft→Edit→PredictionError→Update） | 目前 STYLE THEATER |
| P1-6 | HumanModel 接线（分区 → 提问/写作行为） | 目前 MODEL THEATER |
| P1-7 | 显式 session/resume（checkpoint 恢复原认知会话指针） | 目前重跑语义 |
| P1-8 | 产品 state.json 14 个直接写点收敛到 Kernel | Derived View 计数 |

## P2（生产质量）

| # | 项 |
| --- | --- |
| P2-1 | 观测性统一（trace_id/cost 全链路） |
| P2-2 | 同会话并发写锁 |
| P2-3 | Streaming |
| P2-4 | 包拆分（@csla/core / @csla/runtime / @stylotrace/app） |
| P2-5 | Hooks 系统 / Multimodal / World Model / Executive（文档→实现） |

## 原则

一个修复 → 测试 → 集成 → 真实运行 → 下一个；禁止 Big Bang；修复后必须 node --test / npm test / e2e / CSL real smoke 全绿。
