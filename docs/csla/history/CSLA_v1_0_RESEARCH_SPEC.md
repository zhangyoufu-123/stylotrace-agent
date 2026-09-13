# CSLA v1.0 — Cognitive State Learning Architecture

> **Document role:** Canonical research specification / Codex handoff
>
> **Status:** v1.0-draft, theory-first, implementation not yet authorized
>
> **Updated:** 2026-08-27
>
> **Primary goal:** Build an artificial cognitive system that learns task structure from experience, maintains persistent internal state, predicts consequences, acts, detects failures, and continually updates memory, world model, policy, and metacognitive control.

---

## 0. Instructions for Codex

This document is the current source of truth for the research project.

### Codex must

1. Treat the architecture as a **research hypothesis**, not as a proven neuroscience reproduction.
2. Preserve the distinction between:
   - `LLM inference`
   - `memory retrieval`
   - `reasoning/search`
   - `world prediction`
   - `action`
   - `learning`
   - `consolidation`
3. Never silently replace the mathematical specification with a simpler workflow such as `LLM -> prompt -> tool -> LLM`.
4. Never assume that a component is biologically faithful merely because it is named after a brain region.
5. Keep all modules independently ablatable.
6. Log enough structured information to reproduce every experiment.
7. Every implementation claim must map to a section of this document.
8. If implementation reveals that a proposed equation is ill-defined, write a design note instead of silently changing the theory.
9. Do not begin a large implementation before the corresponding mathematical interface has been fixed in this file.
10. Keep the implementation modular enough that alternative equations can be swapped without rewriting the whole system.

### Current implementation policy

**Theory first. Code second.**

The immediate milestone is to formalize the complete recurrent state transition, credit assignment, memory consolidation and benchmark protocol. Only then should a production implementation begin.

---

# 1. Research North Star

The project does **not** aim to:

- claim machine consciousness;
- copy human-brain weights;
- reproduce brain anatomy one-to-one;
- merely build a stronger chatbot;
- merely build a larger RAG system;
- merely increase chain-of-thought length.

The research target is:

> **Experience-driven cognitive state learning:** a system whose internal task model, memory, world model, policy and confidence can change as a consequence of interaction with the world.

Canonical formulation:

\[
\boxed{
\text{Observation}
\rightarrow
\text{Task Model}
\rightarrow
\text{Memory}
\rightarrow
\text{Hypothesis}
\rightarrow
\text{Prediction}
\rightarrow
\text{Action}
\rightarrow
\text{Outcome}
\rightarrow
\text{Error}
\rightarrow
\text{Credit}
\rightarrow
\text{Learning}
\rightarrow
\text{New State}
}
\]

The key distinction from a standard Transformer workflow is:

\[
\boxed{\text{Transformer: context-conditioned computation}}
\]

versus

\[
\boxed{\text{CSLA: experience-driven state transition and learning dynamics}}
\]

---

# 2. Core Scientific Hypothesis

The central hypothesis is:

> A long-horizon agent should generalize, recover from errors, calibrate uncertainty, and learn continuously better when it maintains explicit persistent state and allows real-world consequences to update multiple learning systems at different timescales.

The critical proposed mechanism is **cross-module temporal credit assignment**.

Given an observed outcome error, the system estimates which internal learning subsystem should change and by how much.

\[
\boxed{
\delta_t
\rightarrow
c_t
\rightarrow
\{\Delta M,\Delta W,\Delta \Pi,\Delta P,\Delta U,\Delta K\}
}
\]

where:

- \(\delta_t\): prediction/reward error
- \(c_t\): cross-module credit vector
- \(M\): episodic memory
- \(W\): world model
- \(\Pi\): policy
- \(P\): executive/working state
- \(U\): uncertainty/meta-control
- \(K\): consolidated schema/knowledge

This is the project's primary research bet.

---

# 3. Theoretical Position Relative to Existing Approaches

The architecture should be understood as a synthesis layer over existing mechanisms, not a claim that all prior work is wrong.

## 3.1 Transformer

Core computation:

\[
H=f_{\theta_L}(X)
\]

\[
P(Y\mid X)=\prod_t P(y_t\mid y_{<t},X)
\]

Transformer supplies the language/semantic computation substrate.

CSLA does not attempt to replace it.

## 3.2 Chain-of-Thought (CoT)

CoT expands computation over reasoning steps:

\[
X\rightarrow z_1\rightarrow z_2\rightarrow\cdots\rightarrow z_T\rightarrow Y
\]

CSLA treats CoT as one possible reasoning operator.

## 3.3 Self-Consistency

Multiple sampled reasoning trajectories:

\[
\{\rho^{(1)},\ldots,\rho^{(K)}\}
\]

followed by aggregation.

CSLA can use this as hypothesis/path generation.

## 3.4 Tree/Graph of Thoughts

Reasoning becomes search over a tree/graph:

\[
\mathcal T=(V,E),\qquad \mathcal G=(V,E)
\]

CSLA uses such search optionally, but does not equate intelligence with more search.

## 3.5 RAT (Retrieval Augmented Thoughts)

Iterative retrieval + thought revision:

\[
T_i\rightarrow Retrieve(D_i)\rightarrow Revise(T_i)
\]

CSLA generalizes this idea into uncertainty-driven information acquisition.

## 3.6 ReAct

Reasoning/action loop:

\[
Thought_t\rightarrow Action_t\rightarrow Observation_{t+1}
\]

CSLA embeds this inside a persistent state-learning loop.

## 3.7 Reflexion

Verbal reflection from outcomes:

\[
Error\rightarrow Reflection\rightarrow Memory
\]

CSLA extends the target of learning to multiple systems, not only textual memory.

## 3.8 STaR / reward-trained reasoning / DeepSeek-R1-like approaches

