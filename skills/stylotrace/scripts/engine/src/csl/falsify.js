// 可证伪演示模式（PRISM 创新点五）：系统主动"攻击自己"，并把结果当场亮出来。
// 不是宣称"我们能拦住违规"，而是现场注入违规 → 看它是否真的被拦住。
// 八项攻击全部在临时工作区运行，不污染真实项目。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ws from '../workspace.js';
import * as st from './state.js';
import { canWrite } from './canonical.js';
import * as dc from './decision.js';
import * as fl from './failure.js';
import * as dd from './dual-diff.js';
import { runCognitiveLoop, dispatch } from './actions.js';

function tmpWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-falsify-'));
  return ws.ensureWorkspace(path.join(dir, 'w'), { create: true });
}

function withCore(w, coreIdea = '门槛是记忆的承重') {
  st.commit(w, { delta: { coreIdea }, event: { eventType: 'core_idea.set' } });
  return w;
}

function withOutline(w, heading = '一') {
  const ps = ws.readState(w);
  ps.confirmed = { ...(ps.confirmed || {}), topic: '门槛', genre: '散文' };
  ps.outline = { title: '门槛', sections: [{ heading, function: '引入', thesis: '门槛', words: 30, keyPoints: [] }] };
  ws.writeState(w, ps);
  return w;
}

/** 只有大纲、没有主题/核心（连写什么都未定）。 */
function withOutlineOnly(w, heading = '一') {
  const ps = ws.readState(w);
  ps.outline = { title: '', sections: [{ heading, function: '引入', thesis: '', words: 30, keyPoints: [] }] };
  ws.writeState(w, ps);
  return w;
}

/** 有话题但没有主张（话题 ≠ 核心想法）。 */
function withTopicOnly(w) {
  const ps = ws.readState(w);
  ps.confirmed = { ...(ps.confirmed || {}), topic: '门槛', genre: '散文' };
  ws.writeState(w, ps);
  return w;
}

const A = (name, injection, expectation, observed, pass, evidence = '') => ({ name, injection, expectation, observed, pass, evidence });

/**
 * 跑完整证伪电池。返回 {attacks, passed, total, allPass, generatedAt}。
 */
