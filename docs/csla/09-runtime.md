# Runtime（09）— 当前实现与原则

## 原则（v1.8）

- 24 步是 capability inventory / 参考执行语义，**不是强制流水线**。
- 实际每一步由状态/目标/不确定性/结果驱动选择动作（Adaptive Cognitive Control）。
- 硬编码只允许 Safety / State Integrity / Auditability / Resource-Risk。

## 已实现（agent/src/csl/）

| 模块 | 状态 | 测试 |
| --- | --- | --- |
| state.js | ✅ 版本化 S^C | csl-state |
| events.js | ✅ 事件账本 + human.edit 接线 | csl-events |
| elicit.js | ✅ 创新挖掘（F2 先问不写） | csl-elicit |
| operators.js | ✅ 算子池 + 上下文路由 | csl-operators |
| ledger.js | ✅ Outcome + Basic Credit | csl-ledger |
| replay.js | ✅ Replay（R1–R5） | csl-replay |
| runtime.js | ✅ 24 步调度（快答/深问/闭环） | csl-runtime |

## 未实现（已设计）

Consolidation 引擎、Future Simulation、Adaptive Policy（学习版）、多模态状态、E1–E8 实验。
