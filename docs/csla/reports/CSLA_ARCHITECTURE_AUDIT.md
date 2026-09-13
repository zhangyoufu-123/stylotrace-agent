# CSLA Architecture Audit

**日期：** 2026-08-29 · **阶段：** Enterprise Architecture Audit（Phase 0，不改代码）
**方法：** 全仓库代码 ↔ 测试 ↔ 文档交叉验证（agent/src 75 模块 + agent/src/csl 10 模块 +
57 测试文件 + web/api/skills/extras 入口）；所有结论标注 GREEN / YELLOW / RED / UNKNOWN。
**范围：** 判断当前代码是否真正形成 Cognitive Runtime，而非"能力集合"。

---

## 0. 一句话结论

**当前系统是"两条平行线"：** 产品线（CLI/MCP/Web → director → clarify/write/redteam/…）是
**成熟的 Stylotrace 写作应用**，有自己的 LLM 驱动的阶段状态机；研究线（agent/src/csl/）是
**已可运行的最小 Cognitive Runtime**（Fast/Deep 共享状态、动作循环、HRME、Replay、真实 LLM 桥），
但只通过 `stylotrace csl` 命令和 director 里的一个 `cognitiveGate` 与产品线相连。
**CSLA Core 尚未成为产品线的执行内核**——产品线仍绕过它运行。这是本次审计最大的 Gap。

---

## 1. 现状分层评估（L0–L6）

| 层 | 现状 | 分类 | 证据 |
| --- | --- | --- | --- |
| L0 Human/World | 用户输入/编辑/确认全量接入；文件/网页/图片经 CLI、rag、io | GREEN | workspace.js、rag.js、io.js |
| L1 Interaction Gateway | csl 有 I_t（csl-interaction.json）+ q* 问题策略 + Fast 层澄清；产品线有 clarify.js/interview.js 但两者状态分离 | YELLOW | csl/runtime.js readInteraction/chooseQuestion；clarify.js |
| L2 Cognitive State Kernel | csl 有版本化 S_t（csl-state.json）与事件账本；产品线另有 protocol/state.json（主状态）——**两个竞争状态** | YELLOW | csl/state.js、workspace.js |
| L3 Adaptive Controller | csl 动作循环真实（select→dispatch→replan，A1–A6 测试）；产品线 director 是 LLM 选动作 + 固定阶段推进（ask/outline/write/revise/audit/review/restyle/deliver） | YELLOW | csl/actions.js、director.js decideNextAction |
| L4 Cognitive Engines | HRME（Encode/Bind/Separate/Consolidate/Replay/Reconsolidate/Decay）已实现并红队 H1–H8；Reasoning 仅 Compare/Counterexample/Abstract（确定性）；Induction 是"共现 token"级；Metacognition/World/Goal/Human Model 未实现 | YELLOW | csl/hrmr.js、reasoning.js、17-hrme.md |
| L5 Model/Tool Runtime | makeLlm 统一工厂 + `.run()` 接口 + 真实 token 验证；**仅 openai 兼容适配器**；产品线 40+ 模块直连 chatWithRetry，未走 Port | YELLOW | llm.js、credentials.js |
| L6 Outcome/Credit/Learning | recordOutcome 真实存在但 runTurn 用的是**合成值**（prediction=0.8，outcome 由 alpha 决定）；basicCredit 是**误差均分**（违反 P0 禁则）；interveneAndCredit 反事实函数已实现但 runtime 未用；Replay R1–R5 通过，B0–B9/E1–E6 未跑 | RED | csl/ledger.js、csl/replay.js |

---

## 2. Fast / Deep 架构审计（规格第 4 节）

CSLA 路径（agent/src/csl/）：

1. **是否只有一个 cognitive state？** csl 内是（csl-state.json 唯一内核）；但产品线另有 protocol/state.json。
2. **Fast 和 Deep 是否共享状态？** 是（同一 S_t；fast 不提交，deep 提交）。
3. **Deep 能否反向请求 Human？** 是（ask/checkpoint 两类，真实冒烟 TEST B 通过）。
4. **Human 能否中途改变 Deep state？** 是（acceptAnswer → 重跑 → deep，实测通过）。
5. **Fast 是否可在不启动 Deep 时完成普通对话？** 是（10 次闲聊 0 次深层算子，测试断言）。
6. **Deep 是否阻塞 Fast？** 否（异步循环内不阻塞前台；交互模式串行但无后台任务）。
7. **是否存在重复 state？** 是（csl-state vs product state.json vs 各类 vault 文件，见 State Inventory）。

