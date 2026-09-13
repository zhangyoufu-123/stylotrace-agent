// CSLA LLMOperatorPool + ContextRouter（v1.0）
// 不同 operator 看不同 Context Bundle（X_i = ContextRouter(S_t, m_i)），不把全部历史塞给每个 LLM。
// Failure cases：
//   F1 未知 operator → 回退默认 bundle（不崩溃）；
//   F2 上下文超预算 → 裁剪到预算内（太多上下文会让 LLM 变差）；
//   F3 同输入同输出（确定性路由）。

export const OPERATORS = {
  divergent: {
    role: '发散生成：从核心想法出发给出多种展开方向',
    fields: ['goal', 'coreIdea', 'questions', 'relations', 'memoryRefs'],
  },
  analyst: {
    role: '分析：拆解假设、找出结构与逻辑链',
    fields: ['coreIdea', 'hypotheses', 'evidence'],
  },
  skeptic: {
    role: '质疑：找反例、矛盾与最脆弱环节',
    fields: ['coreIdea', 'hypotheses', 'decisions'],
  },
  researcher: {
    role: '检索与证据：哪些事实/来源支撑或反驳',
    fields: ['coreIdea', 'hypotheses', 'evidence'],
  },
  structuralizer: {
    role: '结构编排：把选中内容组织成骨架',
    fields: ['goal', 'coreIdea', 'decisions', 'hypotheses'],
  },
  style: {
    role: '风格适配：按作者档案表达',
    fields: ['coreIdea'],
  },
};

function pickFields(state, fields) {
  const out = {};
  for (const f of fields) {
    if (state && state[f] !== undefined && state[f] !== '' && !(Array.isArray(state[f]) && !state[f].length)) {
      out[f] = state[f];
    }
  }
  return out;
}

function estimateSize(o) {
  return JSON.stringify(o).length;
}

/** 路由：按 operator 切上下文，超预算裁剪（F2）。 */
export function buildContextBundle(state, operator, { budget = 1200 } = {}) {
  const spec = OPERATORS[operator] || OPERATORS.divergent; // F1 回退
  const bundle = { role: spec.role, state: pickFields(state, spec.fields) };
  if (estimateSize(bundle) > budget) {
    // 裁剪：保留核心想法与目标，其余字段截断
    bundle.state = {
      goal: bundle.state.goal,
      coreIdea: String(bundle.state.coreIdea || '').slice(0, budget),
    };
  }
  bundle.operator = operator;
  return bundle;
}

/** 按任务类型选择默认算子集。 */
export function selectOperators(taskType = 'creative') {
  const map = {
    creative: ['divergent', 'analyst', 'skeptic'],
    research: ['researcher', 'analyst', 'skeptic'],
    structure: ['structuralizer', 'analyst'],
    style: ['style', 'structuralizer'],
  };
  return map[taskType] || map.creative;
}
