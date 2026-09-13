// AI Writing Failure Taxonomy + AuthorQuality KPI 验收：
// 失败分类（Overclaim/IdeaDrift/AIArtifact/EvidenceError/DecisionDrift）→ FailureType → Credit → Policy 上下文；
// AuthorQuality 向量按任务加权。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));
const fl = await import(path.join(HERE, '..', 'src', 'csl', 'failure.js'));
const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));
const cr = await import(path.join(HERE, '..', 'src', 'csl', 'credit.js'));

// ── 分类 1：过度断言（立场强度偷偷升级）──
const overclaim = fl.classifyFailure({
  coreIdea: '我怀疑 AI 会让人越来越不会思考',
  text: '研究表明，AI 必然导致人类思维能力下降，这已经证明无疑。',
});
assert.equal(overclaim.failureType, 'overclaim', `应判 overclaim: ${overclaim.failureType}`);

// ── 分类 2：AI 套话/表演思考（复用 redteam/fake-thinking）──
const aiArt = fl.classifyFailure({
  text: '首先，我们必须认识到这个问题的重要性。其次，我们要重视它。综上所述，这是一个重要的趋势。',
});
assert.ok(aiArt.findings.includes('ai_artifact'), `应含 ai_artifact: ${aiArt.findings}`);

// ── 分类 3：观点偷换（IdeaIntegrity）──
const ideaDrift = fl.classifyFailure({
  coreIdea: '故乡的门槛被磨矮了，我想写它的沉默和倔强',
  text: 'AI 写作工具可以显著提升用户的工作效率，是未来办公的重要趋势。',
});
assert.ok(ideaDrift.findings.includes('idea_drift'), `应判 idea_drift: ${ideaDrift.findings}`);

// ── 分类 4：证据缺失（出现事实模式但无证据）──
const evErr = fl.classifyFailure({ text: '2024 年统计显示 30% 的用户……', evidence: [] });
assert.ok(evErr.findings.includes('evidence_error'), `应判 evidence_error: ${evErr.findings}`);

// ── 分类 5：用户方向纠正 → decision_drift ──
const decDrift = fl.classifyFailure({ text: '删掉这段', source: 'user-correct', outcomeValue: 0.3 });
assert.ok(decDrift.findings.includes('decision_drift'), `应判 decision_drift: ${decDrift.findings}`);

// ── 未命中 → unclassified ──
const plain = fl.classifyFailure({ text: '今天天气不错，出去走了走。' });
assert.equal(plain.failureType, 'unclassified');

// ── AuthorQuality KPI：任务加权 ──
const creativeQ = fl.evaluateAuthorQuality({ task: 'creative', dims: { novelty: 0.9, individuality: 0.85, evidence: 0.3 } });
assert.ok(creativeQ.weights.novelty > creativeQ.weights.evidence, '创意任务 novelty 权重应高于 evidence');
const academicQ = fl.evaluateAuthorQuality({ task: 'academic', dims: { evidence: 0.9, logic: 0.8 } });
assert.ok(academicQ.weights.evidence > academicQ.weights.novelty, '学术任务 evidence 权重应最高');
const missingDim = fl.evaluateAuthorQuality({ task: 'balanced', dims: { intent: 0.9 } });
assert.equal(missingDim.dimensions.factuality, 0.5, '缺省维度应中性 0.5');
assert.ok(creativeQ.overall > 0.5 && creativeQ.overall <= 1, `overall 应在 (0.5,1]: ${creativeQ.overall}`);

// ── FailureType → Credit → Policy：失败类型进入政策上下文（防跨类型污染）──
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-failure-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
rt.acceptAnswer(w, null, '门槛是记忆的承重');
st.commit(w, { delta: { addHypothesis: '门槛是记忆的承重' }, event: { eventType: 'hypothesis.seed' } });
const fb = rt.recordFeedback(w, { value: 0.3, sessionId: 's', source: 'user-correct' });
const evd = cr.readPolicyEvidence(w);
const keys = Object.keys(evd.items);
assert.ok(keys.some((k) => k.includes('decision_drift')), `政策证据键应含失败类型: ${keys[0]}`);
assert.ok(fb.credit.status === 'resolved');

console.log('PASS csl-failure（Overclaim/IdeaDrift/AIArtifact/EvidenceError/DecisionDrift 分类 + AuthorQuality 加权 + FailureType→Credit→Policy 上下文）');
