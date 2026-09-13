# CSLA v1.2 — Complete Mathematical & Commercial Specification

**Status:** implementation-ready specification (research hypothesis, not neuroscience reproduction)  
**Role:** canonical source of truth for Codex and future implementations  
**Date:** 2026-08-28  
**Name:** Cognitive State Learning Architecture (CSLA)  

---

## 0. Executive Definition

CSLA is a modular cognitive architecture that wraps one or more LLMs with persistent state, episodic/semantic memory, latent world modeling, reasoning/search, executive control, metacognition, action/tool execution, causal credit assignment, replay, and multi-timescale consolidation.

The central research hypothesis is:

> Long-horizon agents improve when consequences of actions are converted into explicit, attributable learning events that selectively update different internal systems at different timescales.

The architecture is **not** a claim of consciousness, human-brain duplication, or biological equivalence.

The core distinction from a standard LLM application is:

\[
\boxed{\text{LLM: } y\sim p_\theta(y\mid x)}
\]

versus

\[
\boxed{\text{CSLA: } S_{t+1}=F_\Theta(S_t,a_t,o_{t+1})}
\]

with learning driven by consequences:

\[
\boxed{e_t\rightarrow\delta_t\rightarrow C_t\rightarrow\Delta\Theta\rightarrow S_{t+1}}
\]

---

# 1. Scientific Position

CSLA integrates ideas from:

- Transformer/LLM inference;
- Chain-of-Thought and structured reasoning;
- Tree/Graph search;
- retrieval-augmented reasoning;
- ReAct-style tool/environment interaction;
- reflection and verbal reinforcement;
- reward-trained reasoning;
- continual learning;
- complementary learning systems;
- hippocampal replay/consolidation hypotheses;
- latent predictive world models / JEPA-style prediction;
- model-based reinforcement learning;
- metacognitive uncertainty/calibration;
- active information acquisition;
- causal/counterfactual inference;
- global-workspace-inspired competition/broadcast.

CSLA does **not** claim any individual prior method is incorrect. Each is treated as a local operator inside a broader state-learning system.

---

# 2. Design Goal

The final product should allow an application developer to write:

```python
from csla import CognitiveAgent

agent = CognitiveAgent(
    llm="openai:gpt-5",
    memory="default",
    world_model="latent",
    tools=[...],
)

result = agent.run(task)
```

while keeping the internal architecture modular enough to swap:

- LLM providers;
- memory backends;
- world-model implementations;
- reasoning operators;
- policy/decision models;
- vector/graph stores;
- evaluators;
- deployment backends.

The product must support **local notebook/CLI → SDK → server → multi-tenant SaaS** without requiring a theoretical rewrite.

---

# 3. Canonical State Space

At time \(t\), define the cognitive state:

\[
\boxed{
S_t=(G_t,B_t,M^E_t,M^S_t,W_t,P_t,\Pi_t,U_t,K_t,Self_t,R_t)
}
\]

Where:

- \(G_t\): goal state;
- \(B_t\): belief state over world/task states;
- \(M^E_t\): episodic memory;
- \(M^S_t\): semantic/schema memory;
- \(W_t\): predictive world model;
- \(P_t\): executive/task working state;
- \(\Pi_t\): action/cognitive policy;
- \(U_t\): uncertainty/calibration state;
- \(K_t\): skills/tool knowledge;
- \(Self_t\): self-model of capabilities/reliability;
- \(R_t\): resource/compute/token/risk budget.

The state is recurrent. It is not reset between interactions unless the application explicitly requests a new session.

---

# 4. Environment Model

Use a POMDP abstraction:

\[
\mathcal E=(\mathcal S,\mathcal A,\mathcal O,T,O,R,\gamma)
\]

with:

\[
T(s'|s,a)=P(s'|s,a)
\]

\[
O(o|s)=P(o|s)
\]

The agent cannot generally observe \(s_t\). It maintains belief:

\[
B_t(s)=P(s_t=s\mid o_{1:t},a_{1:t-1})
\]

The belief is approximated by a learned or LLM-assisted state estimator.

---

# 5. External Observation Contract

Every environment/tool/input observation is normalized to:

```json
{
  "event_id": "uuid",
  "session_id": "uuid",
  "timestamp": "iso8601",
  "source": "user|tool|environment|memory|model",
  "content": {},
  "provenance": {},
  "reliability": 0.0,
  "cost": 0.0
}
```

The system MUST preserve provenance separately from semantic content.

---

# 6. Task Representation

The input is converted to a structured task model:

\[
\boxed{
\tau_t=(G,S,C,A,R,D,H)
}
\]

where:

- \(G\): goals;
- \(S\): current state estimate;
- \(C\): constraints;
- \(A\): action space;
- \(R\): resources;
- \(D\): domain;
- \(H\): horizon/time constraints.

Task encoder:

\[
\tau_t=E_{task}(H^{LLM}_t,M_t,P_t)
\]

