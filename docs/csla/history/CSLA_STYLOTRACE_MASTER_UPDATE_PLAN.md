# CSLA × Stylotrace — Joint Cognitive Writing System Master Update Plan

**Version:** 1.0 (2026-08-28)
**Purpose:** 将现有 Stylotrace 工程与 CSLA/JCC 理论统一成一个可实现、可评测、可商业化的第一代完整系统规格。

> 本文档不是“产品宣传稿”，而是研究 + 工程的主设计文件。未经实验验证的内容必须标记为 hypothesis；不得把类脑类比写成神经科学事实。

---

## 0. 核心判断

现有 Stylotrace 已经是一个工程上较完整的写作 Agent，包含改迹调制、风格向量、风格记忆、澄清、思想脉络、治理、目的/结构/约束、知识/RAG、事实核查、长文一致性、CLI/MCP/Web/API/插件等能力；但其真实边界仍是候选级调制，且尚无真人长期验证。详见 `PROJECT.md`。

CSLA 不应该替换这些能力，而应该在其上增加一个统一的认知运行时；Stylotrace 是第一个垂直应用与实验场。

### 最终结构

```text
Human
  ↕
Joint Cognitive Interface (JCI)
  ↕
Shared Cognitive State (SCS)
  ↕
CSLA Cognitive Runtime
  ├── Task / Goal State
  ├── Memory / Schema
  ├── Reasoning Operators
  ├── World / Evidence Model
  ├── Meta-Control
  ├── LLM Operator Pool
  ├── Evaluation / Deliberation
  ├── Outcome Ledger
  ├── Credit Assignment
  ├── Replay / Consolidation
  └── Tool / Multimodal Bus
  ↕
LLM Providers / Tools / Web / Files / Multimodal Models
```

---

# 1. 第一原则：LLM 不被替换，CSLA 负责认知编排与学习

当前约束：

- 冻结 foundation LLM；
- 不修改 Transformer 架构；
- 不依赖大规模 foundation-model 微调；
- 优先使用现成 LLM API / 本地模型；
- 学习发生在外层状态、记忆、轻量模型、路由器、评价器与策略层。

### 职责划分

**LLM**：高速、通用的语言/知识/候选生成器。

**CSLA**：决定何时思考、给哪些上下文、让多少个候选并行、如何评价、如何记忆、如何从结果学习。

**Human**：提供价值、真实目标、原创体验、关键判断、最终高价值决策。

**Tools / World**：提供外部事实、执行与反馈。

---

# 2. 最终用户体验：表层快交流 + 深层持续认知

人机交流不能把每个短消息都当成一次长推理任务。

定义两条并行循环：

## Fast Interaction Loop

```text
Human utterance
→ intent / salience detection
→ short response
→ next turn
```

目标：低延迟、自然、一问一答。

## Deep Cognitive Loop

```text
signal
→ shared-state update candidate
→ retrieve / hypothesize / plan / verify
→ update beliefs
→ update open questions
→ optionally update memory
→ optionally trigger next action
```

核心原则：

```text
Dialogue != Cognition
```

语言交流只是接口；深层认知状态是持久变量。

---

# 3. Shared Cognitive State

定义联合认知状态：

\[
J_t=(H_t,A_t,S_t,W_t,G_t,I_t,\alpha_t,U_t)
\]

其中：

- `H_t`: human-state model（对当前用户目标、约束、偏好、已表达思想的工作表示）
- `A_t`: AI cognitive state
- `S_t`: shared state
- `W_t`: task/world/evidence model
- `G_t`: joint goal
- `I_t`: interaction state
- `alpha_t`: AI authority / initiative level
- `U_t`: uncertainty / calibration state

注意：`H_t` 是对用户在任务中的可操作状态模型，不等同于读取用户“真实内心”。

---

# 4. Human / AI 权责分配

## 4.1 应交给 Human

Human 优先负责：

1. 最终目标与价值判断；
2. 真实经验和私有语境；
3. 高价值原创洞察；
4. “这件事到底是不是我真正想说的”；
5. 高风险、不可逆、重大外部行动的授权；
6. 最终作品归属与发布决定。

## 4.2 应交给 AI

AI 优先负责：

1. 大规模候选生成；
2. 结构化搜索；
3. 类比检索；
4. 反例生成；
5. 资料整理；
6. 逻辑一致性检查；
7. 长文本组织；
8. 多模态转换；
9. 重复性编辑；
10. 低风险执行。

## 4.3 共同完成

Human + AI 共同完成：

