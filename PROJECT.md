# Stylotrace 项目文档（工程视角 · 真实状态）

> 本文档写给第一次接触本仓库的人：快速理解“它是什么、现在做到哪一步、哪些是真的、哪些还没做”。
> 原则：诚实第一。凡未经验证的都明确标注“未验证/路线图”，不夸大、不编造。

## 1. 一句话定位

Stylotrace 是一个**深度协作写作 Agent（写作子 agent）**：从作者对 AI 草稿的每一次亲手修改里学习个人文风，
并主导 澄清 → 大纲 → 写作 → 审计 → 交付 的完整写作流程。它以 skill / MCP / CLI / DSH 插件形态装进
Codex、Claude Code、OpenCode、DeepSeek Harness、Cursor、Windsurf 等 agent 宿主，也提供可选的本地
Web 工作台与自部署 API。

核心主张：**不是让 AI“写得更像人”，而是“写得更像你”**——通过可解释、可消融、随修改增量更新的
外层调制器，而不是给每个用户微调模型。

## 2. 真实状态速览

| 维度 | 状态 | 证据/说明 |
| --- | --- | --- |
| 代码规模 | 73 个引擎模块 | `agent/src/` 实测 |
| 测试 | 44 个测试文件全绿 | `node --test` 实测（上次全量运行） |
| 引擎版本 | 1.0.0 | `agent/package.json` |
| DSH 插件 | 0.1.15（npm 已发布） | `extras/dsh-plugin-stylotrace/package.json` |
| 部署形态 | CLI / MCP / skill / Web / FastAPI / DSH 插件 六种 | 均已实现，见 §4 |
| 真实用户 | **无**（公开使用量为零） | 仓库无星标、npm 无下载统计；产品尚未正式发布 |
| 核心机制级别 | **候选级**（生成多个候选→评分选优） | 逐 token 重排（V2 logprobs / V3 本地推理）仍是路线图 |
| LLM 依赖 | 强依赖（BYOK） | 无 key 时确定性降级可用，但写作质量打折 |
| 真人验证 | **未做** | 44 套自动化测试 ≠ 真人“装→写→导出”走查 |

## 3. 这是什么 / 不是什么

### 是

- 一个会先读懂作者、再代笔的写作 Agent；
- 一个从“作者实际改了什么”里学风格的系统（改迹调制）；
- 一个可解释、可消融、训练免费的个性化路线（外层调制器）；
- 一个能在主流 agent 生态里随叫随到的写作能力。

### 不是

- 不是通用聊天助手（编程/答疑/翻译等生态位外主动让位）；
- 不是逐 token 风格微调（当前是候选级评分）；
- 不是已上线、有真实用户的产品（还没有）。

## 4. 六种工作形态

| 形态 | 入口 | 说明 | 状态 |
| --- | --- | --- | --- |
| CLI | `stylotrace <命令>` | 60+ 命令，覆盖写作主线与工程工具 | 完整 |
| MCP server | `stylotrace mcp` | ~44 个工具，供宿主 agent 调用 | 完整 |
| Skill | `~/.codex/skills/stylotrace/` | 内嵌完整引擎，脱离 CLI 独立运行 | 已安装 |
| Web 工作台 | `cd web && npm start` | BYOK，浏览器填 key 使用 | 完整（可选） |
| FastAPI | `./run-api.sh` | BYOK HTTP API + 自带前端 | 完整（可选） |
| DSH 插件 | `dsh plugin add dsh-plugin-stylotrace` | npm 包，43 个 MCP 写作工具 | 已发布 0.1.15 |

## 5. 架构与代码地图

单一事实源：`agent/`（引擎）。`skills/stylotrace/scripts/engine/` 是它的快照
（`scripts/sync-skill-engine.sh` 同步，CI 校验防漂移）；DSH 插件再 vendor 该快照。

