# Stylotrace 工程状态报告

**日期**：2026-09-16　**版本**：v1.0.0　**审计方式**：全部数字为本次实测取值，非估计

---

## 0. 一句话状态

**五端可用、零运行时依赖、73 条命令零崩溃、652+466 项检查全绿。**（代码规模的准确数字见 [CODE-FRAMEWORK.md](./CODE-FRAMEWORK.md)——本文档早先写的 187 文件/54,020 行是错的，已订正）
研究层面有两项**主动不做**（不做 AI 判定、平仄不猜），三项**尚未做到**（长期学习、词牌、TTS 回采），已在 §7 逐条列出。

---

## 1. 产物与仓库

| 产物 | 位置 | 可见性 | 状态 |
|---|---|---|---|
| 公开代码仓库 | `github.com/zhangyoufu-123/stylotrace-agent` | **PUBLIC** | 736 文件，匿名可读，无论文/凭据 |
| 私有主仓库 | `github.com/zhangyoufu-123/stylotrace` | PRIVATE | 论文与竞赛材料 |
| 竞赛提交包 | `docs/competition/提交包/` + zip | 本地 | 8 个文件，五项材料齐 |

**双仓库同步**：`bash scripts/publish-public.sh [--dry-run]`
自动脱敏 + 推送前守卫（扫敏感文件 / 密钥 / 本机绝对路径，命中即中止）。
**手工同步已废除**——漏一次就是把论文推到公开仓库。

---

## 2. 代码规模

| 区域 | 文件 | 行数 |
|---|---|---|
| `agent/src` | **111**（根 76 + csl 22 + cadence 13） | **30,325** |
| `agent/test` | 83 | 9,477 |
| `web` | 3（server + app.js + app.css） | 6,825 |
| `scripts` | 56 | — |

**运行时依赖：0**（三个 package.json 的 `dependencies` 全为空）。
唯一 optional 外部程序：Chrome（导出 PDF）、cloudflared（公网演示）、python-docx（可选导出）。

---

## 3. 架构分层

```
┌─ 入口层（五端）────────────────────────────────────────┐
│  CLI         agent/bin/stylotrace.js  （73 条命令）      │
│  MCP         agent/src/mcp.js         （49 个工具）      │
│  Skill       skills/stylotrace/       （引擎内嵌快照）   │
│  Web         web/server.mjs + public/ （聊天式工作台）   │
│  API         web/server.mjs           （REST）          │
└───────────────────┬────────────────────────────────────┘
                    ▼
        Application Adapter（csl/adapter.js）统一契约
                    ▼
        Canonical State（csl/canonical.js）版本单调 · 事件可审计
                    ▼
        ┌───────────┴───────────┐
        ▼                       ▼
  CSLA 认知运行时           写作引擎（write/redteam/…）
  （24 步状态机 · 动作分派）
        ▼
   ┌────┴────┬────────┬─────────┬──────────┐
   ▼         ▼        ▼         ▼          ▼
 CADENCE   棱镜     决断卡    双色 diff   自证电池
 节奏/气群  三视图   冻结保护   事实/风格   12 项攻击
```

**关键工程纪律**：`agent/src` 是唯一事实源；`skills/stylotrace/scripts/engine/` 与
`extras/dsh-plugin-stylotrace/skills/.../engine/` 都是它的快照，
`bash scripts/sync-skill-engine.sh --check` 漂移即失败。

---

## 4. 模块清单（按职责域）

### 4.1 认知运行时 `agent/src/csl/`（22 个）

