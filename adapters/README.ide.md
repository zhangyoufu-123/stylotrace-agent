# Stylotrace 智能体接入各种 IDE / Agent 宿主

**一句话：** Stylotrace 是一个 **MCP 智能体**——凡是支持 MCP（Model Context Protocol）的 IDE / Agent 宿主，
都能把它的能力接进去；**API Key 自动发现**，你不需要在 Stylotrace 里再填一遍。

---

## 一、为什么它"到处都能用"

```
你的 IDE / Agent 宿主（Cursor / Windsurf / VS Code / Claude Code / Codex / OpenCode / Continue…）
        │  MCP（stdio JSON-RPC）
        ▼
Stylotrace 引擎（agent/src，零第三方依赖）
        │  自动发现凭据
        ▼
你已配置的模型服务（Codex 配置 / Claude / OpenCode / DSH / 环境变量 STYLOTRACE_LLM_*）
```

- **同一内核**：四种入口（CLI / MCP / 技能 / 网页）调用同一套认知状态与决策逻辑，不存在"这边能用那边不能用"。
- **自动读 Key**：按顺序发现 `STYLOTRACE_LLM_API_KEY` → 工作区 `.stylotrace/credentials.json` → Codex 配置 → Claude Code → OpenCode → DSH 凭据；**绝不打印完整密钥**（只显示来源与末四位）。
- **零依赖**：引擎只用 Node 内置模块，不需要 `npm install`，装上就能跑。

## 二、逐个 IDE 怎么接（复制即可）

> 所有配置里的路径都指向已安装的引擎：`$HOME/.codex/skills/stylotrace/scripts/engine/bin/stylotrace.js`

| 宿主 | 配置文件 | 现成模板 |
| --- | --- | --- |
| **Cursor** | `~/.cursor/mcp.json` 或项目 `.cursor/mcp.json` | `adapters/mcp/cursor.json` |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` | `adapters/mcp/windsurf.json` |
| **VS Code（MCP）** | 项目 `.vscode/mcp.json` | `adapters/mcp/vscode.json` |
| **Claude Code** | `claude mcp add …`（命令注册） | `adapters/mcp/claude-code.md` |
| **Claude Desktop** | `claude_desktop_config.json` | `adapters/mcp/claude-desktop.json` |
| **Codex** | `~/.codex/config.toml` | `adapters/mcp/codex.toml` |
| **其他 / 通用** | 任意 MCP 客户端 | `adapters/mcp/generic.json` |

**Cursor 为例**（把 `adapters/mcp/cursor.json` 内容合并进 `.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "stylotrace": {
      "command": "node",
      "args": ["$HOME/.codex/skills/stylotrace/scripts/engine/bin/stylotrace.js", "mcp"]
    }
  }
}
```

重启 IDE 后，工具列表里会出现 **47 个工具**（写作流程 + 认知运行时）：

- **认知运行时**：`csl_turn`（一轮认知）· `csl_action`（单一认知动作）· `csl_checkpoint`（追问后恢复）· `csl_state`（状态快照）
- **创作主权**：`status_panel`（生成"我记住了什么"的单页面板）
- **写作流程**：`agent_step` · `clarify_step` · `outline` · `write_section` · `redteam` · `review` · `point_edit` · `restyle` …

## 三、自动读 Key 的规则（不用担心泄露）

| 优先级 | 来源 | 说明 |
| --- | --- | --- |
| 1 | `STYLOTRACE_LLM_API_KEY` 等环境变量 | 显式配置永远优先 |
| 2 | 工作区 `.stylotrace/credentials.json` | 用 `stylotrace credentials --ask` 选择后保存（0600 权限） |
| 3 | Codex 配置 | `~/.codex/config.toml` 里已配的 provider |
| 4 | Claude Code / OpenCode / DSH 凭据 | 自动扫描，只取 OpenAI 兼容协议 |

查看当前用的是什么（不会显示完整 Key）：

```bash
stylotrace credentials          # 列出候选与当前生效来源
stylotrace doctor --ping        # 连通性自检
```

## 四、在 IDE 里最值得试的三件事

1. **`status_panel`**：让宿主生成一份单页 HTML，打开就能看到"这个 agent 现在记住了什么"——
   认知状态、学到的风格、写过的作品、冻结的决断、最近事件。
2. **`csl_turn`**：把"我有个模糊想法"直接交给它，看它先追问而不是直接成稿（写作门 BLOCK）。
3. **`csl_checkpoint`**：回答它的追问后，用同一个 `session` 继续深层思考——跨工具调用状态不丢。

## 五、一次装好（所有宿主）

```bash
bash install.sh                      # 安装引擎 + 技能 + 复用本机凭据
stylotrace setup --hosts codex,claude,opencode   # 自动注册 MCP
```

> 没有出现在列表里的 IDE：只要它支持 MCP，用 `adapters/mcp/generic.json` 的格式填进去即可——
> 我们不绑定任何一家宿主，这也是"一个智能体、多种 IDE"的设计目的。
