# CSLA × Stylotrace — Implementation Readiness Report

**版本：** v1.0 · **日期：** 2026-08-28 · **性质：** 第一轮 Codex 工作交付物（只分析，未改代码）

> 依据 `CODEX_MASTER_HANDOFF_PROMPT.md` 第 18 节执行：仓库审计 → 阅读全部架构/研究文档 →
> 映射现有模块到 CSLA/JCC → 识别可复用/适配/缺失 → 检查测试与入口 → 产出本报告。
> 诚实第一：A/B/C/D 四类状态严格区分，不把设计当实现。

---

## 0. 执行摘要

Stylotrace 是**可复用的真实工程**（73 模块、44 套测试、六种部署形态），不是空壳；
CSLA/JCC 是**已设计未实现**的研究架构（v1.2 规格 + 总设计 + 理论审计齐全）。

结论：

1. **CSLA 不应替换 Stylotrace，而应在它之上加一层"认知运行时"**；Stylotrace 的澄清/思想脉络/
   改迹调制/调制器/审计/记忆/导演已经覆盖 CSLA 约一半的机制（多数在"语义近似"层面）。
2. **真正缺失的是 CSLA 的核心闭环**：版本化共享认知状态、结构化认知事件（Trace）、结果账本、
   信用引擎、创新挖掘器、多算子池+上下文路由、巩固/重放。这些 Stylotrace 没有。
3. **理论审计（C1–C8）必须先于编码**：信用公式、世界模型、记忆评分、元认知等 5+ 处数学/语义
   不闭合项必须落成 design notes 并修正，否则实现会返工。
4. **优先实现五个新增模块**（见 §E），并复用现有 20+ 模块做映射，不重写。
5. **第一里程碑不是"把 CSLA 做完"**，而是跑通一条端到端路径（见 §K），证明
   `Human Insight → AI 候选 → 人类选择 → 产出 → 结果 → 学习 → 下一轮更好`。

---

## 1. 文件清点（强制阅读顺序的落实情况）

| 要求读取的文件 | 状态 | 说明 |
| --- | --- | --- |
| `CSLA_STYLOTRACE_MASTER_UPDATE_PLAN.md` | ✅ 已读（~/Downloads，1135 行） | 总设计入口 |
| `CSLA_v1_3_JCC_SPEC.md` | ❌ **缺失** | ~/Downloads 与仓库中均不存在；JCC 定义目前只见于 master plan 各节，未单独成档 |
| `CSLA_v1_2_COMPLETE_SPEC.md` | ✅ 已读（~40KB） | 规范规格，48 节 |
| `AGENTS_CSLA.md` | ✅ 已读 | 工程规则 |
| `CSLA_ARCHITECTURE_DECISIONS.md` | ✅ 已读 | 12 条 ADR |
| `CSLA_API_CONTRACT.yaml` | ✅ 已读 | REST 契约 |
| `README_CSLA.md` | ✅ 已读 | 定位 |
| `PROJECT.md` | ✅ 已读（本仓库，本人撰写） | 真实状态 |
| `docs/` 架构/理论/调制器/风格/互操作 | ✅ 已读关键件 | THEORY / MODULATOR / STYLE-SYSTEM / INTEROP / UNIFIED-TOKEN-FRAMEWORK |
| `agent/src/`、`agent/test/` | ✅ 已审 | 73 模块、44 测试 |

**缺失报告：** `CSLA_v1_3_JCC_SPEC.md` 不存在。JCC（Joint Cognitive Control）的定义散落在
master plan（J_t 联合状态、alpha_t 动态控制权、Human/AI 权责分配）与 v1.2 中，但没有独立规格。
建议在 Phase 0 补齐该文档（冻结 J_t 状态与 alpha 路由语义），否则实现时以 master plan 为准，
存在口径漂移风险。

---

## 2. A — 当前系统真实做到了什么（已验证）

- 完整写作工作流：澄清 → 大纲 → 逐节写作 → 复阅 → 反 AI 审计 → 读者群像 → 质量门 → 交付，
  半自由导演（LLM 自主决策 + 确定性状态机兜底）。
- 改迹调制：作者修改（原文→改后→意图）→ 外层调制器权重学习 → 候选级评分选优，
  附可解释得分分解；44 套测试覆盖。
