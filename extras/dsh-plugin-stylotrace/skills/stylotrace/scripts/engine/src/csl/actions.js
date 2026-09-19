// CSLA ActionDispatcher + 独立 Executors（Fast–Deep Runtime 第二阶段）
// St → CandidateActions → Select(a) → Execute(a) → Observation → S_{t+1}
// 每个 executor 独立、只做自己的事（A1），返回统一结构；
// 动作价值 Q(a|S_t) = ExpectedGain + InfoGain + NoveltyGain − Cost − Risk − InteractionCost。
import { pickQuestion } from './elicit.js';
import { compare, counterexample as findCounterexample } from './reasoning.js';
import { buildContextBundle, selectOperators } from './operators.js';
import { buildSearchQueries, requestHostSearch } from '../rag.js';
import * as hrmr from './hrmr.js';

export const ACTION_LIBRARY = [
  'askHuman', 'memory', 'abstract', 'search', 'compare', 'counterexample',
  'induce', 'deduce', 'abduce', 'analogize', 'simulate', 'plan', 'verify',
  'generate', 'reflect', 'act', 'stop',
];

/** 动作价值（确定性启发式；taskComplete 时 stop 价值最高）。 */
export function actionValue(a, jt = {}) {
  const core = String(jt.coreIdea || '').trim();
  const h = jt.hypotheses || [];
  const e = jt.evidence || [];
  const ready = Boolean(core) && h.length > 0 && e.length > 0;
  const taskComplete = Boolean(jt.taskComplete);
  const expected = {
    askHuman: !core ? 1.4 : 0.2,
    // Phase 3A：带关系观察且尚未入记忆 → memory 优先（Observation→Relation→Memory）
    memory: core && jt.relations?.length && !(jt.memoryRefs || []).length ? 1.3 : 0.05,
    abstract: core && !h.length ? 1.2 : 0.1,
    search: core && h.length && !e.length ? 1.2 : 0.1,
    // 关系 + 记忆已就绪且未比较 → compare 可选中（golden 管线显式驱动完整链）；
    // 价值保持 0.7，不得压过 generate（避免 compare 死循环，Q 值退化回归）
    compare: h.length >= 2 || (jt.relations?.length && (jt.memoryRefs || []).length && !jt.compared) ? 0.7 : 0.1,
    counterexample: core && h.length && ((jt.uncertainty || 0) >= 0.6 || (jt.relations?.length && (jt.memoryRefs || []).length && !jt.challenged)) ? 0.8 : 0.1,
    induce: h.length >= 2 && e.length ? 0.6 : 0.1,
    deduce: h.length ? 0.4 : 0.1,
    abduce: h.length ? 0.4 : 0.1,
    analogize: core ? 0.3 : 0.1,
    simulate: ready ? 0.4 : 0,
    plan: ready ? 0.3 : 0,
    verify: e.length ? 0.4 : 0,
    // 完成加成：状态就绪时 generate 是终结性产出动作，价值必须压过中间算子（真实 token 实测：
    // 未加成时 compare=0.49 > generate=0.24，循环永远比较、永不产出）
    generate: ready && !taskComplete ? 1.6 : 0,
    reflect: 0.1,
    act: ready && !taskComplete ? 0.5 : 0,
    stop: taskComplete ? 0.95 : 0.05,
  }[a] || 0.1;
  const cost = { askHuman: 0.3, memory: 0.2, search: 0.6, generate: 0.7, simulate: 0.8, plan: 0.4, verify: 0.4, abstract: 0.3, compare: 0.2, counterexample: 0.3, induce: 0.2, act: 0.5 }[a] || 0.2;
  const risk = a === 'act' || a === 'generate' ? 0.4 : 0.1;
  const interactionCost = a === 'askHuman' ? 0.5 : 0;
  return Number((1.0 * expected - 0.8 * cost - 0.5 * risk - 0.4 * interactionCost).toFixed(3));
}

/** 选择动作：A = A_system ∪ A_LLM(proposed)，按 Q 值选最大。 */
export function selectAction(jt, { allow = null, proposed = null, policyWeights = null } = {}) {
  const allowed = new Set(allow || ACTION_LIBRARY);
  if (proposed && proposed.action) allowed.add(proposed.action);
  let best = null;
  let bestV = -Infinity;
  for (const a of allowed) {
    let v = actionValue(a, jt);
    // Phase 2：政策证据（credit 学习）真实调整动作价值——Q_new = Q_old + policyWeights[a]
    if (policyWeights && typeof policyWeights[a] === 'number') v += policyWeights[a];
    if (proposed && a === proposed.action) v += Number(proposed.expectedGain || 0);
    if (v > bestV) {
      bestV = v;
      best = a;
    }
  }
  return { action: best, value: Number(bestV.toFixed(3)) };
}

