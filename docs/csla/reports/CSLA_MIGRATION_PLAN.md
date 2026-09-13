# CSLA Migration Plan（增量，禁止 Big Bang）

**日期：** 2026-08-29 · **原则：** 每阶段独立可回滚、独立测试门禁；旧入口逐步从 Old Runtime 切到 New Runtime；
`agent/` 仍是 engine 单一事实源，skills 是快照（保留 `sync-skill-engine.sh`）。

---

## Phase 0 — Audit（已完成）

产出本组审计文档（Architecture Audit / Target / Responsibility / State Inventory / Dependency Graph /
Risks / ADR 追加）。**不改代码。** ✅

## Phase 1 — State Kernel 统一（P0）

**状态：2026-08-29 全量迁移已实施**（`agent/src/csl/state.js` = Canonical Kernel）：
规范 schema 分区 / patch / commit（版本单调+统一事件流）/ snapshot / restore / compare /
会话隔离（S1/S2 独立文件）/ interaction·style·memory Adapter；legacy API 兼容；canWrite 写门。
测试：`csl-kernel`（C1–C13）+ 61/61 全绿。报告：`reports/CSLA_PHASE1_STATE_MIGRATION_REPORT.md`。
剩余：产品 state.json 的 14 个直接写点收敛到 Kernel、LLM/Tool/Outcome/Error 统一事件挂接、
同会话并发写锁。

- 把 `protocol/csl-state.json` 升为唯一版本化内核；`protocol/state.json` 降为应用视图/兼容层（双写）。
- 所有状态变更收口到 `StateDelta + Event → Commit`（消灭整文件覆盖）。
- 迁移 director 的 stage/decisionHistory 到内核引用。
- **门禁**：新增契约测试——同一对话双读一致；版本单调；无绕过 transition 的写。

## Phase 2 — Credit 反事实接入 Runtime（P0）

**状态：2026-08-29 Phase 2 已完成**（`credit.js` 独立引擎 + runtime 接入）：
Outcome/Prediction Contract、维度化 Evaluator、显式反事实（frozen/matched/deterministic baseline）、
context-aware 政策证据（Q_new=Q_old+ηC，有界/可撤销/低置信门）、credit→真实动作选择变化（Test 6/7）、
OutcomeStore/CreditStore/PolicyEvidenceStore + 统一 OutcomeError 事件。62/62 全绿 + 真实 LLM T10。
报告：`reports/CSLA_PHASE2_OUTCOME_CREDIT_REPORT.md`。
剩余：确定性 CF 评价器升级为真实配对干预（重跑动作循环）、反馈数值映射校准。

- `basicCredit` 移除均分路径或标记 deprecated；runtime 改用 `interveneAndCredit`（配对干预）。
- Outcome 停止合成值：接入真实反馈接口（用户确认/拒绝/编辑信号 → outcome）。
- **门禁**：runtime 测试断言 credit 非均分（单模块因果测试）；真实 outcome 管道测试。

## Phase 3 — Director 接入 Runtime（P0，消除 Cognitive Theater）

**Phase 3（入口统一）2026-08-30 完成**：`csl/adapter.js` 统一入口（CLI/MCP/Skill/Web/API →
Adapter → Canonical State → CSLA → Application Executor）；跨通道共享会话；canWrite 按 session；
旧入口兼容。67 套全绿。报告：`reports/CSLA_PHASE3_ENTRY_INTEGRATION_REPORT.md`。

**状态：2026-08-29 已实施**（`director.agentStep` 认知主门 + `write.js` Core Idea 门）：
syncCoreIdea → cognitiveDecision 主门（askHuman 强制 clarify）、用户确认/纠正 → recordFeedback、
writeSection 无核心拒绝。测试 `csl-integration`（含 E2E 阻断/放行断言）。
剩余：deep checkpoint 返回产品交互、cognitiveAction → 各 director 阶段全映射。

- `agentStep` 每轮先走 `runTurn`（或等价的 controller 入口），用返回的 cognitiveAction 驱动阶段选择；
  director 降级为 Application Orchestrator（任务启动/进度/UI），不再自决认知。
- `write.js` 增加 Core Idea 门：`coreIdea 为空 → 拒绝 draft`。
- **门禁**：E2E 测试 `CLI→director→runtime→writer→artifact`；coreIdea 缺失时 writer 被阻塞的断言。

## Phase 4 — LLM Port 贯穿产品线 + ContextAssembler（P1）

- 39 个直连 `chatWithRetry` 的模块改经 `makeLlm` 注入；cfg 解析统一。
- 新建 `context/assembler.js`：`Context = Assembler(State,Action,Operator,Budget)`；
  首批迁移 write/clarify/redteam（各模块删除自拼 prompt）。
- **门禁**：换 fake provider 全测试绿（Port 契约测试）；上下文预算测试。

## Phase 5 — Reasoning/Induction 引擎补齐（P1）

**3A 先行（2026-08-29 完成）**：HRME ↔ Compare ↔ Abstract 运行时接入 + Golden Cognitive Test。
报告：`reports/CSLA_PHASE3A_MEMORY_REASONING_REPORT.md`。
剩余：3B Induction（多假设→条件 schema）、3C Reasoning→Writer 认知注入。

- 实现 Induce/Deduce/Abduce/Analogy/Causal/Counterfactual/Recombine/Simulate 的确定性 v1
  （结构级）+ LLM 语义层（经 ContextAssembler）；每算子独立测试。
- HRME 接入产品记忆：edits.jsonl/风格样本 → Episodic 编码，检索供 write 使用。
- **门禁**：每算子 F1–F3 失败用例测试；HRME↔产品检索集成测试。

## Phase 6 — Outcome/Learning 真实化（P1）

- 产品动作（写/改/审/交付）上报 Outcome（expected/actual/feedback/cost/risk）。
- Policy/Schema/Style 更新由 credit 驱动；消除"记录但不更新"。
- **门禁**：R1–R5 扩展为真实事件流；至少 1 条"失败→学习→行为改变"端到端测试。

## Phase 7 — Longitudinal 实验（P2/研究）

- 跑 B0–B9 对照与 E1–E6（预算 A–D 条件）；真实 LLM、多会话、跨任务迁移。
- 产出 Performance_{t+1} vs Performance_t 证据；**没有证据不宣称长期学习已解决**。

## Phase 8 — Production Hardening（P2）

- 观测性：trace_id/session/action/model/tool/latency/tokens/cost 统一落账。
- 并发会话隔离、幂等、流式、安全（prompt injection 防护、工具权限）。
- 包拆分（`@csla/core` / `@csla/runtime` / `@stylotrace/app`）作为最后一步，不阻塞前 7 阶段。

---

## 向后兼容策略

- 每阶段保持旧 CLI/MCP/Web/DSH 可用；新入口加 `--runtime csla` 开关灰度。
- `sync-skill-engine.sh --check` 持续作为 CI 门禁。
- 不删除任何现有模块（Legacy/Capability Mapping 保留在 11-stylotrace-integration.md）。

## 优先级总览

```text
P0: Phase 1（状态内核）+ Phase 2（Credit 反事实）+ Phase 3（Director 接入/Writer 门）
P1: Phase 4（LLM Port + Context）+ Phase 5（推理引擎）+ Phase 6（真实 Outcome/Learning）
P2: Phase 7（纵向实验）+ Phase 8（生产加固/包拆分）
```
