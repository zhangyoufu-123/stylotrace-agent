# CSLA v1.7 — Reasoning & Memory Engine
## 从“模块化 Agent”升级为“可计算的认知加工层”

**日期：2026-08-28**

本版本针对 v1.6 的最大缺口：

> 之前我们已经有 memory、reasoning、search、world model、goal、credit 等模块，
> 但没有把“人类到底如何比较、联想、归纳、演绎、类比、反事实、重组记忆、形成新假设”
> 作为一个统一的认知加工过程实现。

本版本增加：
- relational memory
- pattern separation
- pattern completion
- comparison
- association
- abstraction
- induction
- deduction
- abduction
- analogy
- causal reasoning
- counterfactual reasoning
- temporal reasoning
- compositional recombination
- hypothesis competition
- memory-guided simulation
- replay-driven reasoning
- reasoning-aware retrieval
- deep/fast control

---

# 1. 最重要的科学修正

不能把海马体简单建模成：

```text
database / vector store / RAG
```

神经科学中的多个理论与实验线索表明，海马形成的是高度联结的、关系化的经验表示；它可以把一次经历中的多个元素绑定成关系结构，并参与当前输入与既有表征之间的比较。记忆索引理论则把海马描述为连接广泛皮层表征的索引，而不是一个独立保存所有内容的数据库。citeturn761515search0turn761515search5turn761515search12

因此：

\[
\boxed{
Memory \neq Retrieval
}
\]

更准确：

\[
\boxed{
Memory
=
Encoding
+
Binding
+
Separation
+
Completion
+
Comparison
+
Replay
+
Recombination
}
\]

这直接决定 CSLA memory engine 的结构。

---

# 2. Episodic Event Representation

每个经历不再只是文本：

\[
e_t=(text_t)
\]

而是：

\[
\boxed{
e_t=
(
Entities,
Attributes,
Relations,
Time,
Place,
Context,
Goal,
Action,
Outcome,
Prediction,
Emotion/Salience,
Source,
Confidence
)
}
\]

例如：

“小猪吃玉米”

应形成：

\[
Entity_1=Pig
\]

\[
Entity_2=Corn
\]

\[
Relation=(Pig,\ Eats,\ Corn)
\]

以及：

\[
Context=\text{animal feeding}
\]

这允许后续比较：

\[
Pig\leftrightarrow Dog
\]

以及：

\[
Corn\leftrightarrow Apple
\]

而不是只比较文本相似度。

---

# 3. Pattern Separation

海马回路中，DG 被广泛讨论为支持 pattern separation，即让相似但不同的经历形成可区分的表征；CA3 则与 pattern completion 紧密相关。2025 年的人类研究也再次讨论了二者的区分，并明确指出 pattern separation 与 completion 并非简单的一对互补操作。citeturn761515search3

工程定义：

\[
Sep(e_i,e_j)
=
D_{structure}(e_i,e_j)
+
D_{context}(e_i,e_j)
\]

如果：

\[
Similarity_{surface}\uparrow
\]

但：

\[
ContextDifference>\tau
\]

仍保持两个独立 episode。

例如：

```text
“小狗吃肉”
“小狗闻到肉”
```

不能因为 token 很相似就合并。

---

# 4. Pattern Completion

当只有部分线索：

\[
cue\subset e
\]

系统尝试：

\[
\boxed{
Completion(cue,M)
\rightarrow
\{e_1,\dots,e_k\}
}
\]

但 completion 的内容必须标记为：

\[
reconstructed
\]

并携带：

\[
P(e|cue)
\]

绝不能直接变成 confirmed fact。

---

# 5. Relational Binding

核心不是“苹果和玉米都相似”。

而是：

\[
Apple
\rightarrow
Food
\]

\[
Corn
\rightarrow
Food
\]

\[
Pig
\rightarrow
Animal
\]

\[
Pig
\xrightarrow{eats}
Corn
\]

