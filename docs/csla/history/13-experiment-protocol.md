# 实验协议（13）— failure-case-first

## 硬规则：先 failure case，再 test，再 implementation

每个模块编码前必须回答：

1. 什么情况下该模块会失败？（状态损坏 / 事件丢失 / 上下文过载 / 错误归因 / 挖掘失败）
2. 失败如何被测试暴露？（确定性断言）
3. 失败被修复后如何回归？

顺序：`Failure Case → Test → Implementation`，禁止 `Implementation → 找例子证明有用`。

每个模块还必须回答（Cognitive Loop Closure）：

- 它改变哪一个状态？
- 它接收什么事件？
- 它产生什么结果？
- 它怎么被反馈？
- 它怎么影响下一轮？

回答不了 → 不加。

## 核心实验（E1–E8）

- E1 创新挖掘：直接生成 vs 固定问卷 vs IG 提问。
- E2 候选综合：单 LLM vs 多采样投票 vs 多算子综合。
- E3 决策学习：静态风格 vs 编辑偏好 vs 决策轨迹学习。
- E4 信用：终端奖励 vs 均匀传播 vs 学习信用 vs 反事实信用。
- E5 巩固：无 vs 新颖性 vs 误差 vs 信用加权。
- E6 纵向协作：session t+1 是否优于 t。
- E7 联合创新：人独作 vs AI 独作 vs 人+常规 AI vs 人+CSLA。
- E8 控制权校准：何时该说/问/建议/执行/沉默。

## 五个证伪实验（必须主动检验）

1. CoALA + terminal reward 等算力对比（若追平，CSLA 无增量）。
2. 信用坍缩到单一模块或振荡（玩具 oracle 验证 C 是否收敛到真贡献排序）。
3. 口述置信高估导致错误路由（先用 self-consistency 基线证明 U 代理有效）。
4. 记忆污染使"越学越差"（验证门是硬前提）。
5. 世界模型幻觉/误差累积（预测不提升规划就不保留 world model）。

## 方法学约束

- 配对运行（同种子/同温度）隔离单模块差异；多次重复取均值 + 置信区间。
- 每机制有 baseline + ablation；指标公式写死（RecoveryRate / CL / ECE-to-action /
  MemoryEfficiency / Auditability）。
- 失败时先分析机制，不修改 benchmark 或事后改定义。
