// 能力目录（功能全景）：把系统"真正存在、可演示"的能力列成一张表，并给出实时状态。
// 用途：CLI `stylotrace capabilities`、Web「功能全景」面板、MCP 自描述——三端同一份事实。
// 原则：只列有代码、有测试、能演示的；未实现的明确标注 status='planned'，不冒充已完成。
import fs from 'node:fs';
import path from 'node:path';
import * as st from './state.js';
import * as dc from './decision.js';
import * as br from './brief.js';

/** 每项：id / 名称 / 属于哪一层 / 入口（CLI·Web·API） / 状态 / 证据 */
export const CAPABILITIES = [
  {
    id: 'clarify',
    name: '需求澄清（先问后写）',
    layer: '交互层',
    entry: { cli: 'stylotrace agent / stylotrace run', web: '对话输入框', api: 'POST /api/step' },
    status: 'live',
    evidence: '提问策略按信息量/重复度/侵入度打分；csl-elicit 测试 F1–F3',
  },
  {
    id: 'question-policy',
    name: '问题选择策略 q*',
    layer: '交互层',
    entry: { cli: '（内部）', web: '追问卡片', api: 'POST /api/csl/turn' },
    status: 'live',
    evidence: 'IG − λCost − μIntrusion − ρRepetition；同一类型不重复问',
  },
  {
    id: 'fast-deep',
    name: 'Fast / Deep 门控',
    layer: '控制层',
    entry: { cli: 'stylotrace run --mode fast|deep', web: '认知状态卡', api: 'POST /api/csl/turn' },
    status: 'live',
    evidence: '闲聊不进深层（10 次闲聊 0 次深层调用）；复杂任务 ≥3 次',
  },
  {
    id: 'writer-gate',
    name: '写作门（无核心不许写）',
    layer: '控制层',
    entry: { cli: 'stylotrace write', web: '写作门徽章', api: 'POST /api/csl/state' },
    status: 'live',
    evidence: '两档门：无主题/无核心 → BLOCK；有话题无主张 → BLOCK；自证电池 3 项覆盖',
  },
  {
    id: 'decision-card',
    name: '决断卡（创新保护）',
    layer: '认知层',
    entry: { cli: '（Web/API 为主）', web: '🔒 我的决断面板', api: 'POST /api/csl/decision' },
    status: 'live',
    evidence: '8 字段；**比较集必填**；冻结句逐字校验（改写即报违规）；csl-decision 测试',
  },
  {
    id: 'prism',
    name: '棱镜三视图（原文/事实层/风格层）',
    layer: '认知层',
    entry: { cli: 'stylotrace prism "…" [--restyle]', web: '🔺 棱镜面板', api: 'POST /api/csl/prism' },
    status: 'live',
    evidence: '"只改说法"结果经双色 diff 自证事实层零改动；改数字/升模态 → 拒绝结果（csl-prism 测试）',
  },
  {
    id: 'cadence',
    name: 'CADENCE 节奏与气群（文本节奏 + 语音韵律同一份结构）',
    layer: '认知层',
    entry: {
      cli: 'stylotrace cadence "<文本>" [--ssml|--meter|--apply]',
      web: '🔊 节奏面板',
      api: 'POST /api/cadence',
    },
    status: 'live',
    evidence:
      '零 API 调用；把"读起来喘不过气"归因到**气群边界错位**并给可解释建议；应用拆分后 CV/边界错位机械复核（cadence-* 4 个测试文件，分句 14 / 统计 8 / 闭环 12 / 集成 5）',
  },
  {
    id: 'dual-diff',
    name: '双色 diff（事实层 vs 风格层）',
    layer: '验证层',
    entry: { cli: 'stylotrace prism', web: '棱镜结果徽章', api: 'POST /api/csl/dual-diff' },
    status: 'live',
    evidence: '数字/否定/模态变化 → 事实层；标点/连接词 → 风格层；verdict=style_only/fact_only',
  },
  {
    id: 'falsify',
    name: '可证伪演示（系统自证）',
    layer: '验证层',
    entry: { cli: 'stylotrace falsify', web: '自证 12 项按钮', api: 'GET /api/csl/falsify' },
    status: 'live',
    evidence: '12 项攻击全部被拦住；其中 2 项曾抓出真实缺陷（写作门虚设、数字漏判）',
  },
  {
    id: 'anti-lockin',
    name: '反锁死（AI 拒绝服务）',
    layer: '验证层',
    entry: { cli: 'stylotrace write', web: '（写作时触发）', api: '（内部守卫）' },
    status: 'live',
    evidence: '决断密度不足 / 连续删 AI 内容 → 拒绝继续生成并给出建议',
  },
  {
    id: 'outcome-credit',
    name: '结果与反事实归因',
    layer: '学习层',
    entry: { cli: '（内部）', web: '（由纠正触发）', api: '（内部）' },
    status: 'live',
    evidence: '预测 0.937 vs 实际 0.3 → 误差 0.637 → operators −0.06 / router −0.03（非均分）',
  },
  {
    id: 'style-learning',
    name: '改迹调制（从修改学风格）',
    layer: '学习层',
    entry: { cli: 'stylotrace point-edit / absorb', web: '批注修改', api: 'POST /api/point-edit' },
    status: 'live',
    evidence: '每一处亲手修改吸收为风格与决策信号；风格档案/向量/回避库',
  },
  {
    id: 'style-judge',
    name: '风格断定（写出来的像不像你）',
    layer: '验证层',
    entry: { cli: 'stylotrace style / review', web: '风格肖像 / 审计', api: 'POST /api/reroute' },
    status: 'live',
    evidence: '风格保真度评估 + 反 AI 腔审计（红队/校对/事实/原创）',
  },
  {
    id: 'memory',
    name: '记忆生命周期（HRME）',
    layer: '认知层',
    entry: { cli: 'stylotrace csl', web: '记忆计数', api: 'POST /api/csl/action' },
    status: 'live',
    evidence: '经历→关系→规律；反例降级（置信 1.0→0.14）；迁移到未见任务；红队 H1–H8',
  },
  {
    id: 'search',
    name: '认知检索（真实排队）',
    layer: '工具层',
    entry: { cli: 'stylotrace rag search', web: '（深层触发）', api: 'POST /api/csl/action' },
    status: 'live',
    evidence: '命中即排队宿主代检；证据标记 pending，不伪造"已查到"',
  },
  {
    id: 'cross-channel',
    name: '跨通道共享状态',
    layer: '集成层',
    entry: { cli: 'stylotrace run --session', web: '同一 sessionId', api: '/api/csl/*' },
    status: 'live',
    evidence: 'CLI/MCP/Skill/Web 同一 canonical state；canonical/契约测试',
  },
  {
    id: 'audit-trail',
    name: '可审计的 AI 使用记录',
    layer: '合规层',
    entry: { cli: 'stylotrace outcomes [--json]', web: '📋 状态面板 ⑦ 结果账本', api: 'GET /api/csl/panel' },
    status: 'live',
    evidence: '事件账本（状态面板）+ 结果账本（stylotrace outcomes / 状态面板 ⑦）+ 决断卡；三样都能读出来核查',
  },
  {
    id: 'sidecar',
    name: 'Sidecar 协议（小模型影响大模型输出）',
    layer: '集成层',
    entry: { cli: '—', web: '—', api: '—' },
    status: 'planned',
    evidence: 'PRISM 创新点二，尚未实现',
  },
  {
    id: 'longitudinal',
    name: '长期学习证明（越用越好）',
    layer: '学习层',
    entry: { cli: '—', web: '—', api: '—' },
    status: 'planned',
    evidence: '仅机制级证据（出错会改下次动作）；多次任务纵向实验未跑',
  },
];

