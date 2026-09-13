// CADENCE · 语音侧：气群图 → SSML（规格 §8）
//
// 为什么这一层天然成立：TTS 的"怪"来自**跨句规划缺失**——多数 TTS 只建模句内信息。
// 而气群图恰好就是它缺的那个跨句结构。所以节奏审计和语音优化不是两个功能，
// 是同一份气群数据的两种消费方式。
//
// 纪律：不支持某标签的引擎要能降级 → 报告里标 degraded，不假装生效。

const ESC = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 边界类型 → 基准停顿时长（毫秒）。
 * 这些是**候选值**，可被作者覆盖（规格 §8.4：可控胜过自动）。
 */
export const BREAK_MS = {
  within_group: 120, // 气群内（轻）
  between_groups: 380, // 气群间（中）
  sentence: 650, // 句读间（重）
  paragraph: 900, // 段落间（最强）
};

/**
 * 生成 SSML。
 * @param report analyze() 的结果
 * @param opts.overrides 作者覆盖：{ [groupIndex]: { rate, breakAfterMs, emphasis: [字] } }
 */
export function toSsml(report, { overrides = {}, engine = 'generic' } = {}) {
  const supported = SUPPORT[engine] || SUPPORT.generic;
  const degraded = [];
  const groups = report?.breath_level?.groups || [];
  if (!groups.length) return { ssml: '<speak></speak>', degraded: ['没有可用的气群'], engine };

  const body = [];
  groups.forEach((g, i) => {
    const ov = overrides[i] || {};
    const focus = ov.emphasis || g.focusChar || null;
    let inner = ESC(g.text);
    if (focus && supported.emphasis) {
      inner = inner.replace(ESC(focus), `<emphasis level="moderate">${ESC(focus)}</emphasis>`);
    } else if (focus && !supported.emphasis) {
      degraded.push(`engine=${engine} 不支持 <emphasis>，已忽略重音标记`);
    }

    if (ov.rate && supported.prosody) {
      inner = `<prosody rate="${ov.rate}">${inner}</prosody>`;
    } else if (ov.rate) {
      degraded.push(`engine=${engine} 不支持 <prosody rate>`);
    }
    body.push(inner);

    const isLast = i === groups.length - 1;
    if (!isLast) {
      const sameSentence = groups[i + 1].sentenceIndex === g.sentenceIndex;
      const ms = ov.breakAfterMs ?? (sameSentence ? BREAK_MS.between_groups : BREAK_MS.sentence);
      if (supported.breakTag) body.push(`<break time="${ms}ms"/>`);
      else {
        body.push(sameSentence ? '，' : '。');
        degraded.push(`engine=${engine} 不支持 <break>，已降级为标点`);
      }
    }
  });

  return {
    ssml: `<speak version="1.0" xml:lang="zh-CN">${body.join('')}</speak>`,
    degraded: [...new Set(degraded)],
    engine,
    // 计划本身也返回：回采比对时要拿它当基准
    plan: groups.map((g, i) => ({
      index: i,
      text: g.text,
      sentenceIndex: g.sentenceIndex,
      boundaryAfter: i === groups.length - 1
        ? 'end'
        : groups[i + 1].sentenceIndex === g.sentenceIndex
          ? 'between_groups'
          : 'sentence',
      breakMs: overrides[i]?.breakAfterMs ?? null,
    })),
  };
}

/** 引擎能力表：实际支持度不一，必须能降级并在报告里标 degraded。 */
export const SUPPORT = {
  generic: { breakTag: true, prosody: true, emphasis: true },
  azure: { breakTag: true, prosody: true, emphasis: true },
  // 部分引擎只认标点停顿
  minimal: { breakTag: false, prosody: false, emphasis: false },
};

/**
 * 回采比对（规格 §8.2 步骤四）。
 * 输入是从合成音频里量出来的静音段与时长；这里只做计划 vs 实际的偏差报告。
 * 不做声纹、不识别说话人（规格 §1.2 第五条）。
 */
export function compareProsody(plan, measured) {
  const rows = [];
  for (const p of plan || []) {
    const actual = (measured || []).find((m) => m.index === p.index);
    if (!actual) continue;
    const plannedMs = p.breakMs ?? BREAK_MS[p.boundaryAfter] ?? 0;
    const actualMs = Number(actual.pauseMs || 0);
    rows.push({
      index: p.index,
      plannedMs,
      actualMs,
      deltaMs: actualMs - plannedMs,
      verdict: Math.abs(actualMs - plannedMs) <= Math.max(80, plannedMs * 0.35) ? 'ok' : 'off',
    });
  }
  const off = rows.filter((r) => r.verdict === 'off');
  return {
    rows,
    off,
    hint: off.length ? `${off.length} 处停顿与计划偏差较大，可在 SSML 覆盖里手动调整` : '停顿与计划一致',
  };
}
