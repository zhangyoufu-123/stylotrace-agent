# CSLA Baseline Report（Phase 0）

**日期：** 2026-08-29 · **性质：** FINAL BUILD PROGRAM Phase 0——仓库/测试/架构/运行时/风险基线
**规则：** 本阶段只读、不改代码、不删不移；报告如实区分 真实实现 / 文档 / mock / 无证据。

---

## 1. Repository Baseline

| 项 | 值 |
| --- | --- |
| 仓库 | `~/Documents/stylotrace`（私有；origin = zhangyoufu-123/stylotrace，main） |
| 基线提交 | `524724e` feat(csl): P0 集成闭环——Canonical State 版本化双写/反事实 Credit/真实 Outcome/Director 认知主门/Writer Core Idea 门 |
| 工作区 | 干净（仅 2 个未跟踪用户文件：`PROJECT.md`、`CSLA_IMPLEMENTATION_READINESS_REPORT.md`，不属于仓库交付物） |
| Node | v24.15.0 · npm 11.12.1 |
| 依赖 | **零 npm 依赖**（agent/package.json dependencies={}，无 node_modules）——纯 Node 内置模块实现 |
| 源文件 | `agent/src/` 84 个 .js（含 `csl/` 10 个 + `canonical.js`） |
| 测试文件 | `agent/test/` 59 个 .mjs |
| 近 8 提交 | 524724e P0 集成 → 36f4fe2 企业级审计 → 5e9f29e 真实 LLM 桥 → 011a501 接入真实 token → 3a070f0 HRME 红队 → df33170 Action-driven → c06d2a4 Fast–Deep → c1589ad HRME 首模块 |

## 2. Test Baseline

| 套件 | 结果 |
| --- | --- |
| `node --test`（全量） | **60/60 通过，0 失败，0 跳过**（~32s） |
| `npm test`（显式清单，含 e2e 全链） | 全部通过 |
| `test/e2e.mjs`（产品全链：init→clarify→outline→write→redteam→fix→MCP，fetch stub） | 全部通过 |
| `CSL_REAL_LLM=1 npm run test:csl-real` | opt-in 真实 token 冒烟（上次运行通过；本基线默认 SKIP） |
| lint/type check | 项目无 lint/ts 配置（纯 JS ESM）；无独立 lint 门禁 |

测试覆盖分类（59 文件）：单元/契约为主；集成（e2e、ingest-sample、cli-args）；真实 LLM 仅 csl-real（opt-in）；
**无** human-in-loop 自动化、**无** longitudinal、**无** B0–B9/E1–E6 benchmark。

## 3. Architecture Snapshot（当前）

两条平行线（审计结论，代码证实）：

```text
产品线：CLI / MCP / Web / FastAPI(headless) / DSH
  → director.js（LLM 选动作 + 阶段机 clarify→outline→write→redteam→audience→deliver）
  → 39 个模块直连 chatWithRetry（真实 LLM）

研究线：csl/（state/events/canonical/elicit/operators/actions/runtime/ledger/replay/reasoning/hrmr）
  → Fast/Deep + ActionDispatcher + HRME + Replay + 真实 LLM 桥（csl CLI）
  → 与产品线接线点：director.cognitiveDecision 主门 + cognitiveGate + write.js Core Idea 门
```

入口清单：CLI（cli.js）· MCP（mcp.js）· Web（web/server.mjs）· FastAPI（api/main.py→headless.mjs）·
Skill（skills/ 快照，engine 由 `scripts/sync-skill-engine.sh` 同步，CI 校验）· DSH 插件（extras/）。

## 4. Runtime Snapshot（csl/，逐模块状态）

