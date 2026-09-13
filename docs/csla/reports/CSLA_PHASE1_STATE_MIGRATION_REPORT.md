# CSLA Phase 1 Report — Canonical Cognitive State Kernel 全量迁移

**日期：** 2026-08-29 · **基线：** `b31ac39`（Phase 0）· **本阶段提交：** 见 git log
**范围：** 只做 State Infrastructure；未改理论、未加推理算子、未做记忆算法、未做长期学习。

---

## 1. Canonical State Schema

唯一规范（`agent/src/csl/state.js createCanonicalState`，schemaVersion=1）：

```json
{ "schemaVersion": 1, "stateVersion": 0, "traceId": "",
  "session": {}, "interaction": {}, "motivation": {}, "goal": "",
  "confirmedGoal": "", "strategy": "", "task": {}, "workingMemory": {},
  "beliefs": [], "hypotheses": [], "evidence": [], "uncertainty": 0.5,
  "memoryRefs": [], "reasoning": {}, "humanModel": {}, "jointState": {},
  "styleState": {}, "artifactState": {}, "policy": {}, "resources": {},
  "coreIdea": "", "questions": [], "decisions": [], "intent": "", "paramsRef": null }
```

`stateVersion`（即 legacy `sVersion`）是**唯一版本源**；legacy 顶层字段保留为适配层镜像，
供既有 reader 不破坏。四类数据边界严格分开：

| 类别 | 位置 | 说明 |
| --- | --- | --- |
| CognitiveState | `protocol/csl-state*.json` | 当前可影响决策的状态（本内核） |
| EventStore | `protocol/csl-events.jsonl` + `protocol/csl-canonical-events.jsonl` | 历史事件（新统一事件流） |
| MemoryStore | `vault/csl-memory.json` | 长期记忆；内核只存 `memoryRefs` |
| ArtifactStore | `draft.md`、大纲、历史快照 | 产物文件 |

## 2. State Kernel API（agent/src/csl/state.js）

```js
readCanonicalState(ws, {sessionId})   // 规范视图（含 interaction/style/memory adapters）
patch(state, delta)                    // 纯合并，不持久化、不升版本
commit(ws, {delta, event, sessionId, actor, traceId})  // 验证+版本+持久化+统一事件
snapshot(ws, {sessionId})              // 复制当前版本到 protocol/csl-snapshots/<session>/
restore(ws, version, {sessionId})      // 从快照恢复（显式操作，写 restore 事件）
compare(v1, v2)                        // Goal/Hypothesis/Evidence/Decision/Style/Artifact 变化
stateVersion(ws, {sessionId})          // 当前版本
```

Legacy API（`readState`/`transition`/`persistState`/`stateFile`）保持可用 = 同一事实源的适配层。

## 3. State Delta & Event Model

- Delta：模块只输出 `{delta, events}`；Kernel `commit` 负责验证（transition 拒绝非法 key）、
  合并（分区对象）、升版本、持久化、写事件。禁止模块直接 `state.goal = …`。
- 统一事件（`csl-canonical-events.jsonl`）：
  `{eventId, traceId, sessionId, stateVersionBefore, stateVersionAfter, type, actor, payload, timestamp}`。
  已覆盖 StatePatch / CoreIdea / Hypothesis / Restore；LLM/Tool/Outcome/Error 事件为后续 Phase 统一挂接。

## 4. State Sources Before → After

| 迁移前 | 迁移后 | 标记 |
| --- | --- | --- |
| `csl-state.json`（sVersion） | Canonical Kernel 单一版本源（default session 同一文件） | **Canonical** |
| `csl-interaction.json` | interaction 分区 Adapter（该文件=持久化 backend） | **Adapter** |
| `protocol/state.json`（产品阶段/大纲） | readCanonical 应用视图（Director Adapter；cslVersion 镜像） | **Derived View** |
| `write-style.json`/`read-style.json` | styleState 分区 Adapter | **Adapter** |
| `csl-memory.json`（HRME） | memoryRefs 分区（只存引用） | **Adapter/Persistence** |
| `csl-policy.json`/`csl-schema.json` | policy 分区（refs 级） | **Adapter**（完整映射留后续） |

## 5. Migrated Modules & Adapters

