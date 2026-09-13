// CADENCE · 报告渲染（人话版，CLI / Web / 面板共用）

export function renderRhythmReport(report, { maxAntipatterns = 6 } = {}) {
  const s = report.sentence_level;
  const b = report.breath_level;
  const L = [];
  const line = '─'.repeat(52);
  L.push('');
  L.push(line);
  L.push('CADENCE · 节奏与气群报告');
  L.push(line);

  if (report.insufficient) {
    L.push(`句读数 ${s.n} < 8：**不足以判定节奏**（样本太短，任何结论都不可靠）`);
    L.push('这不是报错，是拒绝给你一个不该给的结论。');
    L.push('');
    return L.join('\n');
  }

  L.push(`句读 ${s.n} 个 · 气群 ${b.groups.length} 个（平均每句 ${b.groups_per_sentence} 个气群）`);
  L.push('');
  L.push('【句长统计】');
  L.push(`  均值 ${s.mean} · 中位数 ${s.median} · 标准差 ${s.sd} · CV ${s.cv}`);
  L.push(`  极差 ${s.range} · 四分位距 ${s.iqr} · 偏度 ${s.skew}`);
  L.push(`  MAD（相邻句长差）${s.mad} · 排列熵 ${s.permEntropy} · DFA Hurst ${s.dfaHurst}`);
  L.push(`  气群长度：均值 ${b.mean} · 标准差 ${b.sd} · CV ${b.cv}`);
  L.push('');

  if (report.baseline_source === 'author') {
    L.push(`【相对你自己的基线】你的历史 CV ${report.baseline.cv}（${report.baseline.samples} 篇样本）`);
    L.push(`  这篇 CV ${s.cv} —— ${s.cv >= report.baseline.cv ? '高于' : '低于'}你自己的平均`);
  } else {
    L.push(`【基线】${report.baseline?.note || '样本不足，只报绝对值，不下结论'}`);
  }
  L.push('');

  L.push('【气群图】');
  for (const g of b.groups.slice(0, 14)) {
    const flag = g.splitFromSentence ? '  ⚠ 与其它气群同挤一句' : '';
    L.push(`  [${g.text}](${g.length}字)${flag}`);
  }
  if (b.groups.length > 14) L.push(`  … 还有 ${b.groups.length - 14} 个气群`);
  L.push('');

  const aps = report.antipatterns || [];
  if (!aps.length) {
    L.push('【反模式】未检出');
  } else {
    L.push(`【反模式】检出 ${aps.length} 处`);
    for (const a of aps.slice(0, maxAntipatterns)) {
      L.push(`  · ${a.label}：${a.evidence}`);
      L.push(`    ${a.hint}`);
    }
  }
  L.push('');
  L.push('【口径声明】');
  for (const n of report.notes || []) L.push(`  · ${n}`);
  L.push('');
  return L.join('\n');
}