| 模块 | 职责 |
|---|---|
| `runtime.js` | 24 步状态机：Fast 反射 → 语言交互 → 深认知 → 记忆/推理/检索 → 动作 → 结果 → 误差 → 信用 → 重放 |
| `state.js` / `canonical.js` | 规范状态 + 版本单调 + 快照/恢复 |
| `actions.js` | 动作分派（ask/abstract/search/compare/counterexample/generate/stop…），**每个动作独立执行器** |
| `operators.js` | 可组合认知算子（比较/抽象/归纳/演绎/溯因/类比/反事实/重组/模拟） |
| `reasoning.js` / `hrmr.js` | 推理图 · 记忆的绑定/分离/补全/比较/重组/重放 |
| `replay.js` | 经历重放 → 重新评估 → 重新归因 → 更新记忆/策略（R1–R5） |
| `credit.js` | 反事实信用归因（非均分） |
| `failure.js` | 五类失败分类 + 作者质量加权 |
| `decision.js` | **决断卡**：8 字段、比较集必填、冻结句逐字校验 |
| `prism.js` | **棱镜三视图**：原文 / 事实层 / 风格层，就地只改说法 |
| `dual-diff.js` | **双色 diff**：句子级序列对齐（LCS），事实/风格分层 |
| `falsify.js` | **可证伪自证**：12 项攻击 |
| `capabilities.js` | 能力目录（19 项，CLI/Web/API 同源） |
| `panel.js` | 自包含单文件状态面板（7 板块） |
| `brief.js` / `ledger.js` / `events.js` / `elicit.js` / `e2e.js` / `adapter.js` | 认知简报 · 账本 · 事件 · 引导 · 端到端 · 应用适配 |

### 4.2 节奏引擎 `agent/src/cadence/`（14 个，本次新增）

| 模块 | 职责 |
|---|---|
| `segment.js` | 三层切分（句读/小句）+ 计数口径；小数点、引号书名号、英文缩写、标点连写 |
| `metrics.js` | mean/median/sd/CV/MAD/四分位/偏度/**排列熵**/**DFA-Hurst** |
| `breath.js` | **核心**：候选边界 → 强度打分 → 动态规划求最优切分；边界错位检测 |
| `author-corpus.js` | **样本从 agent 自己的语料取**：作品库 / 修改轨迹 / 成稿 |
| `baseline.js` | 分层基线；≥5 篇切作者基线，否则如实报 insufficient |
| `antipattern.js` | 六条反模式（含"机械交替比均匀更糟"） |
| `suggest.js` | 可解释建议 + 交给模型的结构化 prompt |
| `apply.js` | 只做确定性动作（插断句）；语义改写交给模型后重新验证 |
| `meter.js` | 声律：体式识别 + 平仄规则引擎（孤平/三平调/粘对） |
| `ssml.js` | 气群 → SSML（停顿/重音/语速），引擎不支持时降级并标 `degraded` |
| `adapters.js` | 与既有模块的接缝（**决断卡自动保护**） |
| `report.js` / `index.js` / `tone_data/` | 人话报告 · 三函数对外接口 · 字音表位（默认空，见 §7） |

### 4.3 写作与风格（`agent/src/` 根，76 个，主要几类）

- **流程**：`director.js`（导演决策）· `write.js` · `outline.js` · `revise.js` · `polish.js` · `restyle.js` · `transform.js`
- **风格**：`style.js` · `style-vector.js` · `style-memory.js` · `style-pulse.js` · `style-eval.js` · `style-adapter.js` · `stylometry.js` · `modulator.js`（外层调制器）· `personal-model.js`
- **审校**：`redteam.js` · `proofread.js` · `fact-check.js` · `consistency.js` · `originality.js` · `academic-norm.js` · `roundtrip.js`
- **交互**：`clarify.js` · `interview.js` · `reader-gallery.js`（8 读者身份）· `persona.js`
- **基础设施**：`llm.js`（BYOK 桥）· `credentials.js` · `config.js` · `workspace.js` · `concurrency.js` · `tty.js` · `ai-tells.js`

---

## 5. 验证证据（全部本次实测）

### 5.1 测试

| 套件 | 文件 | 断言 | 结果 |
|---|---|---|---|
| 引擎 | **74** | **652 项检查**（PASS/✓ 输出行） | 退出码 0，**0 失败** |
| 网页 | **15** | **466 项检查**（PASS/✓ 输出行） | 退出码 0，**0 失败** |
| 自证电池 | — | 12 项攻击 | **12/12 全部拦住** |
| 能力清单 | — | 19 项 | 真实可用 **17**，规划中 2 |

