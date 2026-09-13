# 实验协议（12）

## failure-case-first（硬规则）

每个模块编码前回答：什么情况下失败？如何被测试暴露？如何回归？
顺序：`Failure Case → Test → Implementation`。

## 核心实验（E1–E6）

E1 认知连续性（跨 session 状态保持）；E2 目标保真（推断=确认）；
E3 创新挖掘（少互动获得更独特 core idea）；E4 综合质量（多候选+验证 > 单次生成）；
E5 恢复（犯错后改策略）；E6 学习（t+1 因 t 而更好，且 unseen 泛化）。

## Replay 对照条件（A–D）

A 不重放 / B 等权重放 / C credit 加权重放 / D 加权+巩固。

## 基线矩阵

Vanilla LLM / OpenAI-style runtime / Claude-style workflow / Gemini deep research。
等算力、等预算比较。

实现状态：协议已定，E1–E8 未运行。
