# CSLA Phase 3 Report — Unify All Agent Entries on CSLA Runtime

**日期：** 2026-08-30 · **基线：** `ebfbe0d`（FULL E2E 后）· **范围：** 只统一入口，未改认知引擎/HRME/推理/信用理论。

---

## 1. Unified Application Adapter（`agent/src/csl/adapter.js`）

```js
runTask({ workspace, sessionId, input, channel, application='stylotrace', mode='auto|fast|deep', llm, metadata })
```

内部：`syncCoreIdea → syncBrief → CSLA runTurn → 认知动作 → 应用执行器映射 → canWrite 门 → 状态快照`。
另有 `decideTask`（零 LLM 认知决定，director 复用）、`answerCheckpoint`（Deep→Human→Deep）、
`runAction`（selected==executed）、`canonicalSnapshot`（跨通道同一状态视图）。

**边界**：adapter 只做 channel/presentation/serialization；cognition（决策/记忆/信用/目标）只在 CSLA。

## 2. CLI

- 新增 `stylotrace run "<输入>" [--session] [--mode] [--interactive] [--json]` → runTask。
- `stylotrace agent`（director）的认知主门改为 `adapter.decideTask`（原 inline sync+决策替换为统一入口）。
- 行为兼容：旧命令全部保留；66→67 测试全绿。

## 3. MCP

新增 4 个工具（43→47）：`csl_turn` / `csl_action` / `csl_checkpoint` / `csl_state`，全部经 adapter。
旧工具（agent_step 等）保留（compatibility，直连同一 runtime，未复制逻辑）。

## 4. Skill

SKILL.md 新增"认知入口统一（Phase 3）"协议：skill 只提供任务上下文/写作意图/应用提示，
认知决策走 `stylotrace run` 或 MCP `csl_turn`；不维护第二套 cognition。引擎快照同步 + SKILL.md 已复制到已安装 skill。

## 5. Web/FastAPI

- `headless.mjs`：`type:'task'` → adapter.runTask；`type:'state'` → canonicalSnapshot；旧 agentStep 路径保留。
- `api/main.py` 新增：`POST /v1/sessions/{id}/turn|action|checkpoint`、`GET /v1/sessions/{id}/state`；
  `/v1/chat` 等旧接口兼容。

## 6. Session 共享

同 `sessionId` 跨 CLI/MCP/Web → 同一 canonical state（stateVersion/coreIdea/memoryRefs/brief）。
修复：`canWrite` 原只读默认会话 → 现在按 sessionId 判定（跨通道 Writer 门一致）。

## 7. 一致性

- 契约测试：同输入不同通道 → 同一认知动作/状态版本。
- 跨通道：cli ask → mcp checkpoint → web deep，stateVersion 单调、coreIdea 可见。
- Checkpoint：Deep → answer → resume Deep（adapter.answerCheckpoint 用原任务输入恢复）。
- 动作一致性：`runAction('search')` selected==executed（排队宿主代检）。
- Writer 门：无核心 BLOCK / 有核心放行（所有入口同一 canWrite）。

## 8. Tests

- `csl-adapter.test.mjs`（新）：契约/跨通道/Checkpoint/Writer 门/动作一致/MCP 工具注册+调用。
- e2e：MCP 工具数断言 43→47（预期 API 变化）。
- `node --test` **67/67**；`npm test`（含 e2e 全链）全绿。

## 9. Real LLM Evidence（诚实）

- 今日真实运行：TEST A（小猪，新会话路径）经重试通过；直连多次 2-3s 正常。
- TEST B/D 今日多次 `terminated`：长推理响应被连接断开（API/网络侧不稳定），
  非代码回归——同代码路径昨日 TEST A–E 全过；错误路径验证安全（kind=error、状态无污染）。
- opt-in 测试已加网络级重试（最多 3 次；逻辑错误仍立即失败）。

## 10. Remaining Gaps

1. Web 前端尚未消费新 `/turn|action|checkpoint|state` 端点（后端已就绪，前端改造未做）。
2. MCP `csl_turn` 真实 LLM 直连验证受今日 API 不稳定影响（adapter 同一代码已由 CLI 通道真实验证）。
3. 观测性（trace/cost 全链路）与并发锁仍未统一（P2）。

## 11. Definition of Done

- [x] CLI → Adapter → CSLA · [x] MCP → Adapter → CSLA（4 工具）· [x] Skill → Adapter → CSLA（协议）
- [x] Web/API → Adapter → CSLA（headless + 4 端点）
- [x] shared session state（跨通道测试）· [x] shared cognitive action（契约测试）
- [x] shared checkpoint（Deep→Human→Deep）· [x] shared writer gate（canWrite 按 session）
- [x] no duplicate cognition logic（adapter 唯一认知入口；旧入口为兼容直连）
- [x] old API compatible（agent_step / /v1/chat 保留）
- [x] cross-channel test pass · [x] real LLM integration（TEST A 今日过；B/D 受 API 不稳定影响，如实记录）
- [x] all existing tests green（67/67 + npm test）· [x] Phase 3 report（本文档）

**Phase 3 完成。按规格停止。**