- hypothesis refinement；
- problem framing；
- concept formation；
- outline selection；
- core idea stress test；
- final synthesis。

---

# 5. 动态控制权

AI 的主动权不是固定的。

\[
\alpha_t=\sigma(f_\alpha(Capability_t,Confidence_t,Alignment_t,Risk_t,HumanNeed_t,Novelty_t))
\]

`alpha_t ∈ [0,1]` 表示 AI 当前建议/行动的主导程度。

高风险、低置信度、高人类价值判断需求时：`alpha_t ↓`。

低风险、重复性工作、AI 已验证可靠时：`alpha_t ↑`。

最终不追求 AI 永远主动，而追求 **authority calibration**。

---

# 6. 创新优先机制：先找“灵魂”，再生产“血肉”，最后生成“皮囊”

这是 Stylotrace 下一版最重要的产品流程。

定义作品：

\[
D=(K,F,P)
\]

- `K`: Core — 核心原创/核心判断/灵魂
- `F`: Flesh — 作者已有经验、知识、证据、风格、案例
- `P`: Presentation — 结构、句子、标题、格式、图片、声音等表达

最终：

\[
D_{final}=Compose(K,F,P)
\]

## 6.1 默认禁止的行为

用户只有一句模糊想法时，系统不能直接生成大篇幅“AI 同质化文章”。

## 6.2 默认行为

```text
模糊想法
→ 识别潜在创新点
→ 找信息缺口
→ 问一个高价值问题
→ 用户补充
→ 形成 Core Idea
→ AI 多路径扩展
→ 反例 / 事实 / 逻辑 / 新颖性检查
→ Human validation
→ 结构化展开
→ 风格化表达
→ 最终交付
```

---

# 7. Human Insight Elicitation

目标不是让用户回答一堆问卷，而是最少的问题换取最大的认知增量。

定义候选问题：

\[
q^*=\arg\max_q IG(HumanInsight;q)-\lambda Friction(q)
\]

系统每轮只优先提出一个高价值问题。

### 问题类型

- `Clarify`: 你到底在说什么？
- `Differentiate`: 你和常见观点有什么不同？
- `Why`: 你为什么这么判断？
- `Counterexample`: 什么情况会推翻你？
- `Origin`: 你是从哪个经历得出的？
- `Implication`: 如果你是对的，会意味着什么？
- `Boundary`: 这个观点在哪里不成立？

---

# 8. Innovation Attractor

定义当前用户潜在的核心观点集合：

\[
\mathcal K_t=\{k_1,...,k_n\}
\]

每个候选核心观点评分：

\[
Score(k)=
\lambda_N Novelty(k)
+\lambda_U Utility(k)
+\lambda_E EvidencePotential(k)
+\lambda_H HumanOwnership(k)
+\lambda_T Transferability(k)
-\lambda_R Risk(k)
\]

其中 `HumanOwnership` 表示该观点是否明显来自用户自己的经验/判断，而不是简单复述公共知识。

目标不是选择“AI 最漂亮的观点”，而是找到：

> **最值得由人继续展开、且最可能形成非同质化产出的核心观点。**

---

# 9. LLM Pool：多点生成，但不是简单多 agent 投票

建立 provider-neutral LLM operator pool：

```text
Generator A: divergent / creative
Generator B: analytical
Generator C: skeptical / adversarial
Generator D: evidence / research
Generator E: structural editor
Generator F: style / author fit
Generator G: multimodal / visual
```

不同 operator 不应收到完全相同上下文。

定义：

\[
X_i=ContextRouter(S_t,m_i)
\]

然后：

\[
y_i\sim LLM_i(X_i)
\]

生成多个候选：

\[
\mathcal Y=\{y_1,...,y_N\}
\]

---

# 10. Candidate → Hypothesis → Deliberation → Synthesis

不能：

```text
N outputs → vote → answer
```

应该：

```text
N candidates
→ semantic clustering
→ hypothesis abstraction
→ evidence binding
→ contradiction detection
→ counterexample search
→ human alignment
→ synthesis
```

定义 hypothesis 集合：

\[
\mathcal H=Cluster(\mathcal Y)
\]

每个 hypothesis：

\[
h_i=(claim,evidence,assumption,prediction,risk)
\]

---

# 11. Evaluator Stack

每个候选至少经过：

\[
E(y)=
(w_1E_{fact},w_2E_{logic},w_3E_{goal},w_4E_{novelty},w_5E_{style},w_6E_{risk},w_7E_{humanfit})
\]

评价器可以由不同 LLM / deterministic rules / external tools 组成。

必须保存评分分解和证据来源。

