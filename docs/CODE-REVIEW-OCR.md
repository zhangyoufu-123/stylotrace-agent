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

### 4.1 会丢数据或掩盖失败（建议优先）

| 位置 | 问题 |
|---|---|
| `brief.js` / `canonical.js` / `credit.js` | **持久化非原子、无锁**：直接覆盖写 JSON，崩溃会留半截文件，并发会丢更新。应改成「临时文件 + rename」 |
| `brief.js` | 空 `catch {}` 把解析错误、EACCES、EMFILE 与"文件不存在"混为一谈——**损坏的数据被静默当成 0** |
| `actions.js` | 多个入口（`dispatch`/`runTurn`/`acceptAnswer`/`recordFeedback`）没有 try/catch，一处失败就丢掉已收集的 trace/usage |

### 4.2 契约字段名不副实

| 位置 | 问题 | 状态 |
|---|---|---|
| `actions.js` | 早返回丢掉累计 `usage` | ✅ 已修 |
| `capabilities.js` | `frozenSpans` 恒等于 `decisions`（解冻是删记录，不是打标记） | ✅ 已修 |
| `actions.js` | `nextActions` 声明了但没有任何执行器填充 | ⬜ 待办 |
| `dual-diff.js` | `neutral` 层不可达，`stats.neutral` 恒为 0 | ⬜ 待办 |
| `index.js` | `frozen_protected` 是全文档布尔值，任何冻结句存在时所有建议都被标"受保护" | ⬜ 待办 |

### 4.3 性能与可维护性

- `breath.js` 的 `cost()` 在双重循环里重算长度 → 气群划分是 **O(n³)**
- `baseline.js` 把作者语料**重复计算三次**（`readBaseline` 两次 + `analyze` 一次）
- `dual-diff.js` 的 `alignUnits` 没有长度保护，而 `charDiff` 有（`n*m > 400000` 降级）
- `antipattern.js` 用 `Number.MAX_SAFE_INTEGER` 当区间哨兵，会让「标点单一化」建议与任意锁定区间重叠而被静默丢弃
- 大量业务常数（阈值、截断长度、权重）硬编码在各模块里

### 4.4 仅影响可读性

- 死导入：`antipattern.js` 的 `sd`、`index.js` 的 `countUnits` / `metricalReport` / `toSsml`
- 死代码：`author-corpus.js` 里 `.md|.txt` 之后的 `index.json` 排除分支不可达；`apply.js` 的 `upgrade_punctuation_auto` 永不触发
- 注释与实现不符：`apply.js` 说保留标点但代码删掉了；`antipattern.js` 说做了并列检查其实没做
- 嵌套三元表达式（项目自己的规则禁止）

---

## 5. 修复后的验证

| 项目 | 结果 |
|---|---|
| 引擎测试 | 74 个文件 **652 项检查全过** |
| 网页测试 | 15 个文件 **466 项检查全过** |
| 双色 diff 极性判别 | **8/8 符合预期**（假阳性消除、真极性仍拦） |
| 连接词区间 | `[1,3]` 正确；2 句触发、不连续不触发 |
| 长序列 | 20 万句读不再爆栈 |
| 缺字音表 | `warnings: []`（不再凭空判失对失粘） |
| 冻结保护 | 无关句不再被锁 |
| 标点保真 | 冒号/顿号/引号原样保留 |

**全部修复未引入回归**（652 + 466 项全过）。

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
