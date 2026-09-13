# CSLA / Stylotrace — Source of Truth（00）

> 本文档是 CSLA/JCC/Stylotrace 研究上下文的**唯一当前真相索引**。
> Codex 今后先读本文档，再按 §9 顺序读 canonical 文件；历史细节去 `history/`。
> 诚实第一：已实现/已设计/研究假说严格区分，不把文档当实现。

## 0. 一句话定位

CSLA 是通用认知运行时（脑科学原则 → 计算功能 → 可组合认知算子 → 自适应 runtime），
Stylotrace 是它的第一个垂直应用/实验场（深度写作）。核心主张：

> 在一个不修改 foundation model 参数的外层 runtime 中，Human、LLM Operators、Memory、
> World/Task Model、Tools 与 Outcome Feedback 围绕一个持久的 shared cognitive state 协同运行，
> 并用可追溯的 consequence-based credit 决定哪些内部状态、记忆、策略与 schema 应该改变。

## 1. CURRENT THEORY — CSLA v1.8

- 主文件：`history/CSLA_v1_8_BRAIN_INSPIRED_COGNITIVE_CONTROL.md`
- 原则：**Neural Principle → Computational Function → Runtime Operator**（禁止"脑区=软件模块"）。
- 语言不是 token 串行接龙：Thought/Goal/Concept → Language Planning → Expression。
- 控制模式：`Mode_t ∈ {Automatic, Controlled, Mixed}`；Novelty↑/Risk↑/Conflict↑ → Controlled。
- 记忆是关系系统（Encoding + Relational Binding + Pattern Separation + Completion +
  Comparison + Replay + Recombination + Consolidation），**不是 RAG**。
- 推理 = 可组合算子（Compare/Associate/Abstract/Induce/Deduce/Abduce/Analogize/Causal/
  Counterfactual/Recombine/Simulate），**不是更长的 CoT**。
- 认知状态：`S_t = (D,G,B,E,W,P,M^E,M^S,K,Π,U,Self,H,J,R,Language)`（见 02）。

## 2. CURRENT RUNTIME（实现）

- 实现位置：`agent/src/csl/`（state / events / elicit / operators / ledger / replay / runtime）。
- 依据 v1.6 参考语义（`history/CSLA_v1_6_EXECUTABLE_COGNITIVE_RUNTIME.md`），v1.8 修正：
  **24 步是 capability inventory / 参考执行语义，不是强制流水线**；runtime 按状态动态选动作。
- 硬编码只允许四类：Safety、State Integrity、Auditability、Resource/Risk Limits。
- 支持 **Native Model Escape Hatch**（LLM 认为内置算子不适配时可直接 NativeLLMReasoning）。
- 当前已实现并测试：FastSalience、DeepGate、确定性 Authority、24 步调度、Replay（R1–R5）、
  Basic Credit（B0/B1/B2）。见 `reports/CSLA_IMPLEMENTATION_READINESS_REPORT.md`。
- **P0 集成（2026-08-29 实施）**：Canonical State Kernel（`csl/canonical.js`，产品状态版本化+双写镜像）、
  Counterfactual Credit（`creditFromCounterfactual`，runtime 不再用 δ/N 均分、Outcome 不再合成）、
  Director 认知主门（`cognitiveDecision`）与 Writer Core Idea 门（`write.js` 拒绝无核心写作）。
  测试：`csl-canonical` / `csl-integration`（60 套全绿）。
- **Phase 1（2026-08-29 实施）**：Canonical Cognitive State Kernel 全量迁移——
  `state.js` 升级为唯一版本化内核（schema 分区 / commit / snapshot / restore / compare / 会话隔离 /
  统一事件流 csl-canonical-events.jsonl）；interaction/style/memory 经 Adapter 汇入；legacy API 兼容。
  测试：`csl-kernel`（C1–C13，61 套全绿）。报告：`reports/CSLA_PHASE1_STATE_MIGRATION_REPORT.md`。
