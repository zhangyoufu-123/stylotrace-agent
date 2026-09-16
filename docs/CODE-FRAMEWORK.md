# Stylotrace 代码框架 · 绝对真实版

**日期**：2026-09-16　**审计工具**：`scripts/audit-deps.mjs`（可复跑）

---

## 0. 这份文档的立场

上一份《工程状态报告》要回答"现在能不能用"；这一份要回答**"代码到底长什么样"**。

所以它有两条规矩：

1. **数字全部来自脚本扫描，不是我数的**。规模、依赖、孤儿模块都由
   `node scripts/audit-deps.mjs` 算出，你可以自己跑一遍对。
2. **写完先自曝问题**。§7 专门列"文档说的和代码做的不一致"的地方——
   包括我上一份文档里写错的数字。

> 一份只讲架构多漂亮的框架梳理，价值接近于零。

---

## 1. 真实规模（更正上一份报告的错误）

| 项目 | 本次实测 | 上一份报告写的 | 说明 |
|---|---|---|---|
| `agent/src` 模块数 | **111** | 187 ❌ | 上次用 `ls agent/src/*.js agent/src/**/*.js` 统计，glob 重复计数 |
| `agent/src` 行数 | **30,325** | 54,020 ❌ | 同上 |
| 根目录模块 | 76 | 76 ✅ | |
| `csl/` | 22 | 22 ✅ | |
| `cadence/` | 13 个 .js（另有 `tone_data/` 目录） | 14 ❌ | 把目录也算成了一个文件 |
| `agent/test` | 84 个 .mjs（74 个注册）/ 9,477 行 | 83 ⚠️ | |
| `web/` | 3 个文件 / 6,825 行 | 3 ✅ | |
| 运行时依赖 | **0** | 0 ✅ | 三个 package.json 的 `dependencies` 全空 |

**复跑命令**：`node scripts/audit-deps.mjs`

---

## 2. 真实依赖图

### 2.1 地基模块（被引用最多 = 动它最危险）

```
 51 × workspace.js      工作区读写（一切持久化的入口）
 39 × llm.js            BYOK 模型桥（所有模型调用的唯一出口）
 13 × style-vector.js   四层复合风格向量
 12 × style.js          风格档案
 10 × csl/state.js      认知状态转移
 10 × prompts.js        提示词
  9 × rag.js            检索
  9 × redteam.js        反 AI 审计
  8 × genre.js          文体
  8 × history.js        版本快照
  8 × style-memory.js   风格记忆
  7 × csl/brief.js      认知简报
```

**读法**：改 `workspace.js` 或 `llm.js` 会波及全仓（51 / 39 处）。这两个模块的接口
必须保持稳定——它们是整个系统的地基。

### 2.2 叶子模块（不引用任何人 = 纯工具/常量）

29 个，例如 `ai-tells.js`（AI 腔模式目录）、`concurrency.js`（并发限流）、`tty.js`（TTY 检查）、
`cadence/metrics.js`（统计量）。这类模块风险最低，可以独立替换。

### 2.3 无静态 import 的入口

`cli.js` / `mcp.js` / `director.js` 由 `agent/bin/` 与 `web/server.mjs` 拉起，属于顶层入口。

---

## 3. 分层与数据流（经过验证的，不是愿望）

```
┌─ 入口层 ────────────────────────────────────────────────┐
│ agent/bin/stylotrace.js   → cli.js       （75 条命令）   │
│ agent/src/mcp.js                          （49 个工具）  │
│ skills/stylotrace/        引擎内嵌快照（与 agent/src 同源）│
│ web/server.mjs            HTTP 服务 + 静态前端            │
│ web/public/assets/app.js  前端逻辑（6.8k 行内联单页）     │
└───────────────────────┬─────────────────────────────────┘
                        ▼
              csl/adapter.js  ← 命令/工具/HTTP 三个入口收敛到同一契约
                        ▼
              csl/state.js + csl/canonical.js
              （规范状态：版本单调、快照/恢复、跨会话隔离）
                        ▼
        ┌───────────────┴────────────────┐
        ▼                                ▼
  csl/runtime.js                    director.js
  （认知运行时：转移 + 动作分派）     （写作导演：决定下一步写什么）
        ▼                                ▼
  csl/actions.js ← 每个动作独立执行器   write / outline / redteam / …
        ▼
  验证层（四个确定性校验器，零 API）
  ├─ dual-diff.js   事实层 / 风格层分离（句子级 LCS 对齐）
  ├─ prism.js       棱镜三视图 + 只改说法
  ├─ falsify.js     12 项自证攻击
  └─ cadence/       节奏与气群（13 个模块）
```

**已验证的事实**（不是设计意图）：

