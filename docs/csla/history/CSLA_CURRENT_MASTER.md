# CSLA v1.5 — Frontier Audit, Novelty Boundary & Executable Architecture

**Date:** 2026-08-28  
**Status:** research/engineering master update after frontier audit  
**Purpose:** 将 CSLA/JCC 与 2026 年主流 LLM、Agent、Memory、World Model、Cognitive Architecture 和 Human-AI Teaming 路线重新对照，明确“已有、可借鉴、真正缺失、可验证创新”，并冻结可运行架构边界。

> 科学声明：本文件不宣称 CSLA 发明了长期记忆、Agent planning、world model、global workspace、human-AI collaboration 或 credit assignment。所有创新主张必须通过文献对比与实验验证。

---

## 0. Executive Verdict

### 0.1 我们不是在一个空白领域

2026 年的主流系统已经覆盖大量我们早期蓝图中的部件：

- OpenAI：Responses API / Agents SDK、工具调用、web/search、sandbox、compaction、parallel orchestration、programmatic tool calling、tracing；GPT-5.6 的官方开发指南明确把持久 reasoning、compaction、并行分解和把确定性处理放到代码中作为 agent efficiency 的关键原语。
- Anthropic：context engineering、subagents、multi-agent research、extended thinking、plan mode、agent harness、动态工具使用；Claude Code 的大规模使用分析显示，人通常更决定 what，模型更多决定 how。
- Google DeepMind：Gemini Deep Research、MCP、可视化、多源研究；Genie 3 提供实时交互式世界模型；SIMA 2 在 Genie 3 世界中执行目标并通过训练改进。
- Memory：MemGPT、Mem0、Zep/Graphiti 等已经解决了不同形式的长期记忆、压缩、图/时间知识管理。
- Cognitive architecture：CoALA 已经系统化了 language agent 的 memory、action space 和 decision process；Global Workspace Agents 研究已经提出事件驱动 workspace、多 agent、双层 memory 和 intrinsic drive。
- World model：V-JEPA 2 已展示 latent world prediction + action-conditioned post-training + planning；Genie 3 已展示交互式生成世界。

### 0.2 因此以下不能作为 CSLA 的独立创新

- "有 memory"
- "会搜索"
- "会 planning"
- "有 subagents"
- "有 multimodal"
- "有 world model"
- "有 global workspace"
- "有 reflection"
- "让 AI 记住用户"
- "让 AI 学用户风格"

### 0.3 当前真正可守的研究边界

CSLA 的研究假设应收窄为：

> **在一个不修改 foundation model 参数的外层 runtime 中，让 Human、LLM Operators、Memory、World/Task Model、Tools 和 Outcome Feedback 围绕一个持久的 shared cognitive state 协同运行，并使用可追溯的 consequence-based credit 信号决定哪些内部状态、记忆、策略和 schema 应该改变。**

核心研究单元：

\[
\boxed{
\text{Shared Cognitive State + Experience Trace + Selective Credit + Consolidation}
}
\]

---

# 1. Frontier Comparison Matrix

| 领域/系统 | 已解决 | 与 CSLA 重合 | CSLA 不应重复 | 值得借鉴 |
|---|---|---|---|---|
| OpenAI agent runtime | reasoning、tools、sandbox、compaction、parallelism、programmatic calls | context、planning、tools | 基础 orchestration | state persistence、compaction、deterministic work、observability |
| Anthropic agents | context engineering、subagents、research、plan/act loops | context routing、human/AI task split | 通用 agent loop | context curation、subagent isolation、human-in-the-loop at strategy layer |
| Gemini Deep Research | dynamic research、MCP、multimodal analysis | search/action、research planning | generic research workflow | evidence loops、MCP、visual synthesis |
| Genie 3 | interactive generative world | world simulation | foundation world generator | action-conditioned prediction、simulation as testbed |
| SIMA 2 | goal-directed embodied agent、self-improvement | goal/action/learning | embodied runtime at MVP stage | goal-conditioned behavior、environmental feedback |
| V-JEPA 2 | latent prediction、action-conditioned world model、planning | latent world model | full physical world model at MVP | predict relevant latent state rather than all pixels |
| MemGPT | hierarchical memory/context management | persistent state/memory | memory OS mechanics | paging/compaction and explicit memory tiers |
| Mem0 | salient memory extraction/consolidation/retrieval | memory write/consolidation | generic long-term memory | practical memory lifecycle |
| Zep/Graphiti | temporal knowledge graph, cross-session synthesis | temporal memory/state | knowledge graph as universal solution | temporal validity/provenance |
| Generative Agents | observation/planning/reflection/memory | memory/reflection/planning | simulation architecture | retrieve-reflect-plan loop |
| CoALA | modular memory + actions + decision loop | cognitive architecture | rebranding CoALA | explicit cognitive modules/action space |
| Global Workspace Agents | event-driven workspace、heterogeneous agents、intrinsic drive、dual memory | workspace/event bus/intrinsic motivation | copy of GWA | event-driven broadcast、heterogeneous roles |
| Human-AI teaming | shared mental models、trust、authority、mixed initiative | JCC | generic UX-only collaboration | shared state、authority calibration |

