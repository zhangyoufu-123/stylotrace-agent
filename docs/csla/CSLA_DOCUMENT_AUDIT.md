# CSLA Document Audit

> 2026-08-28 · 全仓库 CSLA/JCC 文档审计（哈希 = sha256 前 12 位）。
> 判定：Current / Historical / Duplicate / Supporting / External-source。

| File | Hash | Version | Type | Current? | Dup? | Conflicts? | Action | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 00-SOURCE-OF-TRUTH.md | cd9475a4d222 | — | Index | ✅ | no | no | keep | 唯一真相索引 |
| 01-research-goal.md | c4943e9b7049 | v1.8 | Theory | ✅ | no | no | keep | canonical |
| 02-cognitive-state.md | c30755cc0c55 | v1.8 | Theory | ✅ | no | no | keep | canonical |
| 03-motivation-goal.md | 3ede33ae034c | v1.8 | Theory | ✅ | no | no | keep | canonical |
| 04-memory-reasoning.md | 3925677042c1 | v1.8 | Theory | ✅ | no | no | keep | canonical |
| 05-world-model.md | 9f24c57ba6e3 | v1.8 | Theory | ✅ | no | no | keep | canonical |
| 06-control-metacognition.md | 04d1b9632841 | v1.8 | Theory | ✅ | no | no | keep | canonical |
| 07-credit-learning.md | b75115ca9700 | v1.8 | Theory | ✅ | no | no | keep | canonical |
| 08-jcc-human-ai.md | f0ff924e0977 | v1.8 | JCC | ✅ | no | no | keep | canonical |
| 09-runtime.md | 93f82c972cf4 | v1.6→v1.8 | Runtime | ✅ | no | no | keep | 当前实现与原则 |
| 10-jcc.md | f4c75859b804 | — | JCC | ✅ | no | no | keep | JCC 单一权威 |
| 10-llm-operator-protocol.md | 1bac86f31b40 | v1.8 | Integration | ✅ | no | no | keep | canonical |
| 11-stylotrace-integration.md | a32eabe526b8 | v1.8 | Integration | ✅ | no | no | keep | canonical |
| 12-experiment-protocol.md | 63005fa6e259 | v1.8 | Experiment | ✅ | no | no | keep | canonical |
| 13-api.yaml | 0df38ab274e0 | v1.2 | API | ✅ | no | no | keep | 当前 API 契约 |
| 14-open-problems.md | 685f41323667 | v1.8 | Theory | ✅ | no | no | keep | canonical |
| 15-mainstream-baseline-matrix.md | 876148910cb6 | v1.4+ | Integration | ✅ | no | no | keep | 能力三分类 |
| ADR/CSLA_ARCHITECTURE_DECISIONS.md | 9d3c3cd8fecf | v1.2 | ADR | ✅ | no | no | keep | 12 条 ADR |
| reports/CSLA_IMPLEMENTATION_READINESS_REPORT.md | 6ce12aaba19f | v1.0 | Report | ✅ | no | no | keep | readiness |
| reports/CSLA_THEORY_AUDIT.md | b25c41d80309 | v1.0 | Report | ✅ | no | no | keep | C1–C8 审计 |
| reports/CSLA_PROJECT_UNDERSTANDING_REPORT.md | 9ac5e7abfdb6 | v1.0 | Report | ✅ | no | no | keep | 理解报告 |
| history/CSLA_v1_8_BRAIN_INSPIRED_COGNITIVE_CONTROL.md | d2caefc0d700 | v1.8 | Theory | current-src | no | no | archive | 当前理论主文件（深度版本） |
| history/CSLA_v1_6_EXECUTABLE_COGNITIVE_RUNTIME.md | 98a353c3ee3d | v1.6 | Runtime | ref | no | C1（固定24步） | archive | 参考语义，superseded by v1.8 原则 |
| history/CSLA_v1_7_REASONING_MEMORY_ENGINE.md | 795cdda82bc9 | v1.7 | Theory | hist | no | no | archive | 保留唯一份 |
| history/CSLA_CURRENT_MASTER.md | f53de06707f5 | v1.5 | Theory | hist | no | C2（命名） | archive | 实为 v1.5 前沿审计 |
| history/CSLA_v1_2_COMPLETE_SPEC.md | 92934054a055 | v1.2 | Spec | hist | no | no | archive | 完整规格 |
| history/CSLA_v1_0_RESEARCH_SPEC.md | 184315c6f9f4 | v1.0 | Spec | hist | no | no | archive | 研究规格 |
| history/CSLA_STYLOTRACE_MASTER_UPDATE_PLAN.md | 05302dff979b | v1.0标 | Integration | hist | no | C3 | archive | 总设计（版本头待升） |
| history/CSLA_v1_4_MAINSTREAM_INTEGRATION.md | b8b50584cb3f | v1.4 | Integration | hist | no | no | archive | superseded by v1.8 |
| history/00-overview.md … 18-replay-engine.md | — | v1.4–v1.7 | Historical | hist | no | no | archive | 旧 canonical，被新 01–14 取代 |
| history/CODEX_MASTER_HANDOFF_PROMPT.md | dd3f91d81210 | v1.0 | Handoff | hist | no | no | archive | 执行入口（历史） |
| history/16-handoff-v1-4.md | 9896835562be | v1.4 | Handoff | hist | no | no | archive | v1.4 执行入口 |
| history/AGENTS_CSLA.md | 4693997c2afb | — | Integration | hist | no | no | archive | 工程规则 |
| history/README_CSLA.md | bbc16c3abe67 | — | Historical | hist | no | no | archive | 旧定位 |
| **deleted** history/CODEX_MASTER_HANDOFF_PROMPT_v1_4.md | 9896835562be | v1.4 | Handoff | — | ✅ exact | no | delete | = 16-handoff-v1-4.md |
| **deleted** history/CSLA_API_CONTRACT.yaml | 0df38ab274e0 | v1.2 | API | — | ✅ exact | no | delete | = 13-api.yaml |
| **deleted** history/CSLA_ARCHITECTURE_DECISIONS.md | 9d3c3cd8fecf | v1.2 | ADR | — | ✅ exact | no | delete | = ADR/ 副本 |
| ⚠ Downloads/CSLA_v1_7_REASONING_MEMORY_ENGINE (1).md | 795cdda82bc9 | v1.7 | Duplicate | — | ✅ exact | no | external | 与 v1.7.md 及仓库副本完全一致，建议删除 |
