# CSLA Project Understanding Report

**版本：** v1.0 · **日期：** 2026-08-28 · **作者：** Codex（Research / Cognitive Architecture / ML / Systems / Scientific Critic 五重角色）
**状态：** 接管第一轮交付物 —— 仅理解与审核，不包含任何代码修改

---

## 0. 执行摘要

1. 已完整读取 6 份源文档（README_CSLA、CSLA_v1_2_COMPLETE_SPEC、CSLA_API_CONTRACT.yaml、AGENTS_CSLA、CSLA_ARCHITECTURE_DECISIONS、CSLA_v1_0_RESEARCH_SPEC）以及用户交接指令。
2. 结论：**v1.2 数学规格已达到"可开始实现"的闭合程度**（§59 数学闭合条件基本成立），但存在 **5 处必须在编码前明确或修正的理论问题**（见第 4 节与"冲突与修正记录"），不构成阻塞项，但若不处理会在实现中放大为返工。
3. 当前仓库**没有任何代码**，源文档散落在 `~/Downloads`。真正的 Phase 0 是：建立项目仓库、把文档纳入版本管理、冻结契约。
4. 建议的最小第一步是 **MVCA（最小可运行认知体）**：LLM + 任务状态 + 情景记忆 + 世界预测 + 工具 + 结果账本 + 信用估计 + 重放，并配套"同一任务重复执行"基准来验证核心假设。
5. 已核验 v1.0 规格中的时效事实：宇树科技（688836）确实于 2026-08-19 在科创板上市，开盘约 1100 元（较发行价 150.80 元 +629%）—— 金融类案例必须带时间戳，规格中的 reality check 正确。

---

## 1. Project Goal

**最终目标（一句话）：** 把"让 AI 因为经历过世界而改变自己"从口号变成可运行、可度量、可审计的认知架构 —— 即一个系统在经历真实事件后，改变自己的内部认知状态，并让这种改变持续影响未来的预测、记忆、推理、规划、决策与行动。

**商业目标：** 长期任务 AI 执行层（可审计、可恢复、记忆持久、供应商无关），最终以 Python/TypeScript SDK、CLI、REST API、hosted runtime 形式交付。

**科学目标：** 验证"经历 → 预测 → 行动 → 结果 → 因果信用 → 选择性学习 → 巩固 → 更好的未来决策"这一回路确实带来可测量的长期收益（完成率、恢复率、校准、迁移、持续学习、审计性、成本效率），并通过消融回答"哪个机制贡献了什么"。

---

## 2. Cognitive Model

CSLA 的认知模型是一个 **recurrent / partially-observable / action-conditioned / multi-timescale learning 动力系统**，不是静态神经网络，也不是 prompt+tool 包装。

- **环境抽象：** POMDP `E=(S,A,O,T,O,R,γ)`；智能体无法直接观测真实状态，维护信念状态 `B_t(s)=P(s_t=s|o_{1:t},a_{1:t-1})`。
- **三层嵌套回路：**
  - 快回路：Observe → Decide → Act（在线控制）
  - 中回路：Retrieve → Hypothesize → Simulate → Evaluate（任务推理）
  - 慢回路：Experience → Replay → Consolidate → Update（学习）
- **核心区分：** 传统 LLM 是"上下文条件化计算"（`y~p_θ(y|x)`）；CSLA 是"经验驱动的状态学习"（`S_{t+1}=F_Θ(S_t,a_t,o_{t+1})` + 显式学习事件）。
- **神经科学定位：** 只提取计算原则（海马式快速绑定/重放、前额叶式目标维持/抑制、纹状体式价值学习、慢皮层式统计抽象等），不主张脑区一一映射、不主张意识。
- **两条人类思维案例**（小猪吃玉米 / 宇树科技股票）保留为"认知轨迹 trace"，作为算子序列与学习流的形式化素材；金融案例必须带时间戳。

## 3. State Space

### 3.1 官方状态（v1.2 §3，12 分量）

