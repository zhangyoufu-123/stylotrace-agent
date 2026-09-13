# 记忆与推理（04）— 关系系统 + 可组合算子

## 记忆（不是 RAG）

```text
Memory = Encoding + Relational Binding + Pattern Separation + Pattern Completion
       + Comparison + Replay + Recombination + Consolidation
```

- 三分：M^E 情景（结构化事件）/ M^S 图式（带证据链）/ M^W 工作。
- 检索 ≠ 学习（ADR-003）；写门与巩固优先级分量先归一化（C5）。
- 实现：`events.js`（事件）、`replay.js`（重放/R1–R5）、现有 `style-memory.js`/`knowledge.js`。

## 推理算子（可组合，非固定 CoT）

```text
Compare / Associate / Abstract / Induce / Deduce / Abduce / Analogize
/ Causal / Counterfactual / Recombine / Simulate
```

例：小猪吃玉米 → Bind→Compare(Pig,Dog)→Compare(Corn,Apple)→Abstract→Induce→Counterexample→Refine；
股票预测 → Hypothesis→Search→Compare→Causal→Counterfactual→Scenario→Verify。

实现：`operators.js`（算子池/上下文路由）；CoT/ToT/RAT 等为局部算子，不是完整架构。
