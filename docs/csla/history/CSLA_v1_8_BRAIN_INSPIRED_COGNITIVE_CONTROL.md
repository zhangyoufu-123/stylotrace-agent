# CSLA v1.8 — Brain-Inspired Cognitive Control & Language Planning

**日期：2026-08-28**  
**目标：把脑科学中有较强证据支持的计算原则，映射为可运行的认知状态机；不声称复制人脑。**

---

## 0. 本版本的核心修正

CSLA 之前已经拥有大量模块，但容易出现一个问题：

> “脑区 = 一个软件模块”。

本版本不再采用脑区一一映射，而采用：

\[
\boxed{
Neural\ Principle
\rightarrow
Computational\ Function
\rightarrow
Runtime\ Operator
}
\]

例如：

```text
海马
→ 关系绑定/模式分离/补全/重组/回放
→ EpisodicRelationalMemory

前额叶
→ 目标维护/层级控制/工作状态/抑制
→ ExecutiveController

纹状体
→ 目标导向与习惯控制/动作选择
→ ActionSelection + HabitPolicy

语言网络
→ 语义/词汇/句法/音系及规划-执行转换
→ LanguagePlanner

全局工作空间相关网络
→ 竞争、选择、广播、状态更新
→ CognitiveWorkspace

感觉/多模态网络
→ 模态特征提取与跨模态绑定
→ MultimodalStateEncoder
```

这种方式更符合现代系统神经科学：复杂认知不是单一脑区完成，而是多个网络协同。PFC 相关研究强调目标、规则、工作记忆和层级控制；语言研究强调核心语言网络是分布式且跨输入输出模态的；最新 2026 年脑内记录还显示语音规划阶段存在离散的层级表征，再动态整合为执行序列。citeturn815422search1turn815422search12turn815422search7

---

# 1. 语言不是 Token 串行接龙

Transformer 的工程输入是 token sequence：

\[
x_1,x_2,\ldots,x_n
\]

但人类语言产生并非简单：

\[
x_1\rightarrow x_2\rightarrow...\rightarrow x_n
\]

语言产生涉及多个层级：

\[
\boxed{
Intent
\rightarrow
Concept
\rightarrow
Lexical
\rightarrow
Syntactic
\rightarrow
Phonological
\rightarrow
Motor
}
\]

而且存在并行/级联过程，而不是严格串行。2025 年语言产生研究综述明确讨论了 meaning、grammar、sound 表征的并行激活与绑定；2026 年颅内记录进一步发现，语音规划阶段会在不同前额叶位置形成不同层级的离散 speech-unit representations，随后在皮层和运动系统中动态整合成连续执行序列。citeturn338973search13turn815422search7

因此 CSLA 必须允许：

\[
\boxed{
Plan\ Semantics\ before\ Surface\ Text
}
\]

也就是先决定：

> “我到底想表达什么？”

再决定：

> “怎么写？”

---

# 2. Language Planning State

定义：

\[
\boxed{
L_t=
(
Intent_t,
Concept_t,
Structure_t,
Lexical_t,
Style_t,
OutputMode_t
)
}
\]

其中：

- \(Intent_t\)：表达意图
- \(Concept_t\)：概念结构
- \(Structure_t\)：句/段/篇章结构
- \(Lexical_t\)：词汇候选
- \(Style_t\)：表达风格
- \(OutputMode_t\)：文本/图像/声音/视频等

生成过程：

\[
\boxed{
Intent
\rightarrow
Concept
\rightarrow
Structure
\rightarrow
Expression
}
\]

注意：

这不是让 LLM 不能直接生成。

而是：

> 当任务值得深度规划时，允许系统先建立上层表达状态；当任务简单时，可以直接调用 model-native generation。

---

# 3. Hierarchical Cognitive Control

PFC 的大量研究支持层级化控制观点：从更具体的 stimulus-response/context，到更抽象的规则、任务和未来分支控制。2021/2022 年综述明确讨论了不同层级 PFC 对规则、工作记忆、注意和规划的作用；2026 年前额叶-纹状体综述进一步把 goals、strategies、actions 放进层级循环。citeturn815422search1turn338973search0

因此：

\[
\boxed{
Goal
\rightarrow
Strategy
\rightarrow
Plan
\rightarrow
Action
}
\]

不能全部放到一个 flat planner。

定义：

\[
G_t
\rightarrow
\Sigma_t
\rightarrow
\Pi_t
\rightarrow
A_t
\]

其中：

- \(G\)：goal
- \(\Sigma\)：strategy
- \(\Pi\)：plan
- \(A\)：action

每一级可以重新选择，而不是一次冻结。