| 分量 | 含义 | 本质类型 | 更新速度 | 说明 |
|---|---|---|---|---|
| `G_t` | 目标状态 | 内容 | 中 | 由任务解析与子目标分解更新 |
| `B_t` | 信念状态 | 内容/分布 | 快 | 对世界/任务状态的估计 |
| `M^E_t` | 情景记忆 | 数据（事件集） | 快 | 经验事件的有界集合 |
| `M^S_t` | 语义/图式记忆 | 数据（抽象集） | 慢 | 由巩固产生，带证据链 |
| `W_t` | 世界模型 | 参数/函数 | 中 | latent 预测器（可替换） |
| `P_t` | 执行/工作状态 | 内容 | 快 | 目标、子目标、规则、约束、预算、抑制向量 |
| `Π_t` | 认知/行动策略 | 参数/函数 | 很慢 | 动作选择机制 |
| `U_t` | 不确定性/元认知 | 内容/分布 | 快 | 校准历史、置信状态 |
| `K_t` | 技能/工具知识 | 数据 | 慢 | 可复用技能与工具知识 |
| `Self_t` | 自模型 | 数据 | 慢 | 能力/局限/失效模式/工具可靠度/校准 |
| `R_t` | 资源/预算 | 内容 | 快 | token/工具/推理深度/成本/风险预算 |

### 3.2 建议修正：内容状态与参数状态分离（C1）

官方定义把 `W_t, Π_t, K_t` 放进了 `S_t`，而学习方程又更新它们 —— 造成"状态更新函数 F 同时更新自身参数"的自指问题。建议正式拆分：

```
S_t := ( S^C_t , Θ_t )
S^C_t = (G, B, M^E, P, U, Self, R)      # 内容状态：F_Θ 更新（快）
Θ_t   = (W, Π, K, M^S 参数, C_ψ)        # 参数状态：U_Θ 更新（慢，经学习事件）
```

这样 §3 与 §59 的冲突被消除：`F` 负责内容转移，`U` 负责参数学习；两者都通过事件账本可审计。

---

## 4. Mathematical Core

### 4.1 五条脊柱方程（与交接指令一致，v1.2 中均有对应）

| # | 方程 | 位置 |
|---|---|---|
| 1 | `S_{t+1}=F_Θ(S_t,a_t,o_{t+1})` | §33/§59 |
| 2 | `z_t=E_W(o_t,M_t,G_t);  hat z_{t+1}=W_θ(z_t,a_t)` | §16 |
| 3 | `δ_t=λ_W·D(z_{t+1},hat z_{t+1}) + λ_R·(r_t+γV(S_{t+1})-V(S_t))` | §23 |
| 4 | `C_{i,t,e} ≈ L_future(do(i,t,e=baseline)) - L_future(real)` | §24 |
| 5 | `θ_i^{t+1}=θ_i^t - η_i·g(C_{i,t})·∇J_t` | §28 |

### 4.2 依赖关系

```
o_t → E_W → z_t ──→ W_θ ──→ hat z_{t+1}
                        │
o_{t+1} → E_W → z_{t+1} ┴─→ δ^W ─┐
                                  ├─→ δ_t → 写门/巩固优先级
r_t + γV(S_{t+1}) - V(S_t) ──→ δ^R ─┘         │
                                              ↓
δ_t, S_t, e_t, U_t, G_t ──→ C_ψ ──→ C_{i,t,e} → g(C) → 各模块更新
                                              ↓
                                    重放 → 巩固 → S_{t+1}/Θ_{t+1}
```

### 4.3 闭合性审核结论

- **总体闭合：** 是。§59 规定每个持久变更可表示为 `S/Θ` 更新，且无隐藏副作用通道 —— 满足"可开始实现"条件。
- **但有三处必须修**（详见"冲突与修正记录"）：
  - **C1** S/Θ 自指（上文 3.2）。
  - **C2** 复合误差 `δ^W + λ_R·δ^R` 的量纲/尺度混加不可靠，建议拆成两条独立误差通道，分别路由到世界模型与策略；需要标量输入的门控（写门、巩固优先级）改用归一化后的分量。
  - **C3** 信用公式是"基线相对"的：`baseline` 对每个模块没有唯一含义，`C_{i,t,e}` 因此不唯一。必须为每个模块定义规范基线（如：空记忆 / 默认策略 / 无世界模型），小系统用 Shapley 平均，生产用学习估计器 + 选择性反事实监督。

---

## 5. Module Graph

