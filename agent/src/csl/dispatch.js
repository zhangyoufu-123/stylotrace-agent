// CSLA Application Dispatcher（v1.0）
//
// 为什么会有这个文件：`ACTION_APP_MAP` 从 Phase 3 起就声明了
// `executor: 'write' / 'outline' / 'rag' / 'redteam' / 'deliver' / 'chat'`，
// 但整个仓库没有任何调用点。结果是"统一入口"只在**认知层**统一：
// `runTask` 做完决策就把 `app` 当字符串返回，`stylotrace run` 打印一句
// `应用=write` 就结束，工作区里不产生任何草稿。CSLA 真正走到 `generate` 时，
// 产物是 `hypotheses.map(h => h.claim).join('。')`——字符串拼接，不调 LLM、不调 Writer。
//
// 本文件的职责：把那个映射真正执行掉。
//
// 语义（对应 S_t → Choose(a_t) → Execute(a_t) → Observation → S_{t+1}）：
//   **一次调用 = 一个决策 → 执行一个 executor。**
// 不在这里跑完整链（澄清→大纲→写→审计→交付）：那会绕过 Human Checkpoint，
// 并且违反预算硬约束（§9 要求每次模型调用前检查并预留预算）。调用方循环推进。
//
// Failure cases：
//   F1 前置条件不满足（如没有大纲就写）→ 不抛异常，返回 executed=false + 缺什么 + 下一步动作；
//   F2 executor 未实现 → 明确返回 executor_not_implemented，不伪装成功；
//   F3 写作门拦截 / 反锁死拒绝 → 原样上报，不吞掉原因。
import fs from 'node:fs';
import path from 'node:path';
import * as ws from '../workspace.js';
import { readCanonical, canWrite } from './canonical.js';

/** executor 名 → 是否已接线。没接线的必须在报告里显示，不能沉默。 */
export const EXECUTOR_STATUS = Object.freeze({
  write: 'wired',
  outline: 'wired',
  deliver: 'wired',
  rag: 'not_implemented',
  redteam: 'not_implemented',
  clarify: 'handled_inline', // runTurn 已经产出问题，dispatcher 无需再执行
  checkpoint: 'handled_inline',
  chat: 'handled_inline',
});

function readDraft(workspace) {
  const f = path.join(workspace, 'draft.md');
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return '';
  }
}

/**
 * 写作 executor：把 Brief 约束下的一个章节真正写出来。
 * 前置：已有大纲（否则不知道写什么）+ canWrite 通过 + 反锁死未触发。
 * 每次只写一节：与 director 的推进语义一致，也让每次调用有界、可中断、可预算。
 */
async function executeWrite(workspace, { cfg = {}, sessionId = 'default', llm = null, maxSections = 1 } = {}) {
  const state = ws.readState(workspace);
  const sections = state.outline?.sections || [];
  if (!sections.length) {
    return {
      executed: false,
      reason: 'no_outline',
      missing: '大纲',
      nextAction: 'abstract',
      advice: '还没有大纲：先执行 outline 动作（对应 ACTION_APP_MAP 的 abstract → outline）。',
    };
  }

  const gate = canWrite(workspace, { sessionId });
  if (gate.blocked) {
    return { executed: false, reason: 'writer_gate', missing: gate.reason, nextAction: gate.nextAction || 'askHuman' };
  }

  const { writeSection } = await import('../write.js');
  // 从已写到的位置继续：已有 draft 的节数决定下一节（不重写用户已看过/改过的部分）
  const before = readDraft(workspace);
  const written = Number(state.director?.writeIndex || 0);
  const from = Math.min(written, sections.length - 1);
  const to = Math.min(from + Math.max(1, Number(maxSections) || 1) - 1, sections.length - 1);

  const results = [];
  for (let i = from; i <= to; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await writeSection(cfg, workspace, { index: i });
      results.push(r);
    } catch (err) {
      if (!results.length) {
        return { executed: false, reason: 'write_failed', missing: String(err.message || err), nextAction: 'askHuman' };
      }
      break;
    }
  }

  const after = readDraft(workspace);
  const st2 = ws.readState(workspace);
  st2.director = { ...(st2.director || {}), writeIndex: to + 1 };
  ws.writeState(workspace, st2);

  return {
    executed: true,
    artifact: after,
    artifactFile: path.join(workspace, 'draft.md'),
    sectionFrom: from,
    sectionTo: to,
    totalSections: sections.length,
    remaining: Math.max(0, sections.length - (to + 1)),
    wroteChars: after.length - before.length,
    reports: results.map((r) => ({ sections: r.sections, frozen: r.frozen, hint: r.hint || '' })),
    llmUsed: Boolean(llm),
  };
}