---

# 4. Automatic vs Controlled Processing

大脑同时存在自动化与目标导向控制；习惯与目标导向系统并非“一个脑区对一个脑区”，而是交互并可以随情境改变。2026 年研究直接考察了时间压力下 goal-directed 与 habitual control 的交互；最新 PFC-striatum 综述则强调快速切换与学习性适应两种机制。citeturn338973search10turn338973search0

因此 CSLA 必须拥有：

\[
\boxed{
Mode_t
\in
\{Automatic, Controlled, Mixed\}
}
\]

例如：

### Automatic
已知、低风险、低新颖性：

\[
HabitPolicy
\]

### Controlled
高风险/新颖/冲突：

\[
DeepCognitivePolicy
\]

### Mixed
自动候选 + 控制检查：

\[
FastGenerate
\rightarrow
SelectiveVerify
\]

这比“所有任务都深度推理”更加符合人类认知，也更节省 token。

---

# 5. Thought Inhibition 必须成为真正的算子

2025 年 Nature Reviews Neuroscience 的综述专门讨论 thought inhibition，指出思想控制具有领域一般性机制，右侧外侧 PFC 与停止/抑制过程密切相关，但其具体机制不能简单等同于动作停止。citeturn338973search1

所以：

\[
\boxed{
Inhibit(x)
}
\]

应该成为正式 cognitive operator。

应用：

- 停止错误假设
- 不继续无效搜索
- 停止过度生成
- 抑制旧习惯
- 不把低可靠 memory 继续传播

因此：

\[
Candidate
\rightarrow
Conflict
\rightarrow
Inhibit
\]

而不是所有 candidate 都继续传播。

---

# 6. Memory 要从“检索”升级为“关系系统”

海马不是简单数据库。

CSLA memory 必须支持：

\[
Entity
+
Relation
+
Context
+
Time
+
Outcome
\]

形成：

\[
\boxed{
RelationalEpisode
}
\]

这允许：

\[
Pig
\xrightarrow{eats}
Corn
\]

和：

\[
Dog
\xrightarrow{eats}
Meat
\]

被比较，而不是只做 embedding similarity。

---

# 7. Pattern Separation

相似事件必须保持区分：

\[
e_i\approx e_j
\]

不代表：

\[
e_i=e_j
\]

如果上下文不同：

\[
Context_i\neq Context_j
\]

则：

\[
Separate(e_i,e_j)
\]

防止：

> “小狗吃过一次苹果”

被错误泛化成：

> “小狗通常吃水果”。

---

# 8. Pattern Completion

输入只有部分线索：

\[
cue
\]

系统可以从 memory graph 激活候选：

\[
Completion(cue)
\rightarrow
\{e_1,\ldots,e_k\}
\]

但所有完成内容：

\[
confidence<1
\]

并明确标记：

\[
reconstructed
\]

---

# 9. Comparison 是认知的基础算子

定义：

\[
\boxed{
Compare(x,y)
=
(
Shared,
Different,
RelationalDiff,
ContextDiff
)
}
\]

这是“小猪吃玉米”例子的核心。

不仅：

\[
Pig\sim Dog
\]

还：

\[
Pig,Dog
\rightarrow
Mammal
\]

同时：

\[
Pig\neq Dog
\]

以及：

\[
Diet(Pig)\neq Diet(Dog)
\]

---

# 10. Association

关联必须分类型：

\[
A(x,y)=
\{
Semantic,
Causal,
Temporal,
Spatial,
Functional,
Goal,
Episodic
\}
\]

这避免：

\[
Association
=
EmbeddingSimilarity
\]

---

# 11. Abstraction

多个实例：

\[
e_1,e_2,...,e_n
\]

生成：

\[
K=Abstract(E)
\]

但必须同时计算：

\[
Evidence(K)
\]

和：

\[
Counterexamples(K)
\]

所以：

\[
Schema=
(
Rule,
Support,
Exceptions,
Confidence
)
\]

---

# 12. Induction

\[
H=
Induce(D)
\]

维护：

\[
P(H|D)
\]

不要：

\[
D\rightarrow H=truth
\]

---

# 13. Deduction

规则：

\[
A\rightarrow B
\]

事实：

\[
A
\]

得到：

\[
B
\]

但是保留：

\[
Premises(B)
\]

---

# 14. Abduction

从结果寻找解释：

\[
H^*
=
\arg\max_H
P(H|O)
\]

多个解释可以并存。

这对：

> “为什么会出现这个结果？”

非常关键。

---

# 15. Analogy

关系结构之间的 mapping：

\[
G_A
\leftrightarrow
G_B
\]