- 风格系统：四层向量 + 双风格档案 + 记忆检索 + 回避库 + 改迹变换/拟改 + 风格脉搏。
- 治理层：输入治理面（长期意图/当前聚焦）、目的→风格、结构装置、成功标准→约束、
  具体性/情感评分特征（本轮已实现并测试）。
- 知识/证据：个人知识库 + RAG 供给循环 + 事实核查 + 引文管理。
- 质检：反 AI 审计、校对、学术规范、原创性、回译校验、伏笔一致性、情绪/节奏曲线。
- 六种形态：CLI（60+ 命令）、MCP（~44 工具）、skill、Web（BYOK）、FastAPI（BYOK）、
  DSH 插件（npm 0.1.15）。
- 边界（如实）：候选级而非 token 级；LLM 强依赖；无真人长期验证；无公开用户。

## 3. B — 哪些理论已有实现（映射表）

| CSLA/JCC 概念 | 现有模块 | 实现程度 |
| --- | --- | --- |
| Task / Goal State | `clarify.js` `intent.js` `governance.js` `purpose.js` `constraints.js` | 语义近似：state.confirmed/intent/governance 存在，但**非版本化共享状态** |
| Cognitive Trace（部分） | `thinking.js` `style-pulse.js` `edit-transform.js` `vault/edits.jsonl` | 记录主张/修改，但**无结构化 event（prediction/outcome/error/credit/provenance）** |
| Memory（M^E/M^S/M^W） | `style-memory.js` `personal-model.js` `knowledge.js` `library.js` `profile.js` | 情景/语义/工作记忆以 JSON 存在；**无 replay/consolidation，检索≠学习已基本遵守** |
| Reasoning / 推理算子 | `outline.js` `review.js` `dissect.js` `redteam.js` `fake-thinking.js` | 有单算子实现；**无统一算子接口与元控制选择** |
| Evidence / 验证 | `fact-check.js` `proofread.js` `academic-norm.js` `originality.js` `roundtrip.js` | 有；**无 evidence binding 到 hypothesis 的结构化模型** |
| Policy / Gating | `modulator.js` `token-decode.js` | 候选级评分+学习权重=轻量策略；**无显式策略层/alpha** |
| Negative memory / inhibition | `avoidance.js` | 有 |
| Long-horizon consistency | `consistency.js` `bible.js` | 有（伏笔/世界观） |
| LLM Gateway（部分） | `llm.js` `credentials.js` | OpenAI 兼容单网关+凭据发现；**非 provider-neutral 多算子池** |
| Tool bus | `mcp.js` `rag.js` `io.js` | 有 MCP server；**无 ToolSpec 风险/审批契约** |

## 4. C — 哪些理论没有实现（真缺失）

1. **Shared Cognitive State Store**：版本化、可审计的联合状态（J_t = H/A/S/W/G/I/alpha/U）。
2. **Cognitive Event / Trace**：结构化高价值事件（含 prediction/outcome/error/uncertainty/credit/provenance）。
3. **Outcome Ledger**：预测→行动→结果→误差→反馈→信用→更新的闭环账本。
4. **Credit Engine**：模块×时间×经验的信用分配（当前只有调制器权重的终端式学习）。
5. **Innovation Elicitor**：信息增益选问题（q\* = argmax IG − λ·Friction）、Core Idea K 捕获与保护。
6. **LLM Operator Pool + Context Router**：divergent/analyst/skeptic/researcher 等算子各看不同上下文。
7. **Evaluation / Deliberation**：候选聚类→假设抽象→证据绑定→矛盾/反例→人类对齐→综合。
8. **Replay / Consolidation**：经验重放、证据链图式、再巩固版本化。
9. **Authority Controller**：alpha_t 动态控制权（当前导演是"一票"决策，无显式校准）。
10. **World / Evidence Model**：预测式任务/世界状态模型（当前只有检索，无预测）。

## 5. D — 模块重合 / 需适配而非重写

- `director.js` 是 executive control，但 CSLA 要求生成层是 operator pool；导演保留为"决策编排"，
  生成层抽成 pool（`llm.js` 改造成 operator gateway）。
