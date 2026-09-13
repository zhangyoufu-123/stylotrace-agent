# CSLA RED TEAM REPORT — Cognitive Runtime Falsification

**日期：** 2026-08-28 · **角色：** 首席红队研究员（Falsification Agent）
**方法：** Documentation ↔ Implementation ↔ Tests 交叉验证；目标 = 杀死 CSLA，不辩护。
**结论先行：** **CSLA 当前不能被称为"认知系统"；它是一个"架构 + 一个最小行为闭环（replay→策略）+
大量文档化未实现机制"的复合体。** 若以"Experience→Outcome→Learning→ChangedFutureBehavior"
为最低判据，仅 Replay 一项有最小证据，其余机制要么未接入产品、要么是占位实现。

---

## 1. Executive Verdict

- **认知系统最低判据**（PersistentState + AdaptivePolicy + Memory + Reasoning + Outcome + Learning）：
  PersistentState ✅ · Memory ✅（episodic+replay）· Outcome ✅ · Learning ⚠️（replay 规则，非学习）
  · Reasoning ❌（未实现）· AdaptivePolicy ❌（固定序列 + 两档 authority）。
- **总体判定：YELLOW 偏向 RED。** 架构存在，但"认知"大多未接入产品、未实证；几个核心机制是占位。
- 三个最重要的事实（均有代码证据）：
  1. `agent/src/csl/` **未接入** `director.js`/`write.js`——认知状态不驱动真实写作；
  2. Credit = 参与模块**均匀分摊**（≈随机归因），baseline 只是标签，无真实 do() 干预；
  3. Reasoning operators（Compare/Induce/Abduce/Analogize/Causal/Counterfactual/Recombine/Simulate）
     只有文档，无实现。

## 2. Critical Failures（RED）

| # | 攻击 | 证据 | 判定 |
| --- | --- | --- | --- |
| 28 | Credit ≈ 随机归因 | `ledger.js`：`credit[m]=error/len`（均匀分摊）；无 do() 干预 | RED |
| 29 | Fake Counterfactual | `basicCredit` 的 B0/B1/B2 仅记录口径，不执行真实反事实 | RED |
| 25 | Authority 伪动态 | `runtime.js:109`：`alpha = risk>0.5 ? 0.2 : 0.6`，两档硬编码 | RED |
| 32 | Cognitive Theater | csl state 不驱动产品流（director/write 无 csl import）；hypotheses/decisions 写进 JSON 但不被生成读取 | RED（最高风险） |
| 30 | Schema Hallucination | schema 只追加 success/fail 证据，无 confidence 随证据数/多样性/反例变化 | RED |

## 3. High-risk Weaknesses（YELLOW→RED）

| # | 攻击 | 证据 | 判定 |
| --- | --- | --- | --- |
| 1 | Workflow masquerading as cognition | runtime deep 路径是固定序列（elicit→operators→verify→authority→…）；v1.8 说"24步≠流水线"但实现是流水线 | YELLOW→RED |
| 3/6 | Fake learning | replay R4 使策略 draft→ask（行为改变存在），但 policyFor 是**手写规则**（failRate>0.5→ask），非学习 | YELLOW |
| 16 | DeepGate 未校准 | fastSalience/deepGate 是正则启发式，无校准曲线 | YELLOW |
| 18 | Desire/Goal 无层级测试 | desire 只存 preference/priority/urgency，无 commitment；无 Desire≠Goal≠Action 测试 | YELLOW |
| 27 | Catastrophic drift 无测试 | 无 reconsolidation 版本化测试（style A→B 切换） | YELLOW |

## 4. Medium Weaknesses

- 7–14（Pattern Separation/Completion/Induction/Deduction/Abduction/Analogy/Comparison）：
  **全部只文档、无实现**——v1.7/v1.8 声称的算子一个都没落地。
- 17（Replay→Recombination→FutureSimulation）：Replay 有，Recombination/FutureSimulation 无。
- 20（Ask-human）：elicit 从固定问题库选最高 IG，非学习型；无用户负担实验。
- 23（Fast/Deep 泄漏）：F1 测试证明"嗯→快答"，但无系统化 compute-waste 测量。

## 5. Passed Tests（GREEN）

- **F2 无核心先问不写**：runtime 无 coreIdea 时返回 ask，不直接成稿（Human Insight 保护的架构成立）。
- **R4 行为改变**：creative 有 draft 失败 → policyFor 从 draft 变 ask（最小的
  Experience→ChangedFutureBehavior 证据，但规则手写）。
- **R5 模式隔离**：creative 失败不污染 research 统计。
- **R1 幂等 / R3 优先级 / F1 快答 / F4 版本单调 / F5 确定性**：全部通过。
- 51–52 套测试全绿（但测试多为"机制自身"测试，非"机制 vs 基线"测试）。

## 6. Unknowns（无证据，禁止当通过）

- 2（Memory vs 最强 baseline）、5（因果）、8（迁移）、11（GoalGen vs 直接指定）、
  13（insight 挖掘 vs 直接生成）、14（创造力）、15（成本）、17（未来模拟）、
  19（search spam）、21–22（人类洞察/agency）、24（shared state drift）、26（longitudinal）、
  31（memory bloat）。全部 UNKNOWN——没有对比实验。

