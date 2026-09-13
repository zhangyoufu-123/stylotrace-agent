# AI Writing Failure Taxonomy & Product Problem Map

**日期：** 2026-08-29 · **性质：** 产品问题地图（行业借鉴 + 我们真实不足的规范化收束）
**核心判断：** 我们不是再造一个"写作功能清单"，而是把行业已分开做好的能力
（Projects/Canvas/Grammarly/Sudowrite/PaperMentor/CollabLLM/StyleVector/Author Writing Sheet/RAG）
统一到一个共享的 **Author-Cognitive State** 上，并持续从 Conversation + Revision + Outcome 更新。

---

## 1. 30 类问题 → 8 个根问题 → 8 个引擎

| 根问题 | 引擎 | 仓库现状（Reality Audit 判定） |
| --- | --- | --- |
| A. Human Intent（我到底想说什么） | Intent Engine | ✅ 思想优先澄清 + Fast Interaction + q* 问题策略 |
| B. Human Creativity（避免被平均化） | Creativity Engine | ⚠️ Diversity 候选存在（skeptic 算子/读者群像）；无 Diversity Budget/PreCommitment |
| C. Collaboration（何时问/何时做） | Collaboration Engine | ✅ ask/checkpoint/Writer Gate/Deep↔Human 真实 |
| D. Author Model（我怎么想/选/写） | Author Model Engine | ⚠️ 风格资产丰富；A5 Decision Schema 初建（HRME schema→Brief）；HumanModel 未驱动行为 |
| E. Cognitive Writing（记忆/推理/研究参与写作） | Cognitive Reasoning Engine | ⚠️ HRME/Compare/Abstract 接入；Induction/多数算子占位 |
| F. Generation Control（扩展不替换） | Generation Control Engine | ✅ Writer Gate + Cognitive Brief 注入；IdeaIntegrity 检测初建（failure.js） |
| G. Verification（逻辑/证据/事实/一致性） | Verification Engine | ✅ redteam/fact-check/consistency/fake-thinking 复用；Failure Taxonomy 初建 |
| H. Learning（下次为何更好） | Learning Engine | ✅ Credit→Policy 行为变化（T6/T7）；长期学习无证据 |

## 2. AI Writing Failure Taxonomy（15 类，Outcome → FailureType → Credit → Policy）

已实现（`agent/src/csl/failure.js`，确定性启发式，复用现有检测器）：

- `overclaim`：核心观点用弱词（怀疑/可能）、成稿偷偷升级为强词（研究表明/必然）→ 立场强度越级
- `idea_drift`：成稿对核心观点关键词覆盖不足 → **IdeaIntegrity**
- `ai_artifact`：复用 redteam（套话黑名单）+ fake-thinking（表演思考）检测
- `evidence_error`：成稿出现事实/数字模式但无证据
- `decision_drift`：用户纠正方向（真实反馈 source=user-correct）
- `unclassified`：无法判定（诚实兜底）

待实现（分类已注册）：style_drift / reasoning_error / audience_error / overconfidence /
creative_fixation / human_agency_loss / context_loss / revision_loss / memory_error。

**FailureType → Credit → Policy 已接通**：真实反馈分类后进入政策上下文 key（含 failureType），
失败类型不同的策略证据互不污染（context-aware）。

## 3. AuthorQuality KPI（替代单一 TextQuality）

```text
Q = (Intent, Idea, Individuality, Style, Logic, Evidence, Audience, Agency, Novelty, Factuality)
```

任务加权（`evaluateAuthorQuality`）：creative → novelty/individuality 高；academic → evidence/logic/factuality 高；
缺省维度中性 0.5。这是产品 KPI 的工程落点，也是后续 benchmark 的评分面。

## 4. 行业借鉴 → 我们的升级点（现状核对）

| 行业能力 | 借鉴 | 我们升级点 | 状态 |
| --- | --- | --- | --- |
| ChatGPT Projects/Canvas | 项目上下文+文档+版本 | Context → CognitiveState（不只聊天记录） | ⚠️ 部分（workspace+版本化；Author Workspace UI 未做） |
| Grammarly Reader Reactions | 读者导向 | AudienceModel 入 Cognitive State | ⚠️ reader-gallery 有读者群像；Audience 未入生成加权 |
| Sudowrite | 长文状态组织 | CognitiveState（含"作者为何这样写"） | ⚠️ brief.structure 有；深层 why 弱 |
| PaperMentor | AI 不夺权只给反馈 | Suggestion ≠ Takeover；IssuePriority/因果反馈 | ⚠️ redteam 反馈有；优先级/因果解释待做 |
| CollabLLM | 主动协作 | AskHuman = CognitiveAction（已成） | ✅ |
| StyleVector / Author Writing Sheet | 风格/作者结构化表示 | AuthorModel = Style+Knowledge+Beliefs+DecisionPatterns | ⚠️ 部分 |
| RAG | 资料供给 | Search = Cognitive Action（Hypothesis+EvidenceGap 触发） | ⚠️ 排队已通；证据缺口驱动待做 |

## 5. 论文贡献边界（科学诚信）

- 保留：**"研究型产品 + 可验证工程架构"**；不宣称通用认知理论。
- 措辞修正：`predictEdit` 只能写"已实现候选/接口与实验性预测机制"，**不能**写"已完成长期风格预测学习闭环"（STYLE THEATER）。
- 实验升级方向：HumanEffortReduction / CoreIdeaPreservation / IntentDiscovery / QuestionEfficiency /
  FutureBehaviorImprovement（当前尚未作为正式 benchmark 落地）。

## 6. 停止

本阶段建立：Failure Taxonomy + AuthorQuality KPI + FailureType→Credit→Policy 接入 + 产品问题地图。
下一候选（等开工令）：IdeaIntegrity 全量审计接入（写作后门）、Individuality 基准、Diversity Budget、
Audience Model 加权、3B Induction。