```
Observation o_t
  → TaskEncoder E_task        （任务表示 τ_t，版本化）
  → Meta-Controller q_t       （选算子：retrieve/deduce/analogize/search/simulate/act/verify/ask/stop）
  → Global Workspace C_t      （显著性加权信息池，显式可观测）
  → Memory M^E/M^S 检索 ──→ Reasoning Operators（CoT/ToT/GoT/RAT/ReAct/Reflexion…）
  → World Model W_θ           （hat z_{t+1} 预测 + 可选因果 do()）
  → Planning / Policy Π_t     （计划价值 + 信息增益 + 成本/风险）
  → Action a_t → Tool Bus（MCP/HTTP）→ Environment
  → Outcome o_{t+1}
  → Error δ_t（δ^W + δ^R）
  → Credit Estimator C_ψ（+ 选择性反事实校正）
  → Selective Update（各模块按信用与时标更新）
  → Replay / Consolidation
  → S_{t+1}
```

**模块边界（每个都独立可替换、独立可消融）：** LLMProvider、ToolBus、Memory（E/S）、WorldModel、ReasoningOperator、Policy、MetaController、CreditEstimator、Ledger、SelfModel。接口先行，实现后置。

---

## 6. Event / CogBus Schema

### 6.1 规范事件（v1.2 §39，API 契约 `CognitiveEvent` 一致）

```json
{
  "event_type": "cognitive.experience",
  "event_id": "uuid",
  "session_id": "uuid",
  "step": 17,
  "state_version": "s_17",
  "goal": {}, "observation": {}, "action": {},
  "prediction": {}, "outcome": {}, "error": {},
  "uncertainty": {}, "credit": {}, "provenance": {}, "cost": {}
}
```

### 6.2 经验记录 `e_t`（记忆最小单元）

```
e_t = (S_t, a_t, hat z_{t+1}, z_{t+1}, r_t, δ_t, u_t, p_t, c_t)
```

字段包含：state_ref、goal_ref、observation、action、prediction、outcome、prediction_error、reward_error、uncertainty、credit、provenance、importance、retention。

### 6.3 不变量（AGENTS + v1.2 §52）

- 每个持久状态变更必须产生对应事件并递增版本（I2）。
- 检索 ≠ 巩固；反思 ≠ 世界模型更新；行动结果 ≠ 证据（I3）。
- 学习模式下，无记录在案的 credit/confidence 理由，禁止模块更新（I4）。
- 每次运行预算有界（I5）；记忆检索不可跨租户（I6）。

---

## 7. Credit Assignment Design

这是项目**旗舰研究点**，设计已分三层：

1. **Oracle 反事实层（研究/玩具环境）：** `C_{i,t,e} ≈ L_future(do(baseline)) - L_future(real)`；小系统可用精确 Shapley。提供监督标签。
2. **学习估计器（生产）：** `hat C_t = C_ψ(S_t, e_t, δ_t, U_t, G_t)`，用反事实标签训练（回归或排序损失）。
3. **选择性介入：** `H_C < τ_C` 时用估计器；否则现场算反事实 —— 即"便宜在线信用 + 昂贵选择性诊断"。

**信用矩阵维度：** 模块 × 时间 × 经验（`C_{i,t,e}`）；时间维度经依赖图核 `K` 反向传播（§27，K 未定义 —— MVP 用衰减启发式）。

**必须明确的三件事（C3 相关）：**
- 每个模块的"baseline"需要规范定义（否则信用不唯一）。
- 反事实标签的采样预算（每幕最多几次干预）与抽样策略（哪些 (i,t,e) 单元格值得算）。
- LLM 随机性：反事实必须"配对运行"（同种子/同温度）才能隔离模块差异，否则噪声淹没信号。

---

## 8. Memory Design

### 8.1 三分记忆

- **M^E（情景）：** 结构化经验事件（state/action/prediction/outcome/error/context/goal），**不是 text chunk**。
- **M^S（语义/图式）：** 由巩固产生的抽象，**必须带证据链**（ADR-006），防止无依据的自我强化信念。
- **M^W（工作）：** 当前任务上下文（由 P_t 承载）。

### 8.2 检索评分（v1.2 §12，6 分量）

```
Score(e_i|q) = α·R(语义相关) + β·G(目标相关) + γ·C(因果相关)
             + δ·IG(预期信息增益) + ε·N(新颖性) + ζ·P(来源/可靠度)
```

**问题（C5）：** 6 个分量量纲不同（相似度、分类器得分、信用值、熵差、距离、可靠度），直接加权和不可比。建议每个分量先做秩/分位归一化，权重由校准或学习确定，初始等权+验证集调参。

### 8.3 写门与保留

