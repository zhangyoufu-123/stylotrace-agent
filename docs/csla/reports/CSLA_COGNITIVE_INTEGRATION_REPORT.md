# Stylotrace Cognitive Integration Report（Cognitive Writing Brief）

**日期：** 2026-08-29 · **基线：** `151a157`（Phase 3A）· **定位：** 把 CSLA 作为产品认知操作层，
Stylotrace 仍为核心产品（论文方向不被推翻）；本阶段只做"作者认知 → CSLA → 现有写作引擎"这条真实链路。

---

## 1. Cognitive Writing Brief（核心对象）

新增 `agent/src/csl/brief.js`——"这个人现在究竟想写什么、为什么这么写"的工作表示：

```json
{ "goal": {}, "audience": {}, "purpose": {}, "coreIdea": "", "authorPosition": "",
  "claims": [], "assumptions": [], "evidence": [], "counterarguments": [],
  "openQuestions": [], "memoryRefs": [], "authorSchemas": [], "styleProfile": {},
  "redLines": [], "structure": {}, "artifactPlan": {}, "outcomeRefs": [], "editCount": 0 }
```

- 持久化 `protocol/csl-brief.json`；内容变化才经 Kernel 提交（版本单调，防膨胀）。
- **不是最终文章、不是聊天记录**——是写作的中间认知对象（大纲 = structure 视图）。

## 2. 七步实施链（每步真实证据）

| 步 | 实现 | 证据 |
| --- | --- | --- |
| 1. Fast Interaction → Brief | director.agentStep 每轮 `syncBrief`（产品 confirmed/治理/purpose 汇入） | coreIdea/audience/stance 入 Brief；canonical `brief` 分区 + `brief.synced` 事件 |
| 2. HRME → Brief | `authorSchemas`（HRME level≥3 schema） | 种子 4 episode → Brief 含 mammal—吃→plantfood |
| 3. Reasoning → Brief | goldenCognition 后 `syncBrief` | claims≥1、counterarguments 数组、authorSchemas 保留 |
| 4. Brief → Writer | write.js ctx 注入 `cognitiveBrief` + WRITE_PROMPT 渲染 | fetch 捕获提示含【认知简报】；draft 产出 |
| 5. HumanEdit → Outcome | point-edit 成功后 `recordEdit` → OutcomeStore + Brief.outcomeRefs/editCount | outcome 落账、editCount=1 |
| 6. Outcome → AuthorModel/Policy | recordFeedback → 反事实 credit → policyWeights（目标上下文修正） | 纠正 → operators 负 credit → 权重 <0（学习落点） |

## 3. 验收：真实完整会话（csl-brief.test.mjs）

```
User(门槛) → Fast(acceptAnswer+syncBrief) → State(canonical v+) → HRME/Reasoning(golden)
→ CoreIdea(Brief) → Writer(draft 产出 + 提示含认知简报) → HumanEdit(recordEdit)
→ Outcome(OutcomeStore) → Learning(policy 权重变化)
```

每一步有状态/文件/事件断言；`node --test` **64/64**；npm test（含 e2e）全绿。

## 4. 论文兼容性（不推翻原资产）

- Revision Trace / 四层作者表示 / 思想优先澄清 / RAG 供给循环 / 改迹调制器 **全部保留**；
- 新增 **A5 Decision Schema**（Brief.authorSchemas + HRME）与 **Cognitive Integrity**（写作提示强制
  围绕认知简报展开、禁止偷换作者思想）——是原论文的扩展而非替代。

## 5. 诚实边界

1. `predictEdit` 预测—误差闭环仍为 **STYLE THEATER**（本阶段未做；论文措辞须保持"候选/接口与实验性预测机制"）。
2. HumanModel 仍未驱动提问（MODEL THEATER，P1）。
3. Brief 的 assumptions/evidence 尚浅（evidence 为 pending 检索；真归纳 3B 未做）。

## 6. 停止

本阶段完成。下一步按你的顺序：3B（Induction）或 Level 2/3 学习（Decision/Collaboration Learning）——等开工令。
