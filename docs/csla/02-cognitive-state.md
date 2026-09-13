# 认知状态（02）— v1.8

```text
S_t = (D, G, B, E, W, P, M^E, M^S, K, Π, U, Self, H, J, R, Language)
```

- D 动机/偏好；G 目标；B 信念；E 情景上下文；W 世界/任务模型；P 执行/工作状态；
- M^E 情景关系记忆；M^S 语义/图式记忆；K 技能/工具知识；Π 策略；U 不确定性；
- Self 自模型；H 人类模型；J 人机共享状态；R 资源/风险；Language 语言规划状态。

内容/参数分层（C1 修正）：`S = (S^C, Θ)`；版本化、事件驱动更新。

实现：`agent/src/csl/state.js`（S^C 版本化 + transition 纯函数）。
