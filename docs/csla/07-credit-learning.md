# 信用与学习（07）

## Credit（C3/C7 修正）

```text
C(i,t,e|B) := L_future(do(i,t,e=B)) − L_future(real)，B ∈ {frozen, replacement, matched}
```

- 阶梯：Explicit Counterfactual → Grounded Credit → Learned Credit（有 ground truth 后再学）。
- 聚合防 reward hacking（min-form/Shapley），反事实配对运行。

## Replay / Consolidation

- Replay = Reactivation + Reevaluation + Recombination + Prediction（符号化，已实现 R1–R5）。
- Consolidation：情景 → 图式，必须保留证据链；Reconsolidation 版本化。

## 学习判据

`Performance_{t+1} > Performance_t`，且 `Generalization_unseen > Baseline`。

实现：`ledger.js`（Outcome + Basic Credit）、`replay.js`（R1–R5）。
