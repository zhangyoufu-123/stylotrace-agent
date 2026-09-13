# CSLA Phase 3A Report — HRME ↔ Compare ↔ Abstract 真实运行时接入 + Golden Cognitive Test

**日期：** 2026-08-29 · **基线：** `bec88a9`（Reality Audit 后）· **范围：** 只做 3A（Memory+Reasoning 运行时接入），
未做 Induction 引擎（3B）、未做 Writer 认知注入（3C）。
**验收标准：** Module → State → Behavior（不再接受"module exists"）。

---

## 1. 实现

- **新动作 `memory`**（`actions.js` ACTION_LIBRARY + executor）：Observation → Relation（`hrmr.bind`）→
  Encode（`hrmr.addEpisode`）→ Retrieve（`memoryRefs`/`retrievedMemories` 进 stateDelta）。
- **compare 记忆化**：新关系 vs 检索到的记忆关系 → 结构化比较 + **精化主张写入 hypotheses**
  （Reasoning → ChangedHypothesis）。
- **abstract 记忆约束**：泛化时检索 HRME schema 候选并入状态（Memory → ChangedReasoning），
  发散算子上下文含 relations/memoryRefs。
- **counterexample 记忆化**：反例命中 → `hrmr.challengeSchema`（Counterexample → Refinement，置信/层级降级）。
- **goldenCognition 管线**（`runtime.js`）：驱动同一 ActionDispatcher 按
  `memory→compare→abstract→counterexample` 顺序执行，逐步合并 stateDelta，
  最终提交 canonical（workingMemory + cognition.golden 事件），返回结构化结果。
- 通用 runTurn 也预绑定关系：带关系观察 → memory 动作优先（Q 值 1.3），真实运行中 memory 真正参与。

## 2. Golden Cognitive Test（小猪吃玉米）

`csl-golden.test.mjs`（确定性，零 token）：

```text
Observation(小猪吃玉米。) → relations[小猪—吃→玉米]
→ memory（encode+retrieve，memoryRefs≥1）
→ compare（vs 记忆关系，hypotheses 0→1：精化主张）
→ abstract（3 候选 + schema 候选 mammal—吃→plantfood，support≥5）
→ counterexample（挑战 → 置信下降）
```

断言：entities（小猪=mammal/玉米=plantfood）· relations · hypotheses · comparison · counterexamples ·
schema（level≥3）· confidence>0.5 · 状态版本 v0→v1 · canonical workingMemory 提交 ·
**Schema→NovelTask**（"牛吃粮食"命中 mammal—吃→plantfood）· cognition.golden 事件落账。

## 3. 真实 LLM 证据（opt-in TEST E）

```text
trace: memory→compare→abstract→counterexample
schema: mammal—吃→plantfood · confidence: 1 · hypotheses: 3 · state: v0→v1
```

## 4. Module → State → Behavior 证据

| 验收 | 证据 |
| --- | --- |
| Memory → ChangedReasoning | abstract 的 schemaCandidate 来自 HRME；发散上下文含 memoryRefs |
| Reasoning → ChangedHypothesis | compare 后 hypotheses 0→1（trace 记录） |
| Counterexample → Refinement | 4 反例 → schema 置信 1.0→0.14、层级 L3→L2 |
| Schema → NovelTask | 牛吃粮食（未见）命中 mammal schema |
| 状态真变 | canonical v+1 + workingMemory + cognition.golden 事件 |

## 5. Test Results

- `node --test`：**63/63**（新增 csl-golden）；`npm test` 全绿（含 e2e）；真实冒烟 A/B/C/D/T10 + TEST E 全过。
- 回归保护：Q 值 compare 保持 0.7（避免 compare 死循环）；A1–A6/C1–C13/T1–T9 全部保持。

## 6. Known Limitations

1. compare 的"语义比较"仍是确定性字符级（`reasoning.js`）；LLM 语义比较是后续升级。
2. abstract 泛化以 LLM 候选 + 类型级 schema 为准；真归纳（3B：多假设→条件 schema）未做。
3. HRME 编码是规则级 bind（否定/被动已拒）；复杂句式漏绑仍存在（确定性限制）。

**Phase 3A 完成。按规格停止；下一单元为 3B（Induction↔Counterexample↔Schema）。**
