# 实施规划框架（对照真实代码）

> 日期：2026-10-10 · 依据：主提示词 v1.1 + 对当前工作树的逐条核实
> 用法：这份文档回答"现在真实状态是什么、下一个该做什么"。所有断言都带代码位置，可当场复核。
> 原则：文档说"已实现"不算数，只有代码路径 + 测试才算数。

---

## 1. 已核实的事实基线

下面每一条都在当前工作树的真实代码里查过。**粗体结论**是与主提示词假设不一致的地方。

| 断言 | 证据 | 结论 |
|---|---|---|
| CLI / MCP / Web 共用同一认知入口 | `cli.js:1960`、`mcp.js:654`、`web/server.mjs:684` 都调 `csl/adapter.runTask` | 真——**但只在认知层统一** |
| `runTask` 产出文章 | `adapter.js:72-92` 的返回值只有 `kind / cognitiveAction / app / blocked / writerGate / question / reply / state / usage` | **假：不产出任何产物** |
| 认知动作到执行器有派发 | `adapter.js:10-20` 的 `ACTION_APP_MAP` 写了 `executor: 'write'/'redteam'/'rag'…`，但全仓无调用点 | **假：`executor` 是死字段** |
| CSLA 的 `generate` 会写文章 | `actions.js:215-218`：`(jt.hypotheses||[]).map(h=>h.claim).join('。')`；实测产物 `"门槛区分了内外。跨过门槛才算回家"` | **假：字符串拼接，不调 LLM、不调 Writer** |
| 真正会写文章的是哪条路 | `director.js:12` 引入 `writeSection`；`write.js:214` 把 `briefText(workspace)` 当 `cognitiveBrief` 传给 Writer | 是 director → write.js 这条**旧轨** |
| 两条轨是否相连 | `runTask` 不出现在 director 里，director 不出现在 `runTask` 里 | **不相连：两个半环** |
| Brief 字段是否齐 | `brief.js` 已有 goal/audience/purpose/coreIdea/authorPosition/claims/assumptions/evidence/counterarguments/openQuestions/authorSchemas/styleProfile/redLines/structure/artifactPlan；**缺 `lineage`**，且命名与主提示词差三处（`evidence`↔`evidenceRefs`、`authorSchemas`↔`authorSchemaRefs`、`styleProfile`↔`styleConstraints`） | 大部分已有 |
| 故障分类 | `failure.js` 已有 18 类（intent_drift / idea_flattening / overclaim / context_loss …） | 已有，不用重做 |
| State 内核 API | `state.js` 有 `patch / commit / snapshot / restore / compare / stateVersion` | 已有，不用重做 |
| 六个版本维度 | `state.js:152` 的 `createCanonicalState` 只有 `schemaVersion` + `sVersion`；`harness_version` 只到事件层 | **缺 5 个** |
| Claim Ledger | 全仓搜 `claimId` / `epistemicType` 无命中 | 未实现 |
| Harness 白名单 | 4 键已接线（`WIRING` + `scripts/audit-harness-keys.mjs` 验证消费符号），9 键未接线已单列 | 本轮修正 |
| 测试基线 | 76 个测试文件 / 655 项检查全过 | 见 §5 |

## 2. 差距表（按依赖排序）

依赖关系是硬约束：D2 不做完，D3–D8 的结论都无法归因。

| # | 差距 | 阻塞什么 | 状态 |
|---|---|---|---|
| **D1** | **Writer 未接入运行周期**：统一入口只做认知决策与门控，不产出文章 | 阻塞**所有**产品级证据——没有产物就没有质量、意图保真、编辑负担可测 | **本轮修掉主链**，见 §5.1 |
| D2 | 版本谱系：六维里只实现了 1 维 | 阻塞归因（分不清是换了配置还是换了模型） | **本轮完成**，见 §5.3 |
| D3 | 预算硬约束 | 阻塞成本控制与"耗尽后零调用"验证 | 未动 |
| D4 | Claim Ledger + 冻结 Gate | 阻塞事实保护与过度断言拦截 | 未动 |
| D5 | 9 个 Harness 键无消费点 | 已单列，不再冒充可调；等修消费点 | 本轮单列 |
| D6 | 十个指标没有划分主指标 / 保护指标 | 阻塞发布门（门是关键闸门，输入却是空的） | 未动 |
| D7 | B0–B4 与纵向实证全都未跑 | 阻塞一切"有效"声明 | 未动 |

## 3. 修正后的阶段

相对主提示词的改动有四条，都在下面标了 **[修正]**：

**P0 — 公开入口审计** ✅ 已完成
README / install.sh / site / docs / extras 共 22 个文件的私有仓库地址已改为公开仓库；
守卫通过（无论文、无密钥、无本机路径）；公开仓库 HEAD `33f2059`。

