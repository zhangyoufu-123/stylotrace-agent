# CSLA Research Coverage Matrix（16）— 18 问题 × 6 主轴总验收

> 2026-08-28 · 依据最新行业基准（LongMemEval-V2 / Mem2ActBench / AgentMemoryBench / Atlas）重做总验收。
> 覆盖三档：A=架构覆盖，B=可运行实现，C=科学证据。
> **诚实结论：A 18/18，B ≈11/18（3 部分、2 缺失），C 0/18。**

## 18 问题矩阵

| # | 问题 | 主流现状 | CSLA 机制 | A | B | C | 缺的机制/实验 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 长任务错误累积 | compaction/persistent artifacts（OpenAI/Anthropic） | State→Outcome→Error→Update | ✅ | ✅ | 0 | Recovery_CSLA > Recovery_baseline |
| 2 | Memory 退化成 RAG | Atlas/Mem2ActBench 已承认缺口 | RelationalMemory + Replay | ✅ | ✅ | 0 | vs 最强 memory baseline；记忆→tool action |
| 3 | 不真正从经验改变自己 | AgentMemoryBench（system+experiential memory） | Experience→Outcome→Credit→Policy/Schema Update | ⚠️ | ✅ | 0 | E6 纵向对照（replay R4 已改策略，需跨 session） |
| 4 | 不知道自己不知道 | 校准研究 | U→Search/Ask/Verify/Stop | ✅ | ✅ | 0 | Calibration→CorrectAction（self-consistency 代理） |
| 5 | 缺因果/反事实 | LLM 自身因果弱 | do(X) + Counterfactual | ⚠️ | ❌ | 0 | 结构化 Task Causal Model（否则只是"说因果语言"） |
| 6 | 犯错重复 | LongMemEval-V2（环境陷阱） | Error→Credit→Inhibit→PolicyUpdate | ✅ | ✅ | 0 | Failure_t→Learning_t→Avoidance_{t+1} |
| 7 | 缺稳定长期状态 | session context | S_t→S_{t+1}（版本化） | ✅ | ✅ | 0 | Persistence ≠ Adaptation，需跨 session |
| 8 | 缺个人/环境模型 | personalization | HumanModel / SelfModel / TaskWorldModel | ✅ | ⚠️ | 0 | Task_A→Schema→Task_B 迁移（Self/W 未实现） |
| 9 | Workflow ≠ Cognition | Anthropic 区分 workflow/agent | Dynamic Cognitive Action Space | ✅ | ⚠️ | 0 | adaptive 策略学习版（当前为确定性调度） |
| 10 | 模块无统一学习信号 | — | Experience→Error→Credit→Multi-module Update | ⚠️ | ✅ | 0 | 研究核心；跨模块 credit 消融 |
| 11 | Goal 只是 Prompt | 主流 agent goal=prompt | Desire→Goal→Strategy→Plan | ✅ | ✅ | 0 | GoalGen vs 用户直接指定目标 |
| 12 | 不主动问最有价值问题 | 普通问答 | q\*=argmax[IG−Cost−Intrusion] | ✅ | ✅ | 0 | E3（更少互动获得更独特 core idea） |
| 13 | 不挖掘 latent insight | brainstorming 压平多样性 | I_H→Question→CoreIdea | ✅ | ✅ | 0 | 产品首要实验（Stylotrace） |
| 14 | AI 压平人的创造力 | 人机创造力研究 | HumanCore→AIExpansion | ✅ | ✅ | 0 | creativity benchmark |
| 15 | 不知浅思/深思 | 全问题 CoT | d_t=f(complexity,risk,uncertainty,novelty) | ✅ | ✅ | 0 | E8 authority 校准 |
| 16 | 组合性推理弱 | 组合泛化难题 | Memory_i+Memory_j+Goal→NovelComposition；Analogy/Abstraction/Counterfactual | ⚠️ | ❌ | 0 | 算子实现 + 组合基准 |
| 17 | 经验不能重组为未来模拟 | replay/future-construction 神经科学 | Replay→Recombination→FutureSimulation→Plan | ⚠️ | ⚠️ | 0 | Recombination/FutureSimulation 实现 |
| 18 | Human+AI 无 Shared State | 无统一联合状态 | Human↔SharedState↔AI + Authority | ✅ | ✅ | 0 | JointPerformance > Human |

## 6 个研究主轴

| 主轴 | 覆盖问题 | 核心 |
| --- | --- | --- |
| 1 Persistent Cognition | 1,2,3,6,7,8 | Experience→State→Memory→Learning |
| 2 Structured Reasoning | 5,16,17 | Compare→Abstract→Infer→Simulate |
| 3 Meta-Cognition | 4,15 | Uncertainty→Depth/Action |
| 4 Motivation & Goal | 11 | Desire→Goal→Plan |
| 5 Human-AI Joint | 12,13,14,18 | Human↔SharedState↔AI |
| 6 Cross-Module Learning | 9,10 | Outcome→Credit→Update |

## 每个问题必须有的证据链

```text
Problem → Mechanism → Implementation → Benchmark → Ablation → Evidence
```

## 必须使用的行业基准（真实）

- LongMemEval-V2（动态状态、workflow knowledge、环境陷阱、premise awareness）
- Mem2ActBench（记忆是否改变 tool action）
- AgentMemoryBench（system memory + personal memory 联合持续学习）
- Atlas（retrieval-optimized memory 的任务能力缺口）

## 消融模板（示例：Memory）

```text
Problem: RAG can't learn
Mechanism: RelationalMemory + Replay
Benchmark: LongMemEval-V2 + Mem2ActBench
Ablation: −Retain / −Replay / −Consolidation
Metric: FutureTaskPerformance
```

## 三个优先证明（下一阶段）

1. **Experience → Future Behavior**（1,3,6,10：replay+credit 是否让 t+1 表现更好）
2. **Human Insight → AI Expansion**（13,14：先挖灵魂再扩张，而非 AI 平均答案）
3. **Memory/Reasoning → Better Long-Horizon Decisions**（2,16,17：记忆+组合推理是否改善长程决策）

## 结论

CSLA 已把"模糊抱怨"转换为 18 个可计算问题，每个有候选机制；A/B/C 如实标注。
下一阶段不是加功能，而是逐个证明这三个优先机制是否产生真实增益，
把项目从 Architecture 推进到 Empirical Cognitive Engineering。
