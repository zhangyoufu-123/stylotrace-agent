# 代码审计 · 第一轮（诚实版）

**日期：** 2026-09-12 · **HEAD：** 见 git log · **范围声明：** **不是全仓审计**，见 §1。

---

## 1. 审计范围（我把话说清楚）

全仓共 84 个源文件 + 69 套测试 + web/api/skills。本轮我审计的是**我改动过、以及大赛演示会走到**的链路：

```
agent/src/csl/{adapter,decision,dual-diff,falsify,brief,canonical,credit,failure,state,actions,runtime,decision}.js
agent/src/{write,prompts,cli,mcp,director}.js
web/{server.mjs, public/assets/app.js, public/index.html}
scripts/{demo-tunnel.sh, md2pdf.mjs}
```

**尚未审计（下一轮）**：clarify/outline/redteam/style 系列/rag/library/knowledge/doc-pipeline/io/api(Python) 等
约 50 个文件。**我不会说"整个工程已经没有任何问题"。**

---

## 2. 本轮发现并修复的真实缺陷

| # | 缺陷 | 严重度 | 怎么发现的 | 修复 |
| --- | --- | --- | --- | --- |
| 1 | 违规分支调用未导入的 `logContext`（应为 `ws.logContext`）→ **只有"AI 改写了作者冻结句"时才崩溃**，平时测不出来 | 高（生产级隐患） | 决断卡测试的违规用例 | `ws.logContext`（`46265d2`） |
| 2 | **写作门形同虚设**：只要有"主题"就算有核心，`canWrite` 放行 → "没确认核心不让写"这句产品主张当时站不住 | 高（主张不成立） | **可证伪电池**第 1 项攻击 | 两档门：无主题/无核心 → 硬阻断；有主题无主张 → 硬阻断（话题≠主张）（本提交） |
| 3 | **双色 diff 漏判数字改动**：22% → 37% 被判为"只改说法"，事实层篡改能溜过去 | 高（信任功能失效） | **可证伪电池**第 8 项攻击 | 数字/年份/百分比变化一律判事实层（`number_changed`）（本提交） |
| 4 | `runTurn` 完全忽略 `sessionId` 做状态隔离（读/写都走默认会话）→ 跨通道/多任务互相污染 | 高 | 全链 E2E 验证 | 按会话读/写 + `acceptAnswer` 会话参数（`ebfbe0d`） |
| 5 | `runTurn` 最终提交与中途 `applyCredit` 版本碰撞（`2 <= 2` 抛错） | 中高 | 真实 LLM 反馈路径 | 最终提交前重读当前状态（`ebfbe0d`） |
| 6 | `canWrite` 只读默认会话 → 跨通道 Writer 门判定不一致 | 中 | 跨通道契约测试 | `canWrite(…, {sessionId})`（`d6d8ab8`） |
| 7 | 演示脚本在用户机器上"打不开/没链接"：cloudflared 不在 PATH、端口残留、失败静默 | 中（直接影响演示） | 用户在真实机器上复现 | 显式查找 cloudflared、端口自动换、node 检查、明确打印本地地址+密码+保持窗口（本轮） |

**其中 #2、#3 是"可证伪演示模式"自己抓出来的**——这正是它存在的意义：不是宣称能拦，而是主动攻击自己。

---

## 3. 当前测试基线

- 引擎 `node --test`：**69/69 通过**
- Web 套件：**420+ 项通过**（含决断卡/自证/双色 diff 28 项专项）
- 可证伪电池：**12/12 全部拦住**（`stylotrace falsify` 可复现）
- 真实 LLM 全链：E2E Closure 11/11（Gate A/B 通过，Gate C 诚实未过）

---

## 4. 已知剩余风险（未修，如实列出）

| 风险 | 说明 | 建议 |
| --- | --- | --- |
| 并发写同一会话无锁 | 两人同时用同一 session 可能互相覆盖 | 加文件锁或会话队列 |
| 无流式输出 | 长文等待感强（演示时明显） | SSE 流式 |
| 观测性不完整 | 无统一 trace_id / cost 汇总 | 事件账本已有字段，缺聚合视图 |
| 公网无限流 | 有密码门，但无速率限制 | 加 IP/令牌限流 |
| 真实 API 偶发断连 | 长推理响应被连接中断（实测） | 已加重试；建议演示前预热 + 备用 provider |
| 全仓未审计 | 约 50 个文件未过审 | 下一轮继续 |

---

## 5. 结论

演示主链路（CLI/MCP/Skill/Web → Adapter → CSLA → 写作 → 决断保护 → 自证）**已可用、可演示、可自证**；
但"生产级"还差并发/流式/限流/全仓审计四件事。我不把"跑通了"说成"没有问题"。