于是系统可以比较：

\[
Relation(Pig,Corn)
\]

和：

\[
Relation(Dog,Meat)
\]

关系结构比词语表面相似更重要。

这一点来自 relational memory theory：海马参与把同时出现的元素绑定成组合关系表示。citeturn761515search4turn761515search5

---

# 6. Comparison Engine

定义：

\[
\boxed{
Compare(x,y)
\rightarrow
(
Shared,
Different,
RelationalDifference
)
}
\]

不是简单：

\[
EmbeddingSimilarity(x,y)
\]

输出：

```json
{
  "shared": [...],
  "different": [...],
  "relations": [...],
  "confidence": 0.0
}
```

这是人类学习和归纳的重要基础算子。

---

# 7. Association Engine

定义关联：

\[
A(x,y|context)
=
f(
cooccurrence,
causalLink,
semanticLink,
temporalLink,
goalLink,
experienceLink
)
\]

建立多种边：

```text
semantic
causal
temporal
spatial
functional
goal
social
episodic
```

所以：

\[
x\rightarrow y
\]

不是只有一个 similarity score。

---

# 8. Abstraction Engine

从多个具体经历：

\[
e_1,e_2,\dots,e_n
\]

抽象：

\[
\boxed{
Abstract(E)\rightarrow K
}
\]

例如：

```text
Pig eats corn
Pig eats apple
Pig eats vegetable
```

得到候选 schema：

\[
Pig
\rightarrow
PlantFood
\]

但是如果出现：

```text
Dog eats meat
```

则原来的 schema 需要条件化：

\[
AnimalDiet
=
f(
Species,
Context,
FoodType
)
\]

而不是保留错误的：

\[
Animal\rightarrow PlantFood
\]

---

# 9. Induction

从特殊实例：

\[
x_1\rightarrow y
\]

\[
x_2\rightarrow y
\]

\[
x_3\rightarrow y
\]

产生一般假设：

\[
\boxed{
H=Induce(\{x_i,y_i\})
}
\]

关键：

\[
P(H|D)
\]

而不是把归纳结论当成 certainty。

---

# 10. Deduction

已有规则：

\[
A\rightarrow B
\]

已有事实：

\[
A
\]

得到：

\[
\boxed{
B
}
\]

例如：

\[
Mammal\rightarrow needs\ food
\]

\[
Pig\rightarrow Mammal
\]

得到：

\[
Pig\rightarrow needs\ food
\]

再结合：

\[
Corn\rightarrow Food
\]

可以产生：

\[
Pig\ eats\ Corn
\]

但必须保持前提记录。

---

# 11. Abduction

人类不仅“从规则推结论”，还会：

> 已知结果，寻找最合理的解释。

定义：

\[
\boxed{
Abduce(O)
=
\arg\max_H
P(H|O)
}
\]

例如：

观察：

\[
Pig\ eats\ Corn
\]

候选解释：

\[
H_1:\ Pig\ is\ hungry
\]

\[
H_2:\ Corn\ was\ offered
\]

\[
H_3:\ Pig\ prefers\ corn
\]

三者不能混成一个事实。

必须保持：

\[
\{H_i,P(H_i|O)\}
\]

---

# 12. Analogy

人类重要能力之一是：

> “这个东西虽然不是同一件事，但是结构很像。”

定义两个关系图：

\[
G_A=(V_A,E_A)
\]

\[
G_B=(V_B,E_B)
\]

寻找：

\[
\boxed{
Mapping:
V_A\rightarrow V_B
}
\]

最大化：

\[
Score_{analog}
=
RelationalMatch
-
SurfaceMismatchPenalty
\]

2025 年关于 analogical mapping、counterfactual 与 abduction 的工作也把这种结构性映射视为产生假设的重要机制，并讨论了 LLM 在真正反事实/溯因方面的局限。citeturn761515search1

---

# 13. Compositional Recombination

