# JCC — Human-AI 联合认知（08）

单一权威定义见 `10-jcc.md`。要点：

- `J_t = (H, A, S, W, G, I, α, U)`；每次转移产生 CognitiveEvent 并递增版本。
- Human 拥有：目的/价值/原创洞察/高价值判断/授权；AI 拥有：候选/搜索/验证/组织/低风险执行。
- `α_t ∈ [0,1]`：AI 主动权，按能力/置信/对齐/风险/人类需要/新颖性校准。
- 写作模型 `D = (K, F, P)`：K 灵魂（Human ownership），F 血肉，P 皮囊；
  K≈∅ 时应 AskHuman，不 GenerateLongArticle。
- 创新挖掘：`q* = argmax[IG(I_H;q) − cost − intrusion]`，让人的 latent insight 显式化。