The task representation is versioned and auditable.

---

# 7. Meta-Cognitive Strategy Selection

Before heavy reasoning, the controller selects cognitive operators:

\[
q_t(m)=P(m\mid\tau_t,S_t)
\]

where

\[
m\in\{retrieve,deduce,analogize,search,simulate,act,verify,reflect,ask,stop\}
\]

with:

\[
q_t=softmax(f_\psi(\tau_t,S_t))
\]

This is the formal counterpart of recognizing "what kind of problem is this?" and selecting an appropriate thinking mode.

---

# 8. Global Cognitive Workspace

Candidate information units are scored by:

\[
Salience_i = f_{sal}(GoalRel_i,Novelty_i,Uncertainty_i,Risk_i,Cost_i,SourceRel_i)
\]

and normalized:

\[
\alpha_i=softmax(Salience_i)
\]

Workspace:

\[
\boxed{C_t=\sum_i\alpha_i x_i}
\]

Workspace membership MUST be explicit and observable for debugging.

This is a cognitive-level attention mechanism and is not a replacement for transformer self-attention.

---

# 9. Language Backbone Interface

All LLM providers implement:

```python
class LLMProvider(Protocol):
    async def generate(
        self,
        *,
        messages: list[Message],
        tools: list[ToolSpec] | None,
        response_schema: dict | None,
        model: str,
        temperature: float | None,
        max_output_tokens: int | None,
        metadata: dict | None,
    ) -> LLMResponse: ...
```

Required properties:

- structured-output support where provider supports it;
- tool/function calling;
- streaming;
- retries/timeouts;
- usage accounting;
- provider-neutral response normalization;
- provenance metadata.

The system MUST NOT depend on one provider's proprietary message schema internally.

Current OpenAI APIs expose Responses-style model calls, tool use, file search, web search, function calling, and remote MCP connections; Google Gemini exposes function calling for external tools/APIs. These provider capabilities should be adapted behind the common interface rather than hard-coded into CSLA. citeturn117578search14turn117578search10

---

# 10. Tool / MCP Interface

Tools follow a normalized contract:

```python
class Tool:
    name: str
    description: str
    input_schema: JSONSchema
    output_schema: JSONSchema
    risk_level: str
    cost: float
    side_effects: str

    async def execute(self, arguments: dict, ctx: ToolContext) -> ToolResult: ...
```

MCP should be the preferred interoperability layer when appropriate because it standardizes tools, resources, prompts, capability negotiation, and stateful JSON-RPC interaction. The architecture MUST retain a native adapter interface so non-MCP tools remain supported. citeturn117578search3turn117578search9

High-risk actions MUST support human approval or policy-based authorization.

---

# 11. Episodic Memory

Memory record:

\[
e_t=(S_t,a_t,\hat z_{t+1},z_{t+1},r_t,\delta_t,u_t,p_t,c_t)
\]

Recommended implementation schema:

```json
{
  "id": "uuid",
  "task_id": "uuid",
  "timestamp": "iso8601",
  "state_ref": "...",
  "goal_ref": "...",
  "observation": {},
  "action": {},
  "prediction": {},
  "outcome": {},
  "prediction_error": 0.0,
  "reward_error": 0.0,
  "uncertainty": 0.0,
  "credit": {},
  "provenance": {},
  "importance": 0.0,
  "retention": 0.0
}
```

---

# 12. Memory Retrieval

Memory score:

\[
Score(e_i|q)=
\alpha R_i+
\beta G_i+
\gamma C_i+
\delta IG_i+
\epsilon N_i+
\zeta P_i
\]

where:

- \(R_i\): semantic relevance;
- \(G_i\): goal relevance;
- \(C_i\): causal relevance;
- \(IG_i\): expected uncertainty reduction;
- \(N_i\): novelty;
- \(P_i\): provenance/reliability.

Retrieval distribution:

\[
P(e_i|q)=softmax(Score_i)
\]

Retrieval MUST be separated from consolidation.

---

# 13. Memory Write Gate

\[
w_t=\sigma(
\theta_1|\delta_t|
+\theta_2IG_t
+\theta_3GoalRel_t
+\theta_4Novelty_t
+\theta_5Credit_t
-\theta_6Cost_t
)
\]

Write to episodic memory if:

\[
w_t>\tau_{write}
\]

Otherwise keep the event only in short-lived execution logs.

---

# 14. Schema/Semantic Consolidation

Episodes \(E\) are clustered/composed into a schema \(k\):

\[
k^*=argmin_k\left[
E_{e\sim E}D(e,k)+\lambda Complexity(k)
\right]
\]

Consolidation priority:

\[
V(e)=
\alpha|\delta_e|
+\beta IG_e
+\gamma GoalRel_e
+\delta Credit_e
+\epsilon Novelty_e
\]

Consolidate when:

\[
V(e)>\tau_{consolidate}
\]

