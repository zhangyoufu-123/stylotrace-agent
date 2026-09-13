# Replay 引擎（18）— v1.7 符号化实现

**定义：** Replay = Reactivation + Reevaluation + Recombination + Prediction。
不是"读日志再跑一遍"，而是从 CognitiveEvents 重建 episode → 重算误差/信用 →
从零重算 policy/schema（无状态、幂等）。

## 对照条件

| 条件 | 含义 | 实现 |
| --- | --- | --- |
| A | 不重放（基线） | 不调用 replayOnce |
| B | 重放但不加权 | `credit:'none'`（所有事件等权） |
| C | Credit 加权重放 | `credit:'weighted'` |
| D | 加权 + 巩固（默认） | 默认（weighted + schema 候选） |

## 测试（R1–R5 + DoD，`test/csl-replay.test.mjs`）

- R1 同一事件重放两次 → policy/schema 完全一致（无状态重算，幂等）。
- R2 新 outcome 出现 → 旧判断被 reconsolidation 更新（失败/成功进入 schema 证据链并版本化）。
- R3 高误差/高 credit 经验优先重放。
- R4 重放后未来策略改变：有 draft 失败的任务模式 → `policyFor` 从 `draft` 变 `ask`。
- R5 任务模式隔离：creative 的失败不污染 research 的统计。
- DoD：`Experience → Replay → State Change → Future Behavior Change`，
  以"第一次 draft 失败 → 重放 → 第二次走 ask"的可重复测试证明。

## 落盘

- `vault/csl-policy.json`：模式级策略统计（drafts/asks/failures/successes）。
- `vault/csl-schema.json`：schema 候选（claim + evidence 链 + 版本 + 来源）。
