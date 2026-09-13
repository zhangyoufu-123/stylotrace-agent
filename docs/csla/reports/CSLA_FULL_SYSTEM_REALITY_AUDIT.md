# CSLA Full System Reality Audit

**日期：** 2026-08-29 · **基线 HEAD：** `8b695e9`（审计前）→ 修复后提交见 git log
**方法：** READ-ONLY 审计 → 真实运行（真实 LLM opt-in + 确定性/离线）→ 差距 → P0 定向修复 → 全量回归。
**分级：** Documented / Implemented / Integrated / Executed / Observed / Learned 严格区分。

---

## 1. Current System Reality Map（每条边：REAL / PARTIAL / MOCK / BYPASS / UNKNOWN）

```text
User
 ↓ REAL（CLI agent / csl CLI / MCP 入口）
Entry（cli.js / mcp.js / web / api→headless）
 ↓ REAL
Fast（csl/runtime fastSalience + languageLoop，真实 LLM）
 ↓ REAL（ask 写入 interaction；deep 提交 csl-state）
Canonical State（state.js kernel，单一版本源，事件流）
 ↓ REAL（cognitiveDecision + actionValue + policyWeights）
Controller（selectAction：Q 值 + credit 权重 + Native Escape）
 ↓ REAL（A1 测试：selected == executed；事件/stateDelta 单一）
Action Dispatcher（actions.js dispatch）
 ↓
Cognitive Engines：
  abstract → REAL（LLM 多算子）
  compare → REAL（确定性）
  counterexample → REAL（确定性 KB）
  search → REAL（P0 修复后：生成查询 + 排队宿主代检；证据 pending 非伪造）
  generate → REAL（LLM 成稿）
  askHuman / stop → REAL
  induce/deduce/abduce/analogize/simulate/plan/verify/reflect/act → PARTIAL（占位 executor）
 ↓ REAL
LLM / Tool（makeLlm Port；真实 DeepSeek 验证）
 ↓ PARTIAL（写门 REAL；全阶段 cognitiveAction→director 映射只做 askHuman/generate 关键点）
Application（director → write/restyle/redteam）
 ↓ REAL（OutcomeStore + 真实反馈）
Outcome → Credit（credit.js 显式反事实）
 ↓ REAL（policyWeights 改变 selectAction，Test 6/7）
State Update
```

## 2. 真实运行证据（当前 HEAD，真实 DeepSeek）

| 场景 | kind | 动作轨迹 | tokens | 延迟 | 状态 | 检索 |
| --- | --- | --- | --- | --- | --- | --- |
| TEST A 小猪吃玉米 | deep | abstract→search→generate | 2645 | 29.2s | v1→v2，3 假设 | 排队 4 查询 |
| TEST B 人机写作 | ask→deep | 追问→回答→abstract→search→generate | 5509 | 60.7s | v0→v2，coreIdea 入状态 | 排队 |
| TEST C 深层研究 | deep | abstract→search→generate | 3917 | 44.1s | v0→v2 | **排队 4 条 csl-search 请求** |
| TEST D 错误学习 | deep | abstract→search→generate + feedback | 4133 | 51.0s | credit low_confidence；人类反馈→policyApplied=3 | 排队 |

TEST A 检查：经过 runtime ✓（runTurn）；调用 operator ✓（dispatch 3 次）；非 LLM 直答 ✓（3 算子结构）；
state 改变 ✓（v1→v2）；action 改变 ✓（abstract→search→generate）；memory/reasoning 参与：
compare/counterexample 确定性存在，HRME 未接入本次（P1）。

TEST B 检查：不写长文 ✓（Fast→Ask 追问，语言层简短约束）；问题基于状态 ✓（pickQuestion 按缺口）；
避免重复 ✓（askedTypes 去重测试）；答案入 canonical ✓（acceptAnswer→coreIdea）；deep 看到新增 ✓；
deep→human 再返回 ✓（checkpoint 机制 + 交互模式实测）。

TEST C 检查：Goal→Hypothesis→**Search（真实排队）**→Evidence（pending）→Counterexample（确定性命中）
→Decision（actionTrace）。**search 不再是占位字符串（P0 修复）**；但 evidence 尚未回灌成真事实（回灌是宿主侧动作）。

TEST D 检查：Writer 无核心拒绝 ✓（csl-integration：`missing_core_idea` + BLOCK）；有核心放行 ✓（产出 draft）；
Outcome 来自真实反馈 ✓；Credit 反事实 ✓；未来行为改变 ✓（Test 6：search→deduce；真实反馈 policyApplied=3）。

## 3. Cognitive Theater Audit

| 检查 | 结论 |
| --- | --- |
| coreIdea 缺失 → writer 真的阻塞？ | **REAL**（write.js canWrite 门；测试断言 blocked:missing_core_idea） |
| action=search → 真的发生 search？ | **REAL**（修复后排队宿主检索，非占位） |
| action=stop → 真的无后续 LLM？ | **REAL**（A4 测试：trace 一步、零 LLM 调用） |
| credit 负 → 下次 policy 真变？ | **REAL**（Test 6：动作从 search 变 deduce；Test 7 上下文隔离） |
| HumanModel → 问题选择？ | **THEATER**（humanModel 分区存在但未驱动提问；P1） |
| Style → 下次写作改变？ | **THEATER**（style-pulse 有反馈但无预测—误差闭环；P1） |
| HRME → 产品行为？ | **PARTIAL**（replay→cognitiveGate 真影响 director；HRME 记忆未接产品检索/写作） |

## 4. Fast/Deep Reality

- Fast：低延迟（~1.5s 真实）、短回复（brief 约束）、高频、主动追问 ✓；不动深层状态 ✓。
- Deep：stateful ✓、多步 ✓、可暂停/问人 ✓（ask/checkpoint）、可恢复（交互模式重跑）PARTIAL、可用工具（search 排队）✓。
- Fast ↔ SharedState ↔ Deep：同一 csl-state 文件 ✓（C9/C10 测试）。

## 5. State / Action / LLM Boundary / Context

- 状态：Phase 1 后无新增危险 shadow state；产品 state.json 为 Derived View（已知限制）。
- 动作：selected == executed（A1）；无隐藏固定流水线（动作循环）。
- LLM 边界：state/version/id/持久化/权限在代码 ✓；语义在 LLM ✓；product 模块自拼 prompt（ContextAssembler 未贯穿 → P1）。
- Context：csl 算子经 buildContextBundle 裁剪（预算 1200）REAL；产品模块 BYPASS（P1）。

## 6. 差距结论（Design vs Reality）

- **架构 overclaim 点**：Reasoning 12 算子仅 4 个真实（compare/counterexample/abstract/……其余占位）；
  Induction 为类型级聚合非真归纳；HumanModel/Style 预测闭环/Hooks/Multimodal 仅文档。
- **真实能力反向记录**：Outcome/Credit 引擎已超越文档（显式反事实 + policy 证据 + 行为变化，T6/T7）；
  search 已从占位升级为真实检索通路。

## 7. P0 修复（本审计执行）

**search executor 占位 → 真实检索通路**（`actions.js`）：`buildSearchQueries`（确定性多角度查询）+
`requestHostSearch`（排队宿主代检，purpose=csl-search）；证据标记 `{pending:true}`（不再伪造"已查到"）。
离线/单元测试无 workspace → 确定性 fallback。回归：A1 断言 pending；csl-integration 断言 requests.jsonl 含 csl-search。

## 8. 停止

审计 + P0 修复 + 全量回归完成。P1/P2 见 `CSLA_REPAIR_BACKLOG.md`。不自行开发下一批理论模块。
