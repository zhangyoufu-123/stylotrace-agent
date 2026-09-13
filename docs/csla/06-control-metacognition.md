# 控制与元认知（06）

## 控制模式

```text
Mode_t ∈ {Automatic, Controlled, Mixed}
Novelty↑ / Risk↑ / Conflict↑ → Controlled Cognition
```

## 元认知（C6 修正）

- U_t 用采样一致性/熵代理，不用口述置信；"置信→行动"用校准路由。
- 主动信息获取：`q* = argmax[IG(q) − λCost(q) − μIntrusion(q)]`。

## 硬编码边界（v1.8）

只允许：Safety / State Integrity / Auditability / Resource-Risk Limits。
推理/搜索/记忆/规划/写作均为可替换、可组合算子；支持 Native Model Escape Hatch。

实现：`runtime.js`（FastSalience/DeepGate/确定性 Authority）、`elicit.js`（创新挖掘）。