- 写门：`w_t = σ(θ1|δ_t| + θ2·IG + θ3·GoalRel + θ4·Novelty + θ5·Credit − θ6·Cost) > τ_write`。
- 保留/遗忘：低未来效用 × 低相关 × 冗余 → 压缩/归档/删除；商用审计模式删除留 tombstone 与原因。
- 核心原则（ADR-003）：`retrieve()` 永不隐含 `consolidate()`。

---

## 9. World Model Design

- **形态：** latent predictive world model：`z_t=E_W(o_t,M_t,G_t)`，`hat z_{t+1}=W_θ(z_t,a_t)`，误差 `D(z_{t+1},hat z_{t+1})`。预测"决策相关状态"，不预测像素、不预测全文。
- **防塌缩（C4）：** 仅最小化 `D(E_W(o_{t+1}), W(E_W(o_t),a_t))` 存在平凡解（编码器常数化）。需要 JEPA 式约束：目标侧 stop-gradient、辅助重建/对比损失、或离散潜变量（RSSM 式）。规格未指定 —— 实现前必须选定。
- **因果层（可选）：** 结构充分时维护因果图 `G_c` 与 `P(Y|do(X=x'))`，用于规划/诊断/解释；不是所有任务都要求。
- **MVP 建议：** 先用结构化/符号状态预测器（任务状态机上的转移预测 + 不确定性），再升级 latent；这样 C4 可先绕过，实验仍能检验 H4 的"预测价值"。

---

## 10. Reasoning Operators

- 推理算子库：CoT、Self-Consistency、ToT、GoT、RAT、ReAct、Reflexion、Verifier、Counterexample。
- 认知算子集（v1.0 §37）：Parse、Identify、Represent、Retrieve、Abstract、Analogize、Hypothesize、Search、Simulate、Verify、Act、Observe、Update、Consolidate、Reflect、Suppress、Stop。
- 统一接口：`O_i: (Input, State, Params) → (Output, ΔState, Cost)` —— 规格要求每个算子最终都有数学接口（尚未全部给出，属 missing spec）。
- 定位：这些是 CSLA 的**局部计算算子**，不是替代架构；元控制决定"什么时候用哪个算子"。

---

## 11. Meta-controller

- 形式：`q_t(m)=softmax(f_ψ(τ_t, S_t))`，m ∈ {retrieve, deduce, analogize, search, simulate, act, verify, ask, stop}（v1.2 §7 比 brief 多了 ask/stop）。
- **当前可实现性：** 先用 LLM 提示驱动 + 规则路由（不确定性四档：answer / retrieve / verify / ask-search）作为 v0；学习型 f_ψ 是 H5 远期假设。
- 行动策略还包含模型路由：`P(model|task,state,budget)`，便宜模型解析、强模型困难推理 —— 属于元控制能力。
- 约束：预算不变量（I5）与风险门控必须优先于路由。

---

## 12. Learning Dynamics

### 12.1 四时间尺度（v1.2 §29）

| 尺度 | 对象 | 默认速率层级 |
|---|---|---|
| 快 | M^E 情景写入 | η_fast |
| 中 | W 世界模型 | η_medium |
| 慢 | K 图式/知识 | η_slow |
| 很慢 | Π 策略 | η_vs |

`η_M > η_W > η_K > η_Π` 是默认层级，具体数值是实验参数，不是生物学常数。

### 12.2 三种训练模式

- **A 推理模式：** 无持久参数更新，记忆/状态仍可更新。
- **B 在线自适应记忆：** 更新情景、图式、校准、轻量适配器；**冻结基座 LLM**。
- **C 全持续学习：** 训练选定适配器/世界模型/策略，带重放与遗忘控制。

**默认生产模式 = B**：基座 LLM 冻结，学习发生在小模块。这决定了"LLM 不参与梯度训练，学习=记忆内容/图式/自模型/信用估计器/世界模型头/提示组装" —— 是最重要的实现边界。

### 12.3 更新规则修正（C2/C5 相关）

`θ_i^{t+1}=θ_i^t - η_i·g(C_{i,t})·∇J_t` 中 `g(C)` 的语义需要按模块定义：
- 世界模型：|C| 作为样本权重（幅度），不反号。
- 策略/记忆：可带符号（正=加强，负=抑制）。
- 信用不可靠时（H_C 高）应冻结更新而不是硬算。

---

