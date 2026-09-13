# CSLA Code Responsibility Matrix（Model vs Code）

**日期：** 2026-08-29 · **依据：** 全模块 import/LLM 调用扫描（agent/src 75 模块）
**原则：** LLM 做"高熵认知工作"；代码做"确定性系统工作"。

---

## 1. 工作类型边界表（目标）

| 工作 | LLM | Code |
| --- | --- | --- |
| 语义理解 / 意图 | ✅ | |
| 候选假设生成 | ✅ | |
| 深层语言推理 / 论证 | ✅ | |
| 候选比较 | ✅ 可辅助 | ✅ 结构检查 |
| 搜索计划 | ✅ | |
| 搜索执行 | | ✅ |
| JSON 校验 / schema 验证 | | ✅ |
| 排序 / 过滤 / 计数 / hash / 时间戳 | | ✅ |
| state version / 权限检查 / 幂等 | | ✅ |
| 精确算术 / cost 聚合 | | ✅ |
| 数据库 / 文件查找 | | ✅ |

## 2. 模块清单（LLM 用户 vs 确定性）

### 2.1 真实调用 LLM 的模块（39 个，直连 chatWithRetry）

| 模块 | 职责 | 边界评价 |
| --- | --- | --- |
| clarify.js | 澄清问答 | ✅ 语义工作 |
| interview.js | 采访式挖掘 | ✅ 语义工作 |
| outline.js | 大纲生成 | ⚠️ 大纲结构校验建议代码侧二次验证 |
| write.js | 逐节写作 | ✅ 语义工作；草稿质量门在代码侧 |
| redteam.js | 红队审稿 | ✅ 语义工作 |
| proofread.js / academic-norm.js / consistency.js | 校对/规范/一致性 | ⚠️ 检测与修复可拆分：检测尽量确定性+LLM 复核 |
| fact-check.js | 事实核查 | ✅ 语义判断；来源查找应在代码侧 |
| rag.js | 检索 | ⚠️ 查询生成 LLM、执行应走工具层 |
| style*.js / modulator.js / token-decode.js | 风格 | ✅ 语义判断；向量/统计在代码侧 |
| director.js | 决策 | ⚠️ LLM 选动作 OK，但 JSON 解析应代码侧强校验（现有 try/catch 回退） |
| reader-gallery.js | 读者群像 | ✅ 语义工作 |
| restyle / revise / polish / transform | 改写族 | ✅ 语义工作 |
| roundtrip.js | 回译校验 | ✅ 语义 + ⚠️ 信息点核对可代码侧 |
| library.js / knowledge.js / bible.js / persona.js / character.js | 素材/人格 | ✅ 语义；检索/归档应在代码侧 |
| concretize.js / dissect.js / fake-thinking.js / intent.js / observer.js / synthesize.js / experiment.js / doc-pipeline.js / point-edit.js / author-sheet.js / academic.js | 各垂直能力 | ✅ 语义工作 |

### 2.2 确定性模块（无直接 LLM 调用）

`avoidance`（个人回避库）· `budget` · `citation`（GB/T 7714 格式化）· `constraints` · `edit-transform` ·
`genre`（分类规则）· `governance`（意图/聚焦）· `history`（快照）· `io`（docx/导出）· `mcp`（调度）·
`originality`（查重规则）· `personal-model` · `preset` · `profile` · `prompts`（模板库）· `purpose` ·
`setup` · `stats` · `structure`（结构模板）· `stylometry` · `workspace`（文件/状态）· `credentials` · `config`

### 2.3 CSLA 算子（csl/）

| 算子/引擎 | 实现 | 责任方 |
| --- | --- | --- |
| fastSalience / DeepGate | 确定性规则 | Code |
| chooseQuestion (q*) | IG−λCost−μIntrusion−ρRepetition | Code |
| actionValue (Q) | 启发式价值 | Code |
| compare / counterexample / abstract | 确定性（字符/知识库） | Code（LLM 版列为扩展） |
| abstract→发散/分析/质疑 | `llm.run` 多算子 | LLM |
| generate / native_reasoning | `llm.run` | LLM |
| search / plan / verify / simulate 等 | 占位 executor | 待接工具层 |
| HRME bind/schema/decay/retrieve | 确定性语义 KB | Code（LLM Semantic Decomposer 为扩展） |
| recordOutcome / basicCredit | 账本 + 启发式 | Code（但 credit 均分违规，见 P0） |
| interveneAndCredit | 配对干预反事实 | Code（runtime 未用） |

## 3. 发现的边界违规/风险

1. **Credit 误差均分**（csl/ledger.js basicCredit）：把"哪个模块造成结果"用 δ/N 分摊——**P0 违反**；
   反事实函数已存在但 runtime 未调用。
2. **runTurn 合成 Outcome**：prediction=0.8、outcome 由 alpha 决定——把"结果评估"当"真实反馈"提交账本，
   属于假 Outcome（YELLOW→RED）。
3. **产品线 40 模块各自组 prompt**：无统一 ContextAssembler；同一状态被不同模块重复序列化。
4. **director LLM 输出仅 try/catch 回退**：JSON 决策有 allowed 白名单（好），但 schema 校验可更强（代码侧）。
5. **HRME bind 为规则正则**：否定/被动已修复，复杂句仍会漏绑（确定性限制，诚实标注为扩展点）。

## 4. 目标迁移后的矩阵（精简）

| 层 | LLM | Code |
| --- | --- | --- |
| L1 浅层 | 语义回复/问题生成 | q* 选择、去重、DeepGate、状态 I_t |
| L2 内核 | — | 版本、事件、Delta、Commit |
| L3 控制器 | 动作提议（LLMProposal） | 最终选择、Q 值、Stop/Ask/权限 |
| L4 引擎 | 语义算子（假设/反驳/类比/写作） | 确定性算子（Compare 结构/反例 KB/HRME 生命周期/阈值） |
| L5 Runtime | Provider 适配 | Port、ContextAssembler、工具执行、重试/超时 |
| L6 学习 | — | Outcome 账本、反事实 Credit、Policy/Schema/Style 更新 |
