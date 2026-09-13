# CSLA Architecture Decision Record (ADR) — v1.2

## ADR-001 — Base LLM remains replaceable

**Decision:** The foundation model is an adapter, not the architecture itself.

**Reason:** The cognitive contribution of CSLA must be measurable independently of which LLM is used.

**Consequence:** OpenAI, Anthropic, Gemini and other providers can be swapped behind `LLMProvider`.

## ADR-002 — Persistent state is first-class

**Decision:** Every run operates over a versioned cognitive state `S_t`.

**Reason:** Long-horizon learning cannot be represented only as current prompt context.

## ADR-003 — Retrieval and learning are separate

**Decision:** `retrieve()` never implies `consolidate()`.

**Reason:** Accessing a memory and changing future behavior are distinct computations.

## ADR-004 — Consequences create learning events

**Decision:** A completed action generates an experience event containing prediction, outcome, error, uncertainty, provenance and credit.

**Reason:** The project hypothesis is about experience-driven state learning.

## ADR-005 — Credit must be causal/contrastive where possible

**Decision:** Production uses learned credit estimation; training/research generates counterfactual labels selectively.

**Reason:** Exhaustive intervention is too expensive, while terminal reward alone is too coarse.

## ADR-006 — Consolidation is evidence-linked

**Decision:** Every semantic/schema memory retains links to supporting episodic evidence.

**Reason:** Prevent unsupported self-reinforcing beliefs.

## ADR-007 — World model predicts latent task-relevant state

**Decision:** Start with latent state prediction, not pixel generation or full transcript simulation.

**Reason:** This minimizes computation and focuses prediction on decision-relevant structure.

## ADR-008 — Human approval gates high-risk tools

**Decision:** Tool specifications declare risk and side effects; critical actions require explicit approval or a pre-authorized policy.

**Reason:** Commercial systems require controlled actuation and auditable authorization.

## ADR-009 — Provider-neutral interoperability

**Decision:** Support direct HTTP/provider adapters plus MCP adapters.

**Reason:** MCP provides a standardized tool/resource integration surface while preserving compatibility with existing APIs. The MCP specification defines standardized tools, resources, prompts, stateful JSON-RPC interactions and capability negotiation.

## ADR-010 — Research and production are separate tracks

**Decision:** Experimental equations can live in research modules, but production interfaces remain stable.

**Reason:** A research architecture must evolve without making the commercial API unstable.

## ADR-011 — No claim of human equivalence

**Decision:** CSLA is described as a computational architecture inspired by cognitive science, not as a copy of the human brain.

## ADR-012 — Success is empirical

**Decision:** A proposed mechanism is considered successful only if it improves controlled benchmarks or cost/reliability frontiers relative to matched baselines.

---

# Audit Addendum v2.0（2026-08-29 · Enterprise Architecture Audit 派生）

> 以下决策由全仓库架构审计（`reports/CSLA_ARCHITECTURE_AUDIT.md`）得出，追加记录，不覆盖 v1.2 历史。

## ADR-013 — Single Cognitive State Kernel

**Decision:** `protocol/csl-state.json` 是唯一版本化认知内核；`protocol/state.json` 降为应用视图/兼容层；
所有状态变更必须经 `StateDelta + Event → Commit`，禁止整文件覆盖与模块间互改。
**Reason:** 审计发现双状态源（State Inventory）导致 Cognitive Theater 与漂移。

## ADR-014 — Credit is Counterfactual, Never Equal-Split

**Decision:** runtime 的 credit 必须来自配对干预（`interveneAndCredit`，C_i = L^{CF}_i − L^{real}）；
`basicCredit` 的误差均分路径 deprecated。同时 Outcome 禁止合成值，必须来自真实反馈。
**Reason:** 审计确认当前 runTurn 使用 δ/N 均分 + 合成 outcome，违反 P0。

## ADR-015 — Director Is an Application Orchestrator

**Decision:** director 不再承担认知决策；每轮先经 CSLA Runtime/Controller，用返回的 cognitiveAction 驱动应用阶段；
`write.js` 受 Core Idea 门控（coreIdea 空 → 拒绝 draft）。
**Reason:** 消除产品线绕过 runtime 的 Theater。

## ADR-016 — Incremental Migration Only

**Decision:** 按 `CSLA_MIGRATION_PLAN.md` Phase 0–8 增量迁移；禁止 Big Bang；
每阶段独立测试门禁与回滚；旧入口保持可用（灰度开关）。
**Reason:** 73 个现有资产必须保留并重新接入，不可推倒重来。

## ADR-017 — ContextAssembler Is a Single Service

**Decision:** 所有 LLM 调用上下文由 `ContextAssembler(State,Action,Operator,Budget)` 组装；
各模块删除自拼 prompt；LLM 调用统一经 `makeLlm` Port。
**Reason:** 审计发现 39 模块直连 chatWithRetry 且各自组 prompt。

## ADR-018 — Claim Discipline

**Decision:** 无真实纵向实验不宣称长期学习已解决；无真人数据不宣称理解用户；
无 benchmark 不宣称超过基线；无真实干预不宣称 Credit 已解决。
**Reason:** 审计标准（第 31 节）——文档/测试/模块数量不是 GREEN 的证据。