```text
agent/src/          73 个模块（引擎本体）
  cli.js             CLI 入口与命令分发
  director.js        导演状态机（自主决策 + 确定性兜底）
  mcp.js             MCP 工具注册
  clarify.js         澄清协议（一次一问 / 外溢优先 / 思想脉络）
  outline.js         大纲生成
  write.js           逐节写作（风格注入）
  revise.js          复阅-修订
  redteam.js         反 AI 审计（黑名单/重复比喻/姿态层）
  reader-gallery.js  读者群像（8 位第一读者 + 交锋）
  modulator.js       外层调制器（候选评分，学习权重）
  token-decode.js    候选对比解码（改迹调制核心）
  personal-model.js  个人 n-gram 模型（p_personal）
  style.js / style-vector.js / style-memory.js / style-pulse.js / style-adapter.js
                     风格档案 / 四层向量 / 记忆 / 脉搏 / 适配卡
  concretize.js      具体化拟改（抽象→具体，从作者编辑对学）
  avoidance.js       个人回避库（作者删过什么）
  edit-transform.js  改迹变换（作者怎么改）
  governance.js      输入治理面（长期意图 + 当前聚焦）
  purpose.js         目的→风格调节
  structure.js       非线性结构装置（倒叙/插叙/突转/留白/反问）
  constraints.js     成功标准→可验证约束
  knowledge.js / rag.js / library.js   知识库 / 检索 / 个人写作库
  intent.js / thinking.js / interview.js   意图 / 思想脉络 / 访谈
  fact-check.js / proofread.js / academic-norm.js / originality.js   质量门
  consistency.js / character.js / bible.js   伏笔 / 角色 / 文章圣经
  roundtrip.js / doc-pipeline.js / io.js   回译校验 / 文档管线 / 导出
  preset.js / polish.js / synthesize.js / humanize 相关   扩展能力
  llm.js / config.js / credentials.js   模型接入 / 配置 / 凭据发现
agent/test/         44 个测试文件
web/                可选本地写作工作台（BYOK）
api/                可选自部署 FastAPI（BYOK）
skills/stylotrace/  可安装技能（内嵌引擎快照）
extras/dsh-plugin-stylotrace/   DSH 插件（npm 包）
docs/               产品/设计/理论文档
scripts/            实验脚本（学习曲线/作者识别/盲评等）
```

## 6. 核心创新（实现现状与边界）

### 已实现并测试

1. **改迹调制**：把作者每次亲手修改（原文→改后→意图）当作偏好标注，学外层调制器权重；
   候选级评分选优，附“为什么选它”的得分分解。这是全项目最核心、最独特的创新。
2. **四层风格向量**：L1 连续向量 + L2 动态维度 + L3 困惑度签名 + L4 偏好对。
3. **改迹变换 + 拟改层**：从编辑对学“作者怎么改”（删什么/断句/改具体），选优后复现改法。
4. **姿态层**：反“表演式思考”（金句排比/路标转折/点题顿悟），软性加权而非拒绝生成。
5. **外溢优先 + 思想脉络**：接住用户主动说出的高价值信息，追踪主张-前提-推理-来源。
6. **统一评分空间**：基础分布/个人分布/知识/缺陷/阻抗五路信号，同一可解释评分函数。
7. **治理面 + 目的/结构/约束/具体性/情感**：长期意图、写作目的、非线性结构、成功标准、
   具体性与情感画像，全部作为可注入信号进入生成。

### 边界（如实）

- **候选级，非 token 级**：V2 logprobs / V3 本地推理是路线图，未实现。
- **具体性/情感是启发式特征**：确定性近似，不是学出来的语义理解；报告会标注“请人工复核”。
- **LLM 依赖**：澄清/写作/审计需要 API key；无 key 降级后可用但效果打折。

## 7. 完整写作工作流

```text
观察 → 澄清（一次一问/思想脉络/外溢优先）→ 大纲 → 逐节写作
      → 复阅-修订 → 反 AI 审计 → 读者群像 → 质量门 → 交付
```

- **半自由导演**：LLM 每轮自主决定下一步；确定性状态机兜底；人只在真正决策点拍板。
- **全程风格采集**：每一轮对话、每一条素材、每一次手动修改都被吸收进风格档案。
- **交付质量门**：字数核对、风格保真、原创性、校对、事实核查、回译校验、学术规范、成功标准约束。

## 8. 能完成什么任务

- 散文 / 议论文 / 演讲稿 / 记叙文：全流程自动；
- 学术论文：论证链（已知→缺口→张力→洞见→方法→证据→局限）+ 参考文献草稿；
- 公文 / 合同 / 通知：20+ 文体范式，公文按 GB/T 9704-2012 排版导出；
- 小说 / 推理：角色预演、伏笔记账与回收校验；
- 长文 / 系列文：卷级大纲、文章圣经跨篇一致性；
- 翻译 + 回译校验：先懂原意再翻译，信息点核对；
- 项目自动提炼：给项目目录 → 实验报告/产品介绍/README/技术博客；
- 改写矩阵：扩写 / 缩写 / 润色 / 古文风 / 脱敏 / 按目的调风格；
- 去 AI 味：人类化指数打分 + 按作者风格重写复检；
- 定点修改：选一句 → 按作者习惯改写 → 吸收进风格档案。

## 9. CLI 命令索引（分组）

```text
写作主线   agent / interview / clarify / outline / write / revise /
           redteam / audience / debate / review / dissect
风格       style / style-vector / style-eval / style-adapter / style-memory /
           modulator / persona / author-sheet / absorb / fingerprint /
           profile / governance
改写/定点  restyle / transform / point-edit / rewrite / polish /
           absorb-sample / diagnose-sentence / diagnose
知识/检索  knowledge / library / recommend / rag / citations / cite /
           ingest / bible / character
质检       fact-check / proofread / originality / norm / consistency /
           academic / emotion / curve / roundtrip
工程/生态  init / status / panel / history / rollback / export / doc /
           dictate / experiment / setup / credentials / doctor / hook /
           mcp / probe / genre / preset / synthesize
```