## 13. Replay / Consolidation

- **Replay = 离线学习**，不是检索：重放轨迹 → 重算 latent 转移 → 优化 `L_replay=ΣD(z_{k+1},hat z_k)`；也可用于策略改进、图式发现、反事实模拟、防遗忘。
- 采样优先级：`priority(e)=α|δ_e|+β·IG+γ|C_e|+δ·GoalRel+ε·Novelty`，`P(e)∝priority(e)^κ`。
- **Consolidation：** 把情景聚类/组构成图式：`k*=argmin_k E[D(e,k)]+λ·Complexity(k)`（MDL 风格）；**必须保留到支持情景的证据链**。
- **Reconsolidation：** 记忆/图式被检索后遇新证据可更新，版本化 `memory_v1→v2→v3`，记录证据来源。
- **巩固优先级：** `V(e)=α|δ_e|+β·IG+γ·GoalRel+δ·Credit+ε·Novelty > τ`。与检索评分结构相似但语义不同：检索面向"当前查询是否有用"，巩固面向"未来能力是否提升"。
- 危险模式：错误巩固/自我强化错误图式 —— 需要消融实验 EXP-01 与证据链审计。

---

## 14. API Architecture

### 14.1 分层

```
Application
  → CSLA API（REST/SDK）
    → Cognitive Runtime（状态机 + 事件账本）
      → LLM Adapter（OpenAI / Anthropic / Gemini / local，统一协议）
      → Memory / World Model / Reasoning / Tool Bus（MCP 优先，原生 HTTP 兼容）
```

### 14.2 核心端点（CSLA_API_CONTRACT.yaml 已给出）

`POST /v1/agents`、`POST /v1/agents/{id}/runs`、`GET /v1/runs/{id}`、`GET /v1/runs/{id}/events`（SSE）、`GET /v1/runs/{id}/trace`、`POST /v1/agents/{id}/memory/search`、`POST /v1/agents/{id}/feedback`、`POST /v1/agents/{id}/replay|consolidate`、`POST /v1/tools`。

### 14.3 SDK 表面（v1.2 §38）

`agent.run(task, context, budget)`、`agent.learn(feedback)`、`agent.memory.search(q)`、`agent.inspect(run_id)`；底层 observe/plan/act/reflect/replay/consolidate 是研究/调试接口。

### 14.4 后置项

租户模型（Organization→Project→Agent）、计费维度（token+tool+memory+rollout+CF）、安全（OAuth/RBAC/加密/审批/限流）、部署三层（研究 SDK→团队服务器→SaaS）—— 均属于 Phase 10+，不阻塞科研。

---

## 15. Current Repository State

**审计结果（Phase 0）：**

- `~/Documents/Codex/2026-08-28/qin/` 为空目录，**不是 git 仓库**，仅有 `outputs/` 与 `work/`。
- 6 份源文档全部位于 `~/Downloads/`（README_CSLA.md、CSLA_v1_2_COMPLETE_SPEC.md、CSLA_API_CONTRACT.yaml、AGENTS_CSLA.md、CSLA_ARCHITECTURE_DECISIONS.md、CSLA_v1_0_RESEARCH_SPEC.md）。
- **实现为零**：无 src/、tests/、docs/、configs/、experiments/。Phase 1（理论审核）完成，Phase 2+（契约/运行时）未开始。
- 时效事实核验：宇树科技 688836 于 2026-08-19 科创板上市，发行价 150.80 元，首日开盘约 1100 元（+629%）—— 与 v1.0 §38.2 的 reality check 一致。金融示例必须按时间戳处理。

---

## 16. Theory vs Implementation Gap

| 理论项 | 实现状态 | 缺口 |
|---|---|---|
| 状态转移 F | 未实现 | 需先定 S/Θ 拆分与序列化 |
| 事件账本 | 未实现 | schema 已定，需功能性核心（纯函数转移） |
| LLM 适配器 | 未实现 | Protocol 已定，无 provider 实现 |
| 情景记忆 | 未实现 | 检索 6 分量未归一化、后端未定（SQLite+pgvector 起步） |
| 世界模型 | 未实现 | **损失函数与防塌缩未定**（C4） |
| 信用估计 | 未实现 | **baseline 定义与标签采样未定**（C3） |
| 重放/巩固 | 未实现 | 聚类算法（D(e,k)）未定 |
| 元控制 | 未实现 | v0=规则路由，学习版远期 |
| 基准 | 未实现 | 任务生成器、同任务重复协议、消融矩阵未落地 |
| 奖励来源 | 未定义 | **r_t 在真实任务中如何操作化？**（环境成功标准/验证器/用户反馈） |