/**
 * 大纲 executor（`abstract` 动作 → app=research / executor=outline）。
 * 它是 write 的前置条件：没有大纲就没有"写什么"。素材门槛没过时如实上报缺什么，不硬撑。
 */
async function executeOutline(workspace, { cfg = {} } = {}) {
  const state = ws.readState(workspace);
  const existing = state.outline?.sections || [];
  if (existing.length) {
    return { executed: false, reason: 'already_has_outline', nextAction: 'generate', totalSections: existing.length };
  }
  const { generateOutline } = await import('../outline.js');
  try {
    const r = await generateOutline(cfg, workspace);
    const sections = r.outline?.sections || [];
    return {
      executed: true,
      sectionCount: sections.length,
      headings: sections.map((s) => s.heading).filter(Boolean),
    };
  } catch (err) {
    // 素材门槛未过是最常见的一种：这不是失败，是"还没轮到写"。
    return { executed: false, reason: 'outline_gate', missing: String(err.message || err), nextAction: 'askHuman' };
  }
}

/**
 * 交付 executor（`stop` 动作 → app=deliver）。
 * 不做任何 LLM 调用：交付是"确认产物完整并交出引用"，不是再写一遍。
 * 缺稿或还有没写的节，如实报出来——交付一个半成品而不说明，是这类工具最常见的失信方式。
 */
async function executeDeliver(workspace) {
  const draftPath = path.join(workspace, 'draft.md');
  if (!fs.existsSync(draftPath)) {
    return { executed: false, reason: 'no_draft', nextAction: 'generate', advice: '还没有成稿，先写作再交付。' };
  }
  const text = readDraft(workspace);
  const state = ws.readState(workspace);
  const sections = state.outline?.sections || [];
  const written = Number(state.director?.writeIndex || 0);
  const remaining = Math.max(0, sections.length - written);
  return {
    executed: true,
    artifact: text,
    artifactFile: draftPath,
    chars: text.length,
    totalSections: sections.length,
    remaining,
    complete: remaining === 0,
    message: remaining
      ? `已交付当前成稿，但还有 ${remaining} 节没写——这不是完整稿。`
      : '文章已交付。要修改请直接说（方向或具体哪一句）。',
    next: 'point-edit / restyle / redteam',
  };
}

const EXECUTORS = { write: executeWrite, outline: executeOutline, deliver: executeDeliver };

/**
 * 执行一个应用动作。永远不抛异常——失败以 `executed:false` + 原因返回，
 * 这样调用方（CLI/MCP/Web）能把"为什么没做"直接展示给用户。
 */
export async function dispatchApp(workspace, { app = 'chat', executor = '', cfg = {}, sessionId = 'default', llm = null, maxSections = 1 } = {}) {
  const name = executor || app;
  const status = EXECUTOR_STATUS[name] || 'unknown';
  if (status === 'handled_inline') return { executor: name, executed: false, reason: 'handled_inline' };
  if (status !== 'wired') {
    return { executor: name, executed: false, reason: 'executor_not_implemented', status };
  }
  try {
    const r = await EXECUTORS[name](workspace, { cfg, sessionId, llm, maxSections });
    return { executor: name, ...r };
  } catch (err) {
    return { executor: name, executed: false, reason: 'exception', missing: String(err.message || err) };
  }
}

/** 渲染执行结果（CLI/日志共用一份措辞）。 */
export function renderDispatch(d) {
  if (!d) return '';
  if (d.executed) {
    if (d.executor === 'outline') {
      return `已生成大纲：${d.sectionCount} 节\n  ${(d.headings || []).join(' / ')}`;
    }
    if (d.executor === 'deliver') {
      return `${d.message}（成稿 ${d.chars} 字，共 ${d.totalSections} 节）\n  ${d.artifactFile}`;
    }
    const lines = [`已写入 ${d.artifactFile}（第 ${d.sectionFrom + 1}–${d.sectionTo + 1} 节 / 共 ${d.totalSections} 节，${d.wroteChars} 字）`];
    if (d.remaining > 0) lines.push(`还剩 ${d.remaining} 节：再调用一次 runTask 继续`);
    else lines.push('全部章节已写完');
    return lines.join('\n');
  }
  const why = {
    no_outline: '还没有大纲，先做 outline',
    already_has_outline: '已有大纲，下一步是写作',
    outline_gate: `素材门槛未过：${d.missing}`,
    writer_gate: `写作门拦截：${d.missing}`,
    write_failed: `写作失败：${d.missing}`,
    executor_not_implemented: `executor「${d.executor}」尚未实现（不伪装成功）`,
    handled_inline: `executor「${d.executor}」由认知循环内联处理，无需派发`,
  }[d.reason] || d.reason;
  return `未执行：${why}`;
}
