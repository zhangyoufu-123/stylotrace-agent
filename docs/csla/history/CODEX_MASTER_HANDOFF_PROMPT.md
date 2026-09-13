# Codex Master Handoff Prompt — CSLA × Stylotrace

你现在正式接手 CSLA × Stylotrace 项目。

本项目包含一个已有的真实工程 Stylotrace，以及一个正在研究/实现中的 Cognitive State Learning Architecture (CSLA) 与 Joint Cognitive Control (JCC) 层。

你的任务不是从零造一个普通 Agent，而是：

> 读取全部项目材料，理解已有工程，不破坏已经工作的能力，然后把现有 Stylotrace 逐步升级为一个以 Shared Cognitive State、Cognitive Trace、Innovation Elicitation、LLM Operator Pool、Outcome Ledger、Credit Assignment、Memory Consolidation 为核心的长期人机协同系统。

==================================================
0. 强制阅读顺序
==================================================

开始前不要写代码。

必须完整读取：

1. `CSLA_STYLOTRACE_MASTER_UPDATE_PLAN.md`
2. `CSLA_v1_3_JCC_SPEC.md`
3. `CSLA_v1_2_COMPLETE_SPEC.md`
4. `AGENTS_CSLA.md`
5. `CSLA_ARCHITECTURE_DECISIONS.md`
6. `CSLA_API_CONTRACT.yaml`
7. `README_CSLA.md`
8. `PROJECT.md`
9. `docs/` 下与架构、理论、调制器、风格、互操作相关的文件
10. `agent/src/`、`agent/test/` 的目录结构与关键实现

如果当前仓库没有这些文件，要先报告缺失，而不是假设它们存在。

==================================================
1. 先理解真实现状
==================================================

你必须区分：

A. 已实现并测试
B. 已设计但未实现
C. 研究假说
D. 未来路线图

绝对不允许把 B/C/D 写成 A。

`PROJECT.md` 的“诚实第一”原则必须保留。

==================================================
2. 不允许破坏的核心约束
==================================================

- 不修改 foundation Transformer 架构。
- 不要求微调大模型才能运行第一代产品。
- LLM provider 必须通过 adapter 接入。
- 不把 CSLA 简化成 `LLM → prompt → tool → LLM`。
- 不把 Memory 简化成 vector RAG。
- 不把用户风格等同于用户认知。
- 不把人脑脑区类比写成神经科学事实。
- 不在没有实验的情况下宣称性能提升。
- 不为了“看起来完整”随便增加复杂模块。

==================================================
3. 目标架构
==================================================

最终系统：

Human
  ↕
Joint Cognitive Interface
  ↕
Shared Cognitive State
  ↕
CSLA Runtime
  ├── Task / Goal
  ├── Memory
  ├── Schema
  ├── Reasoning Operators
  ├── Context Router
  ├── LLM Operator Pool
  ├── Evaluation / Deliberation
  ├── World / Evidence Model
  ├── Meta-Control
  ├── Authority Controller
  ├── Outcome Ledger
  ├── Credit Engine
  ├── Replay
  └── Consolidation
  ↕
LLM / Tools / Multimodal Providers

第一阶段先实现最小闭环，而不是一次性实现全部研究内容。

==================================================
4. 核心数学脊柱
==================================================

必须保持以下核心定义：

Cognitive state:

S_t=(G_t,B_t,M_t^E,M_t^S,W_t,P_t,Pi_t,U_t,K_t,Self_t,R_t)

Joint state:

J_t=(H_t,A_t,S_t,W_t,G_t,I_t,alpha_t,U_t)

State transition:

S_{t+1}=F_Theta(S_t,a_t,o_{t+1})

World prediction:

hat z_{t+1}=W_theta(z_t,a_t)

Consequence error:

delta_t=D(z_{t+1},hat z_{t+1}) + lambda_R delta_t^RL

Credit:

C_{i,t,e} ≈ L_future(do(i,t,e=baseline)) - L_future(real)

Module update:

theta_i^{t+1}=theta_i^t-eta_i*C_{i,t,e}*gradient(theta_i,J_t)

Authority:

alpha_t=sigma(f_alpha(Capability,Confidence,Alignment,Risk,HumanNeed,Novelty))

Human insight question:

q*=argmax_q IG(HumanInsight;q)-lambda*Friction(q)

==================================================
5. 产品最重要的创新方向
==================================================

最终写作系统不是：

Prompt → AI generates article

而应优先实现：

Human idea
→ detect missing core insight
→ ask one high-value question
→ capture core idea
→ generate diverse candidates
→ cluster hypotheses
→ evidence / logic / counterexample checks
→ human alignment
→ structured synthesis
→ style / presentation
→ outcome
→ learn

作品分层：

D=(K,F,P)

K = Core / soul
F = author knowledge, evidence, experience, style / flesh
P = presentation / skin

优先保护 Human ownership of K。

==================================================
6. 人与 AI 的职责
==================================================

Human should own:
- purpose
- values
- original insight
- high-stakes judgment
- final approval

AI should own:
- candidate generation
- search
- comparison
- evidence organization
- consistency
- repetitive editing
- multimodal conversion
- low-risk execution

Joint:
- framing
- hypothesis refinement
- core idea stress test
- synthesis

==================================================
7. LLM 合作方式
==================================================

不要把 LLM 当成单一“总 Agent”。

建立 provider-neutral operator pool：

- divergent generator
- analyst
- skeptic
- researcher
- structuralizer
- style adapter
- multimodal generator

不同 operator 应看到不同 Context Bundle。

不要把所有历史 context 全塞给每个 LLM。

先：

Cognitive Mode
→ Context Router
→ Operator Selection
→ LLM Calls

然后：

Candidates
→ Evaluation
→ Deliberation
→ Synthesis

“多点大量生成”不等于“投票”。

==================================================
8. Shared Cognitive State
==================================================

必须维护可版本化状态：

- Goal
- Intent
- Core Idea
- Hypotheses
- Evidence
- Assumptions
- Questions
- Decisions
- Uncertainty
- Open Problems
- Relevant Memory
- Current Draft
- Authority

Dialogue text 是输入/输出层，不是完整状态。

==================================================
9. Cognitive Trace
==================================================

高价值互动必须形成结构化事件：

human input
ai proposal
human modification
reason (optional / inferred / confirmed)
goal
hypothesis
evidence
prediction
outcome
uncertainty
credit
provenance

修改用户文章不能只产生“style preference”；要区分：

Style → Preference → Decision Pattern → Task Schema

只有足够证据时才上升层级。

==================================================
10. Memory
==================================================

维护：

M^E = episodic
M^S = semantic/schema
M^W = working

核心：

Retrieval != Learning

记忆事件必须至少保存：

state/action/prediction/outcome/error/context/provenance

长期目标：

experience → replay → abstraction → schema

==================================================
11. Outcome Ledger
==================================================

每次重要输出和行动都要能追踪：

prediction
→ action
→ outcome
→ error
→ human feedback
→ credit
→ update

没有 outcome ledger 就没有可靠的 consequence-driven learning。

==================================================
12. Credit Engine
==================================================

第一阶段不要追求全量精确 Shapley。

先实现：

1. module-level intervention interface
2. experience-level intervention interface
3. temporal attribution record
4. learned credit estimator
5. selective counterfactual fallback

当：

Entropy(predicted_credit)>threshold

才进行昂贵 intervention。

==================================================
13. Replay / Consolidation
==================================================

不要把 replay 当 RAG retrieval。

Replay 应重新运行过去的重要经验，以训练：

- world/evidence model
- schema
- policy
- calibration

Consolidation score 可以基于：

prediction error
information gain
goal relevance
credit
cost

==================================================
14. Frontend
==================================================

第一版至少需要：

A. Chat / fast interaction
B. Cognitive Workspace
C. Writing Canvas
D. Human decision gates
E. optional Trace / Learning panel

Cognitive Workspace 最少展示：

Goal / Core Idea / Questions / Evidence / Hypotheses / Outline / Decisions

不要把内部 chain-of-thought 原样暴露给用户。

应展示结构化 reasoning artifacts、结论依据和决策状态。

==================================================
15. Backend
==================================================

建议服务边界：

