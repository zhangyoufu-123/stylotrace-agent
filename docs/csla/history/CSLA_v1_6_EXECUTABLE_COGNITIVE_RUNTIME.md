# CSLA v1.6 — Executable Cognitive Runtime
## 中等保真类脑认知状态机 + Human–AI Joint Cognitive Runtime

**日期：2026-08-28**  
**状态：架构/数学/运行时规格；仍属可证伪研究假设，不宣称脑复制。**

---

# 0. 本版本解决什么问题

前几个版本已经定义了：

- LLM
- memory
- reasoning
- world/task model
- search
- metacognition
- credit
- consolidation
- human-AI joint control

但存在一个根本缺口：

> 这些机制虽然分别存在，却还没有真正进入一个“每一秒/每一轮到底怎么运行”的统一认知状态机。

本版本把它们正式串成：

```text
外界/用户输入
      ↓
快速显著性与本能层
      ↓
语言交互层
      ↓
任务/目标识别
      ↓
深层认知状态
      ↓
记忆 + 类比 + 推理 + 搜索 + 模拟
      ↓
候选行动/候选表达
      ↓
人机控制权分配
      ↓
执行/表达
      ↓
现实结果/用户反馈
      ↓
预测误差
      ↓
归因与信用分配
      ↓
记忆更新 / 策略更新 / schema 巩固
      ↓
新的共享认知状态
```

核心原则：

> **不是让每句话都深思；而是让一个快速系统负责交流，让另一个持续系统负责认知。**

---

# 1. Final System Definition

CSLA 不再定义为“若干插件”。

定义为一个连续时间、离散事件驱动的认知动力系统：

\[
\boxed{
\mathcal{CSLA}
=
(\mathcal{S},\mathcal{O},\mathcal{A},\mathcal{T},\mathcal{L})
}
\]

其中：

- \(\mathcal S\)：认知状态空间
- \(\mathcal O\)：观察空间
- \(\mathcal A\)：行动/交互空间
- \(\mathcal T\)：状态转移
- \(\mathcal L\)：学习动力学

基本状态转移：

\[
\boxed{
S_{t+1}=F_\Theta(S_t,o_t,a_t,r_t)
}
\]

这里 \(S_t\) 是系统在时刻 \(t\) 的全部认知状态。

---

# 2. 中等保真“脑状态”模型

本项目不复制具体脑区，而模拟已知的计算原则。

定义：

\[
\boxed{
S_t=
(
D_t,
G_t,
B_t,
E_t,
W_t,
P_t,
M_t^E,
M_t^S,
K_t,
\Pi_t,
U_t,
Self_t,
H_t,
J_t,
R_t
)
}
\]

其中：

### \(D_t\)：Motivation / Preference State
表示当前“想得到什么/避免什么”。

第一版：

\[
D_t=(Preference,Value,Priority,Urgency,Commitment)
\]

### \(G_t\)：Goal State
当前目标及子目标。

### \(B_t\)：Belief State
对当前任务/世界的概率信念。

### \(E_t\)：Episodic Event Context
当前连续事件与最近经历。

### \(W_t\)：World / Task Model
对任务世界状态及行动后果的内部模型。

### \(P_t\)：Executive / Working State
当前工作记忆、约束、规则、任务 schema。

### \(M_t^E\)：Episodic Memory
具体经历。

### \(M_t^S\)：Semantic / Schema Memory
从多次经历中巩固的抽象规律。

### \(K_t\)：Skill / Tool Knowledge
如何使用工具、执行技能。

### \(\Pi_t\)：Policy
当前行动/认知策略。

### \(U_t\)：Uncertainty
当前不确定性。

### \(Self_t\)：Self Model
对自己能力和失败模式的估计。

### \(H_t\)：Human Model
对当前合作人的任务意图、偏好、知识、决策规律的估计。

### \(J_t\)：Joint Shared State
人与 AI 共同维护的状态。

### \(R_t\)：Resource / Risk Budget
token、时间、工具成本、风险和人类注意力预算。

---

# 3. 不再使用“浅层/深层”模糊词，正式定义三条计算通路

## 3.1 Fast Reflex / Salience Loop

负责：

- 低延迟响应
- 显著性
- 风险捕获
- 情绪/优先级启发式
- 是否需要升级到深层系统

定义：

\[
r_t^{fast}=F_{fast}(o_t,S_t)
\]