每个命令的完整说明见 `stylotrace --help` 与 [docs/GUIDE.md](docs/GUIDE.md)。

## 10. MCP 工具索引（~44 个）

```text
生态位      probe
流程        init / panel / status / clarify_step / agent_step / interview_step
大纲/写作    outline / outline_review / write_section / write_all /
            restyle / transform / point_edit / quote
审计        redteam / proofread / fact_check / originality / style_eval /
            review / dissect / diagnose_sentence
读者        audience / reader_debate
扩展        polish / synthesize
风格        style_status / style_memory / style_adapter / absorb / fingerprint
资料        rag_search / rag_ingest / data_needs / citations
文档/历史    doc_translate / doc_restyle / history / rollback /
            profile_export / profile_import / absorb_sample
```

## 11. 快速开始（本地跑起来）

```bash
# 1. 安装（装进 Codex/Claude Code/OpenCode/Cursor/Windsurf）
curl -fsSL https://raw.githubusercontent.com/zhangyoufu-123/stylotrace/main/install.sh | bash -s -- --all

# 2. 或装 DSH 插件
dsh plugin --profile web add dsh-plugin-stylotrace

# 3. 手动跑（开发）
cd agent && npm test                 # 全量测试
node src/cli.js init                 # 初始化工作区
node src/cli.js agent                # 导演模式，开始一段写作

# 4. 可选 Web / API
cd web && npm start                  # 本地写作工作台（BYOK）
./run-api.sh                         # FastAPI（BYOK）
```

凭据：未配置 `STYLOTRACE_LLM_API_KEY` 时，自动发现宿主已配置的 API（Codex/Claude/OpenCode/env），
绝不打印；`stylotrace credentials --ask` 可交互选择。

## 12. 测试与质量

- 44 个测试文件全绿（`cd agent && node --test`），覆盖：一次一问、实时大纲、字数达标、
  红队 8 文体 × 6 对抗输入、长文端到端、回译校验、全格式导出、统一 Token 解码、改迹调制、
  外层调制器、神经风格编码、作者写作清单、姿态层、盲评统计、目的/结构/约束/具体性/情感。
- Web 另有 11 套 QA（含 headless 浏览器验收）；DSH 插件含路由 + 浏览器验收。
- **诚实边界**：这些是契约/单元测试，不等于真人走查；真人“装→写→导出”验证尚未进行。

## 13. 已知限制（如实）

1. **候选级而非 token 级**：逐 token 风格重排未实现（V2/V3 路线图）。
2. **LLM 依赖**：核心流程强依赖 API；无 key 降级可用但效果有限。
3. **无真实用户**：产品尚未正式发布，公开使用量为零；“越用越像你”缺少真人长期验证。
4. **中文为主**：实验与语料以中文为主，多语言未覆盖。
5. **实验规模小**：作者识别/续写选择样本量小，未做完整显著性报告；盲评是 LLM 模拟、非真人。
6. **单作者偏置**：风格实验以一位目标作者为主体。
7. **论文与竞赛材料不随仓库发布**：`docs/competition/` 为个人成果，按约定仅本地保留。

## 14. 路线图（真实）

- 意图分流训练、状态向量化；
- V2 logprobs / V3 本地 DExperts 与激活转向（逐 token 级）；
- 真人盲评与多作者 × 多主题语料；
- 跨语言验证；
- 公开部署与真实用户验证（当前最缺）。

## 15. 文档导航

- [README.md](README.md)：产品定位与安装（面向用户）
- [docs/GUIDE.md](docs/GUIDE.md)：使用手册（命令大全）
- [docs/THEORY.md](docs/THEORY.md)：理论架构
- [docs/MODULATOR.md](docs/MODULATOR.md)：外层调制器
- [docs/STYLE-SYSTEM.md](docs/STYLE-SYSTEM.md)：四层风格体系
- [docs/INTEROP.md](docs/INTEROP.md)：全流程文件进出
- [docs/UNIFIED-TOKEN-FRAMEWORK.md](docs/UNIFIED-TOKEN-FRAMEWORK.md)：统一 Token 对比框架
- [docs/PROMO.md](docs/PROMO.md)：发布与推广清单
- [CHANGELOG.md](CHANGELOG.md)：版本历史

---

最后一句实话：这是一个**工程上很完整、产品上还没启动**的项目。代码可以跑、测试全绿、创新点真实，
但它还没有真实用户、没有公开热度、也没有端到端的真人验证。任何对外说法都应基于上面这张“真实状态速览”。