### 5.2 干净机器验证（从公开仓库下载）

```
git clone https://github.com/zhangyoufu-123/stylotrace-agent
node agent/bin/stylotrace.js capabilities   → 功能全景：真实可用 17/19
node agent/bin/stylotrace.js falsify        → 证伪电池：12/12 通过
node agent/bin/stylotrace.js cadence "…"    → 正常出报告
bash install.sh --global                    → 成功
```

**不装任何依赖、不带任何密钥**，上述全部通过。

### 5.3 崩溃扫描（全新目录、零状态）

**73 条命令 → 原始 JS 错误 0 个。**
（CLI 共 75 个命令；`mcp` 是常驻 stdio 服务、`setup` 会改宿主配置，
两者不放进批量扫描，分别由 `mcp-fresh.test.mjs`（真实 MCP 握手）和安装测试覆盖。）
缺前置条件时给的是人话（"先运行 stylotrace init"），不是栈。
（历史上 `author-sheet` / `panel` / `cite` 曾在空状态崩过，已修并锁进
`cli-fresh-install.test.mjs`——每次全量测试都会重跑这 73 条。）

### 5.4 真实模型链路（非模拟）

- 端到端冒烟：`CSL_REAL_LLM=1 npm run test:csl-real` 通过
- 与 GitHub 最火 humanizer（47.1k★）的 A/B：3 轮 × 6 用例，同模型同温度
- 引用机制：`quote-input.test.mjs` 用**拦截 fetch**证明引用确实进了模型提示（不是只在界面）

---

## 6. 五端入口对照

| 能力 | CLI | MCP | Skill | Web | API |
|---|---|---|---|---|---|
| 导演流程 | `stylotrace agent` | `agent_step` | ✅ | 对话输入 | `POST /api/step` |
| 需求澄清 | `clarify` | `clarify_step` | ✅ | 追问卡片 | `POST /api/start` |
| 棱镜三视图 | `prism` | `prism` | ✅ | 🔺 面板 | `POST /api/csl/prism` |
| 决断卡 | （Web/API 为主） | `decision_*` | ✅ | 🔒 面板 | `POST /api/csl/decision` |
| **节奏与气群** | `cadence` | `cadence_analyze` | ✅ | 🔊 面板 | `POST /api/cadence` |
| 自证电池 | `falsify` | `falsify` | ✅ | 按钮 | `GET /api/csl/falsify` |
| 状态面板 | `panel --html` | `status_panel` | ✅ | 📋 面板 | `GET /api/csl/panel` |

**四端同一内核**：都经 Application Adapter → Canonical State，跨通道共享同一会话状态。

---

## 7. 已知边界与风险（不粉饰）

### 7.1 主动不做（设计选择，答辩时是加分项）

| 不做 | 硬理由 |
|---|---|
| **不做"这是 AI 写的"判定器** | 有研究显示分类器把 **61.22%** 非英语母语者托福作文误判为 AI。那是伤害不是功能。只报告"相对作者自身基线"的偏离 |
| **不宣称"均匀 = 差"** | 说明文、法律文本里均匀是优点。只报数值，不做价值判断 |
| **平仄不由 LLM 判定** | 必须规则后端 + 字音表；缺表时**全部标 unknown、tonal_score 返回 null**，绝不编分数 |

### 7.2 尚未做到（明确列出，不假装完成）

| 缺口 | 影响 | 怎么补 |
|---|---|---|
| **黄金样本校准未跑** | 规格要求拿老舍《入会誓言》对 CV 0.28 校准；原文有版权，本仓库不转载 | 把原文放进 `agent/test/fixtures/laoshe-rumian.json`，跑 `node test/cadence-metrics.test.mjs --calibrate`。**现有替代证明**：构造样本的解析解 + 分句→计数→统计全链一致 |
| **平仄字音表未附** | 平仄只出结构分，不出平仄分 | 放 `agent/src/cadence/tone_data/pingshui.json`（格式见该目录 README）。**不能由代码或 LLM 生成** |
| **TTS 真实回采未接** | 只有 `compareProsody()` 比对函数，没接音频处理依赖 | 需提取 F0/时长/静音段（额外依赖） |
| **词牌支持未实现** | 未收录词牌一律返回 `unknown` | 需 `cipai_patterns.json` |
| **长期学习未证明** | 只验证到机制级（出错会改变下次动作选择） | 需纵向实验 |
| **无真人盲评** | 只有小样本自动对照 | 需真实读者 |

