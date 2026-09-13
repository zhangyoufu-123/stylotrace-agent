# 人机交互（11）

## 双循环

- **Fast Loop**：utterance → intent/salience → short response → next turn（低延迟）。
- **Deep Loop**：signal → shared-state update → retrieve/hypothesize/plan/verify →
  update beliefs → update open questions → optional memory/action。

## 决策门（Human Control Points）

只在以下高价值点出现：选择核心观点、选择方向、授权外部行动、确认重大事实/价值判断、最终发布。

## 可观测性

- 不暴露内部 chain-of-thought；展示结构化 reasoning artifacts、结论依据与决策状态。
- Trace/Learning 面板（可选）：让用户看见"AI 从我的哪些修改中学到了什么"，支持删除/纠正/撤销。
- **Style ≠ Cognition**：风格偏好与认知判断分层存储，不把"用户写作偏好"直接当"用户认知模型"。
