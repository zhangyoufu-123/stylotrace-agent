# CSLA Runtime Dependency Graph（现状）

**日期：** 2026-08-29 · **依据：** import 扫描（agent/src 与 agent/src/csl）

---

## 1. 产品线（主流程）

```text
cli.js ─────────────────────────────┐
mcp.js ──┐                         │
web ─────┼──► director.js ──► 阶段执行（每轮一个 action）──► 输出
api(main.py → headless.mjs) ───────┘

director.js 直接依赖（25+ 模块，星型耦合）：
  clarify / outline / write / redteam / reader-gallery / restyle / style(apply/extract) /
  style-pulse / style-vector / style-adapter / fact-check / proofread / academic-norm /
  originality / rag / persona / intent / bible / revise / style-eval / library / io /
  roundtrip / consistency / governance / constraints / csl/runtime(cognitiveGate 唯一接线)
```

## 2. CSLA 研究线（csl/）

```text
cli.js (csl 命令) ──► csl/runtime.runTurn ──► csl/actions.runCognitiveLoop ──► dispatch(executor)
                                        │            ├─► operators.buildContextBundle/selectOperators
                                        │            ├─► reasoning.compare/counterexample
                                        │            └─► llm.run（makeLlm 注入）
   ├─► csl/state.transition/persist（版本单调）
   ├─► csl/events.appendEvent
   ├─► csl/elicit.pickQuestion
   ├─► csl/ledger.recordOutcome/basicCredit
   └─► csl/replay.policyFor
csl/hrmr ──► events + reasoning（记忆生命周期）
csl/replay ──► events（重构/再巩固）
csl/ledger ──► events
```

无环。csl 内部依赖干净（runtime→actions→operators/reasoning；hrmr→events/reasoning）。

## 3. LLM 依赖

```text
39 个产品模块 ──► chatWithRetry(cfg)（直连，无 Port）
csl 算子 ──► llm.run（经 makeLlm 注入，Port 化 ✅）
```

产品线每模块自组 prompt（无统一 ContextAssembler）；csl 有 buildContextBundle（按 operator 裁剪）。

## 4. 标记

| 问题 | 位置 | 说明 |
| --- | --- | --- |
| 星型耦合 | director.js | 25+ 直接 import，入口=编排中枢；可维护性差 |
| 双状态源 | workspace.js vs csl/state.js | state.json 与 csl-state.json 不同步（State Inventory） |
| 绕过 runtime | director.js:239 | 仅 cognitiveGate，不调 runTurn |
| 直接 provider 依赖 | 39 模块 | chatWithRetry 直连，未过 Port；换 provider 需逐模块改 cfg |
| 隐式共享 | workspace 文件 | 模块间经文件通信，无事件/契约 |
| 重复职责 | clarify/interview/elicit | 三套澄清/提问逻辑并存 |
| 占位 executor | csl/actions.js | search/plan/verify/simulate/act 等为确定性占位 |

## 5. 目标依赖（迁移后）

```text
CLI / MCP / REST / Web / Skill
  ↓ Application Adapter（薄）
CSLA Runtime（唯一认知入口）
  ├─ L2 StateKernel（唯一事实源）
  ├─ L3 Controller（Q 值 + LLMProposal + 权限）
  ├─ L4 Engines（Memory/Reasoning/Induction/…）
  ├─ L5 LLM Port + ContextAssembler + Tools/MCP
  └─ L6 Outcome/Credit/Learning
      ↓
Stylotrace 应用模块（write/restyle/style/rag/quality gates）——以"能力服务"接入，不再自组认知
```