产生：

\[
\sigma_t=
(
salience,
urgency,
risk,
novelty,
escalation
)
\]

升级概率：

\[
\boxed{
p_{deep}
=
\sigma(
w_s salience
+w_u uncertainty
+w_g goalRel
+w_r risk
+w_n novelty
-b
)
}
\]

如果：

\[
p_{deep}<\tau_{deep}
\]

可以走快速响应。

如果：

\[
p_{deep}\ge\tau_{deep}
\]

进入深层认知循环。

**注意：这里的“reflex”是工程抽象，不声称复现生物本能回路。**

---

# 4. Language Interaction Loop

语言层不是认知本身。

定义：

\[
\boxed{
L_{t+1}=F_L(L_t,input_t,A_t,J_t)
}
\]

负责：

- 自然语言响应
- 澄清
- 询问
- 简短建议
- 实时交流

原则：

\[
\boxed{
Dialogue_t \neq CognitiveState_t
}
\]

一轮一句话可以只改变：

\[
L_t
\]

而不改变：

\[
S_t
\]

只有当事件通过 Deep Update Gate 后，才进入长期认知状态。

---

# 5. Deep Cognitive Loop

\[
\boxed{
C_{t+1}=F_C(C_t,e_t)
}
\]

深层循环维护：

- goal
- belief
- hypotheses
- evidence
- memory
- task structure
- uncertainty
- pending decisions
- open questions

触发条件：

\[
Gate(e_t)>\tau_{deep}
\]

其中：

\[
Gate(e_t)
=
\sigma(
\theta_N Novelty
+\theta_G GoalRel
+\theta_D DecisionImpact
+\theta_U Uncertainty
+\theta_F FutureUtility
+\theta_R Risk
-\theta_C Cost
)
\]

---

# 6. Desire / Motivation → Goal

目标不能直接假设为用户一句话。

定义：

\[
\boxed{
D_t
\rightarrow
\mathcal G_t
\rightarrow
G_t
}
\]

候选目标：

\[
\mathcal G_t=
\{g_1,\ldots,g_k\}
\]

目标评分：

\[
Score(g)=
\lambda_vV(g)
+\lambda_pP_{success}(g)
+\lambda_aAlignment(g)
+\lambda_uUrgency(g)
-\lambda_cCost(g)
-\lambda_rRisk(g)
\]

选择：

\[
g^*=\arg\max_g Score(g)
\]

**但推断目标必须保持“hypothesis”状态，直到人类确认。**

因此：

\[
G_t=
(G^{inferred},G^{confirmed})
\]

而不能偷换：

\[
G^{inferred}=G^{confirmed}
\]

---

# 7. Goal → Task Representation

任务状态：

\[
\boxed{
\tau_t=
(
Goal,
CurrentState,
Constraints,
Resources,
ActionSpace,
Domain,
Horizon,
SuccessCriteria
)
}
\]

由：

\[
\tau_t=E_{task}(O_t,M_t,P_t,G_t)
\]

得到。

这一步回答：

> “这是什么任务？完成它究竟意味着什么？”

---

# 8. Meta-Cognitive Strategy Selection

系统不应该固定使用一种思考方式。

定义：

\[
q_t(m)
=
P(m|\tau_t,S_t)
\]

其中：

\[
m\in
\{
retrieve,
categorize,
abstract,
analogize,
deduce,
search,
simulate,
plan,
verify,
counterexample,
ask,
act,
reflect,
stop
\}
\]

因此：

\[
\boxed{
Task
\rightarrow
CognitiveMode
\rightarrow
Operator
}
\]

这对应真实任务中“先判断应该怎么想”。

---

# 9. Cognitive Workspace

候选信息：

\[
X=
\{x_1,\ldots,x_n\}
\]

显著性：

\[
Salience_i=
f(
GoalRel_i,
Novelty_i,
Uncertainty_i,
Risk_i,
SourceRel_i,
Cost_i
)
\]

权重：

\[
\alpha_i=
softmax(Salience_i)
\]

workspace：

\[
\boxed{
C_t=
\sum_i\alpha_i x_i
}
\]

但第一版工程实现允许使用 structured selection，而不是强迫全部信息连续向量化。

---

# 10. Hippocampal-style Episodic Memory

每条经历：