Reasoning can become trainable behavior through reinforcement or self-training:

\[
\theta\leftarrow\theta+\eta\nabla_\theta J
\]

CSLA treats policy learning as one learning timescale within a larger recurrent cognitive state.

## 3.9 JEPA / latent world models

Latent prediction:

\[
z_t=E(o_t)
\]

\[
\hat z_{t+1}=P(z_t,a_t)
\]

CSLA uses latent predictive world modeling as the world component, potentially JEPA-inspired but not limited to JEPA.

## 3.10 Core difference

Existing methods usually optimize one or two dimensions:

- reasoning depth;
- retrieval;
- action/environment interaction;
- reflection memory;
- reward-trained reasoning;
- latent prediction.

CSLA aims to unify them under persistent state transition:

\[
\boxed{
S_{t+1}=F_\Theta(S_t,a_t,o_{t+1})
}
\]

and shared consequence-based credit assignment:

\[
\boxed{
\theta_i^{t+1}
=
\theta_i^t
-
\eta_i c_{i,t}\nabla_{\theta_i}\mathcal J_t
}
\]

---

# 4. Neuroscience-Inspired Principles (Not One-to-One Brain Copies)

The architecture is inspired by functional principles, not anatomical identity.

## 4.1 Language network -> LLM

Use a pretrained LLM for linguistic and semantic representation/generation.

\[
H_t=f_{\theta_L}(X_t)
\]

## 4.2 Hippocampal principles

Model:

- rapid episodic binding;
- pattern separation/completion-inspired retrieval;
- compositional state construction;
- replay;
- retrieval-reconsolidation;
- contribution to schema formation.

Do **not** define hippocampus as "database".

## 4.3 Prefrontal executive principles

Model:

- goal maintenance;
- task state;
- working memory;
- rule/constraint maintenance;
- inhibition;
- budget allocation;
- adaptive control.

## 4.4 Salience / attention / thalamocortical coordination principles

Model:

- information prioritization;
- routing under uncertainty;
- task relevance;
- novelty and risk gating.

## 4.5 Striatal / dopaminergic principles

Model:

- action value;
- reward prediction error;
- habit/policy learning;
- action selection.

## 4.6 Default-mode / internal simulation principles

Model:

- autobiographical/contextual integration;
- internal recombination;
- scenario simulation.

## 4.7 Multi-timescale learning

Fast, medium and slow learning systems should coexist:

\[
\eta_{fast}>\eta_{medium}>\eta_{slow}
\]

The exact numerical values are empirical questions.

---

# 5. Global State Definition

The complete cognitive state is:

\[
\boxed{
S_t=(G_t,B_t,M_t^E,M_t^S,W_t,P_t,\Pi_t,U_t,K_t,Self_t)
}
\]

Definitions:

- \(G_t\): active goals
- \(B_t\): belief over latent world state
- \(M_t^E\): episodic memory
- \(M_t^S\): semantic/schema memory
- \(W_t\): world model
- \(P_t\): executive/working state
- \(\Pi_t\): policy / action-selection mechanism
- \(U_t\): uncertainty/metacognitive state
- \(K_t\): consolidated knowledge/skills
- \(Self_t\): self-model / capability model

The true environment state is latent:

\[
S_t^{env}\not\equiv S_t^{agent}
\]

Therefore the system operates under partial observability.

---

# 6. Environment Model

Represent the task environment abstractly as a POMDP:

\[
\mathcal E=(\mathcal S,\mathcal A,\mathcal O,T,O,R,\gamma)
\]

with:

\[
T(s'\mid s,a)
\]

world transition,

\[
O(o\mid s)
\]

observation model, and

\[
R(s,a)
\]

reward/task utility.

Belief state:

\[
\boxed{
b_t(s)=P(s_t=s\mid o_{1:t},a_{1:t-1})
}
\]

The architecture should work even when the environment is noisy, incomplete, delayed, or adversarial.

---

# 7. Stage A — Observation and Language Representation

Input:

\[
x_t
\]

LLM representation:

\[
H_t=f_{\theta_L}(x_t)
\]

Cognitive representation:

\[
\boxed{
z_t=E_\phi(H_t,G_t,M_t^E,M_t^S,P_t)
}
\]

The goal is not to force all meaning into symbolic form. The system may maintain a hybrid representation consisting of:

- dense latent vectors;
- discrete entities/relations;
- task state variables;
- confidence values;
- structured events.

---

# 8. Stage B — Task Identification and Cognitive Mode Selection

Task representation:

\[
\boxed{
\tau_t=(g_t,s_t,c_t,r_t,d_t)
}
\]

where:

- \(g_t\): goal
- \(s_t\): current task state
- \(c_t\): constraints
- \(r_t\): resources
- \(d_t\): domain

Task encoder:

\[
\tau_t=E_{task}(z_t)
\]

Meta-cognitive policy:

\[
\boxed{
q_t(m)=P(m\mid \tau_t,S_t)
}
\]

where cognitive modes include:

\[
m\in\{retrieve,deduce,analogize,search,simulate,act,verify,reflect\}
\]

This formalizes the human behavior observed in the examples: before solving a problem, the system selects **how to think**.

---

# 9. Stage C — Cognitive Workspace and Salience

Define candidate information items \(x_i\).

Salience:

\[
\boxed{
\alpha_i=softmax_i(f_{salience}(x_i,g_t,U_t,risk_i,novelty_i))
}
\]

Workspace:

\[
\boxed{
C_t=\sum_i\alpha_i x_i
}
\]

This is not ordinary token attention. It is a higher-level allocation mechanism determining which information deserves scarce cognitive processing budget.

Executive inhibition vector:

\[
I_t\in[0,1]^N
\]

and effective access can be:

\[
\tilde\alpha_i=\alpha_i(1-I_i)
\]

---

# 10. Stage D — Episodic Memory

Episodic memory is a set of structured experience events:

\[
\boxed{
M_t^E=\{e_1,\ldots,e_N\}
}
\]

Each event:

\[
\boxed{
e_i=(S_i,a_i,\hat z_{i+1},z_{i+1},r_i,\delta_i,u_i,ctx_i)
}
\]

The memory stores not merely facts, but experience:

- what the agent believed;
- what it expected;
- what it did;
- what happened;
- how wrong it was;
- what was learned.

---

# 11. Stage E — Memory Retrieval

Retrieval score:

\[
\boxed{
Score(e_i\mid q_t)
=
\alpha R_i+\beta G_i+\gamma C_i+\delta N_i+\epsilon IG_i
}
\]

where:

- \(R_i\): semantic relevance
- \(G_i\): goal relevance
- \(C_i\): causal relevance
- \(N_i\): novelty
- \(IG_i\): expected uncertainty reduction

Retrieval distribution:

\[
P(e_i\mid q_t)=softmax(Score_i)
\]

This is a deliberate departure from pure nearest-neighbor RAG.

---

# 12. Stage F — Memory Write Gate

Not every experience deserves long-term storage.

Define:

\[
\boxed{
w_t=\sigma(\theta_1\delta_t+\theta_2IG_t+\theta_3Goal_t+\theta_4Novelty_t-\theta_5Cost_t)
}
\]

If:

\[
w_t>\tau_{write}
\]

then write the event into episodic memory.

Otherwise retain only transient state.

This implements:

\[
\boxed{
\text{memory value} \neq \text{mere occurrence}
}
\]

---

# 13. Stage G — Schema / Semantic Consolidation

Semantic/schema memory:

\[
M_t^S=\{k_1,\ldots,k_J\}
\]

A consolidation operator maps episodes to abstractions:

\[
\boxed{
K^*=Consolidate(\mathcal E_{relevant},Outcome,Error)
}
\]

A minimum-description-length style objective is:

\[
k^*=\arg\min_k
\mathbb E_{e\sim\mathcal C}[D(e,k)]
+
\lambda Complexity(k)
\]

The objective is to retain reusable structure while discarding irrelevant trajectory detail.

---

# 14. Stage H — Retrieval / Reconsolidation

A retrieved memory is not immutable.

\[
\boxed{
m_i' = U_{recon}(m_i,D_t,\delta_t)
}
\]

This permits:

\[
old\ belief
\rightarrow
counterexample
\rightarrow
revised\ belief
\]

and guards against blindly preserving outdated rules.

---

# 15. Stage I — Hypothesis Generation and Competition

For uncertain problems, produce multiple hypotheses:

\[
\boxed{
\mathcal H_t=\{H_1,\ldots,H_K\}
}
\]

Belief over hypotheses:

\[
P(H_i\mid D_{1:t})
\]

Bayesian update form:

\[
\boxed{
P(H_i\mid D_{1:t})
\propto
P(D_t\mid H_i)P(H_i\mid D_{1:t-1})
}
\]

Reasoning/search methods such as CoT, Self-Consistency, ToT and GoT can be instantiated as hypothesis/path generators and evaluators.

---

# 16. Stage J — Counterexample / Falsification Engine

Given current best hypothesis:

\[
H^*=\arg\max_iP(H_i\mid D)
\]

search for evidence that would most alter belief:

\[
\boxed{
x^*=\arg\max_x IG(H;x)
}
\]

This implements a scientific-style behavior:

> Do not only search for supporting evidence; actively search for evidence that can break the current model.

---

# 17. Stage K — World Model

Latent world representation:

\[
z_t^W=E_W(o_t,M_t^E,G_t)
\]

Action-conditioned prediction:

\[
\boxed{
\hat z_{t+1}^W=F_W(z_t^W,a_t)
}
\]

or probabilistically:

\[
\boxed{
P_W(z_{t+1}\mid z_t,a_t)
}
\]

A JEPA-like implementation may minimize latent prediction error:

\[
\boxed{
L_W=D(z_{t+1},\hat z_{t+1})
}
\]

The world model should predict decision-relevant latent state, not necessarily pixels or full text.

---

# 18. Stage L — Causal / Counterfactual World Model

Where the task justifies it, represent a structural causal model:

\[
\boxed{
W=(G_c,P(X),P(Y\mid Pa(Y)))
}
\]

or structural equations:

\[
Y=f(X,U)
\]

Interventions:

\[
P(Y\mid do(X=x'))
\]

This supports counterfactual questions:

> What would probably have happened if I had chosen a different action?

The system must distinguish observational correlation from intervention-conditioned prediction.

---

# 19. Stage M — Reasoning Engine

Generic reasoning trajectory:

\[
\rho_t=(z_t,h_1,\ldots,h_K)
\]

Thought transition:

\[
\boxed{
h_{k+1}\sim P_\theta(h\mid h_{\le k},C_t,M_t,W_t)
}
\]

Possible operators:

- CoT: linear reasoning trajectory
- Self-Consistency: multi-path sampling
- ToT: tree search
- GoT: graph search
- RAT: retrieval-conditioned revision
- Reflexion: outcome-conditioned textual reflection
- verifier/self-critique: candidate evaluation

These are **operators**, not the architecture itself.

---

# 20. Stage N — Active Information Acquisition

Search/tool action is chosen according to expected information value, not fixed top-k retrieval.

Define:

\[
\boxed{
IG(a)=H[p(W\mid D_t)]-\mathbb E_oH[p(W\mid D_t,o,a)]
}
\]

Then:

\[
\boxed{
Score(a)=Q(a)+\lambda IG(a)-\beta Cost(a)-\rho Risk(a)
}
\]

The system should search when the expected reduction in consequential uncertainty outweighs cost and risk.

---

# 21. Stage O — Metacognition / Calibration

Predictive uncertainty:

\[
\boxed{
u_t=H[P(Y\mid S_t)]
}
\]

Calibration function:

\[
\boxed{
c_t^{conf}=f_C(\nu_t,history,risk)
}
\]

Action policy can depend on confidence:

\[
Action=
\begin{cases}
Answer,&conf>\tau_1\\
Retrieve,&\tau_2<conf\le\tau_1\\
Verify,&\tau_3<conf\le\tau_2\\
Ask/Defer,&conf\le\tau_3
\end{cases}
\]

The system is not considered metacognitively successful merely because its confidence score correlates with correctness. The confidence must improve action choice.

---

# 22. Stage P — Executive / PFC-like Control

Executive state:

\[
\boxed{
P_t=(G_t,Subgoal_t,Rules_t,Constraints_t,Budget_t,Inhibition_t)
}
\]

Update:

\[
P_{t+1}=F_P(P_t,C_t,e_t)
\]

Executive controller chooses:

- which hypothesis to expand;
- which memory to retrieve;
- whether to search;
- whether to simulate;
- which irrelevant thoughts to suppress;
- how much compute to spend;
- when to stop.

---

# 23. Stage Q — Action Policy / Value Learning

Action policy:

\[
\boxed{
a_t\sim\pi_\Pi(a\mid S_t)
}
\]

Value function:

\[
Q(S,a)
\]

Reward prediction error:

\[
\boxed{
\delta_t^{RL}=r_t+\gamma V(S_{t+1})-V(S_t)
}
\]

Action utility should include task reward, information value, cost and risk:

\[
\boxed{
Q^*(a)=E[R_{task}+\lambda_IIG-\lambda_CC-\lambda_RRisk]
}
\]

---

# 24. Stage R — Prediction Error

The world prediction error is:

\[
\boxed{
\delta_t^{world}=D(z_{t+1},\hat z_{t+1})
}
\]

Combined learning signal:

\[
\boxed{
\delta_t=
\delta_t^{world}
+
\lambda_R\delta_t^{RL}
}
\]

This is the primary consequence signal.

---

# 25. Stage S — Cross-Module Credit Assignment

This is the primary proposed research contribution.

Credit vector:

\[
\boxed{
\mathbf c_t=(c_M,c_W,c_\Pi,c_P,c_U,c_K,c_S)
}
\]

The learned credit estimator is:

\[
\boxed{
\mathbf c_t=C_\psi(e_t,S_t,G_t,\delta_t,U_t,history)
}
\]

A theoretical oracle interpretation is:

\[
\boxed{
c_i^*
\propto
\left|
\frac{\partial E[L_{future}]}{\partial\theta_i}
\right|
}
\]

Practical implementation may use a learned estimator, influence estimation, counterfactual ablation, temporal-difference signals, or combinations thereof.

The central research question is:

> Can a learned credit signal assign responsibility for future loss to the correct cognitive subsystem more effectively than independent local objectives?

---

# 26. Stage T — Unified Multi-Module Learning Rule

For module \(i\):

\[
\boxed{
\theta_i^{t+1}
=
\theta_i^t
-
\eta_i c_{i,t}\nabla_{\theta_i}\mathcal J_t
}
\]

Different modules have different learning rates and update frequencies.

Suggested ordering:

\[
\boxed{
\eta_{episodic}>\eta_{world}>\eta_{schema}>\eta_{policy}
}
\]

This is a hypothesis, not a fixed constant.

---

# 27. Stage U — Replay

Replay is a learning operation, not just retrieval.

Choose trajectories:

\[
\tilde\tau=(e_i,\ldots,e_j)
\]

Re-run latent transitions:

\[
\hat z_{k+1}=W(z_k,a_k)
\]

and optimize:

\[
\boxed{
L_{replay}=\sum_kD(z_{k+1},\hat z_{k+1})
}
\]

Replay may also be used for:

- policy improvement;
- schema discovery;
- counterfactual simulation;
- forgetting protection.

---

# 28. Stage V — Consolidation

The system converts selected episodes into longer-lived structures.

Candidate consolidation value:

\[
\boxed{
V(e)=
\alpha InformationGain
+\beta PredictionError
+\gamma GoalRelevance
+\delta Novelty
+\epsilon FutureUtility
-\zeta Cost
}
\]

If:

\[
V(e)>\tau_{consolidate}
\]

then trigger replay/consolidation.

Consolidation should be:

- selective;
- loss-aware;
- stability-aware;
- generalization-oriented.

---

# 29. Stage W — Forgetting and Stability

We do not want unlimited memory growth or destructive overwriting.

Define a stability objective:

\[
\boxed{
L_{stability}=
\mathbb E_{D_{old}}
[D(f_{new}(x),f_{old}(x))]
}
\]

and a relevance-weighted forgetting policy:

\[
Forget(e_i)
\propto
LowFutureUtility(e_i)
\times
LowRelevance(e_i)
\times
Redundancy(e_i)
\]

The objective is not “remember everything.”

It is “preserve what improves future competence.”

---

# 30. Stage X — Self Model

Self model:

\[
\boxed{
Self_t=(Capabilities,Limits,FailureModes,ToolReliability,DomainReliability)
}
\]

Update:

\[
Self_{t+1}=U_S(Self_t,e_t)
\]

The self-model influences confidence and tool choice.

Example:

\[
Reliability_{finance}\downarrow
\Rightarrow
Verify/Search\uparrow
\]

This is not a claim of consciousness or subjective self-awareness.

---

# 31. Global Cognitive Event / CogBus

The project uses “CogBus” to refer to the structured learning event that passes through modules.

Canonical event:

\[
\boxed{
 e_t=(S_t,a_t,\hat z_{t+1},z_{t+1},r_t,\delta_t,u_t,\mathbf c_t,evidence_t)
}
\]

CogBus is therefore not merely an engineering message queue.

It is the **cross-module learning event representation**.

All persistent learning decisions should be traceable to these events.

---

# 32. Consequence Ledger / Audit Trail

A structured ledger stores:

\[
\boxed{
L_t=\{e_1,\ldots,e_t\}
}
\]

Each event should contain:

- timestamp/task id;
- goal;
- relevant state;
- retrieved memories;
- hypotheses;
- predictions;
- chosen action;
- evidence/tool calls;
- outcome;
- error;
- credit assignment;
- memory writes;
- model/policy updates.

The final conclusion should be traceable as:

\[
Answer
\rightarrow
Belief
\rightarrow
Evidence
\rightarrow
Experience
\rightarrow
Update
\]

---

# 33. Unified State Transition

The complete recurrent update is:

\[
\boxed{
S_{t+1}=F_\Theta(S_t,a_t,o_{t+1})
}
\]

Expanded:

\[
\boxed{
\begin{aligned}
Z_t &= E_\phi(H_t,G_t,M_t,P_t)\\
\tau_t &= E_{task}(Z_t)\\
q_t &= \pi_{meta}(\tau_t,S_t)\\
C_t &= Workspace(Z_t,M_t,W_t,P_t,q_t)\\
H_t^{hyp} &\sim P_\theta(H\mid C_t,M_t,W_t)\\
\hat z_{t+1} &= W_t(z_t,a_t)\\
a_t &\sim \pi_\Pi(a\mid S_t)\\
o_{t+1} &\sim P_{env}(o\mid s_t,a_t)\\
z_{t+1} &= E_W(o_{t+1})\\
\delta_t &= D(z_{t+1},\hat z_{t+1})+\lambda_R\delta_t^{RL}\\
e_t&=(S_t,a_t,\hat z_{t+1},z_{t+1},r_t,\delta_t)\\
\mathbf c_t&=C_\psi(e_t,S_t,G_t,\delta_t,U_t)\\
M_{t+1}^E&=U_M(M_t^E,e_t,\mathbf c_t)\\
W_{t+1}&=U_W(W_t,e_t,\mathbf c_t)\\
\Pi_{t+1}&=U_\Pi(\Pi_t,e_t,\mathbf c_t)\\
P_{t+1}&=U_P(P_t,e_t,\mathbf c_t)\\
K_{t+1}&=U_K(K_t,M_{t+1}^E)\\
U_{t+1}&=U_U(U_t,e_t)\\
Self_{t+1}&=U_S(Self_t,e_t)\\
S_{t+1}&=F_\Theta(S_t,a_t,o_{t+1})
\end{aligned}
}
\]

---

# 34. Global Objective

The current canonical objective is a multi-objective learning functional:

\[
\boxed{
\mathcal J
=
\lambda_TL_{task}
+\lambda_WL_{world}
+\lambda_ML_{memory}
+\lambda_CL_{calibration}
+\lambda_AL_{action}
+\lambda_FL_{forget}
+\lambda_SL_{stability}
+\lambda_LL_{audit}
+\lambda_B L_{budget}
+\lambda_GG(\pi)
}
\]

Components:

### Task

\[
L_{task}
\]

measures final task performance.

### World

\[
L_{world}=D(z_{t+1},\hat z_{t+1})
\]

### Memory

Measures retrieval quality, retention, usefulness and consolidation.

### Calibration

Measures probability/utility calibration and action-calibrated behavior.

### Action

Measures action effectiveness.

### Forgetting/Stability

Measures old capability retention.

### Audit

Measures traceability and consistency of consequence records.

### Budget

Measures token/compute/tool cost.

### Active inference / EFE

\(G(\pi)\) may be included at decision time as an expected-free-energy-style criterion rather than treated as the sole universal training loss.

---

# 35. Expected Free Energy Layer

Current theory:

Variational free energy:

\[
F_t=E_q[\log q(s,m)-\log p(o_t,s,m)]
\]

Expected free energy of policy \(\pi\):

\[
\boxed{
G(\pi)=E_{q(o,s\mid\pi)}[\log q(s\mid\pi)-\log p(o,s\mid\pi)]
}
\]

Engineering decomposition may be approximated as:

\[
G(\pi)\approx Risk(\pi)+Ambiguity(\pi)-InformationGain(\pi)
\]

Use this as one decision-theoretic framing. Do not claim it uniquely explains all cognition.

---

# 36. Three Learning Loops

The system has three nested timescales.

## Fast loop — online control

\[
Observe\rightarrow Decide\rightarrow Act
\]

## Medium loop — task reasoning

\[
Retrieve\rightarrow Hypothesize\rightarrow Simulate\rightarrow Evaluate
\]

## Slow loop — learning

\[
Experience\rightarrow Replay\rightarrow Consolidate\rightarrow Update
\]

This three-loop separation is foundational.

---

# 37. Canonical Cognitive Operator Set

The minimal proposed operator library is:

\[
\boxed{
\mathcal O=
\{Parse,Identify,Represent,Retrieve,Abstract,Analogize,Hypothesize,Search,Simulate,Verify,Act,Observe,Update,Consolidate,Reflect,Suppress,Stop\}
}
\]

Each operator must eventually specify:

\[
O_i:(Input,State,Parameters)\rightarrow(Output,\Delta State,Cost)
\]

The architecture is only considered complete when each operator has a mathematical interface.

---

# 38. The Two Human-Reasoning Examples as Formal Traces

## 38.1 Example A — “小猪吃玉米”

Observed text:

\[
x=\text{“小猪吃玉米”}
\]

Human-like reported sequence:

\[
Parse
\rightarrow
Categorize
\rightarrow
Relate
\rightarrow
Retrieve\ Episodic\ Example
\rightarrow
Generalize
\rightarrow
Counterexample
\rightarrow
Revise
\rightarrow
Compress
\rightarrow
Automate
\]

Computational form:

\[
\{pig,cat,dog\}
\rightarrow
shared\ structure
\rightarrow
candidate\ rule
\rightarrow
counterexample
\rightarrow
revised\ rule
\rightarrow
schema
\]

Important caution: the human self-report is a computational hypothesis generator, not direct evidence of the exact neural mechanism.

## 38.2 Example B — “宇树科技股票会跌”

Reported sequence:

\[
Parse
\rightarrow
DomainIdentify
\rightarrow
CognitiveModeSelect
\rightarrow
AnalogicalRetrieve
\rightarrow
HypothesisSpace
\rightarrow
EvidenceSearch
\rightarrow
CausalModel
\rightarrow
QuantitativeEstimate
\rightarrow
Uncertainty
\rightarrow
Decision
\rightarrow
MemoryCompression
\]

Formalized:

\[
\tau_t\rightarrow d_t=finance\rightarrow q_t(financial\ analysis)\uparrow
\]

Hypotheses:

\[
H=\{policy,valuation,sentiment,fundamental,liquidity,arbitrage,other\}
\]

Evidence updates:

\[
P(H_i|D_{1:t})
\]

Valuation output should be represented as a distribution:

\[
\boxed{
P(P_{future}\mid D_{1:t})
}
\]

rather than an unjustified single point estimate.

### Reality check

As of 2026-08-27, Unitree Robotics (宇树科技) has become a Shanghai STAR Market listed company (ticker 688836); its listing date was 2026-08-19. Any financial example used in future experiments must be treated as historical data at a specific timestamp, not as a timeless fact.

---

# 39. The 10 Original Problems and Their Formal Mechanisms

## Problem 1 — Long-horizon error accumulation

Mechanisms:

\[
Persistent\ State + World\ Model + Planning + Feedback
\]

Target metric:

- success over horizon H;
- error accumulation rate;
- recovery after perturbation.

## Problem 2 — AI does not truly learn from experience

Mechanism:

\[
Experience\rightarrow Error\rightarrow Credit\rightarrow Update
\]

Metric:

- post-experience behavioral change;
- transfer to unseen contexts;
- learning efficiency.

## Problem 3 — Lack of genuine episodic/experiential memory

Mechanism:

\[
M^E + Experience\ Events + Replay
\]

Metric:

- episodic retrieval;
- temporal relation recovery;
- causal usefulness of memories.

## Problem 4 — “Knowing that it does not know”

Mechanism:

\[
Uncertainty\rightarrow Information\ Gain\rightarrow Action
\]

Metric:

- calibration;
- search/defer correctness;
- risk-sensitive behavior.

## Problem 5 — Weak causal understanding

Mechanism:

\[
Causal\ World\ Model + do(\cdot) + Counterfactuals
\]

Metric:

- intervention accuracy;
- counterfactual transfer.

## Problem 6 — Repeating errors

Mechanism:

\[
Prediction\ Error\rightarrow Credit\ Assignment\rightarrow Policy/World/Memory\ Update
\]

Metric:

- recovery rate;
- repeated-error reduction.

## Problem 7 — No stable long-lived internal state

Mechanism:

\[
S_{t+1}=F(S_t,a_t,o_{t+1})
\]

Metric:

- state consistency;
- task continuity;
- context persistence.

## Problem 8 — No gradual personalization/competence accumulation

Mechanism:

\[
Self_t+Schema_t+Memory_t\rightarrow Self_{t+1}
\]

Metric:

- personalized improvement;
- tool reliability learning;
- domain adaptation.

## Problem 9 — Workflow rather than cognition

Mechanism:

\[
MetaPolicy + State + Recurrent Learning
\]

Metric:

- autonomous strategy selection;
- adaptation to task shifts.

## Problem 10 — No shared learning signal across modules

Mechanism:

\[
CogBus=(Observation,Prediction,Action,Outcome,Error,Confidence,Credit)
\]

Metric:

- cross-module improvement;
- credit assignment quality;
- ablation against local-only learning.

---

# 40. Benchmark Philosophy

The system must not be judged only by single-turn answer accuracy.

Required evaluation dimensions:

1. **Long-horizon completion**
2. **Compositional generalization**
3. **Continual learning**
4. **Catastrophic forgetting**
5. **Error recovery**
6. **Uncertainty calibration**
7. **Information acquisition efficiency**
8. **Counterfactual reasoning**
9. **Persistent state consistency**
10. **Auditability**
11. **Compute/tool budget efficiency**
12. **Personalized competence growth**

---

# 41. Core Experimental Program

## EXP-01 — Memory Consolidation

Compare:

- no long-term memory;
- retrieval-only memory;
- replay memory;
- replay + consolidation;
- replay + consolidation + learned credit.

Metrics:

\[
ForgettingRate,
NewTaskAccuracy,
Transfer,
MemoryCost
\]

## EXP-02 — Information-Gain Retrieval

Compare:

- fixed top-k;
- relevance retrieval;
- relevance + uncertainty;
- expected information gain.

Metric:

\[
TaskAccuracy/ToolCost
\]

## EXP-03 — Calibration-to-Action

Compare:

- no confidence control;
- confidence-only reporting;
- calibrated action router.

Metrics:

- ECE/Brier-style calibration;
- correct defer/search behavior;
- risk-adjusted utility.

## EXP-04 — Compositional Generalization

Train on:

\[
A+B,
A+C,
D+B
\]

Test on unseen:

\[
D+C
\]

Ask whether the agent can compose learned structures instead of retrieving an exact precedent.

## EXP-05 — Error Recovery

Inject perturbations after partial success.

Measure:

\[
Recovery(H)=
P(success\mid failure\ at\ step\ H)
\]

## EXP-06 — Cross-Module Credit Assignment

This is the flagship experiment.

Ablate learned credit and compare against:

- equal credit;
- local losses;
- heuristic credit;
- oracle counterfactual credit where feasible.

Primary hypothesis:

\[
Learned\ cross-module\ credit
>
local\ independent\ updates
\]

on long-horizon transfer and recovery.

---

# 42. Required Baselines

At minimum compare against:

- base LLM;
- LLM + long context;
- LLM + vector RAG;
- LLM + CoT;
- LLM + ReAct;
- LLM + Reflexion-style memory;
- LLM + learned router;
- LLM + latent/world model where possible;
- full CSLA minus one module at a time.

The goal is not to claim all baselines are inferior everywhere. The goal is to identify the regimes in which the proposed state-learning mechanism adds value.

---

# 43. Ablation Matrix

Every major component must be independently removable:

\[
\{M^E,M^S,W,P,\Pi,U,C,Replay,Consolidation,Self\}
\]

Required ablations:

- no episodic memory;
- no consolidation;
- no world model;
- no meta-router;
- no uncertainty;
- no credit assignment;
- fixed credit;
- no replay;
- no counterexample engine;
- no causal model.

A component is justified only if its removal causes interpretable degradation on the intended capability.

---

# 44. Main Failure Risks / Falsifiers

The project must actively look for evidence that the theory is wrong.

Potential falsifiers:

1. Persistent explicit state adds no value on long-horizon tasks.
2. Learned cross-module credit is unstable or no better than local learning.
3. Consolidation produces harmful abstractions more often than useful ones.
4. World-model prediction does not improve action planning.
5. Information-gain search is too expensive to outperform simpler heuristics.
6. CoT/ToT/RAT with sufficient test-time compute already matches the proposed architecture.
7. A monolithic recurrent transformer learns the same state dynamics with lower complexity.
8. The proposed biological inspiration does not predict empirical improvements.

If any of these occurs, revise the theory instead of forcing the result to fit it.

---

# 45. Key Research Questions

1. What is the smallest state sufficient for long-horizon task competence?
2. Which experiences should be remembered?
3. When should episodic memories be consolidated?
4. How should an event be decomposed into reusable schema?
5. When should a model search, act, ask, or stop?
6. How should uncertainty control action rather than only reporting confidence?
7. How can world-model predictions be grounded in actual consequences?
8. How should failures be attributed to modules?
9. Can credit assignment be learned without an oracle?
10. Can the system generalize to novel combinations of known structures?
11. Can it retain useful old skills while learning new ones?
12. Can the internal state remain auditable over thousands of interaction steps?

---

# 46. Implementation Order

**Do not implement everything simultaneously.**

Recommended sequence:

### Phase 0 — mathematical interfaces

Freeze data structures and function signatures for:

- CognitiveState
- ExperienceEvent
- MemoryItem
- Hypothesis
- WorldState
- CreditVector

### Phase 1 — minimal recurrent state

Implement:

\[
S_t\rightarrow a_t\rightarrow o_{t+1}\rightarrow S_{t+1}
\]

without sophisticated learning.

### Phase 2 — episodic memory

Add write/retrieve/reconsolidate.

### Phase 3 — world model

Add latent transition prediction.

### Phase 4 — meta-router

Add adaptive selection among retrieval/reasoning/search/action.

### Phase 5 — uncertainty-driven action

Add information gain and calibrated defer/search.

### Phase 6 — replay + consolidation

Add slow learning loop.

### Phase 7 — credit assignment

Implement and evaluate the flagship hypothesis.

### Phase 8 — causal/counterfactual model

Only after the simpler recurrent system is stable.

---

# 47. Data Structures — Canonical

Recommended logical schema:

```python
class CognitiveState:
    goal
    belief
    episodic_memory
    semantic_memory
    world_model
    executive_state
    policy
    uncertainty
    knowledge
    self_model

class ExperienceEvent:
    observation
    prior_state
    action
    prediction
    outcome
    reward
    prediction_error
    uncertainty
    evidence
    credit_vector
    timestamp

class CreditVector:
    memory
    world
    policy
    executive
    uncertainty
    schema
    self_model
```

These are conceptual interfaces, not a final language/API decision.

---

# 48. Design Principle — Memory Is Not a Database

The memory system is successful only when:

\[
Memory_{t+1}
\neq
Memory_t
\]

in ways that improve future behavior.

Useful memory should alter:

\[
P(Action_{future}\mid State_{future})
\]

and/or:

\[
P(World_{future}\mid State_{future},Action_{future})
\]

This is the key distinction between storage and learning.

---

# 49. Design Principle — Reasoning Is Not the Final Product

The system should not optimize for the longest or most verbose chain of thought.

The target is:

\[
\boxed{
Minimum\ computation\ needed\ for\ reliable\ long-horizon\ competence
}
\]

A better world representation may reduce the need for large search trees.

---

# 50. Design Principle — Error Is a Learning Opportunity

Every consequential mismatch should produce a structured event:

\[
Prediction
\rightarrow
Outcome
\rightarrow
Error
\rightarrow
Credit
\rightarrow
Update
\]

No learning module should silently update without a traceable reason.

---

# 51. Design Principle — Uncertainty Must Control Behavior

A system that says “I am 30% confident” but still takes the same action as if it were 99% confident is not metacognitively useful.

Therefore evaluate:

\[
Confidence
\rightarrow
Action\ Choice
\rightarrow
Outcome
\]

not confidence alone.

---

# 52. Design Principle — Biological Inspiration Is a Constraint Generator

Brain science should be used to generate computational hypotheses:

- rapid/slow learning;
- replay;
- compositional memory;
- executive control;
- inhibition;
- prediction error;
- value learning;
- internal simulation.

It should not be used to justify unsupported claims such as:

- “this module literally is the hippocampus”;
- “left brain = logic”;
- “right brain = creativity”;
- “the architecture has consciousness.”

---

# 53. Research Vocabulary

Preferred terms:

- cognitive state;
- persistent state;
- episodic experience;
- schema/consolidation;
- latent world model;
- meta-control;
- cross-module credit assignment;
- multi-timescale learning;
- consequence-driven learning;
- active information acquisition;
- long-horizon recovery;
- compositional transfer.

Avoid as scientific claims:

- “digital hippocampus” unless explicitly marked as metaphor;
- “AI consciousness”;
- “brain copy”;
- “human-like understanding” without operational definition.

---

# 54. Current Research Thesis

The current thesis can be summarized as:

\[
\boxed{
\text{LLM}
+
\text{persistent cognitive state}
+
\text{episodic memory}
+
\text{schema consolidation}
+
\text{latent world model}
+
\text{meta-control}
+
\text{action policy}
+
\text{replay}
+
\text{cross-module credit assignment}
}
\]

should produce a system with stronger:

\[
\boxed{
Long-Horizon Generalization
+
Recovery
+
Calibration
+
Continual Learning
+
Compositional Transfer
}
\]

than isolated components alone.

This is a hypothesis to test, not a conclusion.

---

# 55. Suggested Canonical Project Name

**CSLA — Cognitive State Learning Architecture**

Working internal term:

**CogBus — consequence-driven cognitive event bus**

Long-term research theme:

**From Token Prediction to Experience-Driven State Learning**

---

# 56. References / Research Anchors

The following are conceptual and primary literature anchors for further verification.

### Transformer

Vaswani et al., *Attention Is All You Need* (2017)

https://arxiv.org/abs/1706.03762

### Chain-of-Thought

Wei et al., *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models* (2022)

https://arxiv.org/abs/2201.11903

### Self-Consistency

Wang et al., *Self-Consistency Improves Chain of Thought Reasoning in Language Models* (2022)

https://arxiv.org/abs/2203.11171

### Tree of Thoughts

Yao et al., *Tree of Thoughts: Deliberate Problem Solving with Large Language Models* (2023)

https://arxiv.org/abs/2305.10601

### ReAct

Yao et al., *ReAct: Synergizing Reasoning and Acting in Language Models* (2022)

https://arxiv.org/abs/2210.03629

### RAT

*RAT: Retrieval Augmented Thoughts Elicit Context-Aware Reasoning in Long-Horizon Generation* (2024)

https://arxiv.org/abs/2403.05313

### Reflexion

Shinn et al., *Reflexion: Language Agents with Verbal Reinforcement Learning* (2023)

https://arxiv.org/abs/2303.11366

### STaR

Zelikman et al., *STaR: Bootstrapping Reasoning With Reasoning* (2022)

https://arxiv.org/abs/2203.14465

### DeepSeek-R1

DeepSeek-AI, *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning* (2025)

https://arxiv.org/abs/2501.12948

### I-JEPA

Assran et al., *Self-Supervised Learning from Images with a Joint-Embedding Predictive Architecture* (2023)

https://arxiv.org/abs/2301.08243

### V-JEPA 2

Meta AI, *V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning* (2025)

https://arxiv.org/abs/2506.09985

### Complementary Learning Systems

McClelland, McNaughton & O'Reilly, *Why There Are Complementary Learning Systems in the Hippocampus and Neocortex* (1995)

https://pubmed.ncbi.nlm.nih.gov/7584898/

### Neuroscience / language network

Nature Reviews Neuroscience review on the language network and its interaction with general knowledge systems (2024)

https://www.nature.com/articles/s41583-024-00802-4

### Schema / predictive learning

Nature Reviews Neuroscience work on schema, predictive error and reinforcement learning principles (2025)

https://www.nature.com/articles/s41583-024-00893-z

### Multi-timescale reinforcement learning in the brain

Nature (2025)

https://www.nature.com/articles/s41586-025-08929-9

### Hippocampal replay / compositional state structure

Nature Neuroscience (2025)

https://www.nature.com/articles/s41593-025-01908-3

### PFC / cognitive control

Nature Reviews Neuroscience review on PFC learning and cognitive control (2024)

https://www.nature.com/articles/s41583-024-00836-8

---

# 57. Current Status and Next Revision Gate

Current status:

\[
\boxed{
Theory\ Specification\ v1.0\ Draft
}
\]

Not yet frozen:

- exact tensor dimensions;
- exact neural-network parametrizations;
- exact memory indexing mechanism;
- exact credit estimator;
- exact consolidation learner;
- benchmark task generators;
- optimization algorithm;
- hardware/runtime architecture.

The next revision should freeze the **typed mathematical interface** for every state variable and operator.

Then produce:

1. a formal computational graph;
2. forward-pass pseudocode;
3. replay-pass pseudocode;
4. consolidation-pass pseudocode;
5. credit-assignment training objective;
6. benchmark protocol;
7. only then executable implementation.

---

# 58. One-Sentence Definition

> **CSLA is a recurrent cognitive architecture in which an LLM provides language computation, while persistent task state, episodic memory, schema consolidation, latent world prediction, meta-control, action selection, replay, and a learned cross-module credit signal jointly determine how experience changes future cognition.**

