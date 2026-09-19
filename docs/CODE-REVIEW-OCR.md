# 外部代码审查报告 · OpenCodeReview

**审查工具**：[alibaba/open-code-review](https://github.com/alibaba/open-code-review)（29.9k★，Apache-2.0，阿里巴巴内部 AI 代码审查工具开源版）
**版本**：v1.12.3（darwin/arm64）　**日期**：2026-09-16
**模型**：本机配置的 DeepSeek（`ocr scan` 全文件模式，非 diff 模式）

---

## 0. 怎么复现这次审查

```bash
npm i -g @alibaba-group/open-code-review
ocr config set providers.deepseek.url https://api.deepseek.com/v1
ocr config set providers.deepseek.api_key "$DEEPSEEK_API_KEY"
ocr config set providers.deepseek.model deepseek-v4-flash
ocr llm test                      # 先确认连通
ocr scan --path agent/src/csl --concurrency 4 --format json -o /tmp/ocr-csl.json
ocr scan --path agent/src/cadence,web/server.mjs,web/public/assets/app.js \
         --concurrency 4 --format json -o /tmp/ocr-cad.json
```

---

## 1. 总体结果

| 项目 | 数值 |
|---|---|
| 审查文件 | **37** |
| 发现 | **71** 条 |
| 严重度分布 | **critical 1 · high 18 · medium 38 · low 14** |
| 消耗 token | 约 137 万（两次扫描，均触发预算上限） |

**结论先说**：审查**有效且有价值**——它找出了 8 个我们自己测试没覆盖到的真实缺陷，其中 3 个会直接伤害用户。

---

## 2. 我逐条验证过了，工具基本可信——但我也错过两次

我说"认真检查"就不能只贴工具输出。**每条都拿代码复验**，过程中出现三次**我的验证脚本写错、工具是对的**：

| 我的初判 | 复验结果 |
|---|---|
| `brief.js` editCount 不会被清零 | ❌ 我查错了：`syncBrief` 用 `buildBrief()` 造新对象直接写回，没继承 → **确实清零** |
| `e2e.js` 没有硬编码 `ok: true` | ❌ 我搜错了：`record()` 是**位置参数**，第 5 个实参就是 `true` → **确实硬编码** |
| `connectiveStack` 区间正确 | ❌ 我断言写错了：3 句连续「因为」报成 `[1,2]` → **确实错位** |

**教训**：不要用自己的 grep 去否定一个跑了 37 个文件的审查工具——先看它说的是哪一行。

---

## 3. 已修复的 8 个真实缺陷

### 3.1 双色 diff 把正当的风格替换误判成"改了事实"（high）

`dual-diff.js` 判否定极性时，只要出现「不/无/非」就算否定，于是：

| 改写 | 修复前 | 修复后 |
|---|---|---|
| 非常 → 十分 | ❌ **拒绝交付** | ✅ 放行 |
| 无疑 → 肯定 | ❌ **拒绝交付** | ✅ 放行 |
| 无数 → 很多 | ❌ **拒绝交付** | ✅ 放行 |
| 门槛是阻隔 → 门槛不是阻隔 | ✅ 拒绝（正确） | ✅ 拒绝 |

**实测 5 组常见替换里 3 组被误拒**——这与早先 A/B 实验中"中文改写 3/3 被拒"是同一类病。
修法：先剥掉"含否定字但不表否定"的常用词（非常/无论/无疑/无数/不但/不管…），再判极性。
**复验 8/8 符合预期**，真极性翻转与模态越级仍然拦得住。

### 3.2 作者的修改计数每次同步都被清零（high）

`brief.js` 的 `syncBrief` 用 `buildBrief()` 造全新对象（`editCount: 0, outcomeRefs: []`）后**整份写回**，
没继承上一版 → 累积的修改次数与结果引用**莫名其妙归零**。
修法：从 `prev` 继承这两个累计字段并重算 `briefHash`。**复验：记录 2 次后同步，仍是 2。**

### 3.3 气群文本用固定「，」重拼，改掉了作者的标点（high）

`breath.js` 把小句用 `'，'` 重新拼成气群文本：

```
原文：他站着：没动、也没说话。
修复前气群：他站着，没动，也没说话。   ← 冒号和顿号被改掉了
修复后气群：他站着：没动、也没说话。   ← 原样切片
```

**这与我早先在 `segment.js` 修的是同一类错误**，只是长在了另一个文件里。
修法：小句切分带位置信息，气群文本从**原文切片**而不是重新拼接。

### 3.4 平仄：拿"未判定"的占位符去比平仄，凭空判出失对/失粘（high）

`meter.js` 给人看的占位符是「？」，但 `detectNianDui` 拿到的是这串「？」，把"未判定"当成
一个真实声调参与比较 → **在完全没有字音表的情况下也能"判出"失对失粘**。
修法：内部保留 `instance_raw`（含 `'unknown'`）供判定使用，占位符只用于显示。
**复验：缺表时 `warnings: []`**。

### 3.5 冻结决断的保护范围过大，会锁住无关句子（high）

`adapters.frozenSentenceIndexes` 用了**对称** `includes`：

```
冻结句：今天天气很好，我出门散步
被误锁：今天天气很好              ← 只是它的前缀
```

修法：只允许单向包含，并排除长度明显不匹配的短句。**复验：无关句不再被锁。**

### 3.6 长文本会 RangeError 爆栈（high）

`metrics.js` 用 `Math.min(...xs)` / `Math.max(...xs)`。几千个句读就会把数组展开成
几万个实参——**而"501 本小说"正是这个量级**（规格里引用的研究规模）。
修法：改成单次遍历。**复验：20 万个句读正常返回。**

### 3.7 连接词堆叠的区间错位（critical）

`antipattern.js` 的 `connectiveStack`：第 2 句才 push 却用 `[i, i+1]` 当起点，
收尾时又把不匹配的那句也算进去。

```
3 句连续「因为」→ 报成"连续 2 句"、区间 [1,2]（正确是 [1,3]）
```

修法：按"同词连续段"精确记录。**复验：`[1,3]` 正确，2 句仍触发，不连续不触发。**

### 3.8 英文缩写识别带 `/i`，小写词被当缩写（high）

`segment.js` 的 `ABBREV` 带 `/i`，于是：

```
No. I disagree.         → 修复前 1 段（漏切）  修复后 2 段
He is a prof. She left. → 修复前 1 段（漏切）  修复后 2 段
```

**分句错了，后面所有统计都是假的**——这是最该修的一类。
修法：去掉 `/i`（大小写敏感），并让 `No.` 只在后接数字时才算缩写。

---

## 4. 值得记录但暂未修的问题（backlog）

按"是否影响用户"排序：

### 4.1 会丢数据或掩盖失败 —— **已修（第二轮）**

| 位置 | 问题 | 状态 |
|---|---|---|
| `state` / `brief` / `canonical` / `decision` / `credit` / `cadence.baseline` / `modulator` | **持久化非原子**：直接覆盖写 JSON，崩溃会留半截文件 | ✅ 已改「临时文件 + rename」（`workspace.writeFileAtomic`），10 处调用点 |
| `workspace.readState` | 空 `catch {}` 把"损坏"与"不存在"混为一谈——**损坏的状态被静默当成空状态** | ✅ 新增 `readJsonChecked` 区分 missing/corrupt；损坏时抛出明确错误并写入 `protocol/integrity.jsonl` |
| `actions.js` 入口 | 一处失败丢掉已收集的 trace/usage | ✅ 部分已修（`usage` 早返回）；**入口 try/catch 仍待办** |

### 4.2 契约字段名不副实

| 位置 | 问题 | 状态 |
|---|---|---|
| `actions.js` | 早返回丢掉累计 `usage` | ✅ 已修 |
| `capabilities.js` | `frozenSpans` 恒等于 `decisions`（解冻是删记录，不是打标记） | ✅ 已修 |
| `dual-diff.js` | `classifyChange` **全仓无调用点**（死函数，37 行），且它的 `STYLE_*` 词表与 `classifyRun` 的 `SIM_STYLE` 是两份，会漂移 | ✅ 已删除 |
| `dual-diff.js` | `neutral` 层不可达，`stats.neutral` 恒为 0 | ✅ 已如实标注（保留字段不破坏调用方） |
| `cadence/index.js` | `frozen_protected` 是全文档布尔值，任何冻结句存在时所有建议都被标"受保护" | ✅ 已改为**逐条**判断 |
| `cadence/apply.js` | `upgrade_punctuation_auto` 分支永不触发 | ✅ 已删除 |
| `actions.js` | `nextActions` 声明了但没有任何执行器填充 | ⬜ 待办 |

### 4.3 性能与可维护性

| 位置 | 问题 | 状态 |
|---|---|---|
| `cadence/breath.js` | `cost()` 在双重循环里重算长度 → 气群划分 **O(n³)** | ✅ 已改前缀和（120 小句 1ms） |
| `cadence/baseline.js` | 作者语料**重复计算三次** | ✅ 已改为采集一次并传入 |
| `dual-diff.js` | `alignUnits` 没有长度保护（`charDiff` 有） | ✅ 已加 `n*m > 400000` 降级 |
| `cadence/antipattern.js` | 用 `MAX_SAFE_INTEGER` 当区间哨兵，导致「标点单一化」建议在有任何锁定区间时被静默丢弃 | ✅ 已改用真实句数 |
| 各模块 | 大量业务常数硬编码 | ⬜ 待办 |

### 4.4 可读性 —— **大部分已清**

| 位置 | 问题 | 状态 |
|---|---|---|
| `antipattern.js` / `index.js` | 死导入（`sd`、`countUnits`、`metricalReport`、`toSsml`） | ✅ 已删（对外 API 保持不变，已断言） |
| `dual-diff.js` / `apply.js` | 死代码（`classifyChange`、`upgrade_punctuation_auto`） | ✅ 已删 |
| `apply.js` | 注释说"保留原有层次"，实际是替换标点 | ✅ 注释已改对 |
| `breath.js` | `PARALLEL_PAIR` 名字暗示做了并列分析，其实只是看有没有顿号 | ✅ 改名为 `LIKELY_ENUMERATION` 并注明是弱启发式 |
| 多处 | 嵌套三元表达式（项目自己的规则禁止） | ⬜ 待办（纯风格） |

---

## 5. 修复后的验证

| 项目 | 结果 |
|---|---|
| 引擎测试 | 75 个文件 **658 项检查全过** |
| 网页测试 | 15 个文件 **466 项检查全过** |
| 数据安全 | 新增 `data-safety.test.mjs`（5 项）：原子写不留残骸、写入失败原文件完好、missing≠corrupt、损坏留痕、正常流程无临时文件 |
| 双色 diff 极性判别 | **8/8 符合预期**（假阳性消除、真极性仍拦） |
| 连接词区间 | `[1,3]` 正确；2 句触发、不连续不触发 |
| 长序列 | 20 万句读不再爆栈 |
| 缺字音表 | `warnings: []`（不再凭空判失对失粘） |
| 冻结保护 | 无关句不再被锁 |
| 标点保真 | 冒号/顿号/引号原样保留 |

**全部修复未引入回归**（658 + 466 项全过）。

### 第二轮追加修复（按 §4 的优先级做的）

| 修复 | 验证方式 |
|---|---|
| **原子写**：`state`/`brief`/`decision`/`credit`/`baseline`/`modulator` 共 10 处改成「临时文件 + rename」 | 模拟序列化失败：**原文件完好、无临时残留** |
| **损坏 vs 缺失**：新增 `readJsonChecked`，损坏时抛明确错误并写 `integrity.jsonl` | `readState` 遇坏 JSON → 报"损坏"并留痕 |
| **doctor 显示完整性**：报错里承诺的"运行 doctor 查看"现在真的能看到 | 有损坏 → `⚠ 数据完整性: 有 1 次读写异常（state.json corrupt）` |
| **逐条冻结判断**：`frozen_protected` 不再是全文档布尔 | 5 条建议里 0 条被误标为受保护 |
| **气群划分 O(n³) → O(n²)** | 120 小句 1ms |
| **作者语料采集 3 次 → 1 次** | `analyze` 内部去重 |

---

## 6. 对这次外部审查的评价

**它有价值的地方**：

1. 找出了**我们自己测试覆盖不到**的缺陷——8 个里没有一个是被现有测试拦住的
2. 给出了**精确行号 + 证据 + 修复建议**，不是泛泛而谈
3. 抓到了我在两个不同文件里犯的**同一个错误**（用固定字符重拼/替换用户原文）

**它的局限**（也要说清）：

1. 两次扫描都 `budget_exceeded: true`，**没有覆盖全仓**——只审了 `csl` / `cadence` / `web` 三块共 37 个文件（全仓 111 个模块）
2. **大量 medium/low 是风格建议**（硬编码常数、嵌套三元），不是缺陷
3. 它对"这是不是 bug"的判断**需要人来复核**——我的三次误判就说明了工具也需要被审视

**下一步该做的**：把 §4.1 的三条（原子写、空 catch、入口缺 try/catch）收掉——
它们都是"会丢数据"的性质，比剩下的风格问题重要得多。