产品线路径：无 Fast/Deep 分层；director 每轮串行决定下一动作。

---

## 3. Cognitive Theater 位置

| 位置 | 现象 | 严重度 |
| --- | --- | --- |
| director.js:239 | 唯一接线点 `cognitiveGate`：仅当 csl 策略=ask 且 stage=write 时拦截；**不调用 runTurn** | 高 |
| write.js | 草稿生成**从不读 csl-state**；Core Idea 缺失时不会被 CSLA 阻止（只受 director 阶段约束） | 高 |
| cli.js agent 流程 | 产品主流程（agent/agentStep）绕过 csl runtime | 高 |
| mcp.js / web / api | 无 csl 接线 | 中 |
| csl runTurn | 状态→动作→行为已真实成立（自己的闭环内） | 无（该路径 GREEN） |

结论：**Cognitive Theater 发生在产品线**——csl 认知状态不驱动产品行为；只有 research 路径（csl CLI）真正 State→Action→Behavior。

---

## 4. Dynamic Action 审计（A–G）

| 项 | csl 路径 | 产品线 director |
| --- | --- | --- |
| A 选择 action | 是（Q 值 + Native Escape） | 是（LLM 从 9 个固定动作选） |
| B 执行所选 action | 是（独立 executor，A1 测试） | 部分（action → 固定阶段函数） |
| C 执行后重选 | 是（runCognitiveLoop 重规划） | 否（阶段线性推进） |
| D 隐藏固定流水线 | 无（动作循环） | 有（clarify→outline→write→redteam→audience→deliver 阶段机） |
| E Stop | 是（taskComplete→stop，A4） | 部分（deliver 即终态） |
| F AskHuman | 是（ask/checkpoint） | 是（ask 动作） |
| G NativeLLM escape | 是（A5） | 否 |

---

## 5. LLM Integration 审计

- **真实路径**：`stylotrace csl`（makeLlm → runTurn → 动作循环），真实冒烟 4 组测试通过（fast/小猪/人机写作/状态续接），usage/latency/id 可读。
- **Mock 路径**：csl 单元测试（20+ 测试文件用 mock）；csl-real 为 opt-in（CSL_REAL_LLM=1），不进 CI。
- **产品路径**：40+ 模块直连 `chatWithRetry(cfg,…)`，各自组 prompt——真实可用但无统一 Port/ContextAssembler。
- **Provider**：仅 openai 兼容（DeepSeek/OpenAI/GLM/Qwen/Gemini-compat/本地）；Anthropic 未实现（扩展点）。
- **结构化输出**：llm.js parseJsonContent 有；csl 算子走文本输出，未强约束 JSON。
- **Streaming**：无。

---

## 6. LLM Boundary / Context / Memory / Reasoning / Induction 审计

- **Model/Code 责任**：见 `CSLA_CODE_RESPONSIBILITY_MATRIX.md`。产品线有把确定性任务交给 LLM 的迹象（如 outline 结构校验用 LLM JSON），csl 路径基本守边界。
- **Context Engineering**：产品线无统一 ContextAssembler（prompts.js 集中了部分模板，各模块仍自拼）；csl 有 buildContextBundle（按 operator 裁剪，预算 1200）。
- **Memory**：HRME（Episodic/Relational/Schema/Core + 巩固/遗忘/降级/迁移）实现并红队 9/9；RAG/knowledge/library 为产品资产但**与 HRME 未打通**。Pattern Completion 部分（schemaConfidence），Encoding→Binding 为确定性正则级。分类：YELLOW。
- **Reasoning**：Compare/Counterexample/Abstract 已实现（确定性、有测试）；Induce/Deduce/Abduce/Analogy/Causal/Counterfactual/Recombine/Simulate **只有动作名，无独立实现**（action dispatcher 中为占位 executor）。分类：RED（声称 > 实现）。
- **Induction**：HRME schema 是"类型级聚合 + 反例降级"，比 success++/fail++ 强，但仍是计数/阈值驱动，非真归纳学习。分类：YELLOW。