寻找：

\[
Mapping^*
=
\arg\max_M
RelationalMatch(M)
\]

而不是简单 embedding nearest neighbor。

---

# 16. Recombination

真正的创新通常需要：

\[
Memory_i
+
Memory_j
+
Goal
\]

产生：

\[
\boxed{
NovelComposition
}
\]

即：

\[
NewIdea
=
Compose(
RelationalParts,
Goal,
Constraint
)
\]

不能简单要求“AI 自己发明”。

---

# 17. Future Simulation

过去经验进入：

\[
Memory
\rightarrow
Recombination
\rightarrow
FutureSimulation
\]

得到：

\[
\hat s_{t+H}
\]

然后：

\[
Evaluate(\hat s_{t+H})
\]

人类海马系统与未来目标、规划和重组存在关系；2026 年人类研究显示 hippocampal ripples 与 mPFC 组合表征更新和高效推理直接相关。citeturn815422search6turn338973search2

---

# 18. Replay 要成为在线认知之外的第二条循环

在线：

\[
Experience
\rightarrow
Action
\rightarrow
Outcome
\]

离线：

\[
\boxed{
Replay
\rightarrow
Reevaluate
\rightarrow
Recombine
\rightarrow
Consolidate
}
\]

2026 年人类颅内记录研究显示 replay 与 hippocampal ripples、mPFC compositional representations、planning 和 inference 效率密切协调，这使 replay 在我们的架构里不应只是“后台总结”。citeturn338973search2

---

# 19. Goal / Desire 重新进入脑-行为层级

目标不是固定输入。

定义：

\[
D_t=
(
Need,
Preference,
Value,
Urgency,
Commitment
)
\]

目标：

\[
G_t
=
GoalGen(
D_t,
WorldModel_t,
Memory_t,
Self_t
)
\]

再：

\[
G_t
\rightarrow
Strategy
\rightarrow
Plan
\rightarrow
Action
\]

---

# 20. Goal 与 Habit Arbitration

PFC-basal ganglia 研究支持 goal-directed 与 habitual 系统之间存在层级竞争/协作。citeturn338973search0turn338973search3

因此：

\[
a_t
=
\alpha_t a_t^{habit}
+
(1-\alpha_t)a_t^{goal}
\]

其中：

\[
\alpha_t
=
f(
familiarity,
risk,
novelty,
timePressure,
goalConflict
)
\]

高新颖/高风险：

\[
\alpha_t\downarrow
\]

熟悉/低风险：

\[
\alpha_t\uparrow
\]

---

# 21. Global Workspace 不应该只是“信息池”

工作空间真正应该承担：

\[
Competition
+
Selection
+
Broadcast
+
Update
\]

每个 candidate：

\[
x_i
\]

得到：

\[
Priority_i
=
f(
GoalRel,
Novelty,
Uncertainty,
Risk,
Conflict,
SourceReliability
)
\]

只有获胜者才能进入：

\[
GlobalState
\]

其他 candidate：

\[
suppressed
\]

或进入：

\[
memory/replay
\]

---

# 22. 新的 Cognitive Program

CSLA 不再执行固定 24 步。

每一步从：

\[
\mathcal A_t
\]

选择：

\[
a_t^*
=
\arg\max_{a\in\mathcal A_t}
Q(a|S_t)
\]

而 \(\mathcal A_t\) 可以动态扩展。

因此：

\[
\boxed{
Runtime
=
Adaptive\ Cognitive\ Control
}
\]

而不是 workflow。

---

# 23. Cognitive Program Example

简单输入：

> 小猪吃玉米。

系统可能选择：

\[
Parse
\rightarrow
Bind
\rightarrow
Compare
\rightarrow
Abstract
\rightarrow
Stop
\]

而不是执行：

\[
Search
+
ToT
+
Simulation
+
10\times LLM
\]

这非常重要。

---

# 24. Complex Example

输入：

> 宇树科技股票会跌。

系统可能选择：

\[
DomainDetect
\rightarrow
Hypothesis
\rightarrow
Retrieve
\rightarrow
Search
\rightarrow
Compare
\rightarrow
Causal
\rightarrow
Counterfactual
\rightarrow
Scenario
\rightarrow
Verify
\rightarrow
Decision
\]

如果中间发现：

\[
Uncertainty\downarrow
\]

则停止搜索。

如果：

\[
EvidenceConflict\uparrow
\]

则进入：

\[
HumanCheckpoint
\]

---

# 25. LLM 的新角色

LLM 不是 runtime。

定义：

\[
\boxed{
LLM=
Universal\ Cognitive\ Operator
}
\]

它可以被请求执行：

