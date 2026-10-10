# Harness 版本化发行（冻结模型、进化外壳）

**日期**：2026-10-10　**状态**：Phase D 核心已落地；Phase E（自动提案）未做

对应规范《Stylotrace × CSLA — 冻结模型、进化 Harness v1.0》。本文只记录**核实过的事实**，
以及实现时必须先回答的问题。

---

## 1. 先核实：规范里哪些阶段其实已经做完了

动手前逐条对着代码查了一遍，避免重做：

| 规范里的阶段 | 代码现状 | 证据 |
|---|---|---|
| Phase A 统一产品入口 | **已完成** | `cli.js` / `mcp.js` / `web/server.mjs` 都调用 `csl/adapter.js` 的 `runTask` |
| Phase B 写作认知链 | **大部分已完成** | `csl/brief.js` 已产出 goal/audience/coreIdea/authorPosition/claims/evidence/counterarguments/openQuestions/redLines/structure/artifactPlan |
| §L3 状态 API | **已完成** | `csl/state.js` 已有 `patch/commit/snapshot/restore/compare/stateVersion` |
| §9.2 故障分类 | **已完成** | `csl/failure.js` 的分类与规范列表高度重合（intent_drift / idea_flattening / style_drift / decision_drift / evidence_error / reasoning_error / audience_error / overclaim / context_loss） |
| Phase D Harness 可观测 | **本轮补齐** | `csl/harness.js` + 事件带 `harness_version` |
| Phase C 认知门 | **只有地基** | `fact-check.js` 是正则扫描 + 可选 LLM；没有 Claim Ledger、没有 epistemicType、没有门决策事件 |
| Phase E 离线进化 | **未开始** | 候选目前由人或外部优化器提出 |
| §L3 六个版本维度 | **只有 1 个** | `createCanonicalState` 只有 `schemaVersion` 与 `sVersion`；缺 authorModel / harness / model / artifact / eval 版本 |

结论：规范把 Phase A/B 列为待办是不准确的，会浪费工期。**真正缺的是 D、C、E 和版本维度。**

## 2. 规范里两处必须先裁决的矛盾

**矛盾一：证据门到底能不能被优化。** §4 第 9 条把"证据门与停止策略的非安全性配置"列为可进化，
§6.6 又要求证据门"不允许普通优化器直接改写"。什么算"非安全性配置"无法机械判定，
而 §6.4 又说"风险阈值必须根据验证集校准"——阈值到底谁定，没写。

**本项目的裁决（v1）**：证据门**整层冻结**（`evidence.*` 在白名单之外）。理由是边界不可机械判定时，
宽的那一侧就是奖励作弊的入口。等有评估数据，再单独开一个带门控的子集。

**矛盾二：没有进化预算。** §11 把 Cost 当指标，§12 Phase G 说"成本控制"，
但整份规范没有写一轮进化最多花多少 token。对一个自带密钥的产品，这是**约束条件**不是指标。
当前 `GATE_V0` 用"样本量 ≥ 8"间接限制了花销，但没有直接的预算上限。

## 3. 规范没写、但决定成败的两件事

**样本量。** §13 的假设 B 要求"优化 Harness 能在未参与优化的任务上带来可重复改善"。
个人写作场景的轨迹量是几十条量级，而 GEPA 一类方法在几十条上做选择会直接过拟合。
所以 `GATE_V0.minSampleSize = 8` 是**刻意加的拒绝条件**：样本不够时系统宁可不发布。

**评估器从哪来。** 规范列了 Intent Fidelity / Author Fit 等指标名，但没说怎么测。
如果靠 LLM 打分，优化器会把"让评委模型喜欢"当成目标——而这正是项目早就明确拒绝的方向
（不做 AI 判定器）。**能机械验证的指标优先，靠人打分的是最后手段**，这条要写进评估器设计。

## 4. 本轮实现了什么

### 4.1 `agent/src/csl/harness.js` — Harness Release Manager

- **可进化白名单 13 键**，只允许标量或标量数组。函数、表达式、代码片段一律拒收——
  否则"进化"会退化成任意代码注入。
- **冻结区 9 类**（`state.schema` / `auth.*` / `tool.permissions` / `events.integrity` /
  `safety.*` / `evaluator.*` / `eval.heldOutSet` / `gate.frozenZone` / `evidence.*`）。
  执法靠白名单；冻结清单的作用是让"什么不许动"写在代码里，并有结构性测试断言两者永不相交。
- **发布门 v0**：配对对照 + 留出集 + 样本量 ≥ 8 + 留出集提升 ≥ 0.02 + 回归率 = 0。
- **发行流程**：`propose → evaluate → publish / rollback`，每次提案/拒收/评估/发布/回滚都进
  `protocol/harness/releases.jsonl`。被拒的候选**留作负证据**，不静默丢弃。
- **版本叠加**：新版本发布时把父版本配置合并进来。否则每发一版都会静默回退掉之前所有改进
  （这个 bug 是被 `csl-harness` 测试当场抓出来的）。

### 4.2 事件带 Harness 版本

`csl/events.js` 给每条事件打上 `harness_version`。实测：同一账本里能区分 H0 与 H1 两次真实运行——
否则事后无法判断"变好是因为换了配置，还是因为换了模型"。

### 4.3 顺带修掉一个真 bug：q\* 里的重复项是装饰品

规范 §L2 的公式是 `q* = argmax[IG − λC − μI − ρR]`，但原实现先按**不含 ρ** 的分数选出唯一候选，
再由调用方把 ρ 加到这一个候选上。结果 ρ 只改显示分数、**永远改不了选择**：

```
differentiate 已问过 10 次（ρ=0.3）
  修复前：返回 differentiate，分数 −2.425
  修复后：返回 why，分数 0.5125
```

这正好对应规范 §9.2 里的 `Redundant Question`。现在 ρ 参与**全候选排序**。

### 4.4 一个诚实的发现：可调参数大部分是惰性的

现有问题候选库里，所有候选的 `cost` 都等于 1，且 `ig` 与 `intrusion` 的排序完全一致
（ig 高的侵入性也低）。这导致：

- **λ（cost 权重）改不了任何选择**——cost 全相等；
- **μ（intrusion 权重）改不了任何选择**——排序已被 ig 决定；
- **wIg 同理**；
- **只有 ρ 真的能改变选择。**

也就是说 13 个可进化键里，目前只有 1 个对浅层提问有实际作用。要么扩充候选库，让 ig 与侵入性
出现分歧（例如"高价值但私密的问题"），要么不要假装另外三个是可调的。

## 5. 怎么用

```bash
stylotrace harness                            # 当前版本、生效配置、发布门、冻结区
stylotrace harness log                        # 发行账本
stylotrace harness propose --config '{"question.weights.repetition":0.12}' --target redundant_question
stylotrace harness evaluate R-xxxxxxxx --results '{"paired":true,"heldOut":true,"sampleSize":24,"heldOutDelta":0.09,"regressionRate":0}'
stylotrace harness publish R-xxxxxxxx --by 张佑辅
stylotrace harness rollback --to H0
```

## 6. 还没做的

- **Phase E 自动提案**：候选仍由人或外部优化器提出，反思→提案的回路没接。
- **六个版本维度**：`authorModelVersion` / `harnessVersion` 只到事件层，没进 Canonical State。
- **Web / API 入口**：`harness` 目前只有 CLI（治理面属于离线运维，这是有意的）。
- **Claim Ledger**：认知门缺 claim 级结构。
- **B0–B4 对照**：规范 §11 的四层评估一个都没跑。