\[
\boxed{
e_t=
(
state,
goal,
observation,
action,
prediction,
outcome,
error,
feedback,
credit,
provenance
)
}
\]

核心原则：

\[
\boxed{
Retrieval \neq Learning
}
\]

Retrieval：

\[
M^E\rightarrow C_t
\]

Learning：

\[
e_t
\rightarrow
Replay
\rightarrow
Consolidation
\]

---

# 11. Memory Retrieval

检索分数：

\[
Score(e_i|q)=
\alpha R_i
+\beta G_i
+\gamma C_i
+\delta IG_i
+\epsilon N_i
+\zeta P_i
\]

其中：

- \(R\)：语义相关度
- \(G\)：目标相关度
- \(C\)：因果相关度
- \(IG\)：预期信息增益
- \(N\)：新颖性
- \(P\)：来源可信度

---

# 12. Pattern Separation / Completion 的工程模拟

相似但不同的经历不能全部压成一个记忆。

因此：

\[
e_i\neq e_j
\]

即便：

\[
sim(e_i,e_j)\approx1
\]

如果存在关键上下文差异：

\[
context_i\neq context_j
\]

则必须保持：

\[
separate(e_i,e_j)
\]

相反，如果当前线索不足：

\[
cue\rightarrow partial\ memory
\]

则允许：

\[
completion(cue,M)
\rightarrow
candidate\ memory
\]

注意：

完成出来的内容必须标注：

\[
confidence<1
\]

不能当成事实。

---

# 13. Memory Write Gate

不是所有经历都要成为长期记忆。

\[
w_t=
\sigma(
\theta_1|\delta_t|
+\theta_2IG_t
+\theta_3GoalRel_t
+\theta_4Novelty_t
+\theta_5Credit_t
-\theta_6Cost_t
)
\]

若：

\[
w_t>\tau_{write}
\]

进入 episodic memory。

否则只是 execution trace。

---

# 14. Replay

Replay 是离线认知计算。

\[
\boxed{
Replay(e)
=
Reconstruct(e)
+
Reevaluate(e)
+
Resimulate(e)
}
\]

Replay 不是简单再读文本。

可以重新运行：

\[
\hat z_{t+k}
=
W(\hat z_{t+k-1},a_{t+k-1})
\]

并检查：

- 当时预测是否合理
- 哪一步开始偏离
- 什么信息被忽略
- 是否存在反例
- 是否能够形成通用规则

---

# 15. Schema Consolidation

从多次经历：

\[
E=
\{e_1,\ldots,e_n\}
\]

抽象：

\[
\boxed{
E\rightarrow K
}
\]

目标：

\[
K^*
=
\arg\min_K
E[D(E,K)]
+\lambda Complexity(K)
\]

但 schema 必须保留：

\[
supporting\ episodes
\]

因此：

\[
Schema
\rightarrow
EvidenceLinks
\rightarrow
Episodes
\]

这样未来可以重新检查。

---

# 16. Reconsolidation

被调用的记忆不是只读。

当：

\[
m_i\rightarrow retrieved
\]

并获得新证据：

\[
e_{new}
\]

更新：

\[
\boxed{
m_i'
=
U_M(m_i,e_{new},\delta,C)
}
\]

并版本化：

\[
m_i^{(1)}
\rightarrow
m_i^{(2)}
\rightarrow
m_i^{(3)}
\]

---

# 17. World / Task Model

MVP 使用 task world model。

内部状态：

\[
z_t=
E_W(
O_t,
M_t,
G_t,
P_t
)
\]

预测：

\[
\boxed{
\hat z_{t+1}=W(z_t,a_t)
}
\]

预测目标应该是：

> 对任务决策有用的潜在状态。

不要求预测完整世界。

---

# 18. Reasoning Engine

统一 operator API。

### CoT
\[
z_0\rightarrow z_1\rightarrow...\rightarrow z_k
\]

### Self-Consistency
\[
\{z^{(1)},...,z^{(N)}\}
\]

### ToT
\[
Tree(z)
\]

### GoT
\[
Graph(z)
\]

### RAT
\[
Thought\rightarrow Retrieve\rightarrow Revise
\]

### ReAct
\[
Thought\rightarrow Action\rightarrow Observation
\]

### Reflexion
\[
Outcome\rightarrow Reflection\rightarrow Memory
\]

### Counterexample
\[
Hypothesis\rightarrow Search(Falsifier)
\]