- **Phase 2（2026-08-29 实施）**：Real Outcome + Counterfactual Credit Engine——
  `credit.js`：Outcome/Prediction Contract、维度化 Evaluator、显式反事实（3 类 baseline）、
  context-aware 政策证据（Q_new=Q_old+ηC，有界/可撤销/低置信门）、credit→真实动作选择变化。
  runtime 接入；OutcomeStore/CreditStore/PolicyEvidenceStore；62 套全绿 + 真实 LLM T10。
  报告：`reports/CSLA_PHASE2_OUTCOME_CREDIT_REPORT.md`。
- **Reality Audit（2026-08-29）**：全系统真实运行审查 + P0 修复（search 占位→真实检索通路）。
  5 报告：`reports/CSLA_FULL_SYSTEM_REALITY_AUDIT.md` / `REAL_EXECUTION_MATRIX.md` /
  `EXPECTED_VS_ACTUAL.md` / `CSLA_CURRENT_EFFECTIVENESS_REPORT.md` / `CSLA_REPAIR_BACKLOG.md`。
- **Phase 3A（2026-08-29 实施）**：HRME ↔ Compare ↔ Abstract 真实运行时接入——新 `memory` 动作
  （Observation→Relation→Encode→Retrieve）、compare 精化主张（Reasoning→ChangedHypothesis）、
  abstract 记忆约束（Memory→ChangedReasoning）、counterexample→schema 精化、`goldenCognition` 管线
  + Golden Cognitive Test（小猪吃玉米：结构化认知变化 + Schema→NovelTask）。63 套全绿 + 真实 TEST E。
  报告：`reports/CSLA_PHASE3A_MEMORY_REASONING_REPORT.md`。
- **Stylotrace Cognitive Integration（2026-08-29 实施）**：Cognitive Writing Brief 核心对象
  （`csl/brief.js`）——Fast→Brief、HRME/Reasoning→Brief、Brief→Writer（提示注入+禁止偷换思想）、
  HumanEdit→Outcome（point-edit 落账）、Outcome→AuthorModel/Policy（目标上下文 credit）。
  64 套全绿。报告：`reports/CSLA_COGNITIVE_INTEGRATION_REPORT.md`。
- **Failure Taxonomy（2026-08-29 实施）**：AI 写作失败分类法（`csl/failure.js`，15 类/5 类已实现检测）
  + AuthorQuality KPI + FailureType→Credit→Policy 上下文。65 套全绿。
  报告：`reports/AI_WRITING_FAILURE_TAXONOMY.md`。
- **FULL E2E VALIDATION（2026-08-29）**：13 步全链引擎（`csl/e2e.js`）+ 门禁 `csl-e2e-closure`；
  Closure 11/11=1.0；Gate A/B ✅、Gate C 诚实未过（机制级行为改变已证明，longitudinal 未跑）；
  真实 LLM 全链通过；顺带修复 runTurn 会话隔离与版本碰撞。66 套全绿。
  报告：`reports/CSLA_FULL_E2E_VALIDATION_REPORT.md`。
- **Phase 3（2026-08-30 实施）**：统一所有 Agent 入口到 CSLA Runtime——`csl/adapter.js`
  （runTask/decideTask/answerCheckpoint/runAction/canonicalSnapshot）；CLI `run` 命令 + director 接
  decideTask；MCP 新增 csl_turn/csl_action/csl_checkpoint/csl_state（43→47 工具）；SKILL.md 认知协议；
  Web/API headless task 模式 + 4 端点；跨通道共享会话（canWrite 按 session 修复）。67 套全绿。
  报告：`reports/CSLA_PHASE3_ENTRY_INTEGRATION_REPORT.md` + `AGENT_ENTRY_CAPABILITY_MATRIX.md`。

## 3. CURRENT JCC

- 单一权威：`10-jcc.md`（J_t 联合状态、Human/AI 权责、α 控制权、D=(K,F,P)、创新挖掘目标）。

## 4. CURRENT INTEGRATION

- Stylotrace 模块映射：`11-stylotrace-integration.md`（73 模块 → runtime）。
- 能力三分类基线矩阵：`15-mainstream-baseline-matrix.md`（Existing / Integration / Novelty）。

