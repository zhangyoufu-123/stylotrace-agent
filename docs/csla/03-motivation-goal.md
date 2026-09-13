# 动机与目标（03）

```text
D_t = (Preference, Value, Priority, Urgency, Commitment)
  → GoalGen → G_t → Strategy → Plan → Action
```

- `G_t = (G_inferred, G_confirmed)`：推断目标保持 hypothesis，直到人类确认。
- 支持 goal revision / conflict / abandonment / reprioritization。
- 实现：复用 `governance.js`（长期意图）、`intent.js`（意图）、`purpose.js`（目的→风格）。
