# CSLA Current Effectiveness Report

**日期：** 2026-08-29 · 评分：0=nonexistent · 1=documented · 2=implemented · 3=integrated ·
4=real behavioral effect · 5=experimentally demonstrated（4/5 必须真实证据）

| 能力 | 评分 | 证据 |
| --- | --- | --- |
| Fast interaction | 4 | 真实 LLM ~1.5s 短答/追问；ask 去重测试 |
| Deep reasoning | 4 | 真实 4-call 动作循环，状态 v+1，假设入状态 |
| Memory | 3 | HRME 实现+红队 9/9；replay→cognitiveGate 行为（确定性测试）；未接产品记忆 |
| Induction | 2 | 类型级聚合+反例降级（确定性）；非条件 schema 学习 |
| Search | 3 | P0 修复后真实排队宿主检索；回灌待宿主 |
| Planning | 1 | plan executor 占位（无真实 planner） |
| Human checkpoint | 3 | ask/checkpoint 暂停+交互恢复（重跑语义）；无显式 session 恢复 |
| Writing | 4 | 真实写作门（BLOCK/放行测试）+ 真实草稿产出（fetch stub E2E） |
| Style | 2 | 风格资产丰富（向量/改迹/脉冲）；无预测—误差闭环（THEATER） |
| Outcome | 4 | 真实反馈 → OutcomeStore + 维度误差 → 统一事件 |
| Credit | 4 | 显式反事实（非均分）+ 置信门 + 可撤销 + 审计；真实反馈 policyApplied=3 |
| Learning | 3 | credit→行为变化（T6/T7 确定性证明）；无 longitudinal 证据 |
| Generalization | 2 | HRME transfer 基准（schema 3→4）；无跨任务真实实验 |

## 关键结论

- **4 分以上（真实行为效应）**：Fast / Deep / Writing / Outcome / Credit——均有真实运行或测试断言证明。
- **THEATER（有状态/字段但无行为）**：Style 预测闭环、HumanModel→提问。
- **DOCUMENT_ONLY（0–1）**：Planning、Hooks、Multimodal、World Model、Executive。
- **Learning 停在 3**：credit→行为证明成立，但"长期学习/认知增益"需要 longitudinal 才到 5。
