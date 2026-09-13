# CSLA Documentation Cleanup Report

> 2026-08-28 · 文档基础设施清理（未开发、未改代码/测试/API）。

## 1–6. 扫描与统计

- 扫描文档：53 份（仓库 canonical+history+reports 48 份 + Downloads 外部源 5 份）。
- 发现重复：4 组。
- exact duplicate：4（v1.7 Downloads 双份；history 内 handoff v1.4 / API / ADR 各 1 个副本）。
- near duplicate：0。
- archive：37 份（全部旧版 canonical + v1.0–v1.8 规格 + handoff + master plan → history/）。
- delete（仓库内）：3（纯复制副本：handoff v1.4、API、ADR 的 history 重复件）。
- ⚠ 外部待删：`Downloads/CSLA_v1_7_REASONING_MEMORY_ENGINE (1).md`（精确重复，未动用户文件）。

## 7. 当前 canonical 文件

`docs/csla/`：00-SOURCE-OF-TRUTH + 01–14 + 10-jcc + 13-api.yaml + 15-baseline-matrix + ADR/ + reports/。

## 8–9. 冲突与处理

6 项记录于 `CSLA_DOCUMENT_CONFLICTS.md`；全部有当前解释，以 v1.8 为 current，未改历史文件。

## 10. 代码与文档不一致

- 文档（history/17）写"50 tests passing"，仓库当前实测 **51 tests passing**（新增 csl-replay）——已由 09-runtime.md 更新为 51。
- 文档称 Replay 已实现：仓库确实有 `agent/src/csl/replay.js` 且 R1–R5 测试通过（verified）。
- 文档称 Consolidation/Future Simulation 已设计：仓库无实现（如实标注）。

## 11. JCC 缺失

`CSLA_v1_3_JCC_SPEC.md` 从未存在；JCC 单一权威 = `docs/csla/10-jcc.md`（已建）。

## 12. 当前 Runtime 真实状态

实现于 `agent/src/csl/`：state/events/elicit/operators/ledger/replay/runtime，51 测试全绿
（FastSalience/DeepGate/确定性 Authority/24 步调度/Replay R1–R5/Basic Credit）。
未实现：Consolidation、Future Simulation、Adaptive Policy 学习版、多模态状态。

## 13. 当前 Theory 真实状态

Current = **CSLA v1.8**（Brain-Inspired Cognitive Control & Language Planning）；
原则 = Neural Principle → Computational Function → Runtime Operator；自适应运行时；
4 类硬编码（Safety/State Integrity/Auditability/Resource-Risk）；LLM Freedom Rule。

## 14. Codex 今后优先阅读

```text
docs/csla/00-SOURCE-OF-TRUTH.md
→ 09-runtime.md → 02/03/04/06/07/08 → 10/11 → 13-api.yaml → ADR/
```