---

## 7. Outcome / Credit / Long-term Learning 审计

- **Outcome**：recordOutcome 存在（prediction/outcome/error/event），但 runTurn 注入合成值；产品线无结果账本接入。分类：YELLOW。
- **Credit（P0 禁则违反）**：`basicCredit` 对参与模块**误差均分**（error/N），注释明说"MVP 启发式"；反事实 `interveneAndCredit` 已实现但 runtime 未调用。**Credit 未达 P0**。分类：RED。
- **Long-term Learning**：Replay R1–R5（确定性）与 HRME Transfer 通过，证明"机制存在"；**无任何真实 LLM 纵向数据**（B0–B9/E1–E6 未跑），不构成 Performance_{t+1}>Performance_t 证据。分类：UNKNOWN（机制 YELLOW，证据无）。

---

## 8. Director / Writer 集成审计（P0）

1. director 是否绕过 runtime？**是**（只调 cognitiveGate，不调 runTurn）。
2. write 是否绕过 cognitive state？**是**（不读 csl-state）。
3. cognition 是否影响 draft？**仅通过 gate 拦截 ask 时**；无正向注入。
4. core idea 缺失时 writer 是否被阻止？**否**（依赖 director 阶段，非 CSLA）。
5. 需要 human input 时是否暂停？**是**（产品 ask 流程与 csl ask 均暂停）。
6. deep checkpoint 是否回到人？**仅 csl CLI 路径是**；产品线无 deep checkpoint。
7. 人回答后是否从原状态继续？**csl 路径是**（acceptAnswer→rerun）；产品线是阶段状态机，非认知状态续接。

---

## 9. API Boundary / Test / Enterprise Quality

- **API 边界**：CLI/MCP/Web/FastAPI/DSH 各自有逻辑；FastAPI 通过 Node headless 子进程复用引擎，但均未统一进 CSLA Runtime。分类：YELLOW。
- **测试架构**：57 文件，单元/契约为主；csl-real 是唯一真实 LLM 集成测试（opt-in）；无 E2E 认知链路测试（CLI→director→csl→writer→artifact）、无 longitudinal、无 human-in-loop 自动化。分类：YELLOW。
- **Reliability**：llm.js 有超时/指数退避/空响应重试；csl runTurn 有错误→failure event→安全状态；幂等性部分（state 版本单调）。GREEN/YELLOW。
- **Security**：key 自动发现且脱敏、不落日志；BYOK；API 层按 key 哈希隔离会话。GREEN。Prompt injection/工具权限未专项测试：UNKNOWN。
- **Observability**：csl 事件账本有 state_version/session/action/usage/latency；产品线无统一 trace_id/cost 记录。YELLOW。
- **Persistence**：workspace 文件化 + state 版本化；checkpoint/resume 有（history.js 快照），replay 有（csl）。GREEN/YELLOW。
- **Concurrency**：无并发会话隔离测试；文件级状态天然隔离但无锁。UNKNOWN。
- **Extensibility**：LLM 适配器可插拔（未全部实现）；新算子=注册表+executor（csl 支持）；新 vertical 应用=未验证。YELLOW。

---

## 10. Q1–Q20 回答

