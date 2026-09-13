# CSLA Target Architecture

**日期：** 2026-08-29 · **性质：** 目标架构（审计结论派生），非当前实现
**原则：** 不推倒重来；保留全部现有资产（改迹调制/风格向量/治理/检索/质量门），把它们**重新接入统一 Runtime**。

---

## 1. 系统定义

$$
\boxed{
Human \leftrightarrow SharedState \leftrightarrow AdaptiveController \leftrightarrow Engines \leftrightarrow LLM/Tools \leftrightarrow World
}
$$

反馈回路：`Outcome → Credit → Learning → State'`。

CSLA Core = L2 状态内核 + L3 自适应控制器 + L4 认知引擎 + L6 学习层；
Stylotrace = L1+L5 之上的**垂直应用**（写作），不再是另一个 runtime。

## 2. 七层目标

```text
L0  Human / External World（ObservationEvent：说话/编辑/确认/文件/网页/图片/API/工具结果）
↓
L1  Interaction Gateway（微信式浅层：快聊→快问→快确认→快收集；q* = argmax[IG − λCost − μIntrusion − ρRepetition]；
     DeepNeed_t = f(Novelty,Importance,Uncertainty,Risk,GoalRelevance,DecisionImpact) 决定是否交深层）
↓
L2  Cognitive State Kernel（唯一认知事实源 S_t=(D,G,B,H,M,W,R,U,P,J,A)；所有变更 = Event + StateDelta → Commit）
↓
L3  Adaptive Cognitive Controller（What should happen next?；U(a|S_t)=GoalGain+InfoGain+ExpectedUtility+Novelty−Cost−Risk−Interaction；
     LLM 可提议动作，但 LLMProposal ≠ FinalAction；Controller 最终决定；支持 NativeLLM escape）
↓
L4  Cognitive Engines（Memory / Reasoning / Induction / Metacognition / Goal / WorldModel / HumanModel；
     引擎互不直接调用，只经 Controller 请求 + StateKernel 提交）
↓
L5  Model / Tool Runtime（LLM Port + Adapter：OpenAI/Anthropic/Gemini/Qwen/DeepSeek/Local；
     ContextAssembler(State,Action,Operator,Budget)；Tools/Search/MCP）
↓
L6  Outcome & Learning Plane（O_t=(Expected,Actual,Feedback,Cost,Risk) → δ_t → Counterfactual Credit → Update Memory/Schema/Policy/Style/HumanModel）
    ↺ Persistent State
```

## 3. 六个核心实体（企业级数据模型）

`Session` · `CognitiveState` · `CognitiveEvent` · `CognitiveAction` · `Outcome` · `Artifact`

所有模块围绕这六对象工作；闭环：`Session → State → Action → Event → Outcome → Learning → State'`。

## 4. 关键架构决策（目标）

1. **单一状态内核**：所有状态（产品 stage、csl S_t、交互 I_t、风格、记忆引用）最终收敛到一个版本化内核；
   模块只能提交 `StateDelta`，禁止互改他模块世界。
2. **Director = Application Orchestrator**：负责"写作应用如何启动任务"；真正认知决策在 CSLA Runtime。
3. **Writer 受状态门控**：CoreIdea=空 → Action=AskHuman → Writer 根本收不到 draft 请求；CoreIdea=confirmed 才允许 Research/Generate。
4. **LLM = High-Capacity Cognitive Operator**：只做非确定性语义计算；JSON 校验/排序/计数/版本/权限/精确计算一律进代码。
5. **ContextAssembler 独立服务**：Compare 只给 Entities+Relations；Search 给 Hypothesis+MissingEvidence；Write 给 CoreIdea+Evidence+Style。
6. **Credit 必须反事实**：C_i = L^{CF}_i − L^{real}（配对干预），禁止 δ/N 均分。
7. **观测与认知分离**：Trace 只记录 What happened（trace_id/session/state_version/action/model/tool/input_hash/output_ref/outcome/latency/tokens/cost/errors），不暴露隐藏 CoT。
8. **一个认知系统、两种节奏**：Fast Loop 与 Deep Loop 共享 S_t；Deep 可反向请求 Human，Human 可中途改变 Deep state，Deep 不阻塞 Fast。
9. **Packages（长期目标）**：`@csla/core`（状态/事件/控制器/引擎/学习）· `@csla/runtime`（LLM/Tools/MCP/Context/Observability）· `@stylotrace/app`（写作/风格/编辑/文档）。
10. **迁移路径**：增量迁移（见 MIGRATION_PLAN），禁止 Big Bang；旧入口逐步从 Old Runtime 切到 New Runtime。

## 5. 写作在目标架构中的完整链路

```text
Desire → Purpose → FastDialogue → CoreInsight → Memory → Reasoning → Research → Deliberation
→ HumanAlignment → Draft → HumanEdit → Outcome → Style/PolicyLearning
```

写作入口不是 Generate，而是 FastInteraction 开始问（为什么写/最想反驳谁/真正不同意什么/有没有亲身经历），
每轮 ΔJ_t 入共享状态；DeepNeed>τ 才进 DeepCognition；Core Idea K_H 成为共享状态重要对象；
随后 LLM₁..ₙ 并行做 Alternative/Counterargument/Analogy/Research/Structure，进入 Deliberation；
最终不是投票：Candidate → Compare → Evidence → Counterexample → HumanAlignment → K*；
然后才 K* + Evidence + AuthorModel + Style + Audience → Writer（复用现有 write.js）。

## 6. Style 目标定义

```
Style = Preference + DecisionPattern + StructurePattern + LanguagePattern
```

升级为预测—反馈闭环：`P(ĤumanEdit | Draft, AuthorModel)` vs 实际编辑 → δ^style → AuthorModel_{t+1}。
保留全部现有资产（modulator/token-decode/personal-model/style-vector/style-memory/style-adapter/edit-transform/avoidance/concretize），
在其上加 DecisionSchema 学习（例："段落变抽象 → 用户加具体案例"这类决策模式，而非只学句长/词频）。

## 7. 可观测性目标

每次 State→Action 记录：`trace_id, session_id, state_version, action, model, tool, input_hash, output_ref, outcome, latency, tokens, cost, errors`。

## 8. 验收标准（目标架构成立 = 全系统非 Theater）

- CLI/MCP/REST/Web/Skill → Application Adapter → CSLA Runtime（同一逻辑，无平行逻辑）。
- CoreIdea 缺失时 Writer 被阻塞（真实断言）。
- Credit 为反事实归因，且 runtime 使用它（非均分）。
- 存在至少一条真实纵向实验证据链：`Behavior_{t+1} ≠ Behavior_t` 且 `Performance_{t+1} > Performance_t`。
- 换 LLM provider 不改 CSLA Core（Port 测试）。
