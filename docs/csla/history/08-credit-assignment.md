# 信用分配（08）— C3/C7 修订（旗舰研究点）

## C3：信用必须显式带 baseline

```text
C(i, t, e | B) := L_future(do(i, t, e = B)) − L_future(real)
```

基线 B 是信用定义的一部分，不再隐含。规范基线：

```text
B0 = frozen baseline      # 模块冻结（不参与）
B1 = counterfactual replacement   # 用替代模块替换
B2 = matched alternative   # 等成本/等预算的匹配替代
```

实验判断哪种基线最可靠；小系统用精确 Shapley，生产用学习估计器 + 配对干预监督。

## 实现阶梯（用户冻结：先 Basic，不先做 learned）

```text
Explicit Counterfactual（B0/B1/B2 显式重跑，配对种子/温度）
  → Grounded Credit（C_i → C_{i,t} → C_{i,t,e}）
  → Learned Credit C_ψ（等有 ground truth 后再训）
```

**禁止**一开始就训练 neural credit estimator（=用一个未验证模型学习另一个未验证模型）。

## C7：聚合防 reward hacking

- 不用裸求和 `Σ L_future`；用 min-form / Shapley 归一。
- 反事实必须"配对运行"（同种子/同温度）隔离单模块差异，多次重复取均值。
- 信用不可靠（Entropy(Ĉ_t) > τ）时冻结更新，不做昂贵干预。

## 信用矩阵

维度：模块 × 时间 × 经验（`C_{i,t,e}`）。时间维经依赖图核 K 反向传播；
MVP 用折扣衰减启发式，学习版远期。