### 7.3 运行环境依赖（非代码缺陷，但要知道）

| 依赖 | 影响 | 规避 |
|---|---|---|
| 本机网络对 github.com HTML 不稳定 | 偶尔 clone 报 `early EOF` | 重试；或用 API |
| cloudflared 走 QUIC 会被代理干扰 | 隧道"看着在、点开 502" | 脚本已默认 `--protocol http2` 并加互相监督 |
| 网页服务默认无密码 | 公网裸奔会烧宿主额度 | 部署必设 `STYLOTRACE_WEB_PASSWORD`；隧道脚本自动带 |

### 7.4 安全边界

- **密钥**：不落日志、不进仓库（全历史扫描为空）、BYOK 只存浏览器 localStorage
- **公网防护**：请求体上限 8MB、按 IP 限流、路径穿越已测（404/401）
- **机器隔离**：`X-Machine-Id` 是**客户端约定，不是安全边界**；真正的门是访问密码
- ⚠️ **你之前在聊天里贴过的 npm token 应当视为已泄露，请撤销重建**

---

## 8. 复现全部验证（一条条可跑）

```bash
# 引擎测试（74 文件 652 项检查）
cd agent && npm test

# 网页测试（15 文件 466 项检查）
cd web && npm test

# 自证电池（12 项攻击）
node agent/bin/stylotrace.js falsify

# 能力清单 + 崩溃扫描（73 条命令，全新目录）
node agent/bin/stylotrace.js capabilities
node agent/test/cli-fresh-install.test.mjs

# 节奏引擎（分句 14 / 统计 8 / 闭环 12 / 集成 5）
node agent/test/cadence-segment.test.mjs
node agent/test/cadence-metrics.test.mjs
node agent/test/cadence-loop.test.mjs
node agent/test/cadence-agent-integration.test.mjs

# 快照一致性（改过 agent/src 后必须跑）
bash scripts/sync-skill-engine.sh --check

# 同步到公开仓库（带守卫）
bash scripts/publish-public.sh --dry-run
```

---

## 9. 近期修掉的真实缺陷（都有回归测试）

| 时间线 | 缺陷 | 根因 |
|---|---|---|
| `d452694` | 装完崩溃 | `author-sheet`/`panel`/`cite` 在空状态抛原始 JS 错误 |
| `c600e56` | IDE 里用不了 | ① 安装器把备份留在 skills 目录 → 被当成第二个 skill（备份里是**旧代码**）② MCP 首次调用报"工作区不存在" |
| `b2c03f3` | 非交互环境不可用 | 只修了 `agent`，漏了 `clarify`/`interview`/`credentials`/`csl`/`run` → 抽成共用 `tty.js` |
| `6a2ea11` | 隧道 502 | ① 后端死了隧道还活着 ② QUIC 被代理干扰 |
| `2340710` | 节奏引擎三个 bug | ① 半角化把中文逗号也转了（**篡改原文**）② 归一化把「……」压成一个「…」（**丢字符**）③ 断句按字符计数，把「3200」切成「32。00」 |
| `2982384` | 基线永远攒不起来 | 按"句读 ≥8"筛样本，6 篇散文全被丢掉 → 0/5 |

---

## 10. 结论

**能保证的**：上述每一条都是本次实测结果，可逐条复现；代码零运行时依赖，
从公开仓库下载即可运行；缺前置条件时给人话不抛栈。

**不能保证的**：没有真人盲评、没有纵向学习数据、平仄与黄金样本缺数据。
这些不是"没测"，是**当前客观做不到**，已在 §7.2 列明并给出补法。

> 把不做什么、做不到什么都写清楚，比宣称什么都能做更接近工程。
