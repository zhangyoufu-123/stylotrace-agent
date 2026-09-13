# Real Execution Matrix

**日期：** 2026-08-29 · 判定标准：Documented / Code / Integrated / Real Run / State Effect / Behavior Effect → Verdict

| Capability | Doc | Code | Integrated | Real Run | State Effect | Behavior Effect | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fast | ✓ | ✓ | ✓ | ✓（~1.5s） | 不动深层（设计） | 追问/短答 | **REAL** |
| Deep | ✓ | ✓ | ✓ | ✓（4 calls） | v+1，假设入状态 | 动作循环产出 | **REAL** |
| Ask Human | ✓ | ✓ | ✓ | ✓ | interaction/追问 | 阻塞写作 | **REAL** |
| Memory | ✓ | ✓（HRME） | PARTIAL | ✓（确定性+HRME 红队） | csl-memory | replay→cognitiveGate（测试） | **PARTIAL** |
| Compare | ✓ | ✓ | ✓ | ✓ | comparison | 影响动作价值 | **REAL（确定性）** |
| Induction | ✓ | PARTIAL（类型级聚合） | PARTIAL | ✓ | schema 项 | 反例降级 | **PARTIAL** |
| Search | ✓ | ✓ | ✓（P0 修复） | ✓ | evidence pending | 排队宿主检索 | **REAL（排队；回灌待宿主）** |
| Writer Gate | ✓ | ✓ | ✓ | ✓ | 无核心→BLOCK | 拒绝 draft | **REAL** |
| Outcome | ✓ | ✓ | ✓ | ✓（真实反馈） | OutcomeStore+refs | 误差入事件流 | **REAL** |
| Credit | ✓ | ✓ | ✓ | ✓（T10） | credits/policy 版本 | 动作选择改变（T6） | **REAL** |
| Replay | ✓ | ✓ | ✓ | ✓（确定性 R1–R5） | policy 变化 | cognitiveGate ask（测试） | **REAL（确定性）** |
| Style Learning | ✓ | PARTIAL（资产） | PARTIAL | ✗ 无预测闭环 | 风格档案更新 | 未验证影响生成 | **THEATER** |
| Counterexample | ✓ | ✓ | ✓ | ✓ | counterexamples | 降置信/降级 | **REAL（确定性 KB）** |
| Native Escape | ✓ | ✓ | ✓ | ✓（A5） | nativeResult | 允许原生推理 | **REAL** |
| Hooks / Multimodal / World Model / Executive | ✓ 文档 | ✗ | ✗ | ✗ | — | — | **DOCUMENT_ONLY** |

## 关键证据位置

- Fast/Deep/Ask：`csl/runtime.js` + `csl-real` TEST B（真实）
- Memory→Behavior：`csl/replay.js` + redteam T1（失败→draft→ask）+ `csl-hrmr` 红队 9/9
- Search 真实排队：`csl/actions.js` search case + `protocol/requests.jsonl`（TEST C 实测 4 条）
- Writer Gate：`csl/canonical.js canWrite` + `csl-integration` Part C
- Outcome/Credit/Behavior：`csl/credit.js` + `csl-credit` T1–T9 + `csl-real` TEST D
