// 结构调制（v1.8，备忘录 §4）：非线性结构不是靠单次 Prompt 碰运气，
// 而是由风格档案 + 文体决定"这篇文用哪个结构装置、放在哪一节"，确定性选择、可复现。
// 装置：倒叙（先给画面/结果）、插叙（主线外的一段回忆）、突转（埋线后反转）、
//       留白（不说完）、反问收束（不给定论）。
// 公文/合同/学术论文等公式化文体不启用——结构扰动只给"可以非线性"的文体。
import fs from 'node:fs';
import path from 'node:path';
import { isOfficialGenre } from './genre.js';

const STRUCTURE_FREE = new Set(['合同', '学术论文', '申请书', '投标书', '申报书']);

const DEVICES = {
  lead_with_scene: {
    brief: '本节不从起点讲起，先给一个具体画面或关键结果，再回头补过程。',
    placement: 'first',
  },
  flashback_aside: {
    brief: '主线推进中插入一段与主线看似无关的个人回忆或细节，下一段再拉回来，让读者自己连上线。',
    placement: 'middle',
  },
  reversal: {
    brief: '在中段突然改变方向或语调，制造意外；反转前必须在文中埋下可回收的细节、物件或台词。',
    placement: 'middle',
  },
  ellipsis_end: {
    brief: '关键处不说完，用省略号或沉默收束，把结论留给读者自己补，不要点题。',
    placement: 'last',
  },
  rhetorical_question: {
    brief: '结尾用反问或一个未回答的问题收束，不下确定结论，让读者自己回答。',
    placement: 'last',
  },
};

// 文体默认允许的装置（无高置信风格偏好时按文体选）
const GENRE_DEFAULT_DEVICES = {
  散文: ['lead_with_scene', 'flashback_aside', 'ellipsis_end'],
  游记: ['lead_with_scene', 'flashback_aside', 'ellipsis_end'],
  读后感: ['lead_with_scene', 'flashback_aside', 'ellipsis_end'],
  观后感: ['lead_with_scene', 'flashback_aside', 'ellipsis_end'],
  记叙文: ['lead_with_scene', 'flashback_aside', 'reversal'],
  小说: ['lead_with_scene', 'flashback_aside', 'reversal'],
  演讲稿: ['lead_with_scene', 'rhetorical_question'],
  视频脚本: ['lead_with_scene', 'rhetorical_question'],
  议论文: ['lead_with_scene', 'rhetorical_question'],
};

/** FNV-1a 哈希 → 种子，保证同输入同输出（可复现）。 */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 伪随机（确定性）。 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readStyleSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** 从 read-style 档案读高置信结构偏好 → 优先装置（无则 null）。 */
function preferredDevice(workspace) {
  const obj = readStyleSafe(path.join(workspace, 'vault', 'read-style.json'));
  const st = obj?.structure || {};
  const hint = (key) => {
    const d = st[key];
    return d && (d.confidence || 0) >= 0.6 ? String(d.value || '') : '';
  };
  const ending = hint('endingTaste');
  const opening = hint('openingTaste');
  if (/留白|不点破|余味|收一点/.test(ending)) return 'ellipsis_end';
  if (/反问|问题|未回答/.test(ending)) return 'rhetorical_question';
  if (/反转|意外|欧亨利/.test(ending)) return 'reversal';
  if (/画面|场景|细节|具体/.test(opening)) return 'lead_with_scene';
  return null;
}

/**
 * 为一篇文档决定结构装置与落点；不适用时返回 null。
 * 确定性：同一 workspace+文体+总节数 → 同一装置与落点。
 */
export function documentStructure(workspace, state, { total = 0, genre = '' } = {}) {
  const g = String(genre || '');
  if (isOfficialGenre(g) || STRUCTURE_FREE.has(g)) return null;
  if (total < 3) return null;

  const preferred = preferredDevice(workspace);
  const allowed = GENRE_DEFAULT_DEVICES[g] || ['lead_with_scene', 'flashback_aside', 'ellipsis_end'];
  const pool = preferred && DEVICES[preferred] ? [preferred] : allowed;

  const rng = mulberry32(hashSeed(`${workspace}|${g}|${total}`));
  const device = pool[Math.floor(rng() * pool.length)];
  const placement = DEVICES[device].placement;
  let atSection;
  if (placement === 'first') atSection = 0;
  else if (placement === 'last') atSection = total - 1;
  else atSection = 1 + Math.floor(rng() * Math.max(1, total - 2));

  return { device, atSection, brief: DEVICES[device].brief };
}

/** 给定节的注入文本；该节不是落点时返回空串。 */
export function structureBriefForSection(workspace, state, { index = 0, total = 0, genre = '' } = {}) {
  const d = documentStructure(workspace, state, { total, genre });
  if (!d || d.atSection !== index) return '';
  return `【本节结构装置】${d.brief}`;
}
