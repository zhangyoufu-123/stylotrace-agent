# 元认知（07）— C6 修订

## C6：不确定性用采样代理，不用口述置信

- `U_t` 落地为采样一致性 / 熵（self-consistency），而不是让 LLM 说"我 90% 确定"（JAMIA 实证口述高估）。
- "置信→行动"路由用校准曲线（ConfTuner 思路），不用固定阈值 τ1–τ3。

## 主动信息获取

```text
q* = argmax_q [ IG(q) − λ·Cost(q) − μ·Intrusion(q) ]
```

IG 用 entropy-search / conformal info pursuit 原则，不手写不可靠的 IG 估计。
Intrusion 表示问题对用户的侵入成本（用户负担）。