所有 operator 都必须使用同一个：

\[
S_t^{shared}
\]

而不是各自拥有一套互不兼容的上下文。

---

# 19. Search

Search 是认知行动：

\[
a_t^{search}\in\mathcal A
\]

信息增益：

\[
IG(a)
=
H(B_t)
-
E_oH(B_{t+1}|o,a)
\]

行动价值：

\[
\boxed{
U(a)
=
TaskGain(a)
+
\lambda IG(a)
-\beta Cost(a)
-\rho Risk(a)
}
\]

因此系统可以：

\[
\{
stop,
search,
searchAgain,
changeSource,
askHuman,
act
\}
\]

之间选择。

---

# 20. Hypothesis Competition

给定多个解释：

\[
\mathcal H=
\{H_1,\ldots,H_n\}
\]

维护：

\[
P(H_i|D_t)
\]

观察新证据：

\[
D_{t+1}
\]

更新：

\[
\boxed{
P(H_i|D_{1:t+1})
\propto
P(D_{t+1}|H_i)
P(H_i|D_{1:t})
}
\]

最优假设：

\[
H^*=
\arg\max_iP(H_i|D)
\]

但仍允许多个 hypothesis 并存。

---

# 21. Counterexample Engine

对 \(H^*\) 主动找：

\[
x^*
=
\arg\max_x IG(H;x)
\]

目标：

\[
\boxed{
Try\ to\ falsify\ yourself
}
\]

而不是只收集支持自己的证据。

---

# 22. Metacognition

系统维护：

\[
U_t
\]

其中可以来自：

- predictive uncertainty
- source uncertainty
- model disagreement
- credit uncertainty
- memory uncertainty

行为策略：

\[
A_t=
\begin{cases}
answer & confidence\ high\\
retrieve & medium\\
verify & low\\
ask/search & very\ low
\end{cases}
\]

所有 confidence 都必须与 outcome 回写，以便校准。

---

# 23. Self Model

维护：

\[
Self_t=
(
Capabilities,
Limits,
FailureModes,
ToolReliability,
Calibration
)
\]

例如：

某领域连续错误：

\[
Reliability_{domain}\downarrow
\]

则：

\[
Verification/Search\uparrow
\]

这意味着：

> 系统不仅学习世界，也学习自己。

---

# 24. Human Model

系统维护：

\[
\boxed{
H_t=
(
IntentModel,
PreferenceModel,
DecisionModel,
KnowledgeModel,
CommunicationModel,
NoveltyModel
)
}
\]

关键：

> 不把用户模型当人格模拟。

它只是：

> 对当前协作中可观察行为的统计/结构化模型。

---

# 25. Shared Cognitive State

人和 AI 共同维护：

\[
\boxed{
J_t=
(
Goal,
Claims,
Evidence,
Hypotheses,
Decisions,
Questions,
Uncertainty,
Artifacts,
OpenProblems
)
}
\]

用户更新：

\[
\Delta J_H
\]

AI 更新：

\[
\Delta J_A
\]

共享状态：

\[
\boxed{
J_{t+1}
=
U_J(
J_t,
\Delta J_H,
\Delta J_A,
Outcome_t
)
}
\]

---

# 26. Fast Talk / Deep Think 的真正实现

一个用户说：

> “这个感觉不太对。”

快速层可以回答：

> “你是觉得逻辑、事实还是表达不对？”

与此同时深层状态可以更新：

\[
uncertainty\uparrow
\]

\[
hypothesis\ status=unstable
\]

如果用户继续提供关键判断：

\[
DeepGate\uparrow
\]

然后：

\[
Memory/Reasoning/WorldModel
\]

开始工作。

因此：

\[
\boxed{
One\ sentence
\neq
one\ deep\ reasoning\ cycle
}
\]

---

# 27. Human Authority

定义：

\[
\boxed{
\alpha_t\in[0,1]
}
\]

表示 AI 当前的行动/表达主导程度。

\[
\alpha_t
=
f(
AIConfidence,
AICompetence,
GoalAlignment,
Risk,
HumanConfidence,
HumanPreference
)
\]

文本交互中的 action set：

\[
\{
wait,
ask,
suggest,
challenge,
draft,
execute,
requestApproval
\}
\]

重要任务：

\[
Risk\uparrow
\Rightarrow
\alpha_t\downarrow
\]