---

## 17. Scientific Risks

1. **归因复杂：** 模块太多，消融矩阵巨大；若只报告整体增益，无法判断哪个机制有效。对策：MVCA 起步 + 每次只加一个模块 + 匹配基线。
2. **信用估计自举：** 学习估计器 C_ψ 需要反事实标签，而反事实昂贵 —— 标签采样策略决定成败。
3. **LLM 随机性淹没反事实信号：** 必须配对运行（同种子）并多次重复取均值。
4. **世界模型塌缩（C4）：** 无防塌缩约束时，latent 预测可退化为常数。
5. **记忆污染/错误巩固：** 错误图式自我强化 → 需要证据链 + 反例引擎 + 再巩固版本化。
6. **与基线拉不开差距（falsifier #6）：** 若 CoT/ToT/RAT + 足够测试时算力已持平 CSLA，核心假设失败 —— 这正是需要主动检验的。
7. **成本失控：** 反事实重放 × 多基线 × 多次重复，token 成本会爆炸；需要预算上限与本地/便宜模型策略。
8. **基准有效性：** 若任务太简单（单轮问答），任何学习机制都无增益；必须选"需要长程记忆/恢复/组合泛化"的任务族。

---

## 18. Engineering Risks

1. **不可复现：** LLM API 非确定；需要 temperature 控制、提示版本化、全量事件日志、种子优先。
2. **状态爆炸：** M^E 无界增长 → 写门、保留策略、序列化上限（快照+增量）必须内置。
3. **无基础设施：** 无 git 仓库、无测试框架、无 CI —— Phase 0 必须补齐（至少 git + pytest + 契约测试）。
4. **文档孤立：** 源文档在 ~/Downloads，未纳入仓库版本管理 → 理论变更无法追溯（违反 v1.2 §66 版本策略）。
5. **隐藏全局状态：** 违背"无隐藏全局状态"原则的风险 → 用功能性核心（`(state,event,action)→(next_state,ledger_event)`）强制。
6. **成本/延迟：** 无预算上限的推理回路会失控 → Budget 契约（API 已定义）必须在运行时强制执行。
7. **安全/租户：** 生产阶段（Phase 10+）需要 OAuth/RBAC/加密/审批/审计 —— 前期不实现但接口要预留。

---

## 19. Missing Specifications

以下为"理论已提但未落到可编码精度"的清单（M1-M16）：

- **M1 奖励来源操作化：** r_t 在真实任务/工具/API 场景如何产生（环境成功标准、验证器、用户反馈、规则）。
- **M2 信用 baseline 定义：** 每个模块（M/W/Π/P/U/K）的规范反事实 baseline。
- **M3 反事实标签采样：** 每幕 CF 预算、单元格抽样策略、配对运行协议。
- **M4 世界模型损失：** 防塌缩约束与训练协议（stop-grad/对比/重建、数据来源、验证指标）。
- **M5 记忆分量定义：** R/G/C/IG/N/P 各自的计算方式与归一化。
- **M6 评分权重：** 检索/写门/巩固/重放优先级的 α…ζ、θ、κ 的默认值与校准流程。
- **M7 巩固聚类：** D(e,k) 与 Complexity(k) 的具体实现（LLM 辅助抽象 / 向量聚类 / 规则抽取）。
- **M8 时间信用核 K：** §27 K 的实现（MVP：折扣衰减；远期：学习）。
- **M9 不确定性算子：** U_t 的工程代理（采样一致性 / logprob / 自报置信 + 历史校准）。
- **M10 信息增益估计：** IG(a) 的实际估算器（MVP：置信度改善代理 / 期望惊讶度）。
- **M11 元控制 v0：** 规则路由表的具体阈值与提示协议；学习版监督信号。
- **M12 算子接口：** 17 个认知算子的 Input/State/Output/Cost 正式签名。
- **M13 状态序列化：** S^C 与 Θ 的快照/增量/版本格式。
- **M14 基准任务族：** 支持"同任务重复 + 失败注入 + 组合泛化 + 持续学习"的具体环境（玩具世界优先）。
- **M15 指标定义：** RecoveryRate、CL、ECE-to-action、MemoryEfficiency、Auditability 的精确计算公式。
- **M16 随机性协议：** 种子策略、重复次数、统计检验（置信区间/显著性）。