---

# 12. World / Evidence Model

写作不是封闭语言游戏。

外部事实进入：

\[
Evidence_t
\]

任务模型：

\[
W_t=P(State,Relations,Evidence,Uncertainty)
\]

涉及研究/事实类陈述时，优先绑定来源；事实不确定时，不应伪装成确定结论。

未来可加入 latent world model，但第一代商业产品不要求训练 JEPA。

---

# 13. Memory Architecture

至少维护：

\[
M_t=(M_t^E,M_t^S,M_t^W)
\]

- `Episodic`: 具体经历、对话、修改、结果
- `Semantic/Schema`: 从多次经历抽象出的稳定规律
- `Working`: 当前任务短期状态

记忆不是简单 RAG。

### Memory event

\[
e_t=(state,action,prediction,outcome,error,context,provenance)
\]

### Write gate

\[
w_t=\sigma(\theta_1|\delta_t|+\theta_2IG_t+\theta_3GoalRel_t+\theta_4Novelty_t+\theta_5Credit_t-\theta_6Cost_t)
\]

### Consolidation

\[
e_{1:n}\rightarrow Replay\rightarrow Schema
\]

---

# 14. Cognitive Trace：真正的核心数据资产

每一次高价值人机互动记录：

```json
{
  "event_id": "...",
  "human_input": "...",
  "ai_proposal": "...",
  "human_edit": "...",
  "interaction_reason": "...",
  "goal": "...",
  "hypothesis": "...",
  "evidence": [],
  "prediction": "...",
  "outcome": "...",
  "uncertainty": 0.0,
  "credit": {},
  "provenance": {}
}
```

长期目标：

\[
CognitiveTrace_{1:T}
\rightarrow
DecisionSchema
\rightarrow
PersonalTaskModel
\]

注意：不能把“用户写作偏好”直接等同于“用户认知模型”。两者要分层存储。

---

# 15. Style → Preference → Decision → Schema

Stylotrace 当前已经有编辑轨迹、风格向量、回避库、改迹变换等能力。

下一阶段要把其学习层次分成：

```text
Style
↓
Preference
↓
Decision Pattern
↓
Task Schema
↓
Cognitive Pattern
```

例如：

```text
Style:
我喜欢短句。

Preference:
我删掉了这句长句。

Decision pattern:
当抽象程度高时，我倾向于缩短句子。

Task schema:
抽象观点必须配一个具体例子。
```

只有当重复证据足够时，才能上升到更高层。

---

# 16. Human Edit → Learning

当前 Stylotrace：

\[
Draft\rightarrow HumanEdit\rightarrow PreferenceSignal
\]

下一代：

\[
Draft
\rightarrow HumanEdit
\rightarrow PossibleReason
\rightarrow HumanConfirmation(optional)
\rightarrow CognitiveEvent
\rightarrow Credit
\rightarrow Update
\]

系统不应强迫用户解释每一次修改；只有高价值、可疑或新颖修改才请求轻量确认。

---

# 17. Error / Credit / Learning

最终结果产生：

\[
\delta_t=D(prediction,outcome)+\lambda_R\delta_t^{RL}
\]

模块 credit：

\[
C_{i,t,e}
\approx
L_{future}(do(i,t,e=baseline))-L_{future}(real)
\]

学习更新：

\[
\theta_i^{t+1}
=
\theta_i^t-\eta_iC_{i,t,e}\nabla_{\theta_i}J_t
\]

高不确定的 credit：

\[
Entropy(\hat C_t)>\tau
\Rightarrow Counterfactual\ Intervention
\]

---

# 18. Human-AI Joint Innovation

定义：

\[
I_H=Human\ idea\ space
\]

\[
I_A=AI\ idea\ space
\]

\[
I_{HA}=Joint\ idea\ space
\]

目标不是 AI 替人生成，而是：

\[
Novel(I_{HA})
>
Novel(I_H),Novel(I_A)
\]

但必须通过实际实验定义“novel”与“useful”，不能靠主观宣传。

---

# 19. Multimodal Cognitive State

输入：

\[
O_t=\{Text,Image,Audio,Video,Files,Environment\}
\]

统一进入：

\[
Z_t=Encoder(O_t,S_t)
\]

输出模态选择：

\[
m^*=\arg\min_m Loss(Idea,Representation_m)
\]

也就是说：

> 不是“支持图片/声音”，而是“让系统判断什么模态最适合承载当前思想”。

第一代商业实现可以以 text + image + file 为主，audio/video 作为接口扩展。

---

# 20. End-to-End 产品工作流