熟悉、低风险任务：

\[
Confidence\uparrow
\Rightarrow
\alpha_t\uparrow
\]

---

# 28. Innovation Elicitation

这是 Stylotrace 第一垂直场景的核心。

目标不是：

> AI 自己想出更多东西。

而是：

\[
\boxed{
maximize\ P(
HumanInsight
\ becomes\ explicit
)
}
\]

定义：

\[
I_t=\text{latent human insight}
\]

问题选择：

\[
q^*
=
\arg\max_q
[
IG(I_t;q)
-\lambda Cost(q)
-\mu Intrusion(q)
]
\]

输出：

\[
K_{human}
\]

然后 AI 才扩展：

\[
F_i\sim LLM_i(K_{human},Context_i)
\]

最后：

\[
\boxed{
Document
=
K_{human}
+
F_{selected}
+
P_{appropriate}
}
\]

---

# 29. “灵魂—血肉—皮囊”正式进入数据模型

\[
D=(K,F,P)
\]

### \(K\)：Soul / Core Insight
主要来自人的原创判断、经验和目标。

### \(F\)：Flesh
知识、证据、案例、个人风格、历史经验。

### \(P\)：Skin / Presentation
结构、句子、排版、图片、声音、视觉。

系统不得用大量 \(P\) 覆盖缺失的 \(K\)。

如果：

\[
K\approx\varnothing
\]

则系统应优先：

\[
AskHuman
\]

而不是：

\[
GenerateLongArticle
\]

---

# 30. LLM Operator Pool

LLM 是认知算子提供者，不是整个 runtime。

定义：

\[
\mathcal O=
\{
Generate,
Reason,
Critique,
Search,
Counterexample,
Plan,
Simulate,
Verify,
Write,
Visualize,
Ask
\}
\]

不同模型均可接入：

\[
GPT,\ Claude,\ Gemini,\ Local
\]

每个 operator：

\[
y_i\sim LLM_i(Context_i)
\]

得到：

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
HumanAlignment
\rightarrow
Synthesize
\]

---

# 31. 多候选不是简单投票

不要：

\[
N\ outputs\rightarrow vote
\]

应：

\[
\boxed{
N\ outputs
\rightarrow
semantic\ clustering
\rightarrow
hypothesis\ abstraction
\rightarrow
evidence
\rightarrow
counterexample
\rightarrow
human\ alignment
\rightarrow
synthesis
}
\]

这样多个 LLM 是：

> hypothesis generators

而 CSLA 是：

> deliberation controller。

---

# 32. Outcome Ledger

任何重要行动/输出：

\[
L_t=
(
Goal,
Action,
Prediction,
Outcome,
HumanFeedback,
Cost,
Risk
)
\]

记录：

\[
\delta_t
=
D(
Prediction,
Outcome
)
\]

这是未来所有学习的共同输入。

---

# 33. Error Decomposition

不能简单把所有错误合成一个数。

定义：

\[
E_t=
(
E_{data},
E_{memory},
E_{world},
E_{reason},
E_{policy},
E_{execution},
E_{interaction},
E_{noise}
)
\]

第一版使用独立 normalized scores。

只有经过归一化以后才允许组成：

\[
\delta_t
=
\sum_i
\lambda_i\tilde E_{i,t}
\]

避免不同量纲直接相加。

---

# 34. Cross-module Credit

模块集合：

\[
\mathcal M=
\{
Memory,
World,
Reasoning,
Policy,
Executive,
Meta,
Schema
\}
\]

对模块 \(i\)，定义：

\[
\boxed{
C_{i,t,e}
=
L_{future}^{CF}(i,t,e)
-
L_{future}^{real}
}
\]

但 baseline 必须显式记录：

\[
B\in\{frozen,replacement,matched\}
\]

因此实际数据：

\[
C_{i,t,e|B}
\]

而不是无条件的“唯一真 credit”。

---

# 35. Selective Counterfactual

完整 counterfactual 很贵。

学习：

\[
\hat C=C_\psi(S_t,e_t,\delta_t,U_t,G_t)
\]

当：

\[
Entropy(\hat C)<\tau_C
\]

使用预测 credit。

否则：

\[
CounterfactualIntervention
\]

从而：

\[
\boxed{
Cheap\ Online
+
Expensive\ Selective\ Diagnosis
}
\]

---

