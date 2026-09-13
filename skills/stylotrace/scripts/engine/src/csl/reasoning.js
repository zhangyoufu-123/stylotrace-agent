// CSLA Reasoning Operators（红队修复 #4 首批落地）
// Compare / Counterexample / Abstract —— v1.7/v1.8 声称但此前缺失的算子。
// 全部确定性、可测；LLM 版本后续再扩。

function tokens(s) {
  const t = String(s || '').replace(/[，。！？,.!?；;：:「」“”\s]/g, '');
  const out = new Set();
  for (const ch of t) {
    if (/[\u4e00-\u9fff]/.test(ch) || /[a-z0-9]/i.test(ch)) out.add(ch.toLowerCase());
  }
  return out;
}

/** 比较：输出 shared + different + relationalDifference（红队攻击 11）。 */
export function compare(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  const shared = [...A].filter((t) => B.has(t));
  const onlyA = [...A].filter((t) => !B.has(t));
  const onlyB = [...B].filter((t) => !A.has(t));
  const negation = /(不|没|否|无|别)/;
  const relDiff = negation.test(a) !== negation.test(b) ? '否定极性不同' : onlyA.length + onlyB.length > 0 ? '词汇差异' : '同质';
  return { shared, different: { a: onlyA, b: onlyB }, relationalDifference: relDiff };
}

// 反例知识库（确定性；规则模式：主语+谓语 → 例外）
const EXCEPTIONS = [
  { rule: /鸟.*飞/, counter: '企鹅、鸵鸟不会飞' },
  { rule: /动物.*吃.*肉/, counter: '牛、羊、大象是食草动物' },
  { rule: /人.*都会/, counter: '例外总是存在（如特殊体质、极端情境）' },
  { rule: /鱼.*游/, counter: '弹涂鱼可离水活动' },
];

/** 反例：对"X 会 Y"类宽规则找反例（红队攻击 12）；无命中返回 null。 */
export function counterexample(rule) {
  const t = String(rule || '');
  for (const e of EXCEPTIONS) {
    if (e.rule.test(t)) return { rule: t, counter: e.counter, confidence: 0.9 };
  }
  return null;
}

/** 抽象/归纳：多实例提取共同 token 形成候选 schema（确定性）。 */
export function abstract(instances) {
  const lists = instances.map(tokens);
  if (!lists.length) return { claim: '', confidence: 0 };
  const common = [...lists[0]].filter((t) => lists.every((s) => s.has(t)));
  const confidence = Number(Math.min(1, 0.3 + 0.15 * lists.length).toFixed(3));
  return { claim: common.join('、'), confidence };
}