Key sources: OpenAI agent runtime and GPT-5.6 guidance citeturn536314search1turn536314search4turn536314search7; Anthropic context engineering and multi-agent research citeturn536314search2turn536314search3; Claude Code human/AI division of labor citeturn536314search8; Google Deep Research, Genie 3 and SIMA 2 citeturn695504search1turn695504search0turn695504search2; V-JEPA 2 citeturn239939academia50; MemGPT/Mem0/Zep citeturn495493academia96turn239939academia49turn536314academia48; CoALA citeturn536314academia49; Global Workspace Agents citeturn695504academia48.

---

# 2. “我们是不是做了别人做过的东西？”——逐层裁决

## 2.1 Architecture components

**答案：大量是。**

如果我们的论文/产品主张是：

\[
LLM + Memory + Planner + Search + Tool + World Model + Reflection
\]

则创新性很弱，因为已有文献和产品分别覆盖这些模块。

## 2.2 Integration

**答案：仍然有价值，但不能天然称为创新。**

真正价值来自：

- 清晰的接口契约；
- 可复现的状态转移；
- 成本控制；
- 稳定性；
- 可审计；
- 在真实任务上的 measurable gain。

## 2.3 Research novelty

当前值得验证的候选创新不是“模块存在”，而是：

\[
\boxed{
\text{Consequence-driven credit allocation across human, memory, policy, schema and world/task state}
}
\]

特别是把：

\[
\text{human correction}
+
\text{tool/world outcome}
+
\text{prediction error}
\]

统一编码为 experience event，并让它影响**后续协作策略**。

注意：credit assignment 本身也已有研究，不可声称原创。CSLA 的潜在差异在于它同时跨越：

\[
\text{module}
\times
\text{time}
\times
\text{experience}
\times
\text{human/AI interaction}
\]

并进一步进入 memory consolidation / shared cognitive state update。

---

# 3. Final System Definition

CSLA 不是单一模型，而是 runtime：

\[
\boxed{
CSLA = State + Operators + Environment + Learning\ Dynamics
}
\]

联合系统：

\[
\boxed{
J_t=(H_t,A_t,S_t,W_t,G_t,I_t,\alpha_t,T_t)
}
\]

其中：

- \(H_t\)：Human state model
- \(A_t\)：AI cognitive state
- \(S_t\)：shared cognitive state
- \(W_t\)：task/world model
- \(G_t\)：current goal state
- \(I_t\)：interaction state
- \(\alpha_t\)：authority allocation
- \(T_t\)：trust/reliance calibration

AI 内部认知状态：

\[
\boxed{
A_t=(D_t,G_t,B_t,M_t,W_t,P_t,\Pi_t,U_t,K_t,Self_t)
}
\]

其中：

- \(D_t\)：preference/motivation state
- \(G_t\)：goal
- \(B_t\)：belief
- \(M_t\)：memory
- \(W_t\)：world/task model
- \(P_t\)：working/executive state
- \(\Pi_t\)：policy
- \(U_t\)：uncertainty
- \(K_t\)：schema
- \(Self_t\)：self-model

---

# 4. Goal/Desire Model

不把“欲望”伪装成一个 reward scalar。

