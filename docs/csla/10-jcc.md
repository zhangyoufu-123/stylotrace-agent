# JCC — Joint Cognitive Control（10）单一权威定义

> 本文档是 JCC 的唯一权威定义。master plan 与 v1.2 中的 JCC 表述以本文档为准；如有出入，以本文档为准并记录修订。

## 1. 定义

JCC 研究的是：**Human 与 AI 如何共同维护与改变一个联合认知状态 J_t**，而不是谁替代谁。

```text
J_t = (H_t, A_t, S_t, W_t, G_t, I_t, α_t, U_t)
```

- `H_t`：用户目标/约束/偏好的工作表示（不等于读取用户内心）；
- `A_t`：AI 认知状态；
- `S_t`：共享认知状态（见 03，S^C/Θ 拆分）；
- `W_t`：任务/证据模型；
- `G_t`：联合目标；
- `I_t`：交互状态；
- `α_t ∈ [0,1]`：AI 主动权；
- `U_t`：不确定性/校准状态（采样代理）。

## 2. 状态转移

```text
J_{t+1} = F(J_t, a_t^H, a_t^A, o_{t+1})
```

每一次转移必须产生 CognitiveEvent 并递增 state_version（I2）。

## 3. 权责分配（冻结）

**Human 拥有：** 目的、价值、原创洞察、高价值判断、高风险授权、最终归属与发布。
**AI 拥有：** 候选生成、搜索、对比、证据组织、一致性、重复编辑、多模态转换、低风险执行。
**共同：** 问题框定、假设精化、核心观点压力测试、综合。

## 4. 动态控制权（alpha 校准）

```text
α_t = σ( f_α(Capability, Confidence, Alignment, Risk, HumanNeed, Novelty) )
```

高风险/低置信/高人类价值判断需求 → α↓；低风险/已验证可靠 → α↑。
目标不是"AI 永远主动"，而是 authority calibration。

## 5. 创新优先流程（产品核心）

作品分层：`D = (K, F, P)`

- `K` Core：核心原创/核心判断/灵魂（**Human ownership，必须保护**）；
- `F` Flesh：作者经验/知识/证据/风格；
- `P` Presentation：结构/句子/标题/格式/模态。

禁止：用户只有模糊想法时直接生成大篇幅"AI 同质化文章"。

```text
模糊想法 → 识别潜在创新点 → 找信息缺口 → 问一个高价值问题
→ 形成 Core Idea → 多路径扩展 → 反例/事实/逻辑/新颖性检查
→ Human validation → 结构化展开 → 风格化表达 → 交付
```

## 6. 创新挖掘目标（冻结）

```text
q* = argmax_q [ IG(q) − λ·Cost(q) − μ·Intrusion(q) ]
```

每轮只问一个最高价值问题；问题类型：Clarify / Differentiate / Why / Counterexample /
Origin / Implication / Boundary。

## 7. 综合流程（候选 → 交付）

```text
N candidates → semantic clustering → hypothesis abstraction
→ evidence binding → contradiction detection → counterexample search
→ human alignment → synthesis
```

评价器栈：

```text
E(y) = (w1·E_fact, w2·E_logic, w3·E_goal, w4·E_novelty, w5·E_style, w6·E_risk, w7·E_humanfit)
```

必须保存评分分解与证据来源。

## 8. 语言 ≠ 认知

对话文本是输入/输出层，不是完整状态；深层认知状态是持久变量。
（对应 Fast Interaction Loop 与 Deep Cognitive Loop 双循环。）
