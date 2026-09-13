// AI 腔模式目录（25 类）：逐条对应 blader/humanizer SKILL.md 的 §1–§25。
//
// 为什么要有这个东西：humanizer 用 25 条模式来判断"这段像不像 AI 写的"。
// 要跟它对比，就必须用**它自己的尺子**量两边的产出，否则比出来的只是我们的偏见。
// 所以这里的规则编号、分组（A 铺垫 / B 节奏 / C 夸张 / D 格式 / E 残留）、
// "§1–§5 见一次即算、其余需多处共存"的判罚逻辑，全部照抄它的 SKILL.md。
//
// 它原文声明："该公式出现在每种语言里，等价结构同等处理"——所以中英各有一套等价式。
// §2 / §7 / §24 是结构性 tell（跨句跨段才能看出来），单独实现。

const RE = {
  notXbutY: /(不是|并非|不再|不在于)[^。；！？\n]{2,26}(而是|而在于)|不仅[^。；！？\n]{2,26}而且|不只是[^。；！？\n]{2,26}(更|还|而是)|而非|not (just |only |merely )?[^.!?\n]{4,60}(but|it'?s )/gi,
  sayings: /(正如[^。；！？\n]{2,20}所说|古人云|有句话说得好|这(或许)?就是[^。；！？\n]{2,16}的(意义|真谛)|时间会证明)/g,
  staged: /(在当今[^。；！？\n]{0,12}(社会|时代|世界)|随着[^。；！？\n]{2,14}的(不断)?(发展|进步|推进|普及)|近年来|众所周知|在[^。；！？\n]{2,12}的今天|In today'?s [^.,\n]{2,20}(world|society|era)|In recent years|It is widely (known|recognized))/gi,
  strawman: /(有人(说|认为|质疑)[^。；！？\n]{2,30}(其实|但|然而)|或许有人会问|很多人问[^。；！？\n]{0,10}为什么|Some (may|might) (say|argue|ask)[^.!?\n]{4,60}(but|however|yet))/gi,
  triad: /[^，。；：！？\n]{2,12}、[^，。；：！？\n]{2,12}、[^，。；：！？\n]{2,12}/g,
  dash: /——/g,
  stackedHedge: /(可能|或许|大概|似乎)[^。；！？\n]{0,10}(可能|或许|大概|似乎)|(在某种程度上|在某种意义上)[^。；！？\n]{0,16}(可能|也许|或许)/g,
  hyphens: /\b(third-party|cross-functional|client-facing|data-driven|decision-making|well-known|high-quality|real-time|long-term|end-to-end)\b/gi,
  passive: /(被(认为|视为|广泛|普遍)|受到(广泛|普遍)[^。；！？\n]{0,6}(关注|好评)|is (widely|generally|commonly) (considered|regarded|seen))/g,
  aiWords: /\b(actually|additionally|align with|bolstered|crucial|deep dive|delve|emphasizing|enduring|enhance|fostering|garner|interplay|intricate|intricacies|meticulous|meticulously|pivotal|quietly|robust|showcase|tapestry|testament|underscore|vibrant|valuable)\b|(赋能|抓手|闭环|生态位|深耕|助力|打造|深度融合|全方位|多维度|一体化|高质量发展)/gi,
  inflated: /(具有(重要|深远|里程碑|划时代)(意义|影响)|开创性|至关重要|标志(着)?[^。；！？\n]{0,12}(新时代|里程碑)|stands as a testament|pivotal moment|crucial moment|plays a key role|setting the stage for|indelible mark|the future looks bright|exciting times ahead)/gi,
  vagueLink: /(与[^。；！？\n]{2,16}(相关|有关|联系在一起)|在[^。；！？\n]{0,8}(方面|层面)有着[^。；！？\n]{2,10}(联系|关联)|associated with|in connection with|linked to|tied to)/gi,
  ingRider: /(，[^，。；！？\n]{0,10}(彰显|体现|展现|凸显|映照|折射|诠释|见证)了)|(,\s*(highlighting|underscoring|emphasizing|ensuring|reflecting|symbolizing|contributing to|showcasing|cultivating|fostering)\b)/gi,
  sales: /(坐落于[^。；！？\n]{0,10}的?(美丽|迷人|风景)|得天独厚|令人叹为观止|不可多得|独具魅力|丰富的文化底蕴|boasts|nestled|in the heart of|breathtaking|must-visit|stunning|diverse array)/gi,
  borrowedAuthority: /(专家(认为|指出|表示)|有(观察家|评论家|学者)(认为|指出)|业内人士(认为|表示)|多项(研究|报告)(表明|显示)|observers have cited|experts (argue|believe|say)|industry reports)/g,
  avoidIs: /(作为[^。；！？\n]{0,14}(的)?(存在|代表|象征)|堪称[^。；！？\n]{0,10}的?(典范|代表|缩影)|serves as|stands as|functions as|operates as|boasts|features)/gi,
  bold: /\*\*(?=\S)[^*\n]{1,30}\*\*/g,
  decorativeHeading: /(^|\n)#{1,3}\s*[^\n]*[🚀💡✨🎯📌🔥⭐️]/g,
  curlyQuote: /[“”]/g,
  chatResidue: /(希望(这|以上|这些)(段|篇|内容)?[^。；！？\n]{0,6}(有帮助|有所启发)|还有什么(可以|需要)(帮到你|我帮忙)|需要我(继续|再|帮)|请问需要|以下是[^。；！？\n]{0,10}(介绍|概述)|I hope this helps|Let me know if|Would you like|Great question|Certainly!|Of course!)/gi,
  knowledgeLimit: /(截至[^。；！？\n]{0,10}(最新|目前)?(资料|信息)|根据(现有|公开)(资料|信息)|目前(尚)?未(公开|披露|记载)|as of [^.,\n]{0,12}(knowledge|information)|based on available information|not publicly available|it is believed that)/gi,
  previousVersion: /(本(次|版|稿)(修改|更新|调整)后|此前的(版本|方案)中|经过(这次|本轮)修改|was (added|changed) to replace the previous|previous approach)/g,
};

/** 定义：id = SKILL.md 的小节号；strong = §1–§5（见一次即可改）。 */
export const TELLS = [
  { id: 1, sec: 'A', name: '不是X而是Y', strong: true, re: RE.notXbutY },
  { id: 2, sec: 'A', name: '一行式收尾/戏剧化残句', strong: true, re: null },
  { id: 3, sec: 'A', name: '故作深刻的格言', strong: true, re: RE.sayings },
  { id: 4, sec: 'A', name: '铺垫式开场', strong: true, re: RE.staged },
  { id: 5, sec: 'A', name: '对着空气辩论', strong: true, re: RE.strawman },
  { id: 6, sec: 'B', name: '强行三段并列', strong: false, re: RE.triad },
  { id: 7, sec: 'B', name: '句首重复', strong: false, re: null },
  { id: 8, sec: 'B', name: '破折号当万能连接', strong: false, re: RE.dash, min: 2 },
  { id: 9, sec: 'B', name: '限定词叠加', strong: false, re: RE.stackedHedge },
  { id: 10, sec: 'B', name: '连字符词组泛滥', strong: false, re: RE.hyphens, min: 2 },
  { id: 11, sec: 'B', name: '被动语态/主语缺失', strong: false, re: RE.passive },
  { id: 12, sec: 'C', name: 'AI 高频词', strong: false, re: RE.aiWords },
  { id: 13, sec: 'C', name: '夸大意义', strong: false, re: RE.inflated },
  { id: 14, sec: 'C', name: '含糊关联', strong: false, re: RE.vagueLink },
  { id: 15, sec: 'C', name: '-ing/动词短语挂尾', strong: false, re: RE.ingRider },
  { id: 16, sec: 'C', name: '广告腔', strong: false, re: RE.sales },
  { id: 17, sec: 'C', name: '借来的权威', strong: false, re: RE.borrowedAuthority },
  { id: 18, sec: 'C', name: '回避"是/有"', strong: false, re: RE.avoidIs },
  { id: 19, sec: 'D', name: '加粗当装饰', strong: false, re: RE.bold, min: 2 },
  { id: 20, sec: 'D', name: '装饰性标题', strong: false, re: RE.decorativeHeading },
  { id: 21, sec: 'D', name: '弯曲引号', strong: false, re: RE.curlyQuote, min: 2 },
  { id: 22, sec: 'E', name: '聊天机器人残留', strong: false, re: RE.chatResidue },
  { id: 23, sec: 'E', name: '知识边界免责/猜测', strong: false, re: RE.knowledgeLimit },
  { id: 24, sec: 'E', name: '标题在首句重复', strong: false, re: null },
  { id: 25, sec: 'E', name: '写"上一版"', strong: false, re: RE.previousVersion },
];

/** §2 一行式收尾：段落里紧跟着一个独立成段的短句（≤18 字且以句号收尾）。 */
export function detectOneLineCloser(text) {
  const paras = String(text).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const hits = [];
  for (let i = 0; i < paras.length - 1; i += 1) {
    const p = paras[i].replace(/\s/g, '');
    const len = (p.match(/[\u4e00-\u9fff]/g) || []).length || p.split(/\s+/).length;
    if (len > 0 && len <= 18 && /[。！？.!?]$/.test(p)) hits.push(p.slice(0, 18));
  }
  return hits;
}

/** §7 句首重复：同一开头出现 ≥3 次。 */
export function detectRepeatedOpenings(text) {
  const sentences = String(text).split(/(?<=[。！？!?])/).map((s) => s.trim()).filter((s) => s.length > 4);
  const openers = {};
  for (const s of sentences) {
    const head = s.slice(0, 4);
    openers[head] = (openers[head] || 0) + 1;
  }
  return Object.entries(openers).filter(([, n]) => n >= 3).map(([h, n]) => `${h}×${n}`);
}

/** §24 标题在首句重复：标题下紧跟一句几乎等于标题的话，之后才是正文。 */
export function detectHeadingEcho(text) {
  const lines = String(text).split('\n');
  const hits = [];
  for (let i = 0; i < lines.length - 2; i += 1) {
    const h = lines[i].match(/^#{1,4}\s*(.+)$/);
    if (!h) continue;
    const body = lines.slice(i + 1).find((l) => l.trim());
    if (body && body.trim().length <= h[1].trim().length + 6 && lines[i + 2]?.trim()) {
      hits.push(h[1].slice(0, 20));
    }
  }
  return hits;
}

/**
 * 扫描一段文字触发了哪些 tell。
 * @returns {{found:Array,strong:number,weak:number,index:number,list:string[]}}
 *   index = 0–100 的"去 AI 味完成度"：§1–§5 每条扣 16，弱 tell 第 3 条起每条扣 7
 *   （照抄 SKILL.md 的判罚逻辑：强 tell 见一次即算，弱 tell 需多处共存）。
 */
export function tellScan(text) {
  const s = String(text || '');
  const found = [];
  for (const t of TELLS) {
    let evidence = [];
    if (t.re) {
      const m = s.match(t.re) || [];
      if (m.length >= (t.min || 1)) evidence = [...new Set(m.map((x) => String(x).trim()))].slice(0, 3);
    } else if (t.id === 2) evidence = detectOneLineCloser(s);
    else if (t.id === 7) evidence = detectRepeatedOpenings(s);
    else if (t.id === 24) evidence = detectHeadingEcho(s);
    if (evidence.length) {
      found.push({ id: t.id, sec: t.sec, name: t.name, strong: t.strong, n: evidence.length, evidence });
    }
  }
  const strong = found.filter((f) => f.strong).length;
  const weak = found.filter((f) => !f.strong).length;
  const weakPenalty = weak >= 3 ? weak : Math.max(0, weak - 1) * 0.5;
  const index = Math.max(0, Math.round(100 - (strong * 16 + weakPenalty * 7)));
  return { found, strong, weak, index, list: found.map((f) => `§${f.id} ${f.name}`) };
}

/** 每条模式对应的"怎么改"（写给模型看的动作指令，不写给用户看的术语）。 */
const FIX = {
  1: '把"不是X而是Y"直接说成 Y，或老实说 X 是什么，别用对仗下结论',
  2: '删掉独立成段的一行式收尾，让上一句把话说完',
  3: '删掉格言式收尾，落到具体的事上',
  4: '删掉"在当今社会/随着…的发展/近年来"这类开场，直接从具体的事写起',
  5: '删掉"有人说…但"的自问自答，直接给出你的判断',
  6: '打散三段并列，只保留最有必要说的一两项，其余改成短句',
  7: '换掉重复的句首，别每句一个句式',
  8: '破折号最多留一个，其余改成句号或逗号',
  9: '限定词只留一个真的需要的',
  10: '去掉不必要的连字符词组',
  11: '改成主动语态，把"谁做了什么"写出来',
  12: '换掉这些模型高频词（赋能/打造/深耕/闭环/多维度…），用具体的动词和名词',
  13: '删掉"具有里程碑意义/至关重要"这类拔高，把事实本身说出来，后面别再补一句感慨',
  14: '把"与…相关"改成具体是什么关系；说不出就删掉',
  15: '删掉句尾"彰显了/体现了/展现了…"的挂尾，事实说完就停',
  16: '删掉广告腔（得天独厚/叹为观止/丰富的文化底蕴），直接说它是什么',
  17: '把"专家认为/多项研究表明"换成具体是谁、说了什么；没有出处就删掉这句话',
  18: '把"堪称…的典范/作为…的存在"换回"是/有"',
  19: '去掉装饰性加粗',
  20: '去掉标题和列表里的 emoji 与箭头',
  21: '中文引号统一成「」或直引号，别混用',
  22: '删掉"希望这篇对你有帮助/还需要我…吗"这类聊天残留',
  23: '删掉"根据现有资料/截至目前"这类知识边界说明；没查到就直说没查到',
  24: '删掉标题下面那句复述标题的话，直接从正文开始',
  25: '别写"本次修改后…"这种跟上一版对比的话',
};

/**
 * 把人话版"这段哪里像 AI 写的"写出来。
 * 给用户看诊断、给模型看改写指令，都用这一份。
 */
export function renderTellReport(text, { max = 8 } = {}) {
  const r = tellScan(text);
  if (!r.found.length) return { index: r.index, lines: [], text: '没检出明显的 AI 腔模式。' };
  const lines = [...r.found]
    .sort((a, b) => (b.strong - a.strong) || (a.id - b.id))
    .slice(0, max)
    .map((f) => `§${f.id} ${f.name}${f.strong ? '（严重）' : ''}：${FIX[f.id] || ''}　例：${f.evidence[0]}`);
  return { index: r.index, lines, text: lines.join('\n') };
}

/**
 * 给改写提示词用的"定点爆破"指令：只列这篇里**真的出现**的模式。
 * 泛泛地说"去掉 AI 味"模型会敷衍；指出具体是哪几句、哪几条规则，改写才落得下去。
 */
export function deAiDirective(text, { max = 8 } = {}) {
  const r = renderTellReport(text, { max });
  if (!r.lines.length) return '';
  return ['【这篇里已检出的 AI 腔，必须逐条改掉】', ...r.lines.map((l) => `- ${l}`)].join('\n');
}