第一版使用：

\[
D_t=(Preference,Value,Priority,Urgency,Commitment)
\]

Goal generator：

\[
G_t=GoalGen(D_t,S_t,W_t,M_t,C_t)
\]

候选 goal：

\[
\mathcal G_t=\{g_1,\ldots,g_k\}
\]

Goal score：

\[
Score(g)=
\lambda_v V(g)
+
\lambda_p P_{success}(g)
-
\lambda_c Cost(g)
-
\lambda_r Risk(g)
+
\lambda_a Alignment(g)
\]

\[
g^*=\arg\max_g Score(g)
\]

**第一版产品原则：**目标必须可以被用户修正；系统不能把推断目标偷偷当成用户真实意图。

---

# 5. Fast Interaction / Deep Cognition Split

## Fast layer

\[
L_{t+1}=F_L(L_t,input_t)
\]

负责自然对话、低延迟生成。

## Deep layer

\[
C_{t+1}=F_C(C_t,E_t)
\]

负责目标、记忆、假设、证据、任务状态和长期更新。

只有当：

\[
Gate(E_t)>\tau_C
\]

时，交互事件才导致深层 cognition update。

候选 gate：

\[
Gate(E_t)=
\sigma(
\theta_N Novelty
+\theta_G GoalRel
+\theta_D DecisionImpact
+\theta_U Uncertainty
+\theta_F FutureUtility
-\theta_C Cost
)
\]

这允许：

\[
\text{短对话} \neq \text{深度认知更新}
\]

---

# 6. Cognitive Event / Trace

统一事件：

\[
\boxed{
E_t=(O_t,A_t,\hat O_{t+1},O_{t+1},R_t,\Delta_t,H_t,C_t,P_t)
}
\]

建议字段：

- task_id
- session_id
- timestamp
- human_input
- ai_action
- selected_context
- selected_operator
- prediction
- outcome
- evidence
- uncertainty
- human_feedback
- credit
- state_version
- artifact_version

每次持久改变必须产生 event。

---

# 7. LLM Operator Pool

LLM 不作为唯一 Agent，而作为 operator provider。

\[
\mathcal O=\{
Generate,
Reason,
Search,
Critique,
Counterexample,
Summarize,
Plan,
Simulate,
Verify,
Write,
Visualize,
AskHuman
\}
\]

请求：

\[
X_t=ContextRouter(S_t,O_t,m_t)
\]

调用：

\[
y_i\sim LLM_i(X_i)
\]

多个候选：

\[
Y=\{y_1,\ldots,y_N\}
\]

然后：

\[
Y
\rightarrow
Cluster
\rightarrow
Hypothesis
\rightarrow
Evaluate
\rightarrow
Select/Synthesize
\]

必须支持 provider-agnostic：

- OpenAI
- Anthropic
- Gemini
- local models

第一版不修改任何 foundation-model weights。

---

# 8. Search as Active Information Acquisition

Search 是 action，不是固定 RAG step：

\[
a_t^{search}\in\mathcal A
\]

\[
U(a)=IG(a)+GoalGain(a)-Cost(a)-Risk(a)
\]

\[
a^*=\arg\max_a U(a)
\]

搜索闭环：

\[
Hypothesis
\rightarrow
Query
\rightarrow
Evidence
\rightarrow
BeliefUpdate
\rightarrow
NextQuery
\]

系统必须能够决定：

- 不搜；
- 再搜一次；
- 换来源；
- 查一手资料；
- 问人；
- 停止搜索。

---

# 9. Innovation Elicitation

这是 Stylotrace 的关键垂直能力，但不能声称“没人做过 idea generation”。

目标：不是让 AI 代替用户生成更多观点，而是最大化**用户自己的 latent insight 被外化的概率**。

令：

\[
I_t=\text{latent human insight state}
\]

选择问题：

\[
q^*=\arg\max_q
\left[
IG(I_t;q)-\lambda Cost(q)-\mu Intrusion(q)
\right]
\]

候选：

\[
K_{human}=E_{human}(I_t)
\]

AI 扩展：

\[
F_i\sim LLM_i(K_{human},context_i)
\]

最终：

\[
Document=K_{human}+F_{selected}+P_{appropriate}
\]