## Stage 0 — Capture

用户输入：文字 / 文档 / 图片 / 音频 / 草图 / URL。

## Stage 1 — Fast Understanding

快速识别：

- intent
- domain
- goal
- task type
- salience
- uncertainty

## Stage 2 — Deep State Update

更新 shared state，决定是否进入深思。

## Stage 3 — Innovation Check

如果任务涉及创作/研究/观点：先判断是否缺少核心 insight。

## Stage 4 — Human Elicitation

在必要时只问一个最有价值的问题。

## Stage 5 — Candidate Expansion

多个 LLM/operator 从不同上下文并行产生候选。

## Stage 6 — Deliberation

聚类、假设抽象、事实验证、反例、逻辑检查。

## Stage 7 — Human Alignment

把高价值分歧交还给用户。

## Stage 8 — Structured Synthesis

先生成骨架，再生成内容，再做风格化。

## Stage 9 — Multimodal Composition

根据内容选择文字/图片/图表/音频等输出形式。

## Stage 10 — Quality Gates

事实、原创性、逻辑、结构、风格、格式、目标完成度。

## Stage 11 — Delivery

导出文章 / 文档 / Markdown / PDF / image / audio 等。

## Stage 12 — Outcome Capture

保存最终结果及后续人类反馈。

## Stage 13 — Learning

Credit → Memory → Schema → Next Session。

---

# 21. 产品前端

## A. Conversation Surface

短消息、一问一答、低延迟。

## B. Cognitive Workspace

可视化：

- Goal
- Core Idea
- Questions
- Evidence
- Hypotheses
- Outline
- Decisions
- Open Problems
- Memory

## C. Creation Canvas

最终文本、图像、结构、批注。

## D. Human Control Points

只在高价值决策点出现：

- 选择核心观点
- 选择方向
- 授权外部行动
- 确认重大事实/价值判断
- 最终发布

## E. Trace / Learning Panel（可选）

让用户看见：

> AI 从我的哪些修改中学到了什么。

必须支持删除/纠正/撤销。

---

# 22. 后端服务分层

```text
API Gateway
   ↓
Session / Tenant
   ↓
Joint Cognitive Runtime
   ├── State Store
   ├── Event Ledger
   ├── Memory Service
   ├── Operator Router
   ├── LLM Gateway
   ├── Tool Gateway
   ├── Evidence Service
   ├── Evaluation Service
   ├── Credit Service
   ├── Replay Service
   └── Consolidation Service
        ↓
Persistence / Vector / Graph / Object Storage
```

---

# 23. LLM Gateway

必须 provider-neutral：

```text
LLMProvider
├── OpenAI
├── Anthropic
├── Gemini
├── Local
└── Future providers
```

统一接口：

```python
response = llm.generate(
    messages=...,
    tools=...,
    response_schema=...,
    metadata=...
)
```

所有 provider-specific logic 都留在 adapter 内。

---

# 24. LLM 调用不是“一个 prompt”

每次调用应带：

```text
Task Goal
Current Cognitive State
Relevant Memory
Evidence
Constraints
Cognitive Mode
Expected Output Type
Uncertainty
Budget
Provenance requirements
```

但不得把全部历史塞进去。

必须先经过 Context Router：

\[
X_t=R_c(S_t,m_t,R_t)
\]

然后才交给 LLM。

---

# 25. 商业 API 最小接口

```text
POST /sessions
POST /sessions/{id}/events
POST /sessions/{id}/run
POST /sessions/{id}/ask
POST /sessions/{id}/draft
POST /sessions/{id}/review
POST /sessions/{id}/approve
GET  /sessions/{id}/state
GET  /sessions/{id}/trace
POST /sessions/{id}/feedback
POST /sessions/{id}/export
```

未来开放：

```text
POST /memory/search
POST /memory/consolidate
POST /reason
POST /evaluate
POST /multimodal/compose
```

---

# 26. 安全与治理

高风险动作默认 human approval。

每个 external side effect 必须：

```text
propose
→ validate
→ authorize
→ execute
→ observe
→ ledger
```

持久学习操作必须记录：

```text
who
what
when
why
source
credit
state_before
state_after
```

---

# 27. 商业壁垒

不要把“LLM API”当壁垒。

可形成的长期资产：

1. Cognitive Trace；
2. 用户自己的 Decision Schema；
3. 经过验证的 task-specific memory；
4. 人机协同 outcome 数据；
5. credit-weighted learning pipeline；
6. 行业任务 schema；
7. 可迁移的 cognitive runtime。

