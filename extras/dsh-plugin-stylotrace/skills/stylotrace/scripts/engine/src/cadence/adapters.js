// CADENCE ←→ 既有模块的接缝（规格 §2.2 第三条：旧模块一行不改，只在外面套 adapter）
//
// 这里集中放"从 agent 别的模块取数据"的胶水，好处是：
//   · cadence/ 内部不直接依赖 csl/ 的具体实现，换实现只改这一处
//   · 任何取数失败都降级成空值，绝不让节奏分析因为别的模块出问题而崩

import fs from 'node:fs';
import path from 'node:path';
import * as decision from '../csl/decision.js';

/**
 * 作者冻结的决断（决断卡）→ CADENCE 的 lockedSpans。
 *
 * 这是最要紧的一处接缝：决断卡里是**作者自己指定的、AI 不许动的句子**。
 * 节奏建议要是动了它，就等于系统在劝作者改掉自己的表达——
 * 那正是整个项目最反对的事。所以冻结句一律自动进入锁定集合。
 */
export function lockedSpansFromDecisions(workspace) {
  try {
    const items = decision.listDecisions(workspace).filter((d) => d.frozen !== false);
    return items
      .map((d) => String(d.spanText || '').trim())
      .filter(Boolean)
      .map((text) => ({ text, reason: '作者冻结的决断' }));
  } catch {
    return [];
  }
}

/** 按字面量把冻结句映射成句读下标区间，供 suggest 的 lockedSpans 使用。 */
export function frozenSentenceIndexes(report, texts) {
  if (!texts.length) return [];
  const out = [];
  for (const s of report.sentence_level.segments || []) {
    if (texts.some((t) => s.text.includes(t.text) || t.text.includes(s.text))) out.push([s.index, s.index]);
  }
  return out;
}

/** 上游治理信息（作者长期意图 / 当前聚焦）——节奏建议不该和它对着干。 */
export function governanceOf(workspace) {
  try {
    const g = JSON.parse(fs.readFileSync(path.join(workspace, 'vault', 'governance.json'), 'utf8'));
    return { authorIntent: g?.authorIntent || '', currentFocus: g?.currentFocus || '' };
  } catch {
    return { authorIntent: '', currentFocus: '' };
  }
}