# 36. Learning

任意模块：

\[
\boxed{
\theta_i^{t+1}
=
\theta_i^t
-
\eta_i
g(C_{i,t})
\nabla_{\theta_i}\mathcal J
}
\]

但第一版可以不做 neural parameter update。

可以先更新：

- memory weights
- routing weights
- schema confidence
- user decision profile
- strategy statistics

直到有足够数据再学习 neural estimators。

---

# 37. Multi-timescale State Update

### Fast

\[
M^E_{t+1}=U_E(M^E_t,e_t)
\]

### Intermediate

\[
W_{t+1}=U_W(W_t,e_t,C_t)
\]

### Slow

\[
K_{t+1}=U_K(K_t,Replay(M^E),C)
\]

### Very slow

\[
\Pi_{t+1}=U_\Pi(\Pi_t,Replay,K,C)
\]

---

# 38. 完整 Runtime Algorithm

给定输入 \(o_t\)：

\[
\boxed{
\begin{aligned}
1.\;&
\sigma_t=FastSalience(o_t,S_t)
\\
2.\;&
L_{t+1}=LanguageLoop(o_t)
\\
3.\;&
if\ DeepGate(\sigma_t)<\tau:
\quad return\ L_{t+1}
\\
4.\;&
D_t\leftarrow MotiveUpdate(o_t,S_t)
\\
5.\;&
G_t\leftarrow GoalGen(D_t,S_t)
\\
6.\;&
\tau_t\leftarrow TaskEncode(o_t,S_t,G_t)
\\
7.\;&
q_t\leftarrow MetaPolicy(\tau_t,S_t)
\\
8.\;&
C_t\leftarrow Workspace(S_t,q_t)
\\
9.\;&
M_t^{retrieved}\leftarrow MemoryRetrieve(C_t)
\\
10.\;&
X_t\leftarrow ContextRoute(S_t,M_t^{retrieved},q_t)
\\
11.\;&
Y_t\leftarrow ParallelLLMOperators(X_t)
\\
12.\;&
H_t\leftarrow HypothesisAbstract(Y_t)
\\
13.\;&
E_t\leftarrow Search/Verify/Counterexample(H_t)
\\
14.\;&
\Pi_t\leftarrow Plan(H_t,W_t,G_t)
\\
15.\;&
\alpha_t\leftarrow AuthorityController(S_t,H_t,U_t,R_t)
\\
16.\;&
a_t\leftarrow JointAction(\Pi_t,\alpha_t)
\\
17.\;&
o_{t+1}\leftarrow Environment/User(a_t)
\\
18.\;&
\delta_t\leftarrow PredictionAndOutcomeError
\\
19.\;&
C_t^{credit}\leftarrow CreditEngine(e_t)
\\
20.\;&
M^E,W,K,\Pi,P,U,Self
\leftarrow SelectiveUpdate(...)
\\
21.\;&
Replay(...)
\\
22.\;&
Consolidate(...)
\\
23.\;&
J_{t+1}\leftarrow SharedStateUpdate(...)
\\
24.\;&
S_{t+1}\leftarrow StateTransition(...)
\end{aligned}
}
\]

这就是 CSLA 的**第一版完整 executable semantics**。

---

# 39. Stylotrace 在这个 runtime 中的位置

Stylotrace 不需要被重写。

现有能力映射：

```text
clarify.js          → Goal / Task representation
thinking.js         → Reasoning / cognitive trace
director.js         → Executive policy
governance.js       → Long-term intent
purpose.js          → Goal-conditioned value
constraints.js      → Task constraints
modulator.js        → Policy / gating
style-memory.js     → Semantic / preference memory
edit-transform.js   → Human decision trace
avoidance.js        → Negative memory / inhibition
rag.js              → Information acquisition
redteam.js          → Counterexample / adversarial verification
fact-check.js       → Evidence verification
consistency.js      → World/task-state consistency
bible.js            → Long-horizon schema/state
history.js          → Episodic history
llm.js              → LLM Provider layer
```

当前 Stylotrace 已经有 73 个 engine modules、44 个测试文件，以及 CLI/MCP/Web/FastAPI/插件等入口，因此第一阶段原则仍然是“扩展，不重写”。 

---

# 40. Stylotrace 第一条完整认知工作流