人并非只“回忆”。

会把不同经历的组件重新组合：

\[
e_1=(A,B)
\]

\[
e_2=(B,C)
\]

产生：

\[
\boxed{
(A,B,C)
}
\]

或者：

\[
NewIdea
=
Compose(
Memory_i,
Memory_j,
CurrentGoal
)
\]

这一步是从 memory 到 creativity / hypothesis 的关键。

2025 年的 Nature Neuroscience 计算模型工作直接研究 relational learning 与“快速知识重组”，包括从多个已学关系快速形成新的结构化组合。citeturn761515search10

---

# 14. Causal Reasoning

区分：

\[
Correlation
\]

和：

\[
Causation
\]

维护：

\[
G_c=(V,E)
\]

结构方程：

\[
X_i=f_i(Pa_i,U_i)
\]

允许：

\[
do(X=x)
\]

以及：

\[
P(Y|do(X=x))
\]

---

# 15. Counterfactual Reasoning

定义：

\[
World_{actual}
\]

以及：

\[
World_{counterfactual}
\]

即：

\[
\boxed{
“What\ if\ something\ had\ been\ different?”
}
\]

计算：

\[
\Delta Y
=
Y_{cf}-Y_{actual}
\]

这同时服务：

- planning
- diagnosis
- credit assignment
- scientific reasoning
- innovation

---

# 16. Temporal Reasoning

人类会把事件放在：

\[
Before
\]

\[
After
\]

\[
During
\]

\[
Future
\]

中。

定义：

\[
e_i\prec e_j
\]

因此 memory graph 不再只是：

\[
A\sim B
\]

还支持：

\[
A\rightarrow_{time}B
\]

---

# 17. Future Simulation

人类记忆与未来想象具有深刻联系。研究把 future thinking 分成 simulation、prediction、intention、planning 等不同形式；海马系统参与从过去经验中重组可能未来。citeturn351881search0turn351881search5

因此：

\[
PastEpisode
\rightarrow
Recombine
\rightarrow
FutureHypothesis
\]

定义：

\[
\boxed{
\hat e_{future}
=
Simulate(Memory,Goal,WorldModel)
}
\]

然后：

\[
Evaluate(\hat e_{future})
\]

---

# 18. Hippocampal Replay

Replay 不只是：

```text
retrieve memory
```

而是：

\[
\boxed{
Replay(e)
=
Reactivation
+
Reevaluation
+
Recombination
+
Prediction
}
\]

研究长期把 hippocampal replay 与 consolidation、planning、spatial working memory 和 reinforcement learning 联系起来；近期综述继续讨论 awake/sleep replay 的这些作用。citeturn761515search6turn761515search9turn761515search11

因此：

\[
Replay
\rightarrow
Schema
\]

也可以：

\[
Replay
\rightarrow
FutureSimulation
\]

---

# 19. Reasoning-Aware Retrieval

传统：

\[
q
\rightarrow
Retrieve
\]

太简单。

当前已有研究正在做：

\[
\boxed{
Reasoning
+
Query
\rightarrow
Retrieve
}
\]

例如 AgentIR 直接把 reasoning trace 与 query 联合用于 retrieval，在 BrowseComp-Plus 上报告了相较传统 embedding/BM25 的显著提升。citeturn761515academia57

这应该直接吸收到 CSLA：

\[
q_t
=
f(
CurrentQuestion,
CurrentHypothesis,
Goal,
Uncertainty,
ReasoningContext
)
\]

然后：

\[
Retrieve(M,q_t)
\]

---

# 20. Retrieval 后不是立刻信任

检索结果：

\[
r_i
\]

先经过：

\[
Verify(r_i)
\]

再进入：

\[
Workspace
\]

因此：

\[
\boxed{
Retrieve
\rightarrow
Compare
\rightarrow
Verify
\rightarrow
Integrate
}
\]

而不是：

\[
Retrieve
\rightarrow
Paste
\]