其中：

- \(K\)：灵魂 / core insight
- \(F\)：知识、经验、证据、风格形成的血肉
- \(P\)：结构、语言、视觉、音频等皮囊/表达

---

# 10. Shared Cognitive State

人与 AI 共同维护：

\[
\boxed{
S_t^{shared}=
(Goal,Claims,Evidence,Hypotheses,Decisions,Questions,Uncertainty,Artifacts)
}
\]

用户修改：

\[
\Delta S_H
\]

AI 操作：

\[
\Delta S_A
\]

共享更新：

\[
S_{t+1}^{shared}=U(S_t^{shared},\Delta S_H,\Delta S_A,O_{t+1})
\]

这不是普通 chat history。

---

# 11. Adaptive Authority

\[
\alpha_t\in[0,1]
\]

表示当前任务由 AI 主导程度。

\[
\alpha_t
=f(Capability,Confidence,Alignment,Risk,HumanState)
\]

交互方式：

\[
Action_t=
\alpha_t Action_t^{AI}
+(1-\alpha_t)Action_t^{Human}
\]

在文本产品中，这可以转译为：

- answer directly
- suggest
- ask
- challenge
- draft
- wait
- request approval

不是所有时刻 AI 都应该“更多自动化”。

---

# 12. World / Task Model

MVP 不实现完整物理 world model。

第一阶段实现：

\[
W_t^{task}

to model:
\]

- entities
- constraints
- dependencies
- expected outcomes
- evidence
- action consequences
- uncertainty

预测：

\[
\hat z_{t+1}=W(z_t,a_t)
\]

未来升级：

\[
p(z_{t+1}|z_t,a_t)
\]

再升级：

\[
p(Y|do(X=x))
\]

这样避免一开始复制 Genie/Jepa 这种基础 world-model 路线。

---

# 13. Outcome Ledger

任何重要输出必须记录：

\[
L_t=(Prediction,Action,Outcome,Error,HumanEvaluation)
\]

然后：

\[
Delta_t=D(Outcome,Prediction)
\]

这成为后续 credit 的输入。

---

# 14. Credit Assignment v1

不要一开始训练 neural credit network。

第一版使用可解释 counterfactual：

\[
C_i=L^{CF}_i-L^{real}
\]

同时记录 baseline：

\[
B=(B_0,B_1,B_2)
\]

其中：

- \(B_0\)：frozen baseline
- \(B_1\)：counterfactual replacement
- \(B_2\)：matched alternative

先通过实验评估哪一种 baseline 在不同任务下最稳定。

然后形成：

\[
C_{i,t,e}
\]

最后再训练：

\[
\hat C=C_\psi(S_t,E_t,Delta_t,U_t)
\]

训练：

\[
L_{credit}=D(\hat C,C^{CF})
\]

只在：

\[
Entropy(\hat C)>\tau
\]

时运行昂贵的 intervention。

---

# 15. Consolidation

经验价值：

\[
V(e)=
\alpha|Delta|
+\beta IG
+\gamma GoalRel
+\delta Credit
-\lambda Cost
\]

当：

\[
V(e)>\tau_M
\]

进入 replay：

\[
e\rightarrow Replay\rightarrow Abstract\rightarrow Schema
\]

这一步不是简单保存文本。

---

# 16. Multimodal Direction

多模态不是“支持更多输入格式”。

统一入口：

\[
O_t=\{Text,Image,Audio,Video,Files,Environment\}
\]

共享表示：

\[
z_t=E(O_t,S_t)
\]

输出模态选择：

\[
m^*=\arg\min_m Loss(Idea,Representation_m)
\]

第一版可以先接现有 multimodal APIs，不训练自有 multimodal foundation model。

---

# 17. Evaluation Framework

必须至少有：

### A. Cognitive state continuity

同一长期任务跨 session 是否保持正确状态。

### B. Goal fidelity

AI 推断的 goal 是否和用户最终确认一致。

### C. Innovation elicitation

用户原始想法经过最少交互后是否得到更高 novel/important idea。

### D. Search efficiency

\[
Utility/SearchCost
\]

### E. Human-AI synergy

