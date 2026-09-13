# CSLA Cognitive State Inventory

**日期：** 2026-08-29 · **目的：** 找出所有状态/记忆/会话文件，判断是否存在多个竞争状态

---

## 1. 状态清单

| State | Owner | Schema/位置 | 持久化 | 读者 | 写者 | 版本化 | 副作用 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Product State | workspace.js | `protocol/state.json`（phase/outline/confirmed/director/decisionHistory/…） | 文件 | director、cli、web | director 各阶段、cli | 无版本号（整体覆盖） | 阶段推进 |
| CSLA State S_t | csl/state.js | `protocol/csl-state.json`（D/G/B/H/M/W/R/U/P/J/A） | 文件 | csl runtime、csl CLI、cognitiveGate | runTurn/acceptAnswer（经 transition） | ✅ sVersion 单调 | 版本+事件 |
| Interaction I_t | csl/runtime.js | `vault/csl-interaction.json`（topic/currentQuestion/askedTypes/…） | 文件 | runTurn | runTurn | 无 | 去重追问 |
| Policy Π | csl/replay.js | `vault/csl-policy.json` | 文件 | cognitiveGate/policyFor | replayOnce | 无 | 改未来行为 |
| Schema | csl/replay.js | `vault/csl-schema.json` | 文件 | replay | replay | 无 | 改归纳 |
| HRME Memory | csl/hrmr.js | `vault/csl-memory.json`（Episodic/Relational/Schema/Core） | 文件 | retrieve | addEpisode/challenge/decay/markTransfer | 无 | 遗忘/降级 |
| Event Ledger | csl/events.js | `protocol/csl-events.jsonl` | 追加 | replay/reconstruct | 所有 csl 模块 | state_version 字段 | 审计 |
| 风格向量 write/read | style-vector.js/workspace | `vault/write-style.json` `vault/read-style.json` | 文件 | write/restyle/style* | 编辑吸收/脉冲 | 无 | 影响文风 |
| 风格指纹 | workspace.js | `vault/style-fingerprint.json` | 文件 | 压缩守卫 | refreshFingerprint | 无 | 防降智 |
| 改迹库 | workspace.js | `vault/edits.jsonl` | 追加 | modulator/token-decode | point-edit/absorb | 无 | 风格学习 |
| 素材/知识 | knowledge.js/library.js/rag.js | `vault/knowledge.json`、`vault/library/`、`protocol/requests.jsonl` | 文件 | rag/write | ingest | 无 | 检索回灌 |
| 治理面 | governance.js | `protocol/governance.json` | 文件 | director | 更新 | 无 | 方向锚 |
| 历史快照 | history.js | `protocol/history/` | 文件 | rollback | snapshot | 版本目录 | 可回滚 |

## 2. 竞争状态判定

**存在双源状态：**

- `protocol/state.json`（产品线事实源，无版本号、整文件覆盖）与 `protocol/csl-state.json`（CSLA 事实源，版本化）**并存且不同步**。
  - director 只读前者；csl 只读后者；`cognitiveGate` 读 csl-policy（第三源）。
  - 同一对话中 "主题/核心想法" 可能存在于 state.json（topic/confirmed）与 csl-state（coreIdea）两处，互相不更新。
- 交互状态三处：`clarify.js`（产品澄清内部）、`vault/csl-interaction.json`（csl I_t）、`interview.js`（采访状态）。
- 风格状态多文件（write-style/read-style/style-vector/style-fingerprint/style-samples/edits.jsonl），均为产品资产，彼此通过 style.js 聚合——**不是竞争，是分片**。

## 3. 建议：SINGLE COGNITIVE STATE KERNEL（目标）

1. `protocol/csl-state.json` 升为**唯一版本化内核**（含 product stage/director 指针），`protocol/state.json` 降为应用视图/兼容层。
2. 所有变更经 `StateDelta + Event → Commit`（禁止整文件覆盖）。
3. 交互/风格/记忆/策略作为**内核引用**（paramsRef 模式已存在，扩大使用），保留各自文件但统一版本与事件。
4. 迁移期间提供双写兼容（旧 reader 继续可用），完成后再收敛。

## 4. 版本化现状

- 唯一真正版本化：csl-state（sVersion + transition 拒绝回退）+ events（state_version 字段）+ history 快照目录。
- 其余状态无版本：并发/回滚/审计能力缺失（Risk Register 项）。
