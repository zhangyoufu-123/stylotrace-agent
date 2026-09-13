// 目的→风格调节（v1.8）：同一文体下，写作目的不同则表达方式不同。
// 备忘录 §3.1：说服性文章句子短、断言强；个人随笔句子松、意象多；
// 学术文章语气中立、论据先行。引擎已在澄清期采集 stance（立场/目的），
// 这里把它转成一段可注入的写作目的提示，让"写什么目的"影响"怎么写"。

const PURPOSE_PATTERNS = [
  {
    key: 'persuade',
    re: /说服|劝|号召|呼吁|倡议|主张|争取|反对|支持|游说|打动|改变看法/,
    brief: '这篇要说服读者：句子短促有力、断言清晰，多用具体例证与数据，少绕弯子，收尾落在行动或态度上。',
  },
  {
    key: 'reflect',
    re: /反思|回想|回忆|感悟|随笔|自省|纪念|梳理|表达自己|心里话/,
    brief: '这篇在表达与梳理自己：句子可以松弛，多意象与细节，允许留白和未说完的话，不急着下结论。',
  },
  {
    key: 'academic',
    re: /学术|论文|论证|研究|文献|综述|课题|期刊|学位/,
    brief: '这篇在论证：语气中立克制，多用限定词与让步，论据先行、证据说话，少用第一人称与情绪化表达。',
  },
  {
    key: 'narrate',
    re: /故事|小说|情节|人物|叙事|经历|回忆录/,
    brief: '这篇在讲述：让情节与人物自己推进，多用动作、对话与画面，少用抽象概括，细节比总结重要。',
  },
  {
    key: 'inform',
    re: /说明|介绍|报告|汇报|告知|讲解|指南|通知|总结/,
    brief: '这篇在传达信息：结构清晰、要点先行、少修辞，让读者最快拿到关键内容。',
  },
];

/** 从立场/目的文本中判定写作目的类别；无法判定返回 generic（不注入偏好）。 */
export function detectPurpose(text = '') {
  const t = String(text || '');
  for (const p of PURPOSE_PATTERNS) {
    if (p.re.test(t)) return p.key;
  }
  return 'generic';
}

/** 生成可注入写作提示的目的说明；generic 时返回空串（不干扰默认写法）。 */
export function purposeStyleBrief(state) {
  const stance = String(
    state?.confirmed?.stance || state?.intent?.coreNeed || state?.intent?.summary || '',
  );
  const key = detectPurpose(stance);
  if (key === 'generic' || !stance) return '';
  const p = PURPOSE_PATTERNS.find((x) => x.key === key);
  return p ? `【写作目的】${p.brief}` : '';
}

export const PURPOSE_KEYS = PURPOSE_PATTERNS.map((p) => p.key);
