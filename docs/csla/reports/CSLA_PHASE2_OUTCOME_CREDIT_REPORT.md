# CSLA Phase 2 Report — Real Outcome + Counterfactual Credit Engine

**日期：** 2026-08-29 · **基线：** `21437ea`（Phase 1）· **范围：** 只做 Outcome/Credit 基础设施；
未实现新 reasoning operator、未增强 HRME、未做 PFC/长期学习。

---

## 1. Outcome Architecture

统一 Outcome Contract（`protocol/csl-outcomes.jsonl`，OutcomeStore）：

```json
{ "outcomeId", "traceId", "sessionId", "stateVersion",
  "goal": {}, "action": {}, "prediction": {}, "actual": {},
  "feedback": {}, "cost": {}, "risk": {}, "humanReaction": {}, "worldReaction": {},
  "evaluation": {}, "timestamp" }
```

- **prediction 与 actual 是不同对象**（禁止 prediction=actual）。
- Outcome 来源分类：Human（accepted/rejected/edited/corrected/answered）· Artifact（段落删除/主张改变/结构改变）·
  Tool（search/API）· World（真实外部行为，可选）。humanReaction ≠ worldOutcome（分开记录）。

## 2. Prediction Architecture

`createPrediction({expected, confidence, successCriteria, predictedChanges, action, goal})` →
`{predictionId, expected, confidence, successCriteria, predictedChanges, action, goal, timestamp}`。
runtime 中 prediction 来自状态（alpha），非硬编码。

## 3. Counterfactual Design

`runCounterfactual({evaluate, targets, baselineType, baselineConfig})`：

```text
Actual run → Outcome → 对每个 target：构造 baseline/intervention → 重评价 → delta_i
credit_i = actualScore − counterfactualScore_i   （>0 帮助 / <0 有害 / ≈0 无影响）
```

- `evaluate({active, replaced})` 可注入（确定性轨迹评价 / 状态评价 / 未来 LLM 配对重跑）。
- **CF 运行不污染 canonical state**（Test 4：跑前后状态文件逐字节相等）。

## 4. Baseline Strategy

支持 `frozen_baseline` / `matched_alternative` / `deterministic_baseline`；
无效 baseline → `status=unresolved`，不伪造 credit。runtime 使用 `deterministic_baseline`
（基于实际轨迹/规范状态，confidence 如实低标）。

## 5. Credit Formula & Output

```json
{ "creditId", "target", "actualScore", "counterfactualScore", "delta",
  "baselineType", "method": "explicit_counterfactual", "confidence",
  "status": "resolved|low_confidence|unresolved", "invalidated", "appliedQ" }
```

`confidence ≥ 0.4` 才允许强更新政策（Test 9：低置信跳过）；全部落 `protocol/csl-credits.jsonl`（可审计）。

## 6. State Changes

- Canonical State 新增 `outcomes` / `credits`（引用数组，不塞全部历史——防膨胀）；
  `policy.evidenceVersion` 记录政策证据版本。
- 实际记录在独立 Store（OutcomeStore / CreditStore / PolicyEvidenceStore `vault/csl-policy-evidence.json`）。

## 7. Policy Update（Credit → BehaviorChange，真实）

- `Q_new(s,a) = Q_old(s,a) + η·C`（η=0.3，有界 [-1,1]）。
- **context-aware**：key = {taskType, goal, risk, uncertainty} × operator（Test 7：context B 不被 context A 污染）。
- **versioned**（evidenceVersion）+ **reversible**（invalidateCredit 撤销 appliedQ，Test 8）。
- **真实接入动作选择**：`actions.selectAction` 读 `policyWeights`，Q_new 直接改变选择（Test 6：
  search 负 credit 后首步动作从 search 变为 deduce）。

## 8. Test Results

- `node --test`：**62/62 通过**（新增 `csl-credit` T1–T9 + 契约/审计/错误处理）；`npm test` 全绿；e2e 全链通过。
- T1 非均分（A=0.30 > B=0.10 > C=0）· T2 负 credit（-0.18）· T3 零 credit · T4 CF 状态隔离 ·
  T5 真实 outcome（预测接受、实际删段 → 误差 0.7 入事件流）· T6 行为变化（search→deduce）·
  T7 上下文敏感 · T8 可撤销（-0.9 → 撤销后恢复）· T9 低置信跳过。

## 9. Real Outcome Evidence

真实人工信号路径 `recordFeedback`（用户确认 0.9 / 纠正 0.3，来自 director 输入）→ OutcomeStore 落账 →
Evaluator → 反事实 → policy 更新（applied≥1）。Test 5 用"段落被删"作为真实 artifact outcome。

## 10. Real LLM Evidence（opt-in：CSL_REAL_LLM=1 npm run test:csl-real）

TEST D（T10）真实 DeepSeek 运行：

```text
abstract→search→generate（4 calls, 4760 tokens, 59.3s）
→ feedback=0.8 → credit status=low_confidence（runtime 自评如实低置信）
→ recordFeedback(user-confirm) → status=resolved → policyApplied=3（政策证据真实更新）
```

## 11. Known Limitations

1. 确定性 CF 评价器（轨迹/状态贡献）不是真实"重跑去掉模块"的配对干预；confidence 已如实低标，
   真实配对重跑是后续升级项。
2. 人类反馈 → 0.9/0.3 数值映射为粗粒度启发式（真实信号但量化粗糙）。
3. LLM 可参与语义评价但**不是 ground truth**（规格 §34）；优先 human edit / deterministic checks。
4. 同会话并发写无锁（延续 Phase 1 记录）。

## 12. Remaining Risks

- R2 Credit 均分：**已根除**（runtime 用 explicit_counterfactual；basicCredit deprecated 保留兼容）。
- R3 假 Outcome：**已修**（无反馈 → outcome.pending，不伪造；真实 feedback 才落账）。
- 新风险：CF 评价器启发式可能系统性偏差 → 依赖低置信门与 future 配对干预实验校准。

## 13. Definition of Done 核对

- [x] Outcome Contract · [x] Prediction Contract · [x] Outcome Evaluator（维度化）· [x] Error Event（OutcomeError）
- [x] Explicit Counterfactual Engine · [x] Baseline definition（3 类 + unresolved）· [x] CF state isolation
- [x] Positive/Negative/Zero credit · [x] Credit confidence · [x] Credit invalidation · [x] Policy evidence
- [x] Real action-selection change from credit · [x] Context-sensitive credit · [x] Real human/artifact outcome test
- [x] Real LLM opt-in test（T10）· [x] Trace auditability（OutcomeStore/CreditStore/统一事件）
- [x] 既有 61/61 保持（62/62）· [x] 产品 e2e 保持 · [x] Phase 2 测试全绿 · [x] 本报告

## 14. 科学声明边界（规格 §44）

允许说：**"CSLA has an explicit outcome and counterfactual credit mechanism."**
允许说：**"credit can influence subsequent action selection in tested scenarios."**（Test 6/7 证明）
禁止说：**"CSLA has solved long-term learning."**（无 longitudinal 证据）

**Phase 2 完成。按规格停止，不进入下一阶段。**
