# CSLA Document Conflicts

> 2026-08-28 · 只记录冲突与当前解释，不悄悄修改历史文件。

| # | File A | File B | Conflict | Current interpretation | Reason |
| --- | --- | --- | --- | --- | --- |
| C1 | history/CSLA_v1_6（24 步固定流水线） | v1.8（Adaptive Runtime） | 运行时是否固定顺序 | 24 步 = capability inventory / 参考执行语义，**不是强制流水线**；实际按状态动态选动作 | v1.8 §33–34 |
| C2 | history/CSLA_CURRENT_MASTER.md（名字=CURRENT） | 内容实为 v1.5 | 文件名暗示最新，内容不是 | 该文件归档为 v1.5 前沿审计；CURRENT 以 00-SOURCE-OF-TRUTH 为准 | 内容核对 |
| C3 | history/CSLA_STYLOTRACE_MASTER_UPDATE_PLAN.md（标 v1.0） | v1.4/v1.6/v1.8 | 版本头陈旧 | 该文件为历史集成总设计，superseded by 00-SOURCE-OF-TRUTH | 版本头未随内容升 |
| C4 | 旧文档 Goal=fixed prompt | v1.8 Desire→Goal | 目标来源 | 当前为 Desire→Goal→Strategy→Plan→Action；G_inferred 需人类确认 | v1.8 §19–20 |
| C5 | 旧文档 Memory=retrieval/RAG | v1.7/v1.8 Memory=关系系统 | 记忆定义 | 当前为关系系统（Binding/Separation/Completion/Comparison/Replay/Recombination/Consolidation），检索≠学习 | v1.7 §8、v1.8 §6 |
| C6 | 交接提示词引用 CSLA_v1_3_JCC_SPEC.md | 该文件从未存在 | 缺失引用 | JCC 单一权威 = `10-jcc.md`（v1.4 起已并入） | 文件核对 |

结论：无阻碍性冲突；所有冲突均有明确当前解释，并以 v1.8 + 00-SOURCE-OF-TRUTH 为 current。