Schemas MUST retain evidence links to supporting episodes. This prevents semantic memories from becoming unauditable unsupported claims.

---

# 15. Reconsolidation

When a memory/schema is retrieved and new evidence arrives:

\[
m_i' = U_M(m_i,D_{new},\delta_t,C_t)
\]

The system MUST version changes:

```text
memory_v1 -> memory_v2 -> memory_v3
```

and retain provenance of the evidence causing the change.

---

# 16. Latent World Model

Encode observations:

\[
z_t=E_W(o_t,M_t,G_t)
\]

Predict future state:

\[
\boxed{\hat z_{t+1}=W_\theta(z_t,a_t)}
\]

or probabilistically:

\[
p_W(z_{t+1}|z_t,a_t)
\]

World-model loss:

\[
L_W=D(z_{t+1},\hat z_{t+1})
\]

The world model should predict task-relevant state, not necessarily pixels or full natural-language transcripts.

---

# 17. Causal / Counterfactual World Model

Where sufficient structure exists, maintain causal graph:

\[
\mathcal G_c=(V,E,P)
\]

with structural equations:

\[
X_i=f_i(Pa_i,U_i)
\]

Counterfactual query:

\[
P(Y|do(X=x'))
\]

Used for planning, diagnosis and explanation—not as a blanket requirement for every task.

---

# 18. Reasoning Operator Layer

The reasoning engine exposes operators:

```text
CoT             -> sequential thought expansion
SelfConsistency -> multi-path sampling + aggregation
ToT             -> tree search
GoT             -> graph search/recombination
RAT             -> retrieve -> revise
ReAct           -> reason -> act -> observe
Reflexion       -> outcome -> reflection -> memory
Verifier        -> claim/check pair
Counterexample  -> actively seek falsification evidence
```

All operators consume and update the same normalized cognitive state.

Operator selection is governed by \(q_t(m)\), subject to budget and safety constraints.

---

# 19. Planning

Candidate plan:

\[
\pi=(a_t,a_{t+1},...,a_{t+H})
\]

Rollout:

\[
\hat z_{k+1}=W(\hat z_k,a_k)
\]

Planning value:

\[
V(\pi)=E\left[\sum_{k=0}^{H}\gamma^kR(\hat z_k,a_k)\right]
\]

Add information gain and execution cost:

\[
\boxed{
V_{total}(\pi)=V(\pi)+\lambda_IIG(\pi)-\lambda_CC(\pi)-\lambda_RRisk(\pi)
}
\]

Select:

\[
\pi^*=argmax_\pi V_{total}(\pi)
\]

Planning depth is dynamic, controlled by uncertainty, task complexity, and remaining budget.

---

# 20. Metacognition

Predictive entropy:

\[
U_t=H[P(Y|S_t)]
\]

Calibration function:

\[
c_t=f_C(U_t,history,risk)
\]

Action routing:

\[
A_t=
\begin{cases}
answer,& c_t>\tau_1\\
retrieve,&\tau_2<c_t\le\tau_1\\
verify,&\tau_3<c_t\le\tau_2\\
ask/search,&c_t\le\tau_3
\end{cases}
\]

The system MUST log predicted confidence and realized correctness/outcome.

---

# 21. Active Information Acquisition

For information-gathering action \(a\):

\[
IG(a)=H[B_t]-E_oH[B_{t+1}|o,a]
\]

Information utility:

\[
U_{info}(a)=IG(a)-\lambda Cost(a)-\rho Risk(a)
\]

Search/ask/inspect/experiment actions compete with ordinary task actions under the same decision policy.

---

# 22. Action Policy

\[
\boxed{
a_t\sim\Pi_\theta(a|S_t)
}
\]

Value:

\[
Q(S_t,a)=E[R_{task}+\lambda_IG-\beta Cost-\rho Risk]
\]

Select action by:

\[
a^*=argmax_aQ(S_t,a)
\]

---

# 23. Prediction and Reward Error

World prediction error:

\[
\delta_t^W=D(z_{t+1},\hat z_{t+1})
\]

Reward prediction error:

\[
\delta_t^R=r_t+\gamma V(S_{t+1})-V(S_t)
\]

Composite consequence error:

\[
\boxed{
\delta_t=\lambda_W\delta_t^W+\lambda_R\delta_t^R
}
\]

Error decomposition:

\[
E_t=(E^{data},E^{model},E^{reason},E^{memory},E^{policy},E^{execution},E^{noise})
\]

with:

\[
E_t=A_\omega(S_t,e_t)
\]

The estimated noise component should not be aggressively learned from.

---

# 24. Cross-Module Credit Assignment

Modules:

\[
\mathcal M=\{M,W,\Pi,P,U,K\}
\]

For module \(i\) at time \(t\) and evidence/memory item \(e\), define counterfactual credit:

\[
\boxed{
C_{i,t,e}
\approx
L_{future}(do(i,t,e=baseline))-L_{future}(real)
}
\]

Interpretation:

- positive: removing/replacing the component makes future performance worse → useful contribution;
- negative: removing/replacing it improves performance → harmful contribution;
- near zero: low marginal contribution.

Exact Shapley-style contribution may be used on small systems:

\[
\phi_i=
\sum_{S\subseteq N\setminus\{i\}}
\frac{|S|!(n-|S|-1)!}{n!}
[v(S\cup\{i\})-v(S)]
\]

but approximate sampling is required in production.

---

# 25. Learned Credit Estimator

Because exhaustive counterfactual evaluation is expensive, learn:

\[
\boxed{
\hat C_t=C_\psi(S_t,e_t,\delta_t,U_t,G_t)
}
\]

Supervision comes from selectively computed counterfactual targets:

\[
L_C=||\hat C_t-C_t^{CF}||^2
\]

or a calibrated ranking/listwise loss.

The estimator MUST report confidence over its credit prediction.

---

# 26. Selective Counterfactual Intervention

Credit uncertainty:

\[
H_C=Entropy(\hat C_t)
\]

If:

\[
H_C<\tau_C
\]

use the learned estimator.

Otherwise execute selected interventions:

\[
C_t=C_t^{CF}
\]

This produces:

\[
\boxed{
cheap\ online\ credit + expensive\ selective\ diagnosis
}
\]

---

# 27. Credit Propagation Over Time

For dependency graph:

\[
G_t=(V,E)
\]

credit flows backward through relevant dependencies.

For node \(i,t\):

\[
C_{i,t}=\sum_{j>t}K_{ij,tj}\,C_{j}
\]

where \(K\) is a learned or estimated temporal influence kernel, normalized for stability.

The system MUST distinguish:

- immediate action error;
- delayed consequence;
- memory-induced error;
- world-model-induced error;
- policy-induced error.

---

# 28. Unified Module Update

For module \(i\):

\[
\boxed{
\theta_i^{t+1}
=
\theta_i^t
-
\eta_i\,g(C_{i,t})\nabla_{\theta_i}\mathcal J_t
}
\]

where \(g\) clips/stabilizes credit.

Recommended:

\[
\tilde C_{i,t}=clip(norm(C_{i,t}),-c_{max},c_{max})
\]

and:

\[
\eta_M>\eta_W>\eta_K>\eta_\Pi
\]

as a default hierarchy, subject to task-specific tuning.

---

# 29. Multi-Timescale Learning

Use at least four timescales:

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

The time constants are learned/configurable, not hard-coded to biological times.

---

# 30. Replay

Replay buffer:

\[
\mathcal R=\{e_1,...,e_N\}
\]

Priority:

\[
priority(e)=
\alpha|\delta_e|
+\beta IG_e
+\gamma|C_e|
+\delta GoalRel_e
+\epsilon Novelty_e
\]

Sample:

\[
P(e)\propto priority(e)^\kappa
\]

Replay performs offline model/policy/schema improvement rather than mere retrieval.

---

# 31. Consolidation and Forgetting

The system must learn both what to remember and what to forget.

Retention score:

\[
r(e)=f(C_e,FutureUse(e),Reliability(e),Novelty(e),Age(e))
\]

Low-value memories may be compressed, merged, archived, or deleted according to policy.

Forgetting MUST be auditable. Deletion should record a tombstone and reason category when operating in commercial audit mode.

---

# 32. Self Model

\[
Self_t=(Capabilities,Limits,FailureModes,ToolReliability,Calibration)
\]

Update:

\[
Self_{t+1}=U_S(Self_t,e_t,C_t)
\]

Example:

if finance predictions are repeatedly overconfident:

\[
Reliability_{finance}\downarrow
\]

which causes:

\[
Verify/Search\uparrow
\]

Self-knowledge therefore changes future meta-control.

---

# 33. Full Cognitive Loop

The canonical loop is:

\[
\boxed{
O_t
\rightarrow
\tau_t
\rightarrow
q_t
\rightarrow
C_t^{workspace}
\rightarrow
M_t/W_t/Reasoning
\rightarrow
Plan
\rightarrow
Action
\rightarrow
O_{t+1}
\rightarrow
Prediction\ Error
\rightarrow
Credit
\rightarrow
Selective\ Update
\rightarrow
Replay
\rightarrow
Consolidation
\rightarrow
S_{t+1}
}
\]

This is the primary executable semantics of CSLA.

---

# 34. Full Objective

The total training objective is:

\[
\boxed{
\mathcal J=
\lambda_TL_{task}
+\lambda_WL_W
+\lambda_ML_M
+\lambda_CL_C
+\lambda_UL_U
+\lambda_AL_A
+\lambda_FL_F
+\lambda_KL_K
+\lambda_BL_B
}
\]

where:

- \(L_{task}\): task outcome;
- \(L_W\): world prediction;
- \(L_M\): memory quality/retrieval/consolidation;
- \(L_C\): credit estimation;
- \(L_U\): calibration/metacognition;
- \(L_A\): action/policy;
- \(L_F\): forgetting/retention balance;
- \(L_K\): knowledge/schema consistency;
- \(L_B\): budget/cost/risk.

Expected free energy may be included at decision time:

\[
G(\pi)=Risk+Ambiguity-IG
\]

and should not be treated as the only training objective.

---

# 35. Stability Constraints

All learned updates MUST obey:

1. bounded credit;
2. bounded state norms;
3. replay sampling cap;
4. memory write cap;
5. tool-call budget;
6. maximum reasoning depth;
7. maximum counterfactual interventions per trajectory;
8. uncertainty floor for out-of-distribution states.

Recommended generic constraints:

\[
||C_t||_\infty\le c_{max}
\]

\[
||\Delta S_t||\le s_{max}
\]

\[
N_{CF}(episode)\le N_{CF}^{max}
\]

---

# 36. Training Modes

CSLA supports three modes.

## Mode A — Inference-only

No persistent parameter updates. Memory and state may still update.

## Mode B — Online adaptive memory

Update episodic memory, schemas, calibration, and lightweight adapters; freeze base LLM.

## Mode C — Full continual learning

Train selected adapters/world-model/policy components, preserving replay and forgetting controls.

Default production mode:

\[
\boxed{
\text{Freeze base LLM + learn small modules/adapters + persistent memory}
}
\]

---

# 37. Provider-Neutral LLM Adapter Architecture

Canonical interface:

```text
                    CSLA Core
                       |
                LLMProvider API
                       |
        +--------------+---------------+
        |              |               |
     OpenAI         Anthropic        Gemini
        |              |               |
     Responses       Messages       GenerateContent
```

The provider adapter returns a shared structure:

```python
@dataclass
class LLMResponse:
    content: str | list[ContentPart]
    tool_calls: list[ToolCall]
    structured: dict | None
    usage: Usage
    finish_reason: str | None
    provider_metadata: dict
```

No core module may inspect provider-specific raw response fields.

---

# 38. SDK Surface

Recommended public API:

```python
agent = CognitiveAgent(config)

result = await agent.run(
    task="...",
    context={...},
    budget={...},
)

await agent.learn(feedback)

memories = await agent.memory.search(...)

diag = await agent.inspect(run_id)
```

Optional lower-level APIs:

```python
agent.observe(event)
agent.plan()
agent.act(action)
agent.reflect(outcome)
agent.replay()
agent.consolidate()
```

These are debugging/research interfaces, not the primary end-user API.

---

# 39. Event Bus API

Canonical event:

```json
{
  "event_type": "cognitive.experience",
  "event_id": "uuid",
  "session_id": "uuid",
  "step": 17,
  "state_version": "s_17",
  "goal": {},
  "observation": {},
  "action": {},
  "prediction": {},
  "outcome": {},
  "error": {},
  "uncertainty": {},
  "credit": {},
  "provenance": {},
  "cost": {}
}
```

The event bus can initially be in-process; production may use Kafka/NATS/Redis Streams or a managed equivalent.

The bus is conceptually the **CogBus learning event stream**.

---

# 40. Durable Execution

Long-running agents require resumability.

The execution layer MUST support:

- checkpointing;
- retries;
- idempotent tool actions;
- resumable workflows;
- timeouts;
- compensation/rollback where supported.

Temporal is one suitable infrastructure option because it provides durable execution and recovery from failures over long-running workflows. It is an implementation option, not a theoretical dependency. citeturn117578search13

---

# 41. Observability

Every run should record:

```text
run_id
session_id
state_version
operator_sequence
tool_calls
retrieved_memories
world_predictions
outcomes
errors
credit_estimates
counterfactuals
consolidation_events
cost/tokens/latency
final_result
```

Use OpenTelemetry-compatible tracing where practical.

The minimum production observability requirement is that a final decision can be traced back to:

\[
Decision
\rightarrow
State
\rightarrow
Memory/Evidence
\rightarrow
Reasoning operator
\rightarrow
Tool action
\rightarrow
Outcome
\rightarrow
Credit
\]

---

# 42. Security and Trust

The architecture MUST separate:

- data provenance;
- model output;
- user permissions;
- tool authorization;
- sensitive data;
- tenant boundaries;
- memory scope.

Memory MUST be namespaced at minimum by:

```text
organization / user / application / agent / session
```

Tools MUST declare side effects and risk levels.

MCP guidance emphasizes explicit user control, consent, authorization, and security around context/tool access; commercial deployments should follow those principles. citeturn117578search3turn117578search9

---

# 43. Commercial Tenant Model

Recommended hierarchy:

```text
Organization
  └── Project
      └── Agent
          ├── Policy
          ├── Memory namespace
          ├── Tools
          ├── LLM configuration
          └── Evaluation profile
```

Every stored state/event must carry a tenant scope.

Cross-tenant retrieval is forbidden by default.

---

# 44. Deployment Layers

## Layer 1 — Research SDK

Single machine.

- Python package;
- SQLite/Postgres;
- local vector index;
- optional graph store;
- one LLM provider.

## Layer 2 — Team Server

- API server;
- Postgres;
- vector search;
- object store;
- background workers;
- observability.

## Layer 3 — SaaS

- multi-tenant API;
- billing/quotas;
- organization/user permissions;
- encrypted memory;
- audit logs;
- managed tool/MCP registry;
- model-routing and budget policies.

---

# 45. Commercial API

Suggested REST endpoints:

```text
POST   /v1/agents
GET    /v1/agents/:id
POST   /v1/agents/:id/runs
GET    /v1/runs/:id
GET    /v1/runs/:id/trace
POST   /v1/agents/:id/feedback
POST   /v1/agents/:id/replay
POST   /v1/agents/:id/consolidate
GET    /v1/agents/:id/memory/search
POST   /v1/tools
GET    /v1/tools
```

Streaming endpoint:

```text
GET /v1/runs/:id/events
```

All APIs are versioned.

---

# 46. Billing Model

Do not bill only on raw token count.

Recommended dimensions:

\[
Price=
Base
+\alpha Tokens
+\beta ToolCalls
+\gamma MemoryOps
+\delta WorldRollouts
+\epsilon CFInterventions
\]

Research/enterprise plans may additionally bill for:

- retained memory;
- audit storage;
- dedicated workers;
- custom evaluators;
- private deployment.

---

# 47. Product Wedge

The initial commercial product should NOT claim "general intelligence".

Best first positioning:

> **A long-horizon AI execution layer that learns from outcomes and maintains auditable task memory.**

Potential verticals:

- software engineering agents;
- research assistants;
- operations workflows;
- customer-support operations;
- internal knowledge agents;
- compliance/document workflows;
- industrial/robotic planning when sufficiently safe.

The first product should be measured on:

\[
\text{completion rate} +\text{recovery rate}+\text{auditability}-\text{cost}
\]

not on claims of consciousness or human equivalence.

---

# 48. Benchmark Suite

Every version must be evaluated against baselines.

## B1 — Long-Horizon Completion

Measure task completion over increasing horizon \(H\).

## B2 — Recovery

Inject failures and measure successful recovery without reset.

\[
RecoveryRate=\frac{recovered\ runs}{failed\ runs}
\]

## B3 — Continual Learning

Sequence tasks \(T_1,...,T_n\), measure new-task learning and old-task retention.

\[
CL=NewAccuracy-ForgettingPenalty
\]

## B4 — Calibration-to-Action

Measure whether low confidence causes useful verification/search/asking.

## B5 — Compositional Generalization

Train on primitives/compositions A+B and test unseen A+C/B+D combinations.

## B6 — Counterfactual Credit

Compare terminal-only reward against CSLA credit assignment.

## B7 — Memory Efficiency

Task performance per stored memory token/event.

## B8 — Cost Efficiency

Task quality per dollar/token/tool call.

## B9 — Auditability

Fraction of final claims/actions traceable to evidence and state transitions.

---

# 49. Required Baselines

Minimum:

1. LLM-only;
2. LLM + RAG;
3. LLM + CoT;
4. LLM + ReAct;
5. LLM + memory/reflection;
6. reasoning-search baseline;
7. CSLA minus credit;
8. CSLA minus consolidation;
9. CSLA minus world model;
10. full CSLA.

Every paper or commercial claim MUST report ablations.

---

# 50. Core Scientific Experiments

### E1 — Credit Assignment

Hypothesis:

\[
H_1: Causal/temporal/module credit > terminal-only reward
\]

### E2 — Credit-weighted Consolidation

\[
H_2: Consolidation weighted by future contribution > novelty/error-only consolidation
\]

### E3 — Selective Counterfactuals

\[
H_3: Learned credit + selective intervention approximates exhaustive diagnosis at lower cost
\]

### E4 — World Model

\[
H_4: Latent predictive world model improves long-horizon planning/generalization
\]

### E5 — Meta-control

\[
H_5: Uncertainty-driven information acquisition improves accuracy/cost frontier
\]

### E6 — Full System

\[
H_6: Full CSLA outperforms strongest matched modular baseline under equal compute budget
\]

---

# 51. Failure Modes We Must Explicitly Test

1. memory pollution;
2. false consolidation;
3. self-reinforcing wrong schemas;
4. overconfident world models;
5. credit collapse to one module;
6. credit oscillation;
7. counterfactual explosion;
8. excessive retrieval/search;
9. reasoning loops;
10. reward hacking;
11. tool side-effect errors;
12. stale memories;
13. tenant leakage;
14. cost blow-up;
15. long-horizon state drift.

---

# 52. Anti-Drift Invariants

The implementation MUST preserve these invariants:

### I1 — Provenance invariant

Every durable belief/schema has evidence references.

### I2 — State-version invariant

Every state-changing event increments a version.

### I3 — Separation invariant

Retrieval is not consolidation; reflection is not world-model update; action reward is not proof.

### I4 — Credit invariant

No module update may occur without a recorded credit/confidence reason in adaptive-learning mode.

### I5 — Budget invariant

Every run has bounded compute/tool/search/reasoning budget.

### I6 — Tenant invariant

Memory retrieval cannot cross tenant scope without explicit authorization.

---

# 53. Minimum Viable Cognitive Agent (MVCA)

The first implementable version should contain only:

\[
\boxed{
LLM + TaskState + EpisodicMemory +\nWorldPrediction + ToolUse + OutcomeLog + CreditEstimator + Replay
}
\]

No parameter fine-tuning is required initially.

MVP loop:

```text
input
  ↓
task parser
  ↓
memory retrieve
  ↓
LLM reasoning
  ↓
optional tool/action
  ↓
outcome
  ↓
world prediction error
  ↓
credit estimator
  ↓
write/replay memory
  ↓
next task
```

This is the smallest system that tests the central hypothesis without requiring the full research stack.

---

# 54. Production Architecture

```text
                         Client / SDK / UI
                                |
                           API Gateway
                                |
                     +----------+----------+
                     |   Cognitive Runtime |
                     +----------+----------+
                                |
        +-----------------------+-----------------------+
        |                       |                       |
   Task/Control            Cognitive Workspace      Policy/Meta
        |                       |                       |
        +------------+----------+----------+------------+
                     |                     |
                  Memory                World Model
               Episodic/Schema        latent/causal
                     |                     |
                     +----------+----------+
                                |
                          Reasoning Engine
                    CoT / ToT / GoT / RAT / ReAct
                                |
                             Tool Bus
                         MCP / HTTP / APIs
                                |
                           Environment
                                |
                            Observation
                                |
                         Outcome Ledger
                                |
                         Error + Credit
                                |
                   Replay / Consolidation Workers
                                |
                        Persistent State Store
```

---

# 55. Storage Recommendation

Start with:

- PostgreSQL for durable structured state/events;
- pgvector or an equivalent vector index for semantic retrieval;
- object storage for large artifacts;
- optional graph database only when relational/graph queries justify it;
- Redis or equivalent cache for hot state.

Avoid introducing a graph database solely because the theory mentions graphs.

---

# 56. API Security

Minimum:

- API keys/OAuth;
- per-tenant encryption boundaries;
- role-based access control;
- tool allowlists;
- action approval policies;
- rate limits;
- quota enforcement;
- audit logs;
- secret isolation;
- prompt/tool injection defenses.

---

# 57. Model Routing

The meta-controller may select different LLMs:

\[
P(model|task,state,budget)
\]

Routing objective:

\[
U(model)=Quality-\lambda Cost-\rho Latency
\]

This enables:

- cheap model for parsing;
- medium model for routine reasoning;
- strong model for difficult reasoning;
- verifier model for high-risk decisions.

Provider adapters make this transparent to the core architecture.

---

# 58. Research/Production Separation

The codebase must distinguish:

```text
research/
production/
experiments/
```

Research modules may expose experimental equations.

Production modules MUST have stable interfaces and bounded behavior.

A new research mechanism should enter production only after:

1. benchmark validation;
2. regression tests;
3. resource/cost evaluation;
4. security review;
5. provenance/audit validation.

---

# 59. Mathematical Closure Condition

CSLA is considered mathematically "closed" for implementation when every state transition can be expressed as:

\[
S_{t+1}=F_\Theta(S_t,a_t,o_{t+1})
\]

and every persistent update can be expressed as:

\[
\Theta_{t+1}=U_\Theta(\Theta_t,e_t,C_t)
\]

with:

\[
e_t=(S_t,a_t,\hat o_{t+1},o_{t+1},r_t)
\]

and:

\[
C_t=C_\psi(e_t,S_t,G_t,U_t)
\]

plus optional counterfactual correction:

\[
C_t\leftarrow C_t^{CF}
\]

when estimator uncertainty exceeds threshold.

Under this specification, no module is allowed to change persistent state through an undocumented side channel.

---

# 60. Implementation Order

## Phase 0 — Contracts

Freeze dataclasses/protocols.

## Phase 1 — Runtime

Implement state machine + event ledger.

## Phase 2 — LLM adapters

Implement provider-neutral LLM API.

## Phase 3 — Memory

Episodic + retrieval + provenance.

## Phase 4 — Tool/MCP

Action execution + observation.

## Phase 5 — World model

Start with a lightweight latent predictor.

## Phase 6 — Credit

Implement intervention-based teacher, then learned estimator.

## Phase 7 — Replay/consolidation

Offline learning loop.

## Phase 8 — Meta-control

Uncertainty → information/action routing.

## Phase 9 — Benchmark

Run matched baselines and ablations.

## Phase 10 — Service

Auth, multi-tenancy, quotas, observability, deployment.

---

# 61. Codex Rules

Codex MUST:

1. read this specification before modifying architecture;
2. never silently invent missing semantics;
3. preserve interfaces when replacing an implementation;
4. write tests for every state-changing operator;
5. record all benchmark runs deterministically where possible;
6. keep research experiments reproducible;
7. never expose secrets in traces;
8. never assume an LLM call is deterministic;
9. never treat generated text as ground-truth evidence;
10. never enable real-world high-risk actions by default;
11. keep a changelog entry for mathematical changes;
12. update this specification whenever a core equation changes.

---

# 62. Definition of Done

CSLA v1.x implementation is considered complete enough for a commercial beta when:

- provider-neutral LLM adapters work;
- tool/MCP interfaces work;
- durable state works;
- episodic memory is persistent and tenant-scoped;
- task state is versioned;
- prediction/outcome events are logged;
- learned/teacher credit pipeline works;
- replay/consolidation works;
- uncertainty controls information acquisition;
- long-horizon recovery benchmark passes a predefined target;
- audit trace is complete;
- cost/latency are bounded;
- security controls are in place;
- baseline/ablation reports exist.

Scientific completion is a separate question: it requires evidence that the proposed mechanisms causally improve performance under controlled experiments.

---

# 63. Current Research Boundary

The following are hypotheses, not established facts:

- exact mapping from biological brain regions to software modules;
- superiority of a single unified objective;
- superiority of counterfactual credit over all other learning signals;
- adequacy of latent world prediction for arbitrary cognition;
- emergence of human-like understanding;
- any claim of consciousness.

The project should be judged by experiments, not architecture aesthetics.

---

# 64. North Star

The permanent North Star is:

\[
\boxed{
\textbf{From token prediction to experience-driven cognitive state learning.}
}
\]

Operationally:

\[
\boxed{
Experience
\rightarrow
Prediction
\rightarrow
Action
\rightarrow
Outcome
\rightarrow
Causal\ Credit
\rightarrow
Selective\ Learning
\rightarrow
Consolidation
\rightarrow
Better\ Future\ Decisions
}
\]

The system succeeds when it can demonstrate that this loop produces measurable gains in long-horizon completion, recovery, calibration, transfer, continual learning, auditability, and cost efficiency under controlled comparison.

---

# 65. Primary Sources / Interoperability References

- Transformer: Vaswani et al., *Attention Is All You Need*.
- CoT: Wei et al., *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models*.
- Self-Consistency: Wang et al.
- ToT: Yao et al.
- GoT: Besta et al.
- ReAct: Yao et al.
- RAT: *Retrieval Augmented Thoughts*
- Reflexion: Shinn et al.
- STaR: Zelikman et al.
- DeepSeek-R1: reasoning via reinforcement learning.
- JEPA / I-JEPA / V-JEPA family.
- Complementary Learning Systems: McClelland, McNaughton, O'Reilly.
- Hippocampal replay / schema / planning literature.
- Model Context Protocol specification: standardized resources, prompts, tools and capability negotiation. citeturn117578search3turn117578search11
- OpenAI Responses API: model calls and tool interfaces. citeturn117578search14
- Google Gemini function calling: tool/API integration. citeturn117578search10
- Temporal durable execution: implementation option for resumable long-running agents. citeturn117578search13

---

# 66. Versioning Policy

Version meanings:

- **patch**: wording, typo, non-semantic clarification;
- **minor**: new module or equation that preserves existing interfaces;
- **major**: change to canonical state semantics, core objective, or event schema.

Every release records:

```text
version
changed equations
changed interfaces
changed experiments
compatibility notes
```

**Current canonical version: CSLA v1.2.0**


---

# 67. Companion Engineering Contracts

The canonical mathematical specification is complemented by:

- `CSLA_API_CONTRACT.yaml` — provider-neutral commercial API contract;
- `AGENTS_CSLA.md` — Codex engineering rules;
- `CSLA_ARCHITECTURE_DECISIONS.md` — decisions that prevent accidental architectural drift;
- `README_CSLA.md` — repository-level orientation.

The API contract is intentionally implementation-facing. It MUST NOT redefine the mathematical semantics in this document.

---

# 68. Implementation Readiness Statement

CSLA v1.2 is **closed enough for implementation** in the following precise sense:

1. canonical persistent state is defined;
2. external observations and outcomes have normalized event contracts;
3. the LLM, tool, memory, world-model, policy and runtime boundaries are defined;
4. the forward recurrent loop is defined;
5. learning, replay, consolidation and credit loops are defined;
6. cost, risk, provenance and audit constraints are defined;
7. provider-neutral API contracts are defined;
8. benchmark/ablation criteria are defined;
9. unresolved items are research parameters rather than missing interfaces.

This does **not** mean that the architecture is scientifically validated. Validation begins with implementation and controlled experiments.