\[
Generate
\]

\[
Compare
\]

\[
Abstract
\]

\[
Induce
\]

\[
Deduce
\]

\[
Abduce
\]

\[
Analogize
\]

\[
Critique
\]

\[
SearchPlan
\]

\[
Explain
\]

\[
Write
\]

但 runtime 决定：

\[
When
\]

\[
Why
\]

\[
HowMany
\]

\[
WithWhatContext
\]

---

# 26. LLM Freedom Rule

CSLA 必须提供：

\[
\boxed{
NativeModelEscape
}
\]

如果模型判断：

> 内置 cognitive operators 不适合。

允许：

\[
NativeLLMReasoning
\]

返回：

\[
StructuredInsight
\]

因此：

\[
CSLA
\neq
LLM\ cage
\]

---

# 27. Deep Reasoning Budget

深度：

\[
d_t
\]

由：

\[
d_t=
f(
Complexity,
Uncertainty,
Risk,
Novelty,
Importance,
Conflict
)
\]

决定。

简单问题：

\[
d_t\approx0
\]

复杂问题：

\[
d_t\uparrow
\]

---

# 28. Human–AI Joint Control

人：

\[
a_t^H
\]

AI：

\[
a_t^A
\]

authority：

\[
\alpha_t\in[0,1]
\]

联合动作：

\[
a_t
=
\alpha_ta_t^A
+
(1-\alpha_t)a_t^H
\]

但在文本认知任务中，\(\alpha_t\) 还控制：

\[
\{
Ask,
Suggest,
Draft,
Challenge,
Execute,
Wait
\}
\]

---

# 29. Innovation Elicitation

人的创新不应由 AI 完全替代。

定义：

\[
I_H
\]

为当前尚未完全外化的人类 insight。

AI 选择问题：

\[
q^*
=
\arg\max_q
[
IG(I_H;q)
-
\lambda Cost(q)
-
\mu Intrusion(q)
]
\]

然后：

\[
HumanAnswer
\rightarrow
CoreIdea
\]

AI 再进行：

\[
Expand
+
Search
+
Critique
+
Synthesize
\]

---

# 30. Writing as a Cognitive Product

每篇作品：

\[
\boxed{
D=
(K,F,P)
}
\]

其中：

\[
K=CoreInsight
\]

\[
F=Evidence+Knowledge+Experience+Style
\]

\[
P=Presentation
\]

生成顺序：

\[
\boxed{
Purpose
\rightarrow
CoreInsight
\rightarrow
Evidence
\rightarrow
Structure
\rightarrow
Expression
}
\]

不要：

\[
Prompt\rightarrow LongDraft
\]

---

# 31. Multimodal Cognition

输入：

\[
O_t=
(
Text,
Image,
Audio,
Video,
File,
Environment
)
\]

统一进入：

\[
Z_t
=
Encode(O_t)
\]

再进入 shared cognitive state。

输出模态选择：

\[
m^*
=
\arg\max_m
Utility(
m|Idea,Audience,Goal
)
\]

所以系统可以判断：

> 文字、图、声音哪个更适合表达当前 idea。

---

# 32. Cognitive State v1.8

最终状态：

\[
\boxed{
S_t=
(
D,
G,
B,
P,
M^E,
M^S,
W,
K,
\Pi,
U,
Self,
Human,
Joint,
Language,
R
)
}
\]

其中：

- \(D\)：motivation/preference
- \(G\)：goal
- \(B\)：belief
- \(P\)：working/executive state
- \(M^E\)：episodic relational memory
- \(M^S\)：schema/semantic memory
- \(W\)：task world model
- \(K\)：skills/tools
- \(\Pi\)：policy
- \(U\)：uncertainty
- \(Self\)：self model
- \(Human\)：human model
- \(Joint\)：shared human-AI state
- \(Language\)：language planning state
- \(R\)：resources/risk

---

# 33. Full Adaptive Cognitive Loop

\[
\boxed{
\begin{aligned}
o_t
&\rightarrow
FastSalience
\\
&\rightarrow
LanguageInteraction
\\
&\rightarrow
DeepGate
\\
&\rightarrow
Motivation
\\
&\rightarrow
GoalFormation
\\
&\rightarrow
TaskState
\\
&\rightarrow
MemoryBinding
\\
&\rightarrow
OperatorSelection
\\
&\rightarrow
DynamicContext
\\
&\rightarrow
LLM/Tool/Memory\ Operators
\\
&\rightarrow
Comparison/Abstraction/Inference
\\
&\rightarrow
HypothesisCompetition
\\
&\rightarrow
Search/Verification/Counterexample
\\
&\rightarrow
FutureSimulation/Planning
\\
&\rightarrow
Human-AI\ Authority
\\
&\rightarrow
Action/Expression
\\
&\rightarrow
Outcome
\\
&\rightarrow
Error
\\
&\rightarrow
Credit
\\
&\rightarrow
StateUpdate
\\
&\rightarrow
Replay
\\
&\rightarrow
Consolidation
\\
&\rightarrow
S_{t+1}
\end{aligned}
}
\]