## 7. Baseline Comparison

未运行。B0–B9（Vanilla/CoT/RAG/ReAct/Memory/Planner/Reflection/CSLA−Replay/CSLA−Credit/Full CSLA）
全部 **UNKNOWN**。任何"CSLA 有效"的声明目前都没有对照证据。

## 8. Evidence（可复现）

```bash
cd agent && node --test test/csl-*.test.mjs   # 机制自身测试（R1–R5, F1–F5）
# 核心反证（认知状态未驱动产品）：
grep -n "csl/" src/director.js src/write.js    # 空 → csl 未接入产品流
grep -n "alpha" src/csl/runtime.js             # 两档硬编码
grep -n "credit\[m\]" src/csl/ledger.js        # 均匀分摊
```

## 9. Repro Steps（Kill 复现）

1. 跑 `stylotrace agent`（真实写作）：全程不经过 csl runtime（director 不调用它）→
   证明"认知状态"对产品输出零影响（除非先接入）。
2. 制造 memory error + policy error 各一次 → 观察 credit：两者被同权分摊 →
   无法区分模块贡献（Credit 失败）。
3. 给"2+2"与多步规划任务 → 观察 deep gate：正则启发式可能把简单任务误判深/浅
   （校准缺失）。

## 10. Recommended Fixes

1. **先接入再谈认知**：把 csl/runtime 接到 director（入口控制器），让 state 真正驱动写作；
   否则当前"认知"是孤立测试岛。
2. Credit：改为真实配对干预（do(i,t,e=B) 重跑同一输入，同种子），先做 grounding，
   不做均匀分摊。
3. Authority：alpha 至少用 confidence×risk×novelty 连续函数 + 校准，替代两档。
4. Reasoning：先实现 2–3 个算子（Compare/Counterexample/Abstract）并配单元测试，
   再谈"可组合认知算子"。
5. Schema：confidence 随证据数/多样性/反例/时间戳更新，并做 reconsolidation 版本化测试。
6. 建 B0–B9 等预算对照 + "同任务重复"基准，跑 E1–E6。

## 11. Research Risks

- 核心假说（consequence-based credit）可能只是 CoALA+terminal-reward 的重命名；
- replay 手写规则可能被 MemoPilot/MemRL 的"记忆更新需训练"直接否定；
- 若 credit 均匀分摊，消融无法归因 → 任何增益不可解释。

## 12. Architecture Risks

- csl 与旧流水线双轨并存，认知状态与实际生成脱节（最危险）；
- 24 步被实现为固定流水线，与 v1.8"adaptive"主张冲突；
- 大量文档化机制（算子/世界模型/巩固）无实现 → 架构承诺 > 能力。

## 13. Product Risks

- Stylotrace 产品端未获得 csl 的任何收益（未接入）→ "认知层"是负担不是卖点；
- 复杂度远高于当前收益（Kill Criteria #10 命中风险高）；
- BYOK/CLI/MCP 已完成且可用——产品真正有价值的当前只有"写作 Agent"本体，不是 CSLA 层。

## 14. Kill Criteria 判定

| 条件 | 状态 |
| --- | --- |
| 1. 无真实 future behavioral change | ⚠️ 有最小证据（replay R4），但规则手写 |
| 2. memory 全是 retrieval | ❌ 否（replay 存在） |
| 4. credit 与随机归因无区别 | ✅ **命中（均匀分摊≈随机）** |
| 6. 固定 workflow 与 adaptive 等效 | ⚠️ 无法测（实现就是固定） |
| 9. 强模型被削弱 | 未测（UNKNOWN） |
| 10. 复杂度远高于收益 | ✅ **高风险命中（csl 未接入产品）** |

**结论：未到"必须 STOP/REDESIGN"的绝对红线，但 Credit 与 Cognitive Theater 两项致命攻击命中，
且 csl 未接入产品。按协议：在修复 #1（接入）、#2（真实 credit）、#4（算子落地）之前，
不得宣称 CSLA 解决了任何长期学习问题。**

---

## 30 攻击速查

RED：1（adaptive=固定）、25（authority）、28（credit）、29（counterfactual）、30（schema）、32（theater）
YELLOW：3/6（learning 规则化）、16（gate 未校准）、18（desire/goal）、23（快深）、27（drift）
UNKNOWN：2,5,8,11,13,14,15,17,19,21,22,24,26,31
GREEN：20（ask-human F2）、R1/R3/R4/R5、F1/F4/F5（机制自身）

## 9 维评分（0–5，凭证据）

| 维度 | 分 | 证据 |
| --- | --- | --- |
| Memory | 2 | episodic+replay 存在；无关系绑定/巩固；检索≈RAG |
| Reasoning | 1 | 算子仅文档；ContextRouter 不是推理 |
| Learning | 1.5 | replay 改变手写策略；非学习更新 |
| Generalization | 0 | 无 unseen-task 测试 |
| Calibration | 0.5 | fast/deep 正则启发式，无校准 |
| HumanCollab | 2 | elicit+ask+K/F/P 架构；无真人实验 |
| Innovation | 1 | 固定问题库，无 IG 学习 |
| Efficiency | 1 | 深路径可能过度触发；无成本数据 |
| Robustness | 2 | 52 测试全绿（机制级）；无对抗/多模型 |

