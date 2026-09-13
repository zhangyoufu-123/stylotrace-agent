# CSLA Risk Register

**日期：** 2026-08-29 · 严重度 H/M/L × 可能性 H/M/L → 风险等级

---

| # | 风险 | 等级 | 现状证据 | 缓解 |
| --- | --- | --- | --- | --- |
| R1 | **产品线绕过 Cognitive Runtime（Theater 固化）** | H×H | director 仅调 cognitiveGate；write 不读 csl-state | Phase 3 接入；E2E 断言 |
| R2 | **Credit 误差均分（P0 禁则）** | H×H | basicCredit = error/N；runtime 未用反事实 | Phase 2 切换 interveneAndCredit |
| R3 | **假 Outcome 污染学习** | H×M | runTurn 硬编码 prediction/outcome | Phase 2/6 接真实反馈 |
| R4 | **双状态源漂移** | H×M | state.json 与 csl-state.json 不同步 | Phase 1 单一内核 |
| R5 | **推理算子声称 > 实现** | H×M | 12 算子仅 3 个真实（Compare/Counterexample/Abstract） | Phase 5 补齐或文档降级 |
| R6 | **无真实长期学习证据却对外宣称** | H×L | B0–B9/E1–E6 未跑 | Phase 7 实验；禁止无证据宣称 |
| R7 | **Provider 锁死** | M×M | 39 模块直连 chatWithRetry；仅 openai 适配器 | Phase 4 Port 贯穿 |
| R8 | **Prompt 分散（无 ContextAssembler）** | M×H | 每模块自拼；上下文无统一预算 | Phase 4 context/assembler |
| R9 | **状态无版本/并发隔离** | M×M | 仅 csl-state 版本化；其余整文件覆盖 | Phase 1 内核 + Phase 8 并发 |
| R10 | **密钥/数据泄露** | M×L | key 脱敏、BYOK、工作区 /tmp；无注入专项 | 保持；Phase 8 安全测试 |
| R11 | **Fast 路径长回答高成本** | M×M | 真实对照：fast 未约束时 8k tokens | DeepGate 校准 + fast 语言层预算 |
| R12 | **澄清逻辑三套并存** | M×M | clarify/interview/elicit | Phase 4 收敛到 L1 网关 |
| R13 | **观测性缺失** | M×M | 产品线无 trace_id/cost | Phase 8 统一观测 |
| R14 | **风格学习无预测—误差闭环** | M×L | style-pulse 最接近但非预测式 | Phase 6 接入预测—反馈 |
| R15 | **Mock 掩盖集成问题** | M×M | 57 测试多为 mock；csl-real opt-in | 保持 opt-in + 增加 E2E |

## Top 10 Risks（排序）

R1 → R2 → R3 → R4 → R5 → R7 → R8 → R11 → R9 → R15

## 安全边界（已确认无风险泄漏）

- API key：自动发现、脱敏显示、不落日志；工作区凭据 0600；真实测试全部 /tmp。
- 仓库：私有；npm 旧包保留现状（用户决定）；无新公开发布。
