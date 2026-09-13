# Agent Entry Capability Matrix（Phase 3 后）

**日期：** 2026-08-30 · 判定：✅ 有（经统一 Adapter/CSLA）· ⚠️ 部分 · ❌ 无

| Capability | CLI | MCP | Skill | Web/API |
| --- | --- | --- | --- | --- |
| Fast | ✅ | ✅ csl_turn | ✅ stylotrace run | ✅ POST /turn |
| Deep | ✅ | ✅ csl_turn(mode=deep) | ✅ | ✅ |
| AskHuman | ✅ | ✅ csl_turn(ask) | ✅ | ✅ |
| Memory | ✅ | ✅ csl_turn/csl_action | ✅ | ✅ |
| Search | ✅ | ✅ csl_action(search) | ✅ | ✅ |
| Reasoning | ✅ | ✅ csl_action | ✅ | ✅ |
| Writer Gate | ✅（canWrite） | ✅（同一 gate） | ✅ | ✅ |
| Outcome | ✅ | ✅（同一 runtime） | ✅ | ✅ |
| Credit | ✅ | ✅（同一 runtime） | ✅ | ✅ |
| Replay | ✅ | ✅（同一 runtime） | ✅ | ✅ |
| State（同会话跨通道） | ✅ | ✅ csl_state | ✅ | ✅ GET /state |
| Checkpoint 恢复 | ✅ | ✅ csl_checkpoint | ✅ | ✅ POST /checkpoint |

## 统一方式

```text
CLI / MCP / Skill / Web/API
  ↓
Application Adapter（agent/src/csl/adapter.js：runTask/decideTask/answerCheckpoint/runAction/canonicalSnapshot）
  ↓
Canonical State（按 sessionId 隔离，跨通道共享）
  ↓
CSLA Runtime（唯一认知源）
  ↓
Application Executor（director/write/rag/redteam —— 应用层只做转换）
```

## 一致性证据

- 契约：同输入不同通道 → 同一认知动作/状态版本（csl-adapter 测试）
- 跨通道：cli ask → mcp checkpoint → web deep 共享会话（stateVersion 单调、coreIdea 可见）
- Writer 门：`canWrite` 现按 sessionId 判定（修复了"只读默认会话"的跨通道不一致）
- 旧入口：`agent_step`/`/v1/chat` 等保持兼容（compatibility adapter 直连同一 runtime，未复制逻辑）