async function runLLMCandidates(jt, llm, mode) {
  const ops = selectOperators(mode || 'creative');
  const out = [];
  const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0, calls: 0, latencyMs: 0 };
  for (const op of ops) {
    const bundle = buildContextBundle(jt, op);
    if (llm) {
      if (typeof llm.run === 'function') {
        // 统一算子接口：ContextRouter 已按 operator 裁剪上下文，只传本算子需要的字段
        const r = await llm.run({
          operator: op,
          input: JSON.stringify(bundle.state),
          context: `你的角色：${bundle.role}`,
        });
        out.push(String(r.output || '').trim());
        usage.input_tokens += r.usage?.input_tokens || 0;
        usage.output_tokens += r.usage?.output_tokens || 0;
        usage.total_tokens += r.usage?.total_tokens || 0;
        usage.calls += 1;
        usage.latencyMs += r.latencyMs || 0;
      } else {
        const text = String(await llm([{ role: 'user', content: `${bundle.role}\n${JSON.stringify(bundle.state)}` }])).trim();
        out.push(text);
        usage.calls += 1;
      }
    } else {
      out.push(`[${op}] 基于「${jt.coreIdea || ''}」的候选展开`);
    }
  }
  return { outputs: out, usage };
}

/**
 * 独立 executor（A1：只执行被选中的动作）。统一返回：
 * { action, result, stateDelta, events, needsHuman, nextActions }
 */
export async function dispatch(action, jt, ctx = {}) {
  const { llm, mode } = ctx;
  const base = { action, result: {}, stateDelta: {}, events: [], needsHuman: false, nextActions: [] };
  switch (action) {
    case 'askHuman': {
      const q = pickQuestion(jt);
      return {
        ...base,
        needsHuman: true,
        result: { question: q?.question || '', type: q?.type || '' },
        events: [{ event_type: 'cognitive.elicit' }],
      };
    }
    case 'memory': {
      // Phase 3A：Observation → Relation（bind）→ Encode（addEpisode）→ Retrieve（memoryRefs）
      // Module → State：relations/memoryRefs/retrievedMemories 进入 stateDelta，驱动后续 compare/abstract。
      if (ctx.workspace) {
        const relations = hrmr.bind(jt.observation || jt.coreIdea || '');
        if (relations.length) {
          hrmr.addEpisode(ctx.workspace, { text: jt.observation || jt.coreIdea || '', outcome: 1, goal: jt.goal || '' });
        }
        const subject = relations[0]?.subject || '';
        const retrieved = subject ? hrmr.retrieve(ctx.workspace, subject, { max: 4 }) : [];
        const memoryRefs = retrieved.map((r) => ({
          id: r.id,
          kind: r.kind,
          level: r.level,
          confidence: r.confidence,
          relationText: r.relationText,
        }));
        return {
          ...base,
          result: { relations, retrieved },
          stateDelta: { relations, memoryRefs, retrievedMemories: retrieved, observation: jt.observation || jt.coreIdea || '' },
          events: [{ event_type: 'memory' }],
        };
      }
      return { ...base, result: { note: 'memory（无工作区，离线跳过）' }, stateDelta: { relations: jt.relations || [] }, events: [{ event_type: 'memory' }] };
    }
    case 'abstract': {
      const { outputs: candidates, usage } = await runLLMCandidates(jt, llm, mode);
      const hypotheses = candidates.map((c, i) => ({ id: `h${i + 1}`, claim: c.slice(0, 60), evidence: [] }));
      // Phase 3A：泛化受记忆约束（Memory → ChangedReasoning）——schema 候选并入状态
      const schemaCandidate = ctx.workspace
        ? hrmr.retrieve(ctx.workspace, jt.relations?.[0]?.subject || '', { max: 5 }).find((i) => i.kind === 'schema') || null
        : null;
      return {
        ...base,
        result: { candidates, hypotheses, schemaCandidate },
        stateDelta: { candidates, hypotheses, schemaCandidate },
        events: [{ event_type: 'abstract' }],
        usage,
      };
    }
    case 'search': {
      // P0 修复（Reality Audit）：search 必须真实执行——生成查询并排队宿主代检；
      // 证据标记 queued/pending（不伪造"已查到事实"）。无 workspace（单元测试/离线）→ 确定性 fallback。
      const topic = String(jt.coreIdea || jt.goal || (jt.hypotheses || [])[0]?.claim || '').slice(0, 80);
      let evidence;
      if (ctx.workspace) {
        const queries = buildSearchQueries(topic, { topic, limit: 4 });
        const q = requestHostSearch(ctx.workspace, queries, { purpose: 'csl-search' });
        evidence = q.queued
          ? [{ source: 'search_queued', requestId: q.requestId, queries, pending: true, at: Date.now() }]
          : [{ source: 'search_none', note: '未生成查询（确定性）', pending: true }];
      } else {
        evidence = [{ source: 'search_offline', note: '无工作区（离线/单元测试），未排队检索', pending: true }];
      }
      return { ...base, result: { evidence }, stateDelta: { evidence }, events: [{ event_type: 'search' }] };
    }
    case 'compare': {
      const h = jt.hypotheses || [];
      let cmp = null;
      const stateDelta = {};
      if (h.length >= 2) {
        cmp = compare(h[0]?.claim, h[1]?.claim);
        stateDelta.comparison = cmp;
      } else if (jt.relations?.length && (jt.retrievedMemories || []).length && !jt.compared) {
        // Phase 3A：新关系 vs 检索到的记忆关系 → 结构化比较 + 精化主张（Reasoning → ChangedHypothesis）
        const rel = jt.relations[0];
        const ref = jt.retrievedMemories[0];
        cmp = compare(`${rel.subject}${rel.verb}${rel.object}`, ref.relationText || '');
        const refined = `关系比较（${rel.subject}${rel.verb}${rel.object} vs ${ref.relationText || '记忆'}）→ ${cmp.relationalDifference}`;
        stateDelta.comparison = cmp;
        stateDelta.compared = true;
        // Reasoning → ChangedHypothesis：精化主张真实进入循环状态（hypotheses 数组）
        stateDelta.hypotheses = [...(jt.hypotheses || []), refined];
      }
      return { ...base, result: { comparison: cmp }, stateDelta, events: [{ event_type: 'compare' }] };
    }
    case 'counterexample': {
      const ce = findCounterexample(jt.hypotheses?.[0]?.claim || '');
      const stateDelta = {};
      if (ce) {
        stateDelta.counterexamples = [ce.counter];
        stateDelta.exceptions = (jt.exceptions || 0) + 1;
        // Phase 3A：反例 → HRME schema 精化（Counterexample → Refinement）
        if (ctx.workspace) {
          const challenged = hrmr.challengeSchema(ctx.workspace, jt.hypotheses?.[0]?.claim || jt.coreIdea || '', ce.counter);
          stateDelta.schemaRefined = Boolean(challenged);
        }
      } else {
        stateDelta.evidence = [...(jt.evidence || []), '未找到反例'];
      }
      return { ...base, result: { counterexample: ce }, stateDelta, events: [{ event_type: 'counterexample' }] };
    }
    case 'generate': {
      const artifact = (jt.hypotheses || []).map((h) => h.claim).join('。') || jt.coreIdea || '';
      return { ...base, result: { artifact }, stateDelta: { artifact, taskComplete: true }, events: [{ event_type: 'generate' }] };
    }
    case 'native_reasoning': {
      // Native Model Escape（A5）：LLM 认为内置算子不适配时，允许原生推理
      if (llm) {
        const r =
          typeof llm.run === 'function'
            ? await llm.run({ operator: 'native_reasoning', input: JSON.stringify(jt), context: '原生推理（CSLA 让位）' })
            : { output: await llm([{ role: 'user', content: `原生推理（CSLA 让位）:\n${JSON.stringify(jt)}` }]) };
        const text = String(r.output || '').trim();
        return {
          ...base,
          action,
          result: { text },
          stateDelta: { nativeResult: text },
          events: [{ event_type: 'native_reasoning' }],
          usage: r.usage
            ? { input_tokens: r.usage.input_tokens || 0, output_tokens: r.usage.output_tokens || 0, total_tokens: r.usage.total_tokens || 0, calls: 1, latencyMs: r.latencyMs || 0 }
            : { calls: 1 },
        };
      }
      return { ...base, action, result: { text: '（无 LLM）native_reasoning 占位' }, stateDelta: { nativeResult: 'placeholder' }, events: [{ event_type: 'native_reasoning' }] };
    }
    case 'induce':
    case 'deduce':
    case 'abduce':
    case 'analogize':
    case 'simulate':
    case 'plan':
    case 'verify':
    case 'reflect':
    case 'act':
      return { ...base, result: { note: `${action} 执行（确定性占位）` }, stateDelta: { lastOp: action }, events: [{ event_type: action }] };
    case 'stop':
    default:
      return { ...base, action: 'stop' };
  }
}