---

# 21. Deep Reasoning Controller

系统先判断：

\[
NeedDepth_t
\]

定义：

\[
NeedDepth
=
f(
TaskComplexity,
Uncertainty,
Risk,
Novelty,
GoalImportance,
CurrentDisagreement
)
\]

然后选择 depth：

\[
d_t\in
\{
0,1,2,3,4
\}
\]

### \(d=0\)
直接回应。

### \(d=1\)
快速结构化。

### \(d=2\)
多路径 reasoning。

### \(d=3\)
reason + search + critique。

### \(d=4\)
full deliberation + simulation + counterfactual + human checkpoint。

这让：

\[
Fast\ Talk
\]

与：

\[
Deep\ Cognition
\]

真正连接起来。

---

# 22. LLM 在这里到底干什么？

LLM 不负责成为整个大脑。

它作为高容量 cognitive operator：

\[
LLM:
Context
\rightarrow
Candidate\ Representations
\]

例如：

\[
Generate
\]

\[
Explain
\]

\[
Associate
\]

\[
Analogize
\]

\[
Hypothesize
\]

\[
Critique
\]

\[
Summarize
\]

\[
Write
\]

然后 CSLA 负责：

\[
\boxed{
State
+
Selection
+
Memory
+
Comparison
+
Verification
+
Outcome
+
Learning
}
\]

---

# 23. 多 LLM 的正确用法

不是：

\[
LLM_1+LLM_2+LLM_3
\rightarrow
Vote
\]

而是：

\[
LLM_i
=
Operator_i
\]

例如：

```text
Generator
Analyst
Analogy Finder
Counterexample Finder
Retriever
Verifier
Planner
Writer
```

得到：

\[
Y=
\{y_1,\dots,y_N\}
\]

然后：

\[
Y
\rightarrow
Cluster
\rightarrow
Compare
\rightarrow
Contradiction
\rightarrow
Evidence
\rightarrow
HumanAlignment
\rightarrow
Synthesis
\]

---

# 24. 一个真正的 Reasoning Graph

内部不再只有一条 CoT：

\[
A\rightarrow B\rightarrow C
\]

而是：

```text
          Observation
             │
       ┌─────┼─────┐
       ↓     ↓     ↓
    Memory Analogy Search
       │     │     │
       └─────┼─────┘
             ↓
        Hypotheses
       ┌─────┼──────┐
       ↓     ↓      ↓
    Deduce Induce Abduce
       │     │      │
       └─────┼──────┘
             ↓
        Counterexample
             ↓
          Update
```

这才是“比较—联想—归纳—演绎—溯因—验证”的完整认知流程。

---

# 25. 不要暴露模型隐式 CoT

工程上不要求 LLM 输出完整隐藏 reasoning。

我们只要求：

\[
Structured\ Cognitive\ Artifacts
\]

例如：

```json
{
  "claims": [],
  "hypotheses": [],
  "evidence": [],
  "comparisons": [],
  "assumptions": [],
  "uncertainties": [],
  "decisions": [],
  "next_actions": []
}
```

这样既可审计，又不把系统绑死在某个模型的内部 reasoning 格式。

---

# 26. “小猪吃玉米”的完整认知运行

输入：

\[
Pig\ Eats\ Corn
\]

### Stage 1 — Parse

\[
(Pig,Eats,Corn)
\]

### Stage 2 — Bind

建立：

\[
Pig\stackrel{eats}{\longrightarrow}Corn
\]

### Stage 3 — Retrieve

召回：

\[
Pig,\ Dog,\ Apple,\ Banana,\ Meat
\]

### Stage 4 — Compare

\[
Pig\leftrightarrow Dog
\]

\[
Corn\leftrightarrow Apple
\]

### Stage 5 — Abstract

候选：

\[
H_1:
Animals\ eat\ plant\ foods
\]

### Stage 6 — Counterexample