```text
用户：一句模糊想法
        ↓
Fast Layer
        ↓
是否值得进入深层？
        ↓
Goal / Desire
        ↓
Innovation Elicitation
        ↓
Core Idea
        ↓
Shared Cognitive State
        ↓
Context Router
        ↓
多 LLM 候选生成
        ↓
聚类 / 假设抽象
        ↓
搜索 / 证据 / 反例
        ↓
Human Alignment
        ↓
Synthesis
        ↓
Draft
        ↓
用户修改
        ↓
Outcome
        ↓
Cognitive Trace
        ↓
Credit
        ↓
Memory / Schema / Policy Update
        ↓
下一篇文章
```

---

# 41. 示例一：小猪吃玉米

输入：

> 小猪吃玉米。

系统不是直接只做 token prediction。

它可以：

\[
Pig\rightarrow Mammal
\]

\[
Corn\rightarrow PlantFood
\]

然后生成：

\[
H_1:\text{pig can eat corn}
\]

检索类似：

\[
\{pig,apple,dog,meat\}
\]

发现：

\[
dog\rightarrow meat
\]

形成反例。

于是把过宽的规则：

\[
animal\rightarrow plantFood
\]

修正为更细的：

\[
dietaryClass/species/context
\rightarrow
foodPreference
\]

最后留下：

- episodic evidence
- refined schema
- confidence

而不是保存所有中间 reasoning 文本。

---

# 42. 示例二：宇树科技股票会跌

输入：

> 宇树科技股票会跌。

系统快速识别：

\[
Domain=Finance
\]

然后选择：

\[
Mode=
valuation
+
causal
+
risk
+
evidence
\]

形成候选：

\[
H=
\{
valuation,
policy,
fundamentals,
sentiment,
liquidity,
positioning
\}
\]

然后：

\[
Search
\]

不是固定 top-k，而是寻找：

\[
q^*
=
\arg\max_q IG(H;q)-Cost(q)
\]

搜索新证据后：

\[
P(H_i|Evidence)
\]

更新。

如果系统发现自己无法可靠估值：

\[
Self_{finance}\downarrow
\]

则：

\[
Verify/Search\uparrow
\]

最后才产生判断。

整个过程形成一个可审计：

\[
Evidence
\rightarrow
Belief
\rightarrow
Prediction
\rightarrow
Decision
\]

链。

---

# 43. 示例三：人机共同写作

用户：

> “我感觉现在很多 AI 写作都很同质化。”

快速层：

> “你觉得同质化主要来自语言，还是来自思考方式？”

用户：

> “我觉得是它们都太快开始写。”

深层状态新增：

\[
Claim_1:
StartWritingTooEarly
\rightarrow
Homogeneity
\]

系统检索用户历史：

\[
M^E
\]

发现用户过去多次先讲观点、再写正文。

形成：

\[
Schema_{user}:
IdeaFirst
\]

然后多个 LLM 从不同角度扩展：

\[
F_1,\ldots,F_N
\]

系统要求：

> 保留人自己的核心 idea，AI 负责扩张。

最终：

\[
Document=K_{human}+F_{selected}+P
\]

这才是我们真正想验证的：

\[
HumanInsight
\rightarrow
AIExpansion
\rightarrow
JointCreation
\]

---

# 44. 产品中的“后台认知”与“前台语言”必须分离

前台：

```text
一句一句快速交流
```

后台：

```text
Goal
Belief
Memory
Hypotheses
Evidence
Decision
Uncertainty
Open Problems
User Model
Shared State
```

用户不需要看到全部内部计算。

但系统应该允许：

> 在需要时显示“当前共同认知状态”。

例如：

```text
当前目标
已确认观点
待验证问题
我仍不确定的地方
你刚刚提出的新想法
下一步建议
```

---

# 45. 商业产品最重要的数据对象

最终每一次高价值互动都会产生：

\[
\boxed{
CognitiveInteractionEvent
}
\]

结构：

```json
{
  "human_input": "...",
  "ai_action": "...",
  "shared_state_before": {},
  "shared_state_delta": {},
  "candidate_set": [],
  "human_decision": {},
  "outcome": {},
  "prediction_error": {},
  "credit": {},
  "memory_updates": [],
  "schema_updates": [],
  "artifact_version": "..."
}
```

长期以后：

\[
E_1,E_2,\ldots,E_N
\]

形成：

\[
\boxed{
Human\ Decision\ Model
}
\]