关键：

> 上面的顺序是“可能的计算链”，不是固定 workflow。

实际 runtime 每一步都根据状态决定：

\[
a_t
\]

---

# 34. What Should Be Hard-Coded?

只有四类：

\[
\boxed{
Safety
}
\]

\[
\boxed{
State\ Integrity
}
\]

\[
\boxed{
Auditability
}
\]

\[
\boxed{
Resource/Risk\ Limits
}
\]

除此之外：

\[
Reasoning
\]

\[
Search
\]

\[
Memory
\]

\[
Planning
\]

\[
Writing
\]

都应该是可选择、可替换、可组合的。

---

# 35. What Should Be Learned?

长期学习主要发生在：

\[
\boxed{
Memory
+
Schema
+
Policy
+
UserModel
+
SelfModel
+
SharedState
}
\]

Foundation LLM 可以保持冻结。

---

# 36. 最终“超越 GPT”的科学定义

不要定义成：

\[
CSLA>GPT
\]

因为 GPT 不是一个固定版本和一个固定任务。

正确目标：

\[
\boxed{
Performance(
LLM+CSLA
)
>
Performance(
LLM
)
}
\]

在：

\[
Longitudinal
+
Personalized
+
Novel
+
Human\!-\!AI\ Collaborative
\]

任务上。

尤其希望：

\[
Generalization_{new}
\uparrow
\]

\[
Recovery\uparrow
\]

\[
HumanInsight\uparrow
\]

\[
RepeatedError\downarrow
\]

\[
InteractionCost\downarrow
\]

\[
Originality\uparrow
\]

---

# 37. 最值得做的第一组科学实验

固定同一个 foundation model：

\[
LLM
\]

比较：

```text
A: LLM
B: LLM + RAG
C: LLM + Memory
D: LLM + Planner
E: LLM + CSLA-Runtime
F: LLM + CSLA-Runtime + Replay
```

测试：

1. 长期目标保持
2. 未见任务迁移
3. 反复错误恢复
4. 记忆利用
5. 主动搜索
6. 推理方式选择
7. 人类创新点抽取
8. 写作质量
9. 人机联合效率
10. token / latency / tool cost

---

# 38. 最重要的 falsification test

如果：

\[
LLM+CSLA
\]

只比：

\[
LLM
\]

多使用很多 token、很多搜索、很多调用，

但：

\[
CostAdjustedPerformance
\]

没有提高，

那么：

\[
CSLA
\]

失败。

如果：

\[
Memory
\]

越来越大，但：

\[
Generalization
\]

不提高，

Memory 机制失败。

如果：

\[
DeepReasoning
\]

越来越多，但没有：

\[
Accuracy/Transfer
\]

提升，

Deep Controller 失败。

如果用户没有更容易表达原创 idea，

Innovation Elicitation 失败。

---

# 39. 最终系统的设计目标

\[
\boxed{
Don't\ make\ the\ LLM\ think\ like\ a\ human.
}
\]

而：

\[
\boxed{
Give\ the\ LLM\ the\ computational\ scaffolding
that\ makes\ human\!-\!like\ cognitive\ processes
possible\ outside\ the\ frozen\ model.
}
\]

即：

> 不要求 GPT/Claude/Qwen 自己变成人脑，而是在模型外部提供一个能够进行持续状态管理、关系记忆、认知算子选择、未来模拟、反馈学习和人机联合控制的计算层。

---

# 40. 最终核心闭环

\[
\boxed{
Want
\rightarrow
Goal
\rightarrow
Represent
\rightarrow
Remember
\rightarrow
Compare
\rightarrow
Associate
\rightarrow
Abstract
\rightarrow
Infer
\rightarrow
Simulate
\rightarrow
Act
\rightarrow
Observe
\rightarrow
Evaluate
\rightarrow
Credit
\rightarrow
Learn
\rightarrow
Remember
}
\]

而人机协同：

\[
\boxed{
Human
\leftrightarrow
JointState
\leftrightarrow
CSLA
\leftrightarrow
LLM
\leftrightarrow
World
}
\]

这两个循环才是最终 CSLA 的核心，而不是固定的 24 步流水线。