- `runtime.js` 确实 import 了 `state.js` / `events.js` / `credit.js`——信用归因走的是**生产路径**
- `adapter.js` 是被 CLI / MCP / Web 共同引用的**唯一收敛点**（跨通道共享状态靠它）
- `cadence/*` 被 `director.js` 在交付前的质量阶段调用（shadow mode，只记录不干预）

---

## 4. 五端入口（对照表）

| 入口 | 文件 | 启动方式 | 规模 |
|---|---|---|---|
| CLI | `agent/bin/stylotrace.js` → `src/cli.js` | `node agent/bin/stylotrace.js <cmd>` | 75 条命令 |
| MCP | `agent/src/mcp.js` | `stylotrace mcp`（stdio JSON-RPC） | 49 个工具 |
| Skill | `skills/stylotrace/` | 宿主读取 `SKILL.md` | 引擎内嵌 |
| Web | `web/server.mjs` + `public/` | `node web/server.mjs` | 单页应用 |
| API | `web/server.mjs` | REST | 与 Web 同进程 |

**同源性由脚本保证**：`bash scripts/sync-skill-engine.sh --check` 比对
`agent/src` 与内嵌快照，漂移即失败。

---

## 5. 模块分类清单（111 个）

### 5.1 认知运行时 `csl/`（22）

**运行时核心**：`runtime.js`（转移+分派）· `state.js`（纯函数转移）· `actions.js`（动作执行器）
· `canonical.js`（规范状态）· `events.js`（事件账本）· `adapter.js`（三入口收敛）

**认知机制**：`operators.js`（算子）· `reasoning.js`（推理图）· `hrmr.js`（记忆六机制）
· `replay.js`（重放再巩固）· `credit.js`（**生产路径的反事实信用**）· `failure.js`（五类失败）

**交互与产物**：`elicit.js`（提问策略）· `brief.js`（认知简报）· `decision.js`（决断卡）
· `prism.js`（棱镜）· `dual-diff.js`（双色 diff）· `falsify.js`（自证）· `panel.js`（状态面板）
· `capabilities.js`（能力目录）

**不在生产路径**：`ledger.js`、`e2e.js` —— 见 §7.1

### 5.2 节奏引擎 `cadence/`（13）

`segment.js`（三层切分）· `metrics.js`（统计量）· **`breath.js`（气群划分，核心）**
· `author-corpus.js`（作者语料）· `baseline.js`（分层基线）· `antipattern.js`（六反模式）
· `suggest.js`（建议）· `apply.js`（确定性应用）· `meter.js`（声律）· `ssml.js`（语音）
· `adapters.js`（与 csl 的接缝）· `report.js`（报告）· `index.js`（对外三函数）

### 5.3 写作与风格（根目录 76，主要几类）

| 类别 | 模块 |
|---|---|
| 流程 | `director` `write` `outline` `outline-state` `outline-review` `revise` `restyle` `polish` `transform` `edit-transform` `point-edit` |
| 风格 | `style` `style-vector` `style-memory` `style-pulse` `style-eval` `style-adapter` `stylometry` `modulator` `personal-model` `profile` `author-sheet` `avoidance` |
| 审校 | `redteam` `proofread` `fact-check` `consistency` `originality` `academic-norm` `academic` `roundtrip` `synthesize` |
| 交互 | `clarify` `interview` `reader-gallery` `persona` `purpose` `intent` `hook` |
| 内容 | `knowledge` `library` `rag` `embedding` `citation` `asset` `character` `bible` `genre` `concretize` `structure` `thinking` `fake-thinking` |
| 基础设施 | `llm` `credentials` `config` `workspace` `io` `concurrency` `tty` `history` `governance` `observer` `experiment` `stats` `budget` `preset` `setup` `mcp` `cli` `ai-tells` |

---

## 6. 测试覆盖的真相

**agent/test 目录有 84 个 .mjs（其中 74 个注册进 `npm test`，其余是 mock-llm 等辅助文件）**，但覆盖并不均匀：

- **高覆盖**：`csl/*`（几乎每个都有 `csl-*.test.mjs`）、`cadence/*`（4 个测试文件）、
  `redteam` `humanize` `modulator` `stylometry` 等
- **完全没有直接测试引用的模块：20 个**

```
cadence/adapters.js  cadence/antipattern.js  cadence/apply.js  cadence/author-corpus.js
cadence/baseline.js  cadence/breath.js       cadence/suggest.js
dissect.js  history.js  hook.js  interview.js  observer.js
outline-review.js  outline-state.js  profile.js  reader-gallery.js
restyle.js  review.js  setup.js  tty.js
```

**但"没有直接引用"≠"没被测到"**：

- `cadence/*` 那 7 个由 `cadence-loop.test.mjs` / `cadence-agent-integration.test.mjs`
  通过 `cadence/index.js` **间接覆盖**（对外三函数的测试会走到它们）
