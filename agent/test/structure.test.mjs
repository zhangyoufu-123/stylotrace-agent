// 结构调制测试：确定性、文体排除、短文不启用、落点唯一、注入文本正确。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const { documentStructure, structureBriefForSection } = await import(
  path.join(HERE, '..', 'src', 'structure.js')
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stylotrace-struct-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// 1. 确定性：同输入 → 同装置同落点
const a = documentStructure(w, {}, { total: 5, genre: '散文' });
const b = documentStructure(w, {}, { total: 5, genre: '散文' });
assert.deepEqual(a, b);
assert.ok(['lead_with_scene', 'flashback_aside', 'reversal', 'ellipsis_end', 'rhetorical_question'].includes(a.device));
assert.ok(a.atSection >= 0 && a.atSection < 5);
assert.ok(a.brief.length > 8);

// 2. 公式化文体不启用
assert.equal(documentStructure(w, {}, { total: 5, genre: '公文' }), null);
assert.equal(documentStructure(w, {}, { total: 5, genre: '合同' }), null);
assert.equal(documentStructure(w, {}, { total: 5, genre: '学术论文' }), null);
assert.equal(documentStructure(w, {}, { total: 5, genre: '通知' }), null);

// 3. 短文（<3 节）不启用
assert.equal(documentStructure(w, {}, { total: 2, genre: '散文' }), null);

// 4. 注入文本只出现在落点节
const d = documentStructure(w, {}, { total: 6, genre: '议论文' });
for (let i = 0; i < 6; i++) {
  const brief = structureBriefForSection(w, {}, { index: i, total: 6, genre: '议论文' });
  if (i === d.atSection) assert.ok(brief.includes('本节结构装置'));
  else assert.equal(brief, '');
}

// 5. 不同文体装置集合不同（散文可选池 ≠ 演讲稿可选池），但都合法
const p1 = documentStructure(w, {}, { total: 4, genre: '散文' });
const p2 = documentStructure(w, {}, { total: 4, genre: '演讲稿' });
assert.ok(p1 && p2);
assert.ok(p1.device !== 'rhetorical_question' || p2.device === 'rhetorical_question');

console.log('PASS 结构调制（确定性/文体排除/短文/落点/注入）');