但这些都必须在真实用户与长期实验中证明价值。

---

# 28. 第一代商业产品应该非常克制

第一版不要实现整个 CSLA 的所有研究假设。

MVP：

```text
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
```

先证明：

\[
Human\ idea
\rightarrow
AI\ expansion
\rightarrow
better\ artifact
\rightarrow
learned\ next\ interaction
\]

---

# 29. 必须做的核心实验

### E1 Human Insight Elicitation

比较：

- 直接生成
- 固定问卷
- CSLA information-gain questioning

指标：核心观点质量、创新度、用户负担。

### E2 Candidate Deliberation

比较：

- single LLM
- multi-sample vote
- multi-operator deliberation

### E3 Human Decision Learning

比较：

- static style profile
- edit-only preference learning
- decision-trace learning

### E4 Credit Assignment

比较：

- terminal reward
- uniform propagation
- learned credit
- counterfactual credit

### E5 Consolidation

比较：

- no consolidation
- novelty-only
- error-only
- credit-weighted

### E6 Longitudinal Collaboration

观察：

\[
Performance_{session\ t+1}>Performance_{session\ t}
\]

### E7 Joint Innovation

比较：

- human alone
- AI alone
- human + standard AI
- human + CSLA

### E8 Authority Calibration

测：什么时候 AI 应该说、问、建议、执行、沉默。

---

# 30. 现有 Stylotrace 功能的迁移策略

不要重写全部 73 个模块。

优先把已有模块映射到 CSLA：

```text
clarify.js          → Task / Goal State
thinking.js         → Cognitive Trace / Thought State
governance.js       → Goal / Context State
purpose.js          → Goal-conditioned control
constraints.js      → Constraint State
style-memory.js     → Style Memory
personal-model.js   → Personal Model
edit-transform.js   → Human Decision Trace
avoidance.js        → Negative Memory / Inhibition
modulator.js        → Candidate Policy / Gating
director.js         → Executive Control
rag.js              → Evidence Retrieval
knowledge.js        → Knowledge Memory
redteam.js          → Counterexample / Verification
fact-check.js       → Evidence Validator
consistency.js      → State Consistency
bible.js            → Long-horizon Schema
roundtrip.js        → Output Verification
llm.js              → LLM Gateway
```

真正新增的核心层：

```text
CognitiveStateStore
SharedState
ExperienceEventStore
OutcomeLedger
CreditEngine
ConsolidationEngine
InnovationElicitor
ContextRouter
AuthorityController
```

---

# 31. 当前真实边界

必须继承 `PROJECT.md` 的诚实原则：

- 现有产品尚无真实用户长期验证；
- 当前核心调制仍为候选级而非 token-level；
- 多作者、多主题、跨语言实验仍不足；
- heuristic feature 不等于真正理解；
- AI 模拟盲评不能代替真人研究；
- CSLA/JCC 是研究假说和工程设计，不是已证实的人脑复制模型。

---

# 32. 设计决策

### D1
不改 foundation LLM。

### D2
认知状态必须持久化并版本化。

### D3
语言交流层与深层认知层分离。

### D4
Human ownership of core idea 优先于 AI generation volume。

### D5
高价值互动必须产生可审计 trace。

### D6
persistent learning 只能经过 explicit learning event。

### D7
任何新认知机制都必须有 baseline + ablation。

### D8
产品先从写作这一高反馈领域验证，再向其他知识工作扩展。

---

# 33. 最终目标

不是：

> “做一个比 ChatGPT 更会写文章的 AI。”

而是建立一个真实可运行的系统，使：

```text
Human
  ↓
shares experience / insight
  ↓
CSLA identifies what matters
  ↓
AI generates many candidate expansions
  ↓
CSLA organizes + tests + compares
  ↓
Human makes high-value decisions
  ↓
System produces artifact
  ↓
Outcome is observed
  ↓
Credit is assigned
  ↓
Memory / schema / policy update
  ↓
Next collaboration is better
```

数学上：

\[
J_{t+1}=F(J_t,a_t^H,a_t^A,o_{t+1})
\]

以及：

\[
C_{i,t,e}
\rightarrow
\Delta M,
\Delta W,
\Delta \Pi,
\Delta P,
\Delta SharedState
\]

最终研究问题：

\[
\boxed{
Does\ a\ persistent,\ consequence-driven,\ jointly\ controlled\ cognitive\ state\ produce\ better\ long-horizon\ human-AI\ collaboration\ than\ static\ personalization\ and\ conventional\ agent\ orchestration?
}
\]

这才是整套系统需要被实验回答的问题。