- `interview.js` / `reader-gallery.js` 由 **web 端测试**（persona-qa 等）覆盖
- `history.js` 由回滚相关测试间接覆盖

**诚实的结论**：真正**没有任何测试路径**的大概是 `dissect.js` / `observer.js` /
`outline-review.js` 这几个——它们要么是辅助展示，要么只在交互式流程里被走到。

---

## 7. 真实性问题清单（这份文档最该看的部分）

### 7.1 两个模块不在生产路径上

| 模块 | 被谁引用 | 问题 |
|---|---|---|
| `csl/ledger.js` | 只有 3 个测试 + 1 个实验脚本 | **功能与 `credit.js` 重复**（都有 `recordOutcome`、B0/B1/B2 信用基线），但生产走的是 `credit.js`。它是**历史遗留的平行实现** |
| `csl/e2e.js` | 只有 1 个测试 | **自测用的 13 步全链脚手架**，不参与产品运行 |

**这不是 bug，但文档必须说清**：能力清单里如果不加区分，读者会以为
"13 步全链闭环"和"结果账本"是运行时能力——实际上前者是测试脚手架，
后者的生产实现是 `credit.js` 而不是 `ledger.js`。

→ 建议：`ledger.js` 要么删除、要么标注 `LEGACY`；`e2e.js` 移进 `agent/test/` 更合适。

### 7.2 一条能力"写了盘但读不出来"

**`audit-trail`** 能力的证据写的是"事件账本 + **结果账本** + 决断卡，可逐条导出核查"。

实测：

| 部分 | 生产实现 | 用户能否读出来 |
|---|---|---|
| 事件账本 | `events.js` | ✅ 状态面板显示最近 12 条 |
| 决断卡 | `decision.js` | ✅ 面板 + `GET /api/csl/decisions` |
| **结果账本** | `credit.js`（`outcomeFile` / `listOutcomes`） | ❌ **没有任何对外入口** |

**结果账本确实被 runtime 写进了磁盘**（`runtime.recordFeedback` → `creditEngine.recordOutcome`），
但 CLI / MCP / Web **都没有读它的命令或接口**。

→ 结论：这条能力**被夸大了**。写进去不等于能拿出来。

### 7.3 文档与代码的其他不一致

| 位置 | 说的 | 实际 |
|---|---|---|
| 上一份《工程状态报告》§2 | 187 文件 / 54,020 行 | **111 文件 / 30,325 行** |
| 上一份《工程状态报告》§4.2 | `cadence` 14 个 | 13 个 .js + 1 个目录 |
| 能力清单 `cadence` 证据 | "cadence-* 测试 34 项" | 实际分句 14 + 统计 8 + 闭环 12 + 集成 5 = **39 项** |

### 7.4 代码本身很干净的地方（也要说）

- 全仓只有 **2 处** TODO/未实现标记（`capabilities.js` 里 `sidecar` 明确写"尚未实现"）
- **零运行时依赖**——没有供应链风险，没有版本地狱
- 111 个模块都是单一职责命名的文件，没有 `utils.js` 这种垃圾桶

---

## 8. 怎么自己复核

```bash
# 依赖图 / 规模 / 孤儿模块（本文件 §1 §2 的数据来源）
node scripts/audit-deps.mjs
node scripts/audit-deps.mjs --json

# 能力清单（含每条能力的证据指向）
node agent/bin/stylotrace.js capabilities

# 全量测试
cd agent && npm test     # 74 个测试文件
cd web && npm test       # 15 文件

# 引擎快照是否漂移
bash scripts/sync-skill-engine.sh --check

# 确认 ledger / e2e 确实不在生产路径
rg -n 'ledger\.js' --glob '!**/scripts/engine/**' .
rg -n 'e2e\.js'    --glob '!**/scripts/engine/**' .

# 确认结果账本没有对外入口
rg -n 'listOutcomes|outcomeFile' agent/src web/server.mjs
```

---

## 9. 结论

**框架是真实的**：111 个模块、明确分层、单一入口收敛、零依赖。
地基是 `workspace.js` + `llm.js`，改它们影响全仓。

**但有四处不一致已列明**：2 个模块不在生产路径、1 条能力被夸大、
3 处文档数字有误（含我上一份报告）、1 处测试计数不准。

**下一步最该做的三件**（按性价比排序）：

1. 给结果账本加读取入口（CLI `stylotrace outcomes` + 面板一栏）——把被夸大的能力**变成真的**
2. `ledger.js` 决策：删掉，或明确标 `LEGACY` 并在测试里只保留兼容性断言
3. `e2e.js` 移到 `agent/test/`（它本来就是测试脚手架）