API Gateway
Session/Tenant
Shared State
Memory
LLM Gateway
Operator Router
Evidence
Evaluation
Outcome Ledger
Credit
Replay
Consolidation

所有持久状态必须 versioned + observable。

==================================================
16. 第一阶段 MVP
==================================================

先实现：

LLM API
+
Task State
+
Shared Cognitive State
+
Episodic Memory
+
Cognitive Trace
+
Innovation Elicitation
+
Multi-candidate generation
+
Evaluation / Deliberation
+
Human approval
+
Outcome Ledger
+
Basic Credit Estimator

暂时不要：

- 训练大模型
- 复杂真实世界机器人
- 完整 JEPA training
- 全量 Shapley
- 大规模 autonomous external actions

==================================================
17. 必须利用现有 Stylotrace，而不是重写
==================================================

现有模块优先映射：

clarify → task state
thinking → cognitive trace
 governance/purpose/constraints → goal state
director → executive control
modulator → gating/policy
style-memory/personal-model → memory/model
edit-transform → decision trace
avoidance → negative memory/inhibition
rag/knowledge → evidence retrieval
redteam/fact-check → evaluation
bible/consistency → long-horizon schema/state consistency
llm → provider-neutral gateway

只新增真正缺失的核心层。

==================================================
18. 第一轮 Codex 工作
==================================================

现在不要改代码。

执行：

1. repository audit
2. read all architecture/research docs
3. map 现有 73 modules 到 CSLA/JCC
4. identify reusable / adapt / missing
5. inspect actual tests
6. inspect current API and entrypoints
7. produce `CSLA_IMPLEMENTATION_READINESS_REPORT.md`

报告必须回答：

A. 当前系统真实做到了什么？
B. 哪些理论已经有实现？
C. 哪些理论没有实现？
D. 哪些模块重合？
E. 先实现哪五个新增模块？
F. State schema 应该在哪里落地？
G. Event schema 应该在哪里落地？
H. Cognitive Trace 怎么接入现有 edit flow？
I. LLM Gateway 是否已经可复用？
J. 前端最少需要哪些改动？
K. 第一条端到端 demo path 是什么？
L. 哪些设计有理论冲突？
M. 哪些地方可能重复已有项目/论文？
N. 哪些东西必须实验验证？

不要先写大量代码。

==================================================
19. 第二轮才开始改造
==================================================

优先顺序：

1. schemas/contracts
2. Shared Cognitive State
3. Event Ledger
4. Cognitive Trace
5. Innovation Elicitor
6. LLM Operator Pool / Context Router
7. Evaluation / Deliberation
8. Outcome Ledger
9. Basic Credit
10. Memory consolidation hooks
11. Frontend workspace
12. benchmarks

每完成一层都写测试。

==================================================
20. 永远保持科学纪律
==================================================

必须区分：

fact
hypothesis
implementation
result
interpretation

如果实验失败，优先分析机制，而不是修改 benchmark 或事后改定义。

不要把：

“用户更喜欢这个输出”

直接解释成：

“用户认知被准确建模”。

不要把：

“LLM 生成得很好”

解释成：

“系统学会了”。

学习必须体现为：

experience at t
→ state change
→ improved behavior at t+1 or later

==================================================
21. 你的最终目标
==================================================

把 Stylotrace 从：

“会学习作者文风的写作 Agent”

逐步推进到：

“能够和人共同维护任务状态、主动挖掘人的核心想法、调用多个 LLM 形成候选、进行验证与综合，并从真实互动结果中持续改善下一次协作的认知写作系统”。

更抽象地：

Human
↔
Shared Cognitive State
↔
CSLA
↔
LLM / Tools / World

最终科学问题：

是否能够证明：

persistent cognitive state
+
innovation elicitation
+
consequence-driven credit
+
selective consolidation

能够在长期人机协作任务上优于：

LLM only
LLM + RAG
LLM + CoT
LLM + ReAct
LLM + static personalization
LLM + reflection/memory

如果不能证明，就修改理论。

不要为了证明我们正确而修改实验。

现在开始执行“第一轮 Codex 工作”，先分析，不要直接大规模写代码。
