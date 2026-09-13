# Full E2E Product Validation Report（Gate B：Writing Closed）

**日期：** 2026-08-29 · **引擎：** `agent/src/csl/e2e.js` · **门禁：** `csl-e2e-closure.test.mjs`
**运行：** 离线 mock（CI 门禁）✅ + **真实 LLM（DeepSeek，opt-in）✅**

---

## 1. 核心问题回答

> **如果我是第一次使用这个产品的真实作者，从输入一个模糊想法开始，到最终拿到文章，
> 我是否真的经历了我们设计的整套系统？**

**YES（Gate B）。** 真实 LLM 运行中，作者经历了：Fast Chat → 追问（"你最想说的那件事是什么？"）→
回答入状态 → Deep（abstract→search→generate，search 真实排队检索）→ Core Idea/Brief →
写作（提示含认知简报，产出草稿）→ 修改（OutcomeStore 落账）→ 纠正反馈 → 反事实 Credit →
政策权重变化 → 同一作者第二个任务（Fast→Ask→Deep，trace 含 memory）。每一步都有状态/文件/事件证据。

## 2. EXPECTED vs ACTUAL vs BEHAVIORAL EFFECT（13 步，真实 LLM 运行）

| 步 | EXPECTED | ACTUAL | BEHAVIORAL EFFECT | 证据 |
| --- | --- | --- | --- | --- |
| 1 FastChat | fast 不动深层 | fast | 追问不触发 | kind=fast |
| 2 Clarify | Fast→AskHuman | ask | 写作被追问而非成稿 | question |
| 2b Answer→State | coreIdea 入状态 | 入 canonical | deep 可见 | acceptAnswer |
| 3 DeepReasoning | 动作循环 | abstract→search→generate | 状态 v+1、假设入状态 | actionTrace |
| 4 Memory | HRME 编码检索 | schema mammal—吃→plantfood | authorSchemas 进 Brief | golden schema |
| 5 Search | 真实检索 | queued（宿主代检） | 证据 pending 非伪造 | requests.jsonl |
| 6 CoreIdea | canonical+brief | brief.coreIdea | Writer 门放行 | csl-brief.json |
| 7 Writer | Brief→draft | draft.md 产出 | **CognitiveState 影响最终文章** | draft + 提示含【认知简报】 |
| 8 Revision | edit→outcome | OutcomeStore+editCount | HumanEdit→Outcome 真实 | csl-outcomes.jsonl |
| 9 Outcome | 预测≠实际 | error=0.637（纠正 0.3 vs 预测） | 真实反馈非合成 | recordFeedback |
| 10 Credit | 显式反事实 | operators delta<0 | 纠正→负 credit | method=explicit_counterfactual |
| 11 PolicyUpdate | Q_new=Q_old+ηC | operators/ router 权重 <0 | 下次动作选择会变 | policy-evidence |
| 12 SecondTask | 同作者新任务 | ask→deep（trace 含 memory） | Fast→Ask→Deep 复用状态+记忆 | task2 会话 |
| 13 AuthorComparison | Q↑+schemas | Q 0.464→0.6；schemas/edits 记录 | 作者模型越用越清晰（机制级） | AuthorQuality |

## 3. Closure（闭环完整度）

**11/11 = 1.0**（Human→Fast · Fast→State · State→Controller · Controller→Action · Action→LLM/Tool ·
Result→State · State→Writer · Writer→Human · Human→Outcome · Outcome→Credit · Credit→FutureAction），
每条均有真实证据（非文档）。

## 4. Cognitive Theater 检查

| 检查 | 结果 |
| --- | --- |
| Core Idea Missing → Writer BLOCK | ✅（csl-integration 断言 missing_core_idea） |
| Action=Search → 真执行 | ✅（排队宿主代检） |
| Action=Stop → 零后续 LLM | ✅（A4 断言） |
| Credit<0 → 政策真变 | ✅（operators 权重 <0） |
| HumanCheckpoint → Deep 暂停/恢复 | ✅（ask→answer→deep 恢复，task2 亦验证） |

## 5. Gates

| Gate | 判定 | 依据 |
| --- | --- | --- |
| A Runtime Closed | ✅ | State→Action→Outcome 全链真实 |
| B Writing Closed | ✅ | Human→CoreIdea→Brief→Writing→Revision→Outcome 全链真实（本次验证目标） |
| C Learning Closed | **诚实未过** | 机制级行为改变已证明（C_learningMechanism ✅）；`Performance_{t+1}>Performance_t` 需 longitudinal，不算 closed |

## 6. 真实运行中修复的真实缺陷

1. **runTurn 忽略 sessionId 状态隔离**（Phase 1 内核支持、runtime 未接）→ 修复：按会话读/写状态；
   `acceptAnswer` 增加会话参数。
2. **runTurn 最终提交版本碰撞**：feedback 路径中 applyCredit 先提交，最终 transition 用过期 s0 计算 →
   修复：最终提交前重读当前状态。

## 7. 诚实边界

- **B0–B3 基线对照未在本验证中运行**（B3 全链已验证；B0/B1/B2 的消融对照是独立 benchmark，待做）——
  因此本报告**不宣称**"CSLA 优于 vanilla LLM"，只宣称"全链真实闭合"。
- Gate C 未过：无 longitudinal 性能证据。
- Mock 与真实 LLM 均通过同一引擎与断言（`CSL_REAL_LLM=1` 切换）。

## 8. 结论

**Stylotrace Cognitive Writing MVP 基本成立**（Gate A+B）；**Learning Closed 未成立**（Gate C，诚实）。
下一步（等开工令）：B0–B3 基线对照 + longitudinal 实验（E2E-7 多次会话），或按你的优先序做 3B/AuthorModel。