这才是 Stylotrace 真正应该积累的数据资产。

---

# 46. 第一版不要实现的东西

为了确保可运行：

暂缓：

- foundation model training
- Transformer modification
- full biological simulation
- physical world model
- brain imaging
- embodied robotics
- neural consciousness model

第一版只需要：

\[
\boxed{
Structured\ state
+
LLM APIs
+
Memory
+
Search
+
Human\ feedback
+
Outcome
+
Basic\ credit
}
\]

---

# 47. 第一版必须验证的六个现象

### E1 — Cognitive State Continuity
同一任务跨 session 是否保持正确状态。

### E2 — Goal Fidelity
系统推断的目标与用户最终确认是否一致。

### E3 — Innovation Elicitation
更少的互动是否能得到更独特的 human core idea。

### E4 — Deliberation Quality
多候选 + 验证是否优于单次生成。

### E5 — Recovery
犯错后是否修改策略，而不是重复原错误。

### E6 — Learning
第 \(t+1\) 次是否因为第 \(t\) 次经历而表现更好。

核心学习判据：

\[
\boxed{
Performance_{t+1}>Performance_t
}
\]

并且必须在**未见任务**上检验：

\[
Generalization_{unseen}>Baseline
\]

---

# 48. 最终理论边界

CSLA 当前不是：

> “模拟人脑。”

而是：

\[
\boxed{
\text{A computational model inspired by principles of human cognition}
}
\]

真正需要实验验证的是：

\[
\boxed{
SharedState
+
ExperienceTrace
+
SelectiveCredit
+
Consolidation
}
\]

是否能让：

\[
Human+LLM
\]

在长期任务中获得更好的：

- task continuity
- goal fidelity
- recovery
- calibration
- innovation
- personalization
- generalization

---

# 49. 最终的核心公式

把整个系统压缩以后：

\[
\boxed{
\begin{aligned}
S_{t+1}
&=
F_\Theta
(
S_t,
o_t,
a_t,
r_t
)
\\[4pt]
a_t
&=
\Pi_\Theta
(
S_t,
\alpha_t
)
\\[4pt]
\hat o_{t+1}
&=
W_\Theta(S_t,a_t)
\\[4pt]
\delta_t
&=
D(
o_{t+1},
\hat o_{t+1}
)
+
\lambda_R
\delta_t^R
\\[4pt]
C_t
&=
Credit(
S_t,e_t,\delta_t
)
\\[4pt]
\Theta_{t+1}
&=
Update(
\Theta_t,C_t,e_t
)
\\[4pt]
M_{t+1}
&=
ReplayAndConsolidate(
M_t,e_t,C_t
)
\end{aligned}
}
\]

而 Human–AI Joint Runtime：

\[
\boxed{
J_{t+1}
=
F_J(
J_t,
Human_t,
AI_t,
Outcome_t,
\alpha_t
)
}
\]

最终：

\[
\boxed{
Human
\leftrightarrow
Shared\ Cognitive\ State
\leftrightarrow
CSLA
\leftrightarrow
LLM
\leftrightarrow
World
}
\]

---

# 50. 第一原则

以后 CSLA 增加任何模块，必须回答：

\[
\boxed{
What\ state\ does\ it\ change?
}
\]

\[
\boxed{
What\ observation\ triggers\ it?
}
\]

\[
\boxed{
What\ action\ does\ it\ enable?
}
\]

\[
\boxed{
What\ feedback\ trains\ it?
}
\]

\[
\boxed{
How\ does\ the\ change\ persist?
}
\]

如果不能回答，就不能进入核心架构。

---

# 51. 当前系统的真正终点

不是：

\[
Better\ Text
\]

而是：

\[
\boxed{
Better\ Cognitive\ Collaboration
}
\]

对用户来说，理想行为是：

> 用户给出一点真正重要的想法；
> AI 不抢走这个想法；
> AI 帮他把想法展开、验证、寻找反例、补证据；
> 人在关键价值判断处重新接管；
> 最终形成作品；
> 下一次协作时，系统因为这一次经历而真正表现不同。

因此：

\[
\boxed{
Human\ Insight
\rightarrow
Joint\ Cognition
\rightarrow
LLM\ Computation
\rightarrow
Outcome
\rightarrow
Learning
}
\]

这就是当前 CSLA/JCC 的完整运行定义。