**P0.5 — Writer 接入运行周期 [修正·新增]** ✅ 已完成
已选路线 A：`runTask` 真的派发 `ACTION_APP_MAP` 的 executor。
`write` / `outline` / `deliver` 已接线并实测；`rag` / `redteam` 明示未实现。
Web 前端已消费 `executed` / `artifact` / `dispatchNote` 并在写稿后刷新成稿面板；
MCP `csl_turn` 同样回报派发结果（`mcp-fresh` 有断言守住）。
验收：`stylotrace run` 在具备大纲与核心主张的工作区上产出可读产物 ✅；
端到端真实模型实测产出 306 字正文节 ✅；有测试断言 artifact 只来自 executor、绝不为拼接串 ✅。

**P1 — 版本谱系进入 Canonical State** ✅ 已完成（§5.2）
新增 `csl/lineage.js`，七个维度逐条落地；事件带 `lineage_id`；`lineage history` 可对比。
验收：六维可追踪 ✅；H0/H1 混合运行可归因（`diffLineage` 只报 harnessVersion 变化）✅；
CLI/MCP/Web 三端都经 `runTask` 自动登记 ✅；sessionId 含路径字符不越界 ✅（有测试）。

**P2 — 预算硬约束**
[修正] 预算表补 `maxEvolutionCalls` 与**人类时间预算**（`maxHumanMinutes`）。
理由：§12.2 把作者盲选列为首选评估器（每候选 n≥8），而作者注意力是这个系统里最稀缺的资源，
原预算表只有 token 和 `maxWallTimeMs`，没有它。
验收：所有模型/工具调用前检查；单轮/单任务/进化三套独立预算；耗尽后零新增调用。

**P3 — Claim Ledger 与冻结 Gate v1**
验收：claim / evidenceRef / gateDecision 可序列化可回放；pending 检索不算完成；Gate 配置不在白名单内。

**P4 — 指标、评估器与数据集契约**
[修正] 必须把 §12.1 的十个指标**明确划成主指标与保护指标**，并给每个指标定义计算方式、尺度、方向和来源。
现有发布门写着"主指标 +0.02、保护指标零回归"，但没有任何一处说明谁是谁。

**P5 — 作者个体学习最小闭环**
验收：明确确认的偏好可更新个人画像；推断与事实分开；可查看/撤销/重置；A 的偏好不污染 B。

**P6 — Harness 键逐项接线与效用验证**
[修正] 必须给出**总成本上限**：9 个键 × 任务数 × 重复数 × 2 臂是模型调用量级，
不给上限就违背了 §9 自己立的预算原则。
每种键先做三层检查（静态消费点 → 行为差异 → 真实任务效用），结论可以是 `no_consumer` / `inactive` / `sensitive_not_useful` / `active_candidate`。

**P7 — 条件开启离线提案**
只有当 P1–P6 成立且至少有一个 `active_candidate` 时执行；默认关闭；没有合格对象时允许停止该阶段。

**P8 — B0–B4 与纵向实证**
固定模型与预算；个人适应与全局 Harness 分开实验；对未见任务验证；不确定就报不确定。

**P9 — 生产加固**
并发锁、取消与恢复、隐私隔离、密钥与限速、可观测性、数据导出与删除、多入口一致性。

## 4. 两处与主提示词不同的地方 [修正]

**Shadow / Canary 在这个产品里不成立。** 主提示词 §11.5 的流程以 `Shadow / Canary → Publish` 收尾，
§5.3 也说的是"全局运行配置"。但 Harness 实际存在**用户自己的工作区**（`protocol/harness/current.json`），
没有一群人可以做金丝雀。要么说明这是给未来服务端产品预留的，要么承认这是从服务端流程照搬。
本规划采用后者：**运行时循环不做灰度；影响所有使用者的改动属于代码发布，由人评审发版。**

**权限边界写进代码而不是写在文档里。** `harness.js` 的 `AUTHORITY` 已声明作用域为工作区，
冻结区靠白名单执法——白名单外的一切，循环连碰都碰不到。

## 5. 本轮的增量

### 5.1 应用派发（D1 主链）

新增 `agent/src/csl/dispatch.js`：`ACTION_APP_MAP` 里写了很久、却从来没有调用点的 `executor` 现在真的被执行。
语义是一次调用执行一个 executor（`S_t → a_t → Execute(a_t) → S_{t+1}`），不在一次调用里跑完整链——
那会绕过 Human Checkpoint，并且违反预算硬约束。