- `clarify.js` 已有一问一答，可升级为 Innovation Elicitor 的宿主（加入 IG 式选问与 Core Idea 捕获）。
- `edits.jsonl`/`point-edit.js`/`absorb.js` 是 Cognitive Trace 的天然落点（补 event 字段）。
- `modulator.js` 的权重学习是"终端奖励"式；CSLA 信用引擎可把它当作第一个 credit 消费者。
- `profile.js`/`knowledge.js` 已具备记忆的持久与迁移；缺的是 consolidation。
- `state.json` 是现有状态，但**未版本化**；需新增版本化 Shared State 层（不破坏现有字段）。

## 6. E — 先实现哪五个新增模块（按依赖顺序）

1. **CognitiveStateStore**（版本化 S^C，含 goal/coreIdea/hypotheses/evidence/questions/decisions/uncertainty）
2. **EventStore / CognitiveTrace**（结构化 event 写入 + 查询；状态每次变更产生 event）
3. **InnovationElicitor**（复用 clarify 宿主，加高价值问题选择与 Core Idea K 捕获）
4. **LLMOperatorPool + ContextRouter**（llm.js 之上加 operator 定义与上下文打包，多候选生成）
5. **OutcomeLedger + BasicCreditEstimator**（prediction/outcome/error/credit；先做启发式 credit，
   与 modulator 权重学习对接）

Replay/Consolidation、Authority Controller、World Model 放到第二批（依赖前五项的 event 数据）。

## 7. F — State schema 应该在哪里落地

- 新目录 `agent/src/csl/`（CSLA 运行时），首个文件 `agent/src/csl/state.js`：
  `CognitiveState`（S^C 内容层，版本号递增）+ `Θ` 参数层分离（遵循 C1 修正）。
- 持久化：`protocol/state.json` 升级为 `{schemaVersion, sVersion, content, paramsRef, updatedAt}`，
  兼容现有字段；快照历史存 `vault/state-history/`。

## 8. G — Event schema 应该在哪里落地

- `agent/src/csl/events.js`：`CognitiveEvent`（event_type/event_id/session/step/state_version/
  goal/observation/action/prediction/outcome/error/uncertainty/credit/provenance/cost）。
- 持久化：新增 `protocol/events.jsonl`（与 `context.jsonl` 并存；context 保留人类可读日志，
  events 是结构化账本）。

## 9. H — Cognitive Trace 怎么接入现有 edit flow

修改落点：`workspace.absorbEdit`（吸收编辑）与 `point-edit.js`/`director.applyCorrectionFeedback`。
接入方式：在每次人类修改处追加写一条 CognitiveEvent——
`human_input`（原修改意图）→ `ai_proposal`（修改前候选）→ `human_edit`（改后文本）→
`goal/hypothesis`（来自当前 state）→ `prediction`（期望效果，可选）→ `outcome`（后续反馈回填）→
`credit`（先留空，由信用引擎回填）。不强迫用户解释每次修改；只有高价值/可疑修改才轻量询问 reason。

## 10. I — LLM Gateway 是否已经可复用

可复用但需扩展：`llm.js`（chatWithRetry/parseJsonContent，OpenAI 兼容）与 `credentials.js`
（多来源凭据发现）是基础。需要新增：
- provider 抽象接口（OpenAI/Anthropic/Gemini/local 统一 generate 签名）；
- operator 上下文打包（不同 operator 看不同 Context Bundle，不塞全部历史）；
- response_schema / metadata / budget 参数透传。

## 11. J — 前端最少需要哪些改动

Web（`web/public`）现有：对话、实时大纲、上下文面板（我的理解/素材/思想脉络/风格进度/RAG）、
审计页。最小改动：
- 上下文面板扩展为 **Cognitive Workspace**：Goal / Core Idea / Questions / Evidence /
  Hypotheses / Decisions / Open Problems（多数字段已在 state 里，加展示即可）；
- 人类决策门已有（大纲确认），新增"选择核心观点/方向"门；
- Trace/Learning 面板（可选，二期）。

## 12. K — 第一条端到端 demo path

```text
模糊想法
→ InnovationElicitor 问一个高价值问题（复用 clarify）
→ 捕获 Core Idea K（保护人所有权）
→ 2–3 个 operator 并行生成候选（Context Router 分上下文）
→ redteam/fact-check 验证 + 聚类/矛盾检查（复用现有质检）
→ 人类选择方向（决策门）
→ 现有写作/风格化管线成稿
→ 交付 + 用户反馈 → Outcome/Feedback 事件
→ 调制器权重/记忆更新 → 下一轮
```

