# 推理算子（06）

## 统一接口

```text
O_i: (Input, State, Params) → (Output, ΔState, Cost)
```

## 算子清单（v1.2 认知算子集）

Parse / Identify / Represent / Retrieve / Abstract / Analogize / Hypothesize /
Search / Simulate / Verify / Act / Observe / Update / Consolidate / Reflect /
Suppress / Stop。

## LLM Operator Pool（生成侧）

```text
Generator A: divergent / creative
Generator B: analytical
Generator C: skeptical / adversarial
Generator D: evidence / research
Generator E: structural editor
Generator F: style / author fit
Generator G: multimodal（二期）
```

不同 operator 收到**不同 Context Bundle**：`X_i = ContextRouter(S_t, m_i)`；
生成 `y_i ~ LLM_i(X_i)`。多点生成 ≠ 投票（见 10-jcc 的综合流程）。

## M11 状态

元控制 v0 = 规则路由（不确定性四档：answer / retrieve / verify / ask-search）；
学习版 f_ψ 远期，需先定义监督信号（结果+成本+校准联合），作为独立消融。
