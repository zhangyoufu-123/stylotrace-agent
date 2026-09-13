# HRME — Hippocampal-inspired Relational Memory Engine（17）第一攻坚模块

> **定位：** 受海马计算原则（绑定/分离/补全/巩固/重放/再巩固/选择性遗忘）启发的
> **记忆生命周期引擎**，不是脑区映射、不声称人脑复制（ADR-011）。
> 研发协议：Scientific Basis → Computational Principle → Math Model → Minimal
> Implementation → Benchmark → Red Team → Runtime Integration（本模块处于 4–6 阶段）。

## 核心：记忆不是“抽屉”，是生命周期

```text
Observe → Encode → Bind → Separate → Store → Retrieve → Compare → Generalize
→ Challenge → Validate → Consolidate → Replay → Reconsolidate → Decay/Preserve
```

层级（按生命周期，非重要度抽屉）：

```text
M1 Episodic（具体经历：谁/什么/何时/何地/做了什么/结果）
→ M2 Relational（关系：Pig —eats→ Corn）
→ M3 Schema（多次经历归纳的规律，带置信度）
→ M4 Core（反复验证/预测成功/反例少/迁移成功才升入；High Stability ≠ Immutability）
```

## 数学（确定性，默认权重可测）

```text
ConsolidationScore(H) = w1·Support + w2·Diversity + w3·Prediction + w4·Transfer + w5·Replay − w6·Exceptions
τ_schema = 2.5（升 M3）；τ_core = 4.0（升 M4）

Confidence(H) = 0.3 + 0.15·Support − 0.25·Exceptions + 0.08·Diversity（clamp [0,1]）

Retention(e) = Strength·(1 − λ·timeWeight) + SchemaStrength   # 细节淡出、结构存活
```

升级/降级门：`Generalization → Counterexample → (score>τ ? 升格 : 保留低层)`；
反例增多 → 置信下降 → M4→M3→Hypothesis，甚至 Retract（允许降级，防“错误越学越顽固”）。

## Failure Cases（先定义，后实现）

- F1 两条相似经历不得合并（分离失败）；
- F2 单次经历不得直接升 schema（泛化门槛失败）；
- F3 反例出现后 schema 必须降级/降置信（顽固错误）；
- F4 低价值经历必须衰减（选择性遗忘失败 = bloat）；
- F5 新任务迁移成功才证明 schema 有效（仅“记住”不算）。

## Benchmark（验收）

**Episodic-to-Schema Transfer**：训练 4 条同构 episode → 形成 schema →
给完全未见过的 Novel Episode 5 → 若 schema 帮助解决它 = Transfer Success。
最小单元测试：“小猪吃玉米”（用注入语义 KB，确定性，零 token）。

## 复用与新增

复用：`events.js`（episodic 存储）、`reasoning.js`（compare/counterexample/abstract）、
`replay.js`（replay/policy/schema 置信度）。
新增：关系绑定（M2）、语义 KB、ConsolidationScore 门、M3/M4 层级、decay、
降级、retrieve（目标条件记忆）、Transfer 基准脚本。