---

## 20. Recommended Implementation Order

与 v1.2 §60 / AGENTS_CSLA 保持一致，并加入科研门槛：

| Phase | 内容 | 通过标准 |
|---|---|---|
| 0 | **契约冻结**：建仓库（git）、纳入 6 份文档、定 S/Θ 拆分与核心 dataclass/protocol、记录 C1-C5 修正 | 契约文档版本化，测试可导入 |
| 1 | **运行时 + 事件账本**：功能性核心 `(state,event,action)→(next_state,ledger)`，状态版本化 | 每个转移有测试；账本可回放 |
| 2 | **LLM 适配器**：统一 Protocol，≥1 个 provider + mock/local | mock 测试通过，无厂商字段泄漏 |
| 3 | **情景记忆**：写门 + 检索（归一化 6 分量）+ 来源 | 检索/写门单测 + 简单记忆效用实验 |
| 4 | **工具/MCP 接口**：ToolSpec + 风险审批 | 工具副作用声明与审批生效 |
| 5 | **世界模型**：v0 结构化预测器（带不确定性） | 预测误差有界、不确定性校准起步 |
| 6 | **信用估计**：先规则/启发式 + 玩具环境 oracle 反事实标签，再学 C_ψ | 信用与 oracle 相关度/排序指标达标 |
| 7 | **重放/巩固**：优先级采样 + 证据链图式 + 再巩固版本化 | 消融 EXP-01（有/无巩固） |
| 8 | **元控制**：不确定性→路由 v0（answer/retrieve/verify/ask） | B4 校准到行动指标 |
| 9 | **基准 + 消融**：B1-B9 指标 + 10 条基线 + 核心实验 E1-E6 | 每个声称有消融报告与统计 |
| 10 | **服务层**：REST 全量、认证/租户/配额/审计、可观测性 | API 契约测试全绿 |

**第一优先可运行物（MVCA）：**
```
输入 → 任务解析 → 记忆检索 → LLM 推理 →（可选）工具 → 结果
     → 世界预测误差 → 信用估计 → 写/重放记忆 → 下一任务
```
配套基准：**同一任务重复 1 次 vs 10 次** —— 行为若不变，学习即失败；第一次犯错后若永远重复，信用即失败。

---

## 附录 A：交接指令 A-L 对照

- **A. 项目最终目标：** 见 §1。核心 = "从 token 预测到经验驱动的认知状态学习"，可运行、可度量、可审计。
- **B. 当前认知架构：** 见 §2/§5 —— POMDP 信念 + 12 分量状态 + 三层回路 + 模块化算子库。
- **C. 完整状态变量：** 见 §3（12 分量 + 建议 S/Θ 拆分）。
- **D. 完整数据流：** 见 §5 模块图（o→τ→q→workspace→memory/world/reasoning→plan→act→outcome→error→credit→update→replay→consolidation→S_{t+1}）。
- **E. 完整学习流：** 见 §12/§13（经验→误差→信用→选择性更新→重放→巩固；四时间尺度 + A/B/C 模式）。
- **F. 数学公式依赖关系：** 见 §4.2（E_W→W_θ→δ^W；TD→δ^R；δ→写门/巩固；e,S,U,G→C_ψ→g(C)→更新→重放/巩固）。
- **G. 当前最大理论漏洞：** ① S/Θ 自指（C1）；② 复合误差量纲混加（C2）；③ 信用 baseline 不唯一（C3）；④ 世界模型损失可塌缩（C4）；⑤ 记忆/巩固评分分量不可比（C5）。
- **H. 当前最大工程风险：** 反事实/多基线带来的成本与不可复现性；状态无界增长；无 git/CI；文档未纳入版本管理。
- **I. 最值得验证的科学假设：** H1（反事实信用 > 终端奖励）与 H2（信用加权巩固 > 纯误差/新颖性巩固）—— 两者决定项目是否存在。
- **J. 最小可运行版本：** MVCA（见 §20），冻结基座 LLM，SQLite/JSONL 起步，玩具环境 + 同任务重复基准。
- **K. 应冻结的内容：** 核心回路语义、状态/事件 schema、模块边界、LLMProvider/Tool 接口、6 大不变量（I1-I6）、12 条 ADR、两条人类案例 trace、供应商无关原则。**（详见附录 B）**
- **L. 保持为 research hypothesis 的内容：** 信用公式具体形态（C3 相关）、复合误差组合（C2）、检索/巩固评分权重、元控制学习（H5）、时间尺度数值、世界模型参数化、反事实标签策略。**（详见附录 B）**