/** 认知动作循环（A3 重规划）：每步 select→dispatch→合并 stateDelta，直到 stop/taskComplete/maxSteps。 */
export async function runCognitiveLoop(jt, ctx = {}, { maxSteps = 6 } = {}) {
  let current = { ...jt };
  const trace = [];
  const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0, calls: 0, latencyMs: 0 };
  for (let i = 0; i < maxSteps; i++) {
    const chosen = selectAction(current, { proposed: ctx.proposed, policyWeights: ctx.policyWeights || null });
    const step = await dispatch(chosen.action, current, ctx);
    const u = step.usage;
    if (u) {
      usage.input_tokens += u.input_tokens || 0;
      usage.output_tokens += u.output_tokens || 0;
      usage.total_tokens += u.total_tokens || 0;
      usage.calls += u.calls || 0;
      usage.latencyMs += u.latencyMs || 0;
    }
    trace.push({ action: chosen.action, value: chosen.value, needsHuman: step.needsHuman, usage: u || null });
    // 早返回也要带上已累计的 usage——否则在 askHuman 之前跑过的那些调用，
    // 它们的 token/延迟统计会被调用方整段丢掉（OpenCodeReview 审出来的）。
    if (step.needsHuman) return { trace, current, stop: false, needsHuman: true, step, usage };
    current = { ...current, ...step.stateDelta };
    if (chosen.action === 'stop' || current.taskComplete) {
      break;
    }
  }
  return { trace, current, stop: true, needsHuman: false, usage };
}