\[
Dog\rightarrow Meat
\]

推翻：

\[
H_1
\]

### Stage 7 — Refine

\[
H_2:
Diet
=
f(
Species,
Food,
Context
)
\]

### Stage 8 — Consolidate

把：

\[
H_2
\]

变成 schema：

```text
animal diet depends on species/context
```

同时保存 supporting episodes。

这个过程才更接近你最初描述的“我先分类 → 找相似 → 找不同 → 找反例 → 修正 → 留下结论”。

---

# 27. “宇树科技股票会跌”的完整认知运行

输入：

\[
“Unitree\ stock\ will\ fall”
\]

### Stage 1

\[
Domain=Finance
\]

### Stage 2

Goal：

\[
Estimate(P(Fall))
\]

### Stage 3

Hypotheses：

\[
H_1=valuation
\]

\[
H_2=policy
\]

\[
H_3=fundamentals
\]

\[
H_4=sentiment
\]

\[
H_5=liquidity
\]

### Stage 4

Analogy：

\[
Unitree
\leftrightarrow
ComparableCompanies
\]

### Stage 5

Search：

寻找最能区分：

\[
H_1,...,H_5
\]

的证据。

### Stage 6

Bayesian update：

\[
P(H_i|Evidence)
\]

### Stage 7

Counterfactual：

> 如果估值下降，但盈利增长呢？

> 如果政策继续支持呢？

> 如果投资者情绪崩溃呢？

### Stage 8

Self model：

如果过去预测高估：

\[
FinanceCalibration\downarrow
\]

于是：

\[
Verification\uparrow
\]

### Stage 9

Decision：

不是直接输出：

> “肯定跌到某个数字。”

而是：

\[
Prediction
+
Confidence
+
Assumptions
+
Evidence
+
Scenarios
\]

这样才是认知式决策。

---

# 28. Memory 不应该只是“记住答案”

真正要保存的是：

\[
\boxed{
Experience
+
Relation
+
Reason
+
Outcome
}
\]

例如：

错误记忆：

> “宇树股票会跌。”

正确长期知识：

> “当机器人公司估值显著脱离盈利能力时，估值回归风险增加；但该判断依赖估值、盈利、流动性和政策状态。”

这是：

\[
Episode
\rightarrow
Schema
\]

而不是：

\[
Text
\rightarrow
Vector
\]

---

# 29. 这使“学习”真正变成认知更新

最终：

\[
\boxed{
Experience
\rightarrow
Memory
\rightarrow
Comparison
\rightarrow
Hypothesis
\rightarrow
Evidence
\rightarrow
Prediction
\rightarrow
Outcome
\rightarrow
Credit
\rightarrow
Schema/Policy
}
\]

下次遇到新问题：

\[
NewProblem
\rightarrow
OldSchema
\rightarrow
NewCombination
\]

这才是我们一直想要的：

\[
\boxed{
Transfer
}
\]

---

# 30. 第一版可实现性

这整套系统不需要改 Transformer。

可以用：

\[
LLM API
+
Structured State
+
Graph/JSON Store
+
Vector Search
+
Web Search
+
Rule Engine
+
LLM Operators
\]

实现。

第一版的“海马体”可以是：

\[
EpisodicStore
+
RelationalGraph
+
PatternSeparator
+
PatternCompleter
+
ReplayEngine
\]

第一版的“前额叶”：

\[
GoalManager
+
WorkingState
+
StrategyController
+
AuthorityController
\]

第一版的“推理系统”：

\[
ReasoningGraph
+
OperatorPool
\]

第一版的“新皮层巩固”：

\[
SchemaStore
+
RuleExtractor
+
Consolidator
\]

这样完全可以在现有 LLM 上运行。

---

# 31. 为什么它仍然不等于真正的人脑

因为真正神经计算还涉及：

- continuous neural dynamics
- oscillations
- neuromodulation
- distributed cortical representations
- structural plasticity
- biological constraints
- embodiment

