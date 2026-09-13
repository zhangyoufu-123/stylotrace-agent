// 可证伪演示 + 双色 diff 验收：
// 证伪电池必须全部通过（拦不住的项就是系统 bug）；双色 diff 必须把"改事实"和"改说法"分开。
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const F = await import(path.join(HERE, '..', 'src', 'csl', 'falsify.js'));
const D = await import(path.join(HERE, '..', 'src', 'csl', 'dual-diff.js'));

// 1) 证伪电池：全部拦住
const r = await F.runFalsification();
assert.ok(r.total >= 10, `证伪项应 ≥10（实际 ${r.total}）`);
assert.equal(r.allPass, true, `证伪电池必须全过，未过项：${r.attacks.filter((a) => !a.pass).map((a) => a.name).join('、')}`);
for (const a of r.attacks) {
  assert.ok(a.name && a.injection && a.expectation && a.observed !== undefined, `每项都要有 注入/期望/实测：${a.name}`);
}

// 2) 报告可读
const text = F.renderFalsification(r);
assert.ok(text.includes(`${r.passed}/${r.total}`), '报告应含通过数');
assert.ok(text.includes('注入'), '报告应含注入说明');

// 3) 双色 diff：只改说法（标点/断句）→ style_only，事实层零改动
const styleOnly = D.dualDiff('数据显示 2024 年有 22% 的用户放弃了写作。', '数据显示，2024 年有 22% 的用户，放弃了写作。');
assert.equal(styleOnly.verdict, 'style_only', `只改标点应判 style_only（实际 ${styleOnly.verdict}）`);
assert.equal(styleOnly.stats.factChanges, 0);
assert.equal(D.styleOnlyGuard('数据 22%', '数据，22%。').ok, true, '纯风格改写应放行');

// 4) 双色 diff：改数字 → 事实层（最危险的一类误改）
const numChange = D.dualDiff('数据显示 2024 年有 22% 的用户放弃了写作。', '数据显示 2024 年有 37% 的用户放弃了写作。');
assert.ok(numChange.stats.factChanges >= 1, `改数字必须判事实层：${JSON.stringify(numChange.stats)}`);
assert.equal(D.styleOnlyGuard('数据显示 2024 年有 22% 的用户放弃了写作。', '数据显示 2024 年有 37% 的用户放弃了写作。').ok, false, '改数字必须被拒');
assert.ok(numChange.changes[0].evidence.includes('number_changed'), '证据里要写明是数字变了');

// 5) 双色 diff：否定极性翻转（是→不是）→ 事实层
const polarity = D.dualDiff('门槛是阻隔。', '门槛不是阻隔。');
assert.ok(polarity.stats.factChanges >= 1, '否定翻转必须判事实层');

// 6) 双色 diff：立场强度升级（可能→必然）→ 事实层
const modal = D.dualDiff('这可能导致问题。', '这必然导致问题。');
assert.ok(modal.stats.factChanges >= 1, '可能→必然必须判事实层（过度断言）');

// 7) 完全相同 → identical
const same = D.dualDiff('一模一样。', '一模一样。');
assert.equal(same.verdict, 'identical');
assert.equal(same.stats.total, 0);

console.log(`PASS csl-falsify（证伪电池 ${r.passed}/${r.total} 全过 + 双色 diff 事实/风格分离）`);

// 9) 会话一致性回归（人机交互模拟发现）：recordFeedback 必须读该会话的状态，
//    否则假设为空 → 反事实归因全 0（等于没归因）
{
  const fs = await import('node:fs');
  const os = await import('node:os');
  const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
  const st = await import(path.join(HERE, '..', 'src', 'csl', 'state.js'));
  const rt = await import(path.join(HERE, '..', 'src', 'csl', 'runtime.js'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-fb-session-'));
  const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });
  st.commit(w, { delta: { coreIdea: '先想后写' }, event: { eventType: 'core_idea.set' }, sessionId: 'S' });
  st.commit(w, { delta: { addHypothesis: '写作第一步是想' }, event: { eventType: 'hypothesis.add' }, sessionId: 'S' });
  const fb = rt.recordFeedback(w, { value: 0.3, sessionId: 'S', source: 'user-correct' });
  const ops = fb.credit.credits.find((c) => c.target === 'operators');
  assert.ok(ops.delta < 0, `跨会话反馈必须能归因（operators 应 <0，实际 ${ops.delta}）`);
}