- `write` executor：从 `draft.md` 已写到位置继续，每次写一节，返回产物、进度与剩余节数。
- `outline` executor：`write` 的前置条件；素材门槛没过就如实报缺什么，不硬撑。
- `deliver` executor：不做 LLM 调用；没有成稿就拒绝交付，还有没写的节就**明确标注"这不是完整稿"**。
- `rag` / `redteam`：**明示 `not_implemented`**，不伪装成功。
- `clarify` / `checkpoint` / `chat`：由认知循环内联处理，不重复执行。

`runTask` 新增 `executed` / `artifact` / `dispatchNote` 三个字段。**关键不变量**：
`artifact` 只可能来自 executor；executor 没执行时它是 `null`——
认知循环内部 `hypotheses.join('。')` 那个拼接串永远不会被当成文章返回。

**端到端实测（真实模型，非 mock）**：`dispatchApp('write')` 在带大纲与核心主张的工作区上
产出了 306 字的正文节，写入 `draft.md`。文中出现"这话我没法证实"这类限定——
说明 Brief 里的作者立场约束确实传到了 Writer，而不是字符串拼接。

### 5.2 Harness 白名单诚实化

**P1 版本谱系（对应 D2）**

新增 `agent/src/csl/lineage.js`。每次 `runTask` 登记一条不可变 lineage，落在
`protocol/lineage/<sessionId 的哈希>.json`（当前）与 `protocol/lineage.jsonl`（历史）。
七个维度：

| 维度 | 来源 | 说明 |
|---|---|---|
| `modelRef` | 调用方 `metadata.modelRef`，否则读进程配置 | 拿不到就 `unversioned`，不猜 |
| `harnessVersion` | `harness.currentVersion()` | 已有真实版本号 |
| `authorModelVersion` | 画像文件内容哈希 | `vault/` 五个文件；一个都没有就是 `unversioned` |
| `controllerPolicyVersion` | **正在运行的** `actions.js` 内容哈希 | 没有语义版本就不伪造 |
| `retrievalPolicyVersion` | 正在运行的 `rag.js` 内容哈希 | 同上 |
| `writerPolicyVersion` | 正在运行的 `write.js` 内容哈希 | 同上 |
| `stateSchemaVersion` | `protocol/state.json` | 独立管理，与行为版本分开 |

把"策略版本"定义成**正在跑的那个源文件的哈希**，是主提示词 §6.1 允许的做法
（"记录明确的 `unversioned` 或稳定组件 hash，不能伪造版本语义"）。它带来的性质是：
策略改了哈希必变、同一次提交永远同哈希——够用来归因，又不假装是人工维护的版本号。

事件同时打上 `lineage_id`；`lineage.history` 加 `diffLineage()` 可以一键看出两次运行差在哪。
实测：同一会话先跑一次（H0）再发布 H1 跑一次，`diffLineage` 只报 `harnessVersion` 一项变化。

### 5.3 Harness 白名单诚实化

**Harness 白名单从"13 个声明"改成"4 个已接线 + 9 个未接线单列"。**

静态消费点审计（§11.3 第一层）结果：13 个键里只有 4 个真的被读——提问权重经 `questionWeights()`
投影成 `{wIg, lambda, mu, rho}` 注入 `chooseQuestion`。其余 9 个设置之后什么都不会发生：
`memory.retrieval.topK` 在 `replay.js:109` 是函数默认参数、`decay` 在 `hrmr.js:178` 同理、
`action.weights.*` 的动作价值表在 `actions.js` 里写死、`writer.*` 与 `prompt.systemSuffix` 无消费点。

改动：`EVOLVABLE_KEYS` 只留 4 个已接线键；新增 `WIRING`（每个白名单键必须登记消费符号）
与 `DECLARED_NOT_WIRED`（9 个键逐条写明缺哪段接线）；`checkCandidate` 对未接线键返回 `no_consumer`
而不是 `not_evolvable`——报错要能让人看出"设了没用"，而不是"写错了"。
新增 `scripts/audit-harness-keys.mjs` 可复跑，无消费点即退出码 1。

这样做的依据是主提示词自己的裁决：§4.4「参数没有任何消费点属于代码缺陷」、
§11.3「无效参数移出候选进化空间」、§14.5「不要为保持抽象架构完整而保留行为无效的参数」。

## 6. 本规划不做的事

- 不重做统一入口、Brief、State API、故障分类——它们已经存在且可用。
- 不新增脑区命名、Agent 角色或抽象层。主提示词 §5.2 已说明角色是逻辑职责，不必各建一个 Agent。
- 不在 P0.5 之前做任何"进化"相关建设——没有产物就没有可优化的对象。
- 不为了交付自动优化而制造优化目标。