/** 当前工作区的实时状态（用于面板显示"现在处于什么状态"）。 */
export function capabilityStatus(workspace, { sessionId = 'default' } = {}) {
  if (!workspace) return { live: CAPABILITIES.filter((c) => c.status === 'live').length, total: CAPABILITIES.length, session: null };
  const cs = st.readCanonicalState(workspace, { sessionId });
  const brief = br.readBrief(workspace);
  const decisions = dc.listDecisions(workspace);
  const eventFile = path.join(workspace, 'protocol', 'csl-canonical-events.jsonl');
  let events = 0;
  try {
    events = fs.readFileSync(eventFile, 'utf8').trim().split('\n').filter(Boolean).length;
  } catch {}
  return {
    live: CAPABILITIES.filter((c) => c.status === 'live').length,
    total: CAPABILITIES.length,
    session: {
      stateVersion: cs.stateVersion,
      coreIdea: cs.coreIdea || '',
      goal: cs.goal?.inferred || cs.goal?.confirmed || '',
      hypotheses: (cs.hypotheses || []).length,
      memoryRefs: (cs.memoryRefs || []).length,
      decisions: decisions.length,
      frozenSpans: decisions.filter((d) => d.frozen !== false).length,
      briefVersion: brief.briefVersion || 0,
      events,
    },
  };
}

/** 可读清单（CLI 用）。 */
export function renderCapabilities(status) {
  const L = [`功能全景：真实可用 ${status.live}/${status.total}`];
  for (const c of CAPABILITIES) {
    const mark = c.status === 'live' ? '✓' : '○';
    L.push(`${mark} [${c.layer}] ${c.name}`);
    L.push(`    CLI: ${c.entry.cli} ｜ Web: ${c.entry.web} ｜ API: ${c.entry.api}`);
    L.push(`    证据: ${c.evidence}`);
  }
  if (status.session) {
    const s = status.session;
    L.push('');
    L.push(`当前会话：状态 v${s.stateVersion} · 核心「${String(s.coreIdea).slice(0, 20) || '未确认'}」· 假设 ${s.hypotheses} · 记忆引用 ${s.memoryRefs} · 决断卡 ${s.decisions} · 事件 ${s.events}`);
  }
  return L.join('\n');
}