验收标准：同一任务重复 N 次，若行为/产出无可见变化则学习失败；第一次犯错后若永远重复则信用失败。

## 13. L — 设计理论冲突（编码前必须修正）

来自理论审计 C1–C8，另加与现有系统的集成冲突：

- **C1** 状态/参数自指 → S^C 与 Θ 拆分。
- **C2** 复合误差量纲混加 → 双通道（world/reward）分别路由。
- **C3** 信用 baseline 不唯一 → Shapley/学习估计器 + canonical baseline + 配对运行。
- **C4** 世界模型可平凡塌缩 → stop-grad/对比约束，或 MVP 先用结构化预测器。
- **C5** 记忆/巩固评分分量不可比 → 先秩归一化再加权。
- **C6** 口述置信不可靠 → 用采样一致性/熵代理，校准后路由。
- **C7** 信用聚合避免裸求和 → min-form/Shapley，防 reward hacking。
- **C8** 须明示与 CoALA 的 delta，避免"重新发明认知架构"表述。
- **集成冲突 1**：现有 director 是"单 LLM 自主决策"；CSLA 要求 operator pool——需在"导演=决策编排"
  与"生成=多算子"之间明确边界。
- **集成冲突 2**：现有风格系统把"用户偏好"当学习对象；CSLA 要求 Style→Preference→Decision
  Pattern→Schema 分层，不能把风格直接当认知。需要新增分层存储，不破坏现有风格管线。

## 14. M — 可能重复已有项目/论文

- **CoALA**（Sumers et al. 2023）：记忆类型、动作空间、决策循环、学习动作——CSLA 骨架与其高度重合，
  必须把 novelty 收缩到"冻结 LLM 下模块×时间×经验的因果信用 + 选择性巩固"（理论审计 §7 已给可辩护命题）。
- Generative Agents / Voyager / Reflexion / ExpeL / Mem0 / MemGPT：情景记忆/反思/技能库已有先例。
- LifelongAgentBench / MemoPilot / MemRL：已实证"朴素重放不足、记忆更新需训练"——直接威胁
  CSLA 的启发式写门假设，必须作为强基线。
- Stylotrace 自身论文已声明改迹调制等贡献；CSLA 层不得与论文既有主张混为一谈。

## 15. N — 哪些东西必须实验验证（不得宣传为事实）

- E1 创新挖掘（直接生成 vs 固定问卷 vs IG 提问）；
- E2 候选综合（单 LLM vs 多采样投票 vs 多算子综合）；
- E3 决策学习（静态风格 vs 编辑偏好 vs 决策轨迹学习）；
- E4 信用（终端奖励 vs 均匀传播 vs 学习信用 vs 反事实信用）；
- E5 巩固（无 vs 新颖性 vs 误差 vs 信用加权）；
- E6 纵向协作（session t+1 是否优于 t）；
- E7 联合创新（人独作 vs AI 独作 vs 人+常规 AI vs 人+CSLA）；
- E8 控制权校准（何时该说/问/建议/执行/沉默）；
- 五个证伪实验：CoALA+terminal reward 等算力对比、信用坍缩、置信校准、记忆污染、世界模型价值。

---

## 结论与下一步

现状可总结为：**工程已就绪，认知闭环未开始**。CSLA 对 Stylotrace 的正确关系是"增量认知运行时"，
不是重写；第一阶段只需新增 §E 的五个模块并把它们接到现有 clarify/edits/modulator 上，即可形成
可实验的第一条端到端路径。

建议下一步（等待确认后执行）：

1. 把本报告 + 全部 CSLA 文档纳入仓库版本管理（`docs/csla/`），并补齐缺失的 `CSLA_v1_3_JCC_SPEC.md`；
2. 落 `docs/design_notes/` 记录 C1–C8 与两个集成冲突；
3. 实现 CognitiveStateStore + EventStore（纯函数 `(state,event,action)→(nextState,ledger)`）+ 测试；
4. 接入 InnovationElicitor 与 OperatorPool；
5. 跑通 §K demo path 并建立"同任务重复"基准。

在收到确认前，本轮未修改任何代码或仓库结构。