## 5. CURRENT API

- `13-api.yaml`（OpenAPI 3.1；agent/run/events/trace/memory/feedback/replay/consolidate/tools）。

## 6. CURRENT ADR

- `ADR/CSLA_ARCHITECTURE_DECISIONS.md`（12 条 ADR，冻结接口与不变量）。

## 7. CURRENT EXPERIMENT STATUS

- 协议：`12-experiment-protocol.md`（failure-case-first、E1–E8、控制条件 A–D）。
- 总验收矩阵：`16-research-coverage-matrix.md`（18 问题 × 6 主轴，A/B/C 覆盖）。
- 诚实结论：架构覆盖 18/18，可运行实现 ≈11/18，科学证据 0/18。
- 行业基准（未跑，待建）：LongMemEval-V2 / Mem2ActBench / AgentMemoryBench / Atlas。
- 报告：`reports/`（readiness / theory audit / understanding）。
- **尚未运行**：E1–E8 与 A–D 对照实验均未执行；"同任务重复"基准未建立。

## 7.1 三个优先证明（下一阶段入口）

1. Experience → Future Behavior（replay+credit 使 t+1 更好）；
2. Human Insight → AI Expansion（先挖灵魂再扩张）；
3. Memory/Reasoning → Better Long-Horizon Decisions。

## 7.2 ENTERPRISE ARCHITECTURE AUDIT（2026-08-29，当前现状判定）

> 全仓库架构审计（只读，未改代码）。结论：**csl 最小路径是真 Cognitive Runtime；全系统不是——
> 产品线（director/write/mcp/web）绕过 runtime，Outcome 合成、Credit 均分、长期学习无证据。**

- 总审计：`reports/CSLA_ARCHITECTURE_AUDIT.md`（含 Q1–Q20 与 GREEN/YELLOW/RED/UNKNOWN 判定）
- 目标架构：`reports/CSLA_TARGET_ARCHITECTURE.md`（7 层 + 6 实体 + 写作链路）
- Model/Code 责任：`reports/CSLA_CODE_RESPONSIBILITY_MATRIX.md`
- 状态清单：`reports/CSLA_COGNITIVE_STATE_INVENTORY.md`（双状态源判定）
- 依赖图：`reports/CSLA_RUNTIME_DEPENDENCY_GRAPH.md`
- 迁移计划：`reports/CSLA_MIGRATION_PLAN.md`（Phase 0–8，P0=状态内核/Credit 反事实/Director 接入）
- 风险登记：`reports/CSLA_RISK_REGISTER.md`
- ADR 追加：`ADR/CSLA_ARCHITECTURE_DECISIONS.md`（v2.0，ADR-013~018）
- 实施边界：**审计完成后停止，未进入任何重构阶段**；下一阶段指令下达后才开工。

## 8. 版本谱系（全部在 history/）

v1.0 研究规格 → v1.2 完整规格 → v1.5（CURRENT_MASTER，前沿审计）→ v1.6 可执行运行时 →
v1.7 Reasoning & Memory → **v1.8 当前理论**；另有 master update plan、handoff v1.0/v1.4、README_CSLA。

## 9. Codex 阅读顺序（未来）

```text
00-SOURCE-OF-TRUTH.md
→ 09-runtime.md（当前实现与原则）
→ 02-cognitive-state.md / 03-motivation-goal.md / 04-memory-reasoning.md
→ 06-control-metacognition.md / 07-credit-learning.md / 08-jcc-human-ai.md
→ 10-llm-operator-protocol.md / 11-stylotrace-integration.md
→ 13-api.yaml / ADR/
```

其余（history/、reports/）为历史与辅助材料。

## 10. 已知缺口（文档 vs 实现）

- 已实现：runtime 调度、state/events/elicit/operators/ledger/replay。
- 已设计未实现：Consolidation 引擎、Future Simulation、Adaptive Policy（学习版）、
  多模态状态、E1–E8 实验、同任务重复基准。
- 已文档未验证：任何"性能提升"声明；CSLA > LLM 的对照均未执行。