我们现在只是提取：

\[
\boxed{
Computational\ Principles
}
\]

不能声称生物等价。

---

# 32. 下一阶段最重要的实验

不再只是测：

\[
AnswerAccuracy
\]

而要测：

### Memory

\[
PatternSeparationAccuracy
\]

\[
PatternCompletionAccuracy
\]

### Reasoning

\[
ComparisonAccuracy
\]

\[
InductionAccuracy
\]

\[
DeductionAccuracy
\]

\[
AbductionQuality
\]

\[
AnalogyQuality
\]

\[
CounterfactualAccuracy
\]

### Longitudinal

\[
SchemaTransfer
\]

### Human-AI

\[
HumanInsightElicitation
\]

\[
JointPerformance
\]

### Cost

\[
Token/Latency/Search/Turns
\]

---

# 33. 以后所有认知模块都必须通过这张“认知算子表”

| Human-like computation | CSLA operator |
|---|---|
| 感知/显著性 | Salience |
| 本能快速响应 | Fast Reflex |
| 目标形成 | GoalGen |
| 工作记忆 | WorkingState |
| 事件绑定 | RelationalBinding |
| 模式分离 | PatternSeparation |
| 模式补全 | PatternCompletion |
| 联想 | Association |
| 比较 | Comparison |
| 抽象 | Abstraction |
| 归纳 | Induction |
| 演绎 | Deduction |
| 溯因 | Abduction |
| 类比 | Analogy |
| 因果 | CausalInference |
| 反事实 | Counterfactual |
| 未来想象 | FutureSimulation |
| 规划 | Planning |
| 回放 | Replay |
| 巩固 | Consolidation |
| 元认知 | Metacognition |
| 行动 | Action |
| 结果反馈 | Outcome |
| 错误归因 | Credit |
| 自我修正 | Reconsolidation |
| 人机协作 | JointControl |

这张表以后就是**认知运行时的完整 operator inventory**。

---

# 34. 最终的运行时

\[
\boxed{
\begin{aligned}
Observation
&\rightarrow
FastSalience
\\
&\rightarrow
Language/Interaction
\\
&\rightarrow
Goal/Motivation
\\
&\rightarrow
TaskRepresentation
\\
&\rightarrow
MemoryBinding
\\
&\rightarrow
Retrieve/Compare/Associate
\\
&\rightarrow
Abstract/Induce/Deduce/Abduce/Analogize
\\
&\rightarrow
Search/Verify/Counterexample
\\
&\rightarrow
Simulate/Plan
\\
&\rightarrow
Human/AI\ Authority
\\
&\rightarrow
Action/Artifact
\\
&\rightarrow
Outcome
\\
&\rightarrow
PredictionError
\\
&\rightarrow
Credit
\\
&\rightarrow
Replay
\\
&\rightarrow
Consolidation
\\
&\rightarrow
SharedState_{t+1}
\end{aligned}
}
\]

这才是我们之前所有讨论真正应该进入的**完整 Agent 工作流**。

---

# 35. 最核心的认识

我们之前一直容易犯一个错误：

> 把“认知”理解成更多 reasoning tokens。

现在应该彻底改掉。

\[
\boxed{
Cognition
\neq
Longer\ CoT
}
\]

而应该：

\[
\boxed{
Cognition
=
State
+
Memory
+
Comparison
+
Composition
+
Inference
+
Simulation
+
Control
+
Learning
}
\]

LLM 提供：

\[
\boxed{
High\!-\!capacity\ generative\ computation
}
\]

CSLA 提供：

\[
\boxed{
Persistent\ cognitive\ organization
}
\]

而真正的长期学习：

\[
\boxed{
Experience
\rightarrow
Consequences
\rightarrow
Credit
\rightarrow
Changed\ Future\ Behavior
}
\]

这就是当前这套系统最重要的实现方向。