## Q1–Q4

- **Q1 只是 Fancy Workflow？** **部分是。** 深路径是固定序列；认知状态不驱动产品。
- **Q2 Experience→ChangedFutureBehavior？** **最小证据。** replay R4 改变策略，但规则手写、未入产品。
- **Q3 CostAdjustedPerformanceGain？** **无证据（UNKNOWN）。** B0–B9 未跑。
- **Q4 增加 Human+AI 联合能力而非更多 AI 调用？** **无证据（UNKNOWN）。** 架构有 elicit/authority，未实验。

---

## 实测补充（2026-08-28 · 确定性/mock，零真实 token）

运行 `scripts/experiments/redteam-csl.mjs`，19 项伪造化测试 **19/19 通过**：

### 通过（GREEN）

- T1 失败→行为改变（draft→ask）· T2 泛化（novel 模式不污染）
- Fast/Deep 泄漏：闲聊走快、写作意图走深
- Goal formation：无明确目的先问不写
- Ask-human：完备状态不追问、空状态必有高价值问题
- Authority：低风险高置信 > 高风险低置信（连续）
- Pattern separation：4 条相似事件不合并
- Completion 不冒充事实（置信 <1）· Comparison 输出关系差异
- Induction 反例压低置信 · Counterexample 命中
- Credit 区分因果模块（M1=0.7，M2=0）
- Memory bloat：200 事件后 policy 仅 123B
- Cognitive theater：学习状态驱动 director 行为（认知门）

### 测试中发现并修复的真实缺陷（DeepGate 校准）

初跑 16/19：**复杂规划任务（p_deep=0.438<0.5）与高风险任务（p_deep=0.22）被误判为快通道**——
红队攻击 #14/#16 命中。修复 `fastSalience`：

- 规划/复杂类任务决策影响翻倍（+0.3 第二档）；
- 高风险（资金/法律/医疗/授权）**安全提升级**：`p_deep = max(p_deep, 0.65)` 强制深通道。

修复后 19/19 通过；53 套全量测试保持全绿。

### 仍未覆盖（UNKNOWN，需真实 LLM/token）

B0–B9 等预算对照、E1–E6、LLM 能力抑制（强模型是否被削弱）、Native Model Escape、
50-session longitudinal、跨任务迁移。这些是下一步实证，不能当作通过。

---

## HRME 红队补充（2026-08-29 · H1–H8，确定性/零 token）

运行 `scripts/experiments/redteam-hrmr.mjs`，**9/9 通过**（H1–H8 + H7 双断言）。
针对第一攻坚模块 HRME 的记忆生命周期攻击：

### 通过（GREEN）

- **H1 分离**：吃/闻两经历独立 episode，同文本 support 累加（成功+失败不互相覆盖）
- **H2 泛化门槛**：单次经历 <M3；无迁移证据最多 M3
- **H3 顽固错误**：5 反例把 M4 降回 hypothesis（conf 0.04），再补 3 正例不能复活回 M4
- **H4 选择性遗忘**：decay 保留 M3/M4 结构，清除陈旧低效用 episode
- **H5 迁移门槛**：transfer=0 停 M3，标记迁移证据后才升 M4
- **H6 绑定鲁棒性**：否定句/被动句拒绝绑定，多动词宾语截断
- **H7 目标条件检索**：查"小猪"命中具体 episode（不被通用 schema 压过）；通用"吃"才回 schema
- **H8 生命周期完整性**：同文本幂等；置信随支持单调不降、随反例单调不升

### 测试中发现并修复的真实缺陷（初跑 3/9 失败）

1. **M4 无迁移门槛**：schema 刷 3 次支持即升 M4（transfer 恒为 0，M4 反而永远到不了）。
   修复：M4 = 分数过阈 + 置信≥0.6 + `markTransfer` 迁移证据；M3 增加置信≥0.5 门槛。
2. **顽固错误复活**：schema diversity 无上限（goals 数直灌），5 反例降级后补 3 正例
   置信被顶回 0.89 并回 M4。修复：schema diversity 封顶 3（与 episode 一致）。
3. **绑定产生垃圾关系**："小猪不吃玉米" 绑成主语"小猪不"、"玉米被小猪吃了" 绑成
   "米被小猪—吃→了"。修复：被动句拒绝；主语尾否定词视为否定句不产生正绑定；
   宾语按连接词/第二个动词截断。
4. **检索层级压过目标**：查"小猪"时通用 schema `mammal—吃→plantfood` 排在最前。
   修复：query 命中优先于层级（具体 episode > 通用 schema，通用查询才回 schema）。

修复后 H1–H8 9/9 通过；56 套全量测试保持全绿；Transfer 基准升级为
`schema 3→4（markTransfer 后）`，同时覆盖 M4 门槛正反路径。