| 模块 | 状态 | 证据 |
| --- | --- | --- |
| state.js | 真实 | 版本化 S_t、transition 拒绝非法 key/回退；csl-state.test |
| events.js | 真实 | 事件账本 jsonl、有序回放；csl-events.test |
| canonical.js | 真实（P0 新增） | readCanonical/commitDelta/syncCoreIdea/产品状态版本化；csl-canonical.test |
| elicit.js | 真实 | q* 问题策略、coreIdea 捕获；csl-elicit.test |
| operators.js | 真实 | ContextRouter 按算子裁剪（预算 1200）；csl-operators.test |
| actions.js | 真实 | ActionDispatcher + 16 executor + Q 值 + Native Escape；csl-actions.test（A1–A6/F5） |
| runtime.js | 真实 | Fast/Deep、认知决策、真实 outcome/反事实 credit、错误恢复；csl-runtime/csl-integration.test |
| ledger.js | 真实 | outcome 账本 + `creditFromCounterfactual`（非均分）；basicCredit deprecated；csl-ledger.test |
| replay.js | 真实 | R1–R5 + DoD；csl-replay.test |
| reasoning.js | 部分真实 | Compare/Counterexample/Abstract（确定性）；其余算子只有动作名 |
| hrmr.js | 真实 | M1–M4 生命周期、decay/降级/迁移；红队 H1–H8 9/9；csl-hrmr.test + hrmr-transfer |
| （未实现） | 文档 | Executive/PFC、Metacognition、World Model、Language Planner、Human Model、Hooks、Multimodal、Induction 引擎 |

## 5. Git / 可回滚基线

- 回滚点：`524724e`（P0 集成后）；前一稳定点 `36f4fe2`（审计后）与 `5e9f29e`（真实 LLM 桥后）。
- 每次里程碑均有独立提交；无 force push；无破坏性 git 操作历史。

## 6. Risk Snapshot（引用 CSLA_RISK_REGISTER.md）

| 风险 | 基线状态 |
| --- | --- |
| R1 产品线绕过 runtime | **部分修复**：认知主门 + Writer 门已接；deep checkpoint 回产品、全阶段映射未完成 |
| R2 Credit 均分 | **已修复（最小版）**：runtime 用 creditFromCounterfactual；off 为确定性仿真（conf 0.4），真实配对干预未做 |
| R3 假 Outcome | **已修复（最小版）**：无反馈不再伪造；真实反馈入口为确认/纠正信号（0.9/0.3 映射粗糙） |
| R4 双状态源 | 部分：镜像+版本化完成；字段全量迁移到内核未完成 |
| R5 推理算子声称>实现 | 未变：12 算子仅 3 个真实（P1 项） |
| R6 无长期学习证据 | 未变：B0–B9/E1–E6 未跑（P3 项） |
| R7 Provider 锁死 | 未变：仅 openai 适配器；39 模块直连未过 Port（P1 项） |
| R8 Prompt 分散 | 未变：无 ContextAssembler（P1 项） |
| R11 Fast 长文高成本 | 未变：DeepGate 欠调 + fast 语言层无预算 |

## 7. 诚实分类（Phase 0 结论）

- **真实实现且有测试**：csl 全链（state/events/actions/runtime/ledger/replay/hrmr/canonical）、
  产品线全链（director/write/style/rag/quality gates）、真实 LLM 桥（opt-in 冒烟）、P0 集成门。
- **部分实现 / mock**：reasoning（3/12）、credit off 仿真（非真实干预）、outcome 反馈映射（粗粒度）、
  产品状态镜像（非全迁移）。
- **只有文档**：Executive/Metacognition/World Model/Language Planner/Human Model/Hooks/Multimodal/Induction 引擎。
- **无证据**：长期学习（longitudinal）、认知增益（benchmark）、B0–B9/E1–E6、超越基线任何声明。

## 8. 基线结论

`State→Action→RealBehavior→Outcome→Credit→Learning` 在 **csl 最小路径 + P0 集成门**已代码成立
（测试 60/60）；**全产品闭环与"长期学习"证据仍未成立**——这是 Phase 1–3 与后续 Phase 的实施基线。

**Phase 0 完成。停止。未修改任何代码。**