1. **现在是不是 Cognitive Runtime？** 部分。`agent/src/csl/` 是（State→Decision→Action→Outcome→Learning 闭环代码真实存在且可运行）；但全系统不是——产品线绕过它。
2. **哪里仍是 Cognitive Theater？** 产品线（director/write/mcp/web 不读 csl-state；csl 状态不驱动产品行为）。
3. **哪里是硬编码 workflow？** director 阶段机（clarify→outline→write→redteam→audience→deliver）；csl 的 search/plan/verify 等 executor 为占位。
4. **哪里真正动态？** csl 动作循环（Q 值选择+重规划）；director 的 LLM 选动作（仅下一步，无状态增量）。
5. **哪里真实用 LLM？** 产品线 40+ 模块 + csl CLI（真实冒烟通过）。
6. **哪里只用 mock？** csl 单元测试、多数集成测试；真实路径仅 csl-real（opt-in）。
7. **Memory 是否影响未来行为？** 机制上 csl replay 改 policy（R4 测试通过）；产品线风格记忆影响写作；但跨系统无统一证据。
8. **Reasoning operators 哪些真实存在？** Compare/Counterexample/Abstract（确定性）；其余为占位。
9. **Induction 是否真实存在？** 部分——类型级聚合+反例降级，非真归纳。
10. **Deep→Human→Deep 是否真实？** csl CLI 路径是（实测）；产品线否。
11. **Goal/Desire 是否进入 state？** csl 中 Desire→Goal 为确定性推断，进入 S_t；无修订/冲突/放弃逻辑。产品线有 governance（意图/聚焦）。
12. **Style 能否 Prediction→HumanEdit→Update 学习？** 有资产（改迹/向量/脉冲），但无"预测编辑→误差→更新"闭环；style-pulse 最接近。
13. **Outcome 是否真实存在？** 机制有，值合成（runTurn 硬编码 prediction/outcome）。
14. **Credit 是否真实存在？** 反事实函数有，runtime 用的是误差均分——**未达 P0**。
15. **Long-term learning 是否已证明？** 否（无真实纵向实验）。
16. **Director 是否绕过 runtime？** 是。
17. **Writer 是否受 cognitive state 控制？** 否。
18. **能否换 GPT/Claude/Qwen 不改核心？** csl 路径可（适配器层）；产品线直连 chatWithRetry，未过 Port——部分可。
19. **能否把 Stylotrace 作为 CSLA 第一个 vertical？** 能，这正是目标；当前是"平行线"而非"应用在 runtime 上"。
20. **最小 P0/P1/P2？** 见 `CSLA_MIGRATION_PLAN.md`。

---

## 11. 总结

```text
Current Architecture: 产品线（director 阶段机）+ 研究线（csl runtime）两条平行线
Target Architecture:  1 状态内核 + 1 动态控制器 + N 认知引擎 + 1 LLM/Tool 适配层 + 1 学习层；Stylotrace=vertical app
Critical P0:          (1) Credit 反事实接入 runtime（禁误差均分）
                      (2) Director 接入 CSLA Runtime（State→Action→Behavior 真实贯穿）
                      (3) Core Idea 缺失 → Writer 被阻塞（产品线 Cognitive Theater 消除）
Major P1:             (4) 统一 State Kernel（消除 csl-state 与 product state.json 双源）
                      (5) ContextAssembler 单一服务（消灭 40+ 模块自拼 prompt）
                      (6) Reasoning 算子补齐（Induce/Deduce/Abduce/Analogy/Causal/Counterfactual）
                      (7) LLM Port 贯穿产品线（makeLlm 替换直连 chatWithRetry）
P2:                   (8) 观测性统一（trace_id/cost）、(9) 并发隔离、(10) streaming
Cognitive Theater:    产品线（director/write/mcp/web 不读 csl-state）
Hardcoded Workflow:   director 阶段机；csl 占位 executor（search/plan/verify/simulate）
Real LLM Paths:       产品线全部真实；csl CLI 真实（opt-in 冒烟）
Mock-only Paths:      csl 单元/集成测试；E1–E6/B0–B9 未跑
Memory Status:        YELLOW（HRME 实现+红队通过；未与产品 RAG/风格记忆打通）
Reasoning Status:     YELLOW→RED（3/12 算子真实，其余占位）
Human Interaction:    csl 路径 GREEN；产品线 YELLOW（无 deep checkpoint 概念）
Learning Status:      UNKNOWN（机制有，证据无）
Director Integration: RED（绕过 runtime，仅 gate 接线）
Writer Integration:   RED（不读 cognitive state）
Top 10 Risks:         见 CSLA_RISK_REGISTER.md
Top 10 Actions:       见 CSLA_MIGRATION_PLAN.md
```

**最终判断：** `State→Action→RealBehavior→Outcome→Learning` 在 csl 最小路径已代码成立（GREEN）；
在**全系统范围**不成立（RED）——因为产品线绕过 runtime，Outcome/Credit 是合成/均分，长期学习无证据。
按规格第 31 节标准：**全系统不能给 GREEN。**
