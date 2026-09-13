# v1.6 运行时接入映射（17）— 73 模块 → 24 步状态机

**依据：** `CSLA_v1_6_EXECUTABLE_COGNITIVE_RUNTIME.md` §38（24 步算法）与 §39（现有映射）。
**原则：** 扩展不重写；每个现有模块必须回答 §50 五问（改哪个状态/被什么触发/启用什么行动/被什么反馈训练/如何持久化），否则不进入核心架构。

## 24 步运行时 ← 现有/新增模块

| 步 | 运行时步骤 | 现有模块（复用/适配） | 缺失/新增 |
| --- | --- | --- | --- |
| 1 | FastSalience / 显著性 | `observer.js`（观察）、`probe.js` 规则 | **缺**：salience 评分 + escalation 概率 `p_deep` |
| 2 | LanguageLoop 语言层 | `clarify.js` 一次一问、`prompts.js` | 有；保持"快答不深思" |
| 3 | DeepGate 升级门 | — | **缺**：`Gate(e)=σ(θ·[novelty,goalRel,decisionImpact,uncertainty,futureUtility,risk,−cost])` |
| 4 | Motive / Desire 更新 | `governance.js`（长期意图）、`intent.js` | 适配：补 Desire 五元组（preference/value/priority/urgency/commitment） |
| 5 | Goal 生成 | `intent.js`、`clarify.js`（confirmed） | 适配：`G=(G_inferred, G_confirmed)`，未确认不得当已确认 |
| 6 | Task 编码 | `genre.js`（文体蓝图）、`outline.js` | 适配：τ=(goal,state,constraints,resources,actionSpace,domain,horizon,successCriteria) |
| 7 | MetaPolicy 选认知模式 | `director.js`（决策）、`budget.js` | 适配：固定 operator 集 {retrieve,categorize,abstract,deduce,search,simulate,plan,verify,counterexample,ask,act,reflect,stop} |
| 8 | Workspace 显著性加权 | `style-memory.js`、`rag.js`（统一素材） | 适配：structured selection（允许非向量化） |
| 9 | MemoryRetrieve | `style-memory.js`、`knowledge.js`、`personal-model.js` | 有（检索≠学习已遵守）；评分分量需秩归一化（C5） |
| 10 | ContextRoute | `csl/operators.js`（新） | ✅ 已实现（分上下文/裁剪） |
| 11 | ParallelLLMOperators | `llm.js`、`csl/operators.js` | ✅ 已实现算子池；接 llm.js 多 provider |
| 12 | HypothesisAbstract | `outline.js`、`review.js`、`dissect.js` | 适配：候选→聚类→假设抽象 |
| 13 | Search / Verify / Counterexample | `rag.js`、`redteam.js`、`fact-check.js`、`academic.js` | 适配：主动反例引擎 |
| 14 | Plan | `outline.js`、`outline-review.js` | 有 |
| 15 | AuthorityController（α） | `director.js`（stage 决策） | **缺**：显式 α 计算与 action set {wait,ask,suggest,challenge,draft,execute,requestApproval} |
| 16 | JointAction | `agent_step`（导演对外接口） | 适配 |
| 17 | Outcome 观测 | `roundtrip.js`、`style-eval.js` | 适配：把用户反馈/成稿评估写入 outcome |
| 18 | PredictionAndOutcomeError | `csl/ledger.js`（新） | ✅ 已实现 error 记录；补 Error Decomposition 八通道 |
| 19 | CreditEngine | `csl/ledger.js`、`modulator.js` | ✅ 已实现 Basic（B0/B1/B2）；学习版远期 |
| 20 | SelectiveUpdate | `modulator.js`、`style-vector.js`、`avoidance.js`、`edit-transform.js` | 适配：只更新有 credit 的模块 |
| 21 | Replay | — | **缺**：离线重放（写作任务=重跑编辑对/成稿评估） |
| 22 | Consolidate | `style-adapter.js`、`library.js`（蒸馏） | 适配：加证据链 schema |
| 23 | SharedStateUpdate | `csl/state.js`（新） | ✅ 已实现版本化 S^C |
| 24 | StateTransition | `csl/state.js` + `workspace.js` | ✅ 已实现 |

## 结论

- **已具备（✅）**：10/11/12/18/19/23/24 —— v1.4 的五个新模块覆盖了运行时后半段。
- **需适配（多数）**：clarify/thinking/director/governance/rag/redteam/modulator 等现有模块
  已经覆盖语义，但需要按统一状态机接入（不是重写）。
- **真缺失（需新增）**：步 1（FastSalience）、步 3（DeepGate）、步 15（AuthorityController）、
  步 21（Replay）。这四个是"统一状态机"区别于旧架构的关键新增。

## 实施顺序（按 v1.6）

1. `csl/runtime.js`：24 步调度器（状态机本体，现有模块为算子，先接 mock LLM）；
2. FastSalience + DeepGate（确定性启发式，failure-case-first）；
3. AuthorityController（α 规则路由）；
4. Replay（重跑 edits.jsonl + 成稿评估）；
5. E1–E6 最小实验脚本（连续性/目标保真/创新挖掘/综合质量/恢复/学习）。