\[
Synergy=U(H+A)-\max(U(H),U(A))
\]

### F. Recovery

\[
RecoveryRate
=\frac{correct\ recoveries}{failures}
\]

### G. Credit quality

\[
CreditError=||\hat C-C^{CF}||
\]

### H. Learning over time

\[
Performance_{t+1}>Performance_t
\]

### I. Generalization

未见过的任务/主题上的表现。

### J. Cost

tokens / latency / tool calls / human turns。

---

# 18. Required Baselines

必须比较：

1. Vanilla LLM
2. LLM + CoT
3. LLM + RAG
4. LLM + ReAct
5. LLM + Memory
6. LLM + Reflection
7. LLM + multi-agent
8. Stylotrace current version
9. CSLA without shared state
10. CSLA without credit
11. CSLA without consolidation
12. Full CSLA

不要只比较最终质量，要比较 cost、turn count、search calls、recovery、generalization。

---

# 19. MVP Implementation Boundary

现在真正可以落地的版本只需要：

\[
\boxed{
LLM API
+
CognitiveStateStore
+
CognitiveTrace
+
Goal/Desire State
+
InnovationElicitor
+
ContextRouter
+
LLMOperatorPool
+
Search/Tool Adapter
+
OutcomeLedger
+
BasicCounterfactualCredit
}
\]

暂缓：

- 自研基础 world model
- 自研 multimodal foundation model
- foundation model fine-tuning
- token-level neural modulation
- full neural credit estimator
- embodied robotics

---

# 20. Stylotrace as First Vertical Cognitive Laboratory

现有 Stylotrace 已拥有大量可以复用的结构：改迹调制、风格模型、澄清、思想脉络、治理、目的、结构、约束、知识/RAG、审计、长文一致性、CLI/MCP/Web/FastAPI 等。其当前文档也明确标注核心机制为候选级评分，且真人长期验证尚未完成。

因此不重写。

目标是把：

\[
HumanEdit
\]

从：

\[
StylePreference
\]

升级为：

\[
CognitiveInteractionEvent
\]

再升级：

\[
DecisionTrace
\]

最终：

\[
CognitiveSchema
\]

---

# 21. Scientific Risk Register

### R1 — 新颖性不足

风险：已有 GWA/CoALA/memory/agent papers 覆盖大部分架构元素。

处理：创新主张限定为 shared-state + cross-module consequence credit + consolidation + human collaboration，必须实验验证。

### R2 — Credit 不可识别

不同 baseline 会得到不同 attribution。

处理：显式记录 baseline policy，并进行 intervention sensitivity analysis。

### R3 — World model hallucinated confidence

处理：预测必须附 confidence/calibration，并与真实 outcome 绑定。

### R4 — Memory bloat

处理：memory write gate + consolidation + forgetting。

### R5 — Human preference overfitting

处理：cross-task/cross-topic test；不能只在用户熟悉任务上评价。

### R6 — Innovation collapse

AI 可能让用户思想趋同。

处理：独立测 idea diversity、human ownership、novelty；不要以“生成更多内容”为目标。

### R7 — Over-orchestration

LLM 本身能力增强后，过多外部模块可能反而降低性能。

处理：所有认知模块必须有 ablation；只有在 measurable gain > cost 时启用。

---

# 22. Final Research Thesis

当前最值得验证的 thesis：

\[
\boxed{
\text{Persistent shared state + consequence-aware selective learning can improve long-horizon human-AI collaboration without modifying the foundation model.}
}
\]

中文：

> **在不修改基础模型的条件下，如果让人和 AI 围绕持久共享认知状态协作，并用真实结果产生的选择性因果信用决定记忆、策略和 schema 的更新，那么长期人机协作能力可能优于只增加 context、RAG、reflection 或更长 reasoning 的系统。**

这是 hypothesis，不是已经证明的事实。

---

# 23. Implementation Principle

不要因为某个组件“像脑”就实现它。

只有当一个机制满足：

\[
\boxed{
Mechanism
\rightarrow
Measurable\
Gain
\rightarrow
Reproducible
\rightarrow
Ablation	ext{-}supported
}
\]

才进入核心系统。

CSLA 的最小原则：

> **Less architecture, more verified cognition.**