- **Migrated（经 Kernel 读写）**：csl/runtime（读 canonical、commit 写内核）、csl/canonical（commitDelta→st.commit）、
  write（canWrite 读内核门）。
- **Adapter**：interaction（runtime saveInteraction 持久化 → 视图 Adapter）、style（styleAdapter）、
  memory（memoryRefsAdapter）、director 产品视图（readCanonical 合并）。

## 6. Remaining Shadow State（诚实标记）

| 状态 | 标记 | 说明 |
| --- | --- | --- |
| `protocol/state.json` 的 `stateVersion` 计数 | **Derived View counter（KNOWN LIMITATION）** | 产品内部写计数，非认知版本；cslVersion 才是权威 |
| `clarify.js`/`interview.js` 内部交互状态 | **Legacy** | 未纳入 canonical（P1 剩余项） |
| `style-vector/fingerprint/samples` | **Persistence** | 长期资产，非工作状态 |
| `history/` 快照 | **Persistence** | 审计/回滚 |
| `requests.jsonl`/`context.jsonl` | **Persistence** | 宿主代检/上下文日志 |

## 7. Persistence Strategy

继续使用现有文件持久化；每 session 独立文件（`csl-state-<session>.json`，default 兼容旧路径）；
每次 commit 同时写 `vault/csl-history/<session>/s_{v}.json`（审计轨迹）+ 统一事件流。

## 8. Snapshot / Restore

`snapshot(vN)` → 复制到 `protocol/csl-snapshots/<session>/v{N}.json`；`restore(N)` → 恢复为当前状态，
写 `state.restore` 事件；下一次 commit 从 N 继续单调。测试 C5/C6：v2 快照 → 污染到 v3 → restore(2) →
假设等于快照、版本回 2。

## 9. Concurrency Status

- **会话隔离已验证**（测试 C8）：S1/S2 独立文件与事件，互不污染。
- **并发写同一会话**：文件级状态无锁（KNOWN LIMITATION，记录不假装解决；Phase 8 生产加固项）。

## 10. Test Results

- `node --test`：**61/61 通过**（新增 csl-kernel C1–C13）；`npm test` 全部通过；e2e 产品全链通过。
- 既有 60/60 保持全绿（唯一调整：csl-canonical 测试断言从 legacy 事件文件改为统一事件流）。

## 11. Known Limitations

1. 产品 `state.json` 仍由 14 个模块直接 `ws.writeState` 写（Derived View counter）——完整收敛到 Kernel 属 P1 剩余/后续 Phase。
2. LLM/Tool/Outcome/Error 统一事件尚未全部挂接（仅 StatePatch/CoreIdea/Hypothesis/Restore）。
3. 同会话并发写无锁。
4. `goal` legacy 为字符串、canonical 视图为对象（{inferred, confirmed, strategy}）——视图层统一，存储层待后续迁移。

## 12. Definition of Done 核对

- [x] Canonical State implemented（schema + 分区）
- [x] State Kernel implemented（read/patch/commit/snapshot/restore/compare/version）
- [x] State Delta implemented（Kernel 验证/合并/提交）
- [x] State version monotonic（C4）
- [x] Event model exists（统一事件流 + eventId/traceId/versionBefore/After）
- [x] Snapshot/restore works（C5/C6）
- [x] Compare works（C7）
- [x] Session isolation verified（C8）
- [x] Fast Interaction writes canonical state（C9，interaction 分区 Adapter）
- [x] CSLA runtime reads/writes canonical state（C10）
- [x] Director has canonical-state adapter（C11）
- [x] Writer has canonical-state read path（C12，canWrite）
- [x] Style has adapter（styleState 分区）
- [x] Memory uses refs rather than bloating state（memoryRefs）
- [x] Existing 60/60 tests remain green（61/61）
- [x] New state tests pass（C1–C13）
- [x] Shadow-state inventory updated（§6）
- [x] No new theoretical modules added
- [x] No Big Bang Rewrite（增量 adapter，未删旧模块）
- [x] Phase report generated（本文档）

## 13. 结论

所有核心模块（Fast / CSLA Runtime / Director / Writer）现在经同一个 Canonical Kernel 读写，
单一版本源 `stateVersion`，Fast→State→Deep 与 Deep→Human→State→Deep 使用同一持久化状态源。
**Phase 1 完成。按规格停止，不进入下一阶段。**
