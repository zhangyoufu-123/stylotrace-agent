# Expected vs Actual（理论 vs 代码 vs 真实行为）

**日期：** 2026-08-29 · 原则：不美化；Reality > Design 时反向记录进架构。

| 维度 | Expected | Actual | Gap | Why | Impact | Repair |
| --- | --- | --- | --- | --- | --- | --- |
| Fast/Deep 共享认知 | 同一 canonical state | 同一 csl-state（C9/C10 测试） | 小：产品 state.json 仍为 Derived View | 14 模块直写产品视图 | 版本权威=内核；产品写点未收敛 | P1：产品写点收敛 |
| Dynamic action | 真执行所选动作 | selected==executed（A1） | 无 | — | — | 无 |
| Memory 改变行为 | HRME 影响未来 | replay→cognitiveGate（确定性）；HRME 未接产品 | 中 | HRME 与产品 RAG/风格未打通 | 记忆=旁观者（产品路径） | P1：HRME↔产品记忆打通 |
| Credit 改变政策 | 反事实 + 政策更新 | T6/T7 证明（search→deduce） | 无（已实现） | — | 真实 | 无 |
| Human checkpoint 恢复 deep | 暂停→回答→原状态继续 | 暂停+重跑（交互模式）；非显式 session 指针恢复 | 中 | checkpoint 语义=rerun | 可工作但会话恢复脆弱 | P1：显式 session/resume |
| Writer 服从 coreIdea | 无核心禁止 draft | canWrite 门 REAL（BLOCK 测试） | 无 | — | 真实 | 无 |
| Search 真执行 | 真实检索 | **排队宿主代检**（P0 修复）；回灌待宿主 | 小 | 检索是宿主侧动作 | evidence 为 pending 非伪造 | 完成；回灌为产品既有通路 |
| Reasoning 12 算子 | 全部真实 | 4 个真实（compare/counterexample/abstract/…），8 占位 | 大 | 未实现（注册表≠实现） | 深层研究能力受限 | P1：补齐算子 |
| Induction | 多假设→条件 schema | 类型级聚合+反例降级 | 中 | 计数驱动 | 归纳弱 | P1：Induction 引擎 |
| ContextAssembler | 统一上下文 | csl 有 buildContextBundle；产品模块自拼 | 中 | 未贯穿产品 | prompt 分散 | P1 |
| Style 预测学习 | Draft→Edit→Error→Update | style-pulse 反馈；无预测闭环 | 大 | 未实现预测层 | 风格学习=THEATER | P1 |
| HumanModel | 驱动提问/写作 | 分区存在未接线 | 大 | 未实现 | 提问不个性化 | P1 |
| Hooks/Multimodal/World/Executive | 文档 | 无代码 | 大 | 未进入实施 | 文档≠能力 | P2+ |

## 结论

- **Reality > Design（反向记录）**：Outcome/Credit 显式反事实 + 政策证据 + 行为变化（T6/T7）——
  这是文档没有充分描述的已实现能力；search 从占位升级为真实检索通路。
- **架构 overclaim（Design > Reality）**：Reasoning 12 算子（4 真实）、Induction、Style 预测闭环、
  HumanModel、Hooks——文档存在但代码未达。
