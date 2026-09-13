# 记忆（04）— C5 修订

## 三分记忆

- `M^E` 情景：结构化经验事件 `e_t=(state,action,prediction,outcome,error,context,provenance)`，不是 text chunk。
- `M^S` 语义/图式：由巩固产生，**必须带证据链**（ADR-006）。
- `M^W` 工作：当前任务上下文（由 P_t 承载）。

## 检索评分（C5：先归一化，再加权）

```text
Score(e|q) = α·rank(R) + β·rank(G) + γ·rank(C) + δ·rank(IG) + ε·rank(N) + ζ·rank(P)
```

六个分量先各自做秩/分位归一化，权重默认等权、由校准或学习调整。**禁止裸加权和。**

## 写门（启发式起点，须与 MemoPilot/MemRL 强基线对比）

```text
w_t = σ(θ1·|δ_t| + θ2·IG + θ3·GoalRel + θ4·Novelty + θ5·Credit − θ6·Cost) > τ
```

**检索 ≠ 学习**（ADR-003）：`retrieve()` 永不隐含 `consolidate()`。
入库需"验证后入库"门，防止坏技能污染检索（Voyager 类失败模式）。