---

## 附录 B：冻结 vs 假设清单

### 冻结（接口/身份层，改动需 major version + 变更记录）

1. 核心回路：experience→prediction→outcome→error→credit→selective update→replay→consolidation。
2. 认知状态 schema（含 S/Θ 拆分修正）与事件 schema（§6）。
3. 模块边界与独立性（Memory / World / Policy / Meta / Credit / Ledger 各自可测、可消融、可替换）。
4. LLMProvider / Tool / Memory / WorldModel / CreditEstimator 公共接口。
5. 不变量 I1-I6（来源链、版本递增、检索≠巩固、信用前置、预算有界、租户隔离）。
6. 12 条 ADR。
7. 默认训练模式 B（冻结基座 LLM）。
8. 两条人类案例作为 trace 素材。

### Research hypothesis（可修改，修改需走设计笔记 + 实验验证）

1. H1-H6 全部。
2. 复合误差组合方式（C2）。
3. 信用公式与 baseline 定义（C3）。
4. 检索/写门/巩固/重放评分的权重与归一化（C5/C6）。
5. 元控制实现（规则 v0 → 学习版）。
6. 时间尺度 η 层级的具体数值。
7. 世界模型参数化（结构化 → latent）与损失函数（C4）。
8. 反事实标签采样策略。

---

## 附录 C：冲突与修正记录（必须上报，未静默修改）

| # | 冲突 | 更合理的定义 | 理由 | 对代码的影响 |
|---|---|---|---|---|
| C1 | §3 把 W/Π/K 放进 S_t，§59 又把 Θ 独立更新 | 内容状态 S^C 与参数状态 Θ 拆分，S_t=(S^C,Θ) | 消除状态更新函数的自指，使 F 与 U 语义清晰 | 核心 dataclass 分两层；版本化分开 |
| C2 | §23 复合误差 δ=λ_W δ^W+λ_R δ^R 量纲混加 | 双通道误差分别路由；门控用归一化分量 | latent 距离与 reward 单位不可加，单一 λ 跨任务不成立 | 事件 schema 中 error 分成 world/reward 两字段 |
| C3 | §24 信用依赖未定义的 baseline | 每模块规范 baseline；小系统 Shapley；生产学习估计器+选择性 CF | 否则信用值不唯一、不可复现 | CreditEstimator 接口增加 baseline 配置与配对运行参数 |
| C4 | §16 世界模型损失可平凡塌缩 | JEPA 式 stop-grad/对比/重建约束；或先上结构化预测器 | 否则 latent 预测无信息量 | WorldModel 接口含 loss 配置；MVP 用结构化实现 |
| C5 | §12/14/30 多分量评分直接加权和 | 分量先秩/分位归一化，权重校准或学习 | 不同量纲相加无意义 | Memory 评分函数分两步：归一化→加权 |
| C6 | 版本漂移：brief(11 分量)/v1.0(10 分量)/v1.2(12 分量+R_t)；检索评分 v1.0(5 项) vs v1.2(6 项+ζP) | **以 v1.2 为规范**；brief 为流程/需求文档 | 优先级：ADR > 数学规格 > 理论 > README | 文档统一指向 v1.2；变更走 v1.2 §66 版本策略 |

---

## 附录 D：下一步（等待指令）

理论审核结论：**无阻塞项，但有 5 处需在编码前确认的修正（C1-C5）**。建议下一轮按顺序：

1. 批准本报告与 C1-C5 修正（或给出反对意见）；
2. 在 `qin/` 建立项目仓库：`git init`、把 6 份源文档从 `~/Downloads` 复制进 `docs/` 并提交；
3. 进入 Phase 0：冻结核心 dataclass/protocol（CognitiveState、ExperienceEvent、MemoryItem、CreditVector、LLMProvider、Tool），并落一份 design note 记录 C1-C5；
4. 进入 Phase 1：功能性核心 + 事件账本 + 首批测试。

在您确认前，本轮不进行任何代码或仓库结构修改。