export async function runFalsification() {
  const attacks = [];

  // 1) 完全无方向：写作门必须 BLOCK
  {
    const w = tmpWorkspace(); withOutlineOnly(w);
    const gate = canWrite(w);
    attacks.push(A(
      '写作门：连主题都没有时不许写',
      '新会话直接要求写作（无主题、无核心）',
      'blocked = true · reason = missing_core_idea',
      `blocked=${gate.blocked} · reason=${gate.reason} · next=${gate.nextAction}`,
      gate.blocked === true && gate.reason === 'missing_core_idea',
    ));
    // 1b) 有主题但没表达主张 → 必须拦（"先问清楚你到底想说什么"）
    const w2 = tmpWorkspace(); withTopicOnly(w2);
    const gate2 = canWrite(w2);
    attacks.push(A(
      '写作门：只有话题、没有主张时不许写',
      '给了"写关于门槛的散文"，但没说想表达什么',
      'blocked = true（话题 ≠ 核心主张）',
      `blocked=${gate2.blocked} · reason=${gate2.reason}`,
      gate2.blocked === true,
    ));
    // 1c) 对照：确认核心后可写（不能什么都拦）
    const w3 = withOutline(tmpWorkspace());
    withCore(w3);
    const gate3 = canWrite(w3);
    attacks.push(A(
      '写作门对照：确认核心后应放行',
      '提供 coreIdea 后再写',
      'blocked = false',
      `blocked=${gate3.blocked} · warn=${gate3.warn || '无'}`,
      gate3.blocked === false,
    ));
  }

  // 2) 冻结句被"润色"：逐字校验必须报违规
  {
    const w = tmpWorkspace();
    const span = '门槛不是阻隔，是记忆的承重';
    dc.addDecision(w, { object: '门槛', comparisonSet: '乡愁散文', spanText: span });
    const tampered = '门槛不再是阻隔，而成了记忆的载体。';
    const r = dc.verifyFrozen(w, tampered);
    attacks.push(A(
      '冻结保护：AI 改写作者决断句',
      '把冻结句改写成"更通顺"的版本',
      'ok = false · 报出 1 处违规',
      `ok=${r.ok} · violations=${r.violations.length}`,
      r.ok === false && r.violations.length === 1,
      r.violations[0]?.reason || '',
    ));
    // 对照：原样保留应通过（避免"什么都拦"的假阳性）
    const keep = dc.verifyFrozen(w, `院子里的门槛矮了一截。${span}，它记得每一双脚。`);
    attacks.push(A(
      '冻结保护对照：原样保留应通过',
      '成稿中原文保留冻结句',
      'ok = true（不能误拦）',
      `ok=${keep.ok}`,
      keep.ok === true,
    ));
  }

  // 3) 缺比较集：决断卡必须拒绝（论纲 §8.5）
  {
    const made = dc.createDecisionCard({ object: '门槛', spanText: '门槛不是阻隔' });
    attacks.push(A(
      '决断卡：没有比较集就不算创新',
      '只填"对象 + 句子"，不声明比较集',
      'ok = false · reason = missing_comparison_set',
      `ok=${made.ok} · reason=${made.reason}`,
      made.ok === false && made.reason === 'missing_comparison_set',
    ));
  }

  // 4) 注入 AI 套话：失败分类法必须命中 ai_artifact
  {
    const r = fl.classifyFailure({ text: '首先，我们必须认识到这个问题的重要性。其次，我们要重视它。综上所述，这是一个重要的趋势。' });
    attacks.push(A(
      'AI 套话注入：必须被识别为 ai_artifact',
      '注入"首先/其次/综上所述"模板腔',
      'findings 含 ai_artifact',
      `findings=${JSON.stringify(r.findings)}`,
      r.findings.includes('ai_artifact'),
    ));
  }

  // 5) 立场强度偷偷升级：必须命中 overclaim
  {
    const r = fl.classifyFailure({
      coreIdea: '我怀疑 AI 会让人越来越不会思考',
      text: '研究表明，AI 必然导致人类思维能力下降，这一点已经证明无疑。',
    });
    attacks.push(A(
      '过度断言：弱判断被写成定论',
      '把"我怀疑"改写成"研究表明……必然……已证明"',
      'failureType = overclaim',
      `failureType=${r.failureType}`,
      r.failureType === 'overclaim',
    ));
  }

  // 6) 连续删 AI 内容：必须触发反锁死（拒绝继续服务）
  {
    const w = tmpWorkspace();
    dc.addDecision(w, { object: '门槛', comparisonSet: '乡愁散文', spanText: '门槛不是阻隔，是记忆的承重' });
    const g = dc.lockInGuard(w, { draftText: '门槛不是阻隔，是记忆的承重。', aiRejectedStreak: 3 });
    attacks.push(A(
      '反锁死：连续删除 AI 内容后拒绝服务',
      '模拟用户连续 3 次删掉 AI 写的内容',
      'refuse = true 且给出建议',
      `refuse=${g.refuse} · reason=${g.reason.slice(0, 40)}`,
      g.refuse === true && g.advice.length > 0,
    ));
  }

  // 7) 停止语义：stop 之后不得再有任何 LLM 调用
  {
    const w = tmpWorkspace();
    let calls = 0;
    const counting = async () => { calls += 1; return 'mock'; };
    const loop = await runCognitiveLoop(
      { coreIdea: 'x', hypotheses: ['h'], evidence: ['e'], taskComplete: true },
      { llm: counting },
      { maxSteps: 3 },
    );
    const last = loop.trace[loop.trace.length - 1]?.action;
    attacks.push(A(
      '停止语义：stop 之后零 LLM 调用',
      '任务已完成状态再跑动作循环',
      'trace 只含 stop · calls = 0',
      `last=${last} · calls=${calls} · steps=${loop.trace.length}`,
      last === 'stop' && calls === 0,
    ));
  }

  // 8) 风格层改写守卫：改事实必须被拒，纯改说法必须放行
  {
    const before = '数据显示 2024 年有 22% 的用户放弃了写作。';
    const tamper = '数据显示 2024 年有 37% 的用户放弃了写作。';
    const restyle = '数据显示，2024 年有 22% 的用户，放弃了写作。';
    const gBad = dd.styleOnlyGuard(before, tamper);
    const gOk = dd.styleOnlyGuard(before, restyle);
    attacks.push(A(
      '双色 diff：改数字必须被拒（事实层锁定）',
      '把 22% 改成 37%',
      'ok = false（判为事实层改动）',
      `ok=${gBad.ok} · verdict=${gBad.verdict}`,
      gBad.ok === false,
    ));
    attacks.push(A(
      '双色 diff：只改标点应放行（风格层）',
      '只调整标点/断句，不动数字',
      'ok = true · verdict = style_only',
      `ok=${gOk.ok} · verdict=${gOk.verdict}`,
      gOk.ok === true && gOk.verdict === 'style_only',
    ));
  }

  const passed = attacks.filter((a) => a.pass).length;
  return { attacks, passed, total: attacks.length, allPass: passed === attacks.length, generatedAt: ws.nowIso() };
}

/** 人类的可读报告（CLI/Web 共用）。 */
export function renderFalsification(r) {
  const lines = [
    `证伪电池：${r.passed}/${r.total} 通过${r.allPass ? ' ✅ 全部被拦住' : ' ⚠ 有未拦住项'}`,
    '',
  ];
  for (const a of r.attacks) {
    lines.push(`${a.pass ? '✓' : '✗'} ${a.name}`);
    lines.push(`    注入：${a.injection}`);
    lines.push(`    期望：${a.expectation}`);
    lines.push(`    实测：${a.observed}`);
    if (a.evidence) lines.push(`    证据：${a.evidence}`);
  }
  return lines.join('\n');
}
