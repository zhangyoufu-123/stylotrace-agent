// 具体性/情感特征测试（备忘录 §2.1 / §2.3 的候选级实现）。
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ws = await import(path.join(HERE, '..', 'src', 'workspace.js'));
const { specificityFeature, emotionFeature, FEATURES } = await import(
  path.join(HERE, '..', 'src', 'modulator.js')
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stylotrace-signal-'));
const w = ws.ensureWorkspace(path.join(tmp, 'w'), { create: true });

// 1. 具体性：具体文本 > 抽象文本
const concrete = '老家后院那棵歪脖子的槐树，春天开白花，落一地。2023年有 5 万人参与。他说：“这件事必须改”。';
const abstract = '风景让人回忆起发展过程中的种种问题与情况，生活的意义与价值，本质与氛围。';
const sc = specificityFeature(w, concrete);
const sa = specificityFeature(w, abstract);
assert.ok(sc > sa, `具体 ${sc} 应大于抽象 ${sa}`);
assert.ok(sc > 0.5);

// 2. 空文本/中性文本不爆炸
assert.equal(specificityFeature(w, ''), 0.5);

// 3. 情感：克制画像下，情感密度高的文本被压低
const writeStyle = {
  schemaVersion: '1.0',
  style: 'write',
  dimensions: {
    emotionalSpectrum: { value: '克制、内敛、不煽情', confidence: 0.8, evidence: ['测试'] },
  },
};
ws.writeJson(path.join(w, 'vault', 'write-style.json'), writeStyle);
const emoText = '我哭了出来，心碎了，绝望到颤抖，愤怒地呐喊，悲痛欲绝，孤独无助，委屈又难过。';
const calmText = '他站在门口，看了很久，没说话。';
const er = emotionFeature(w, emoText);
const ec = emotionFeature(w, calmText);
assert.ok(er < 0.35, `克制画像下高情感密度应压低（${er}）`);
assert.ok(ec > er, `克制画像下平静文本应更高（${ec} vs ${er}）`);

// 4. 外露画像：情感密度高加分
const writeStyle2 = {
  schemaVersion: '1.0',
  style: 'write',
  dimensions: {
    emotionalSpectrum: { value: '外露、强烈、抒情', confidence: 0.8, evidence: ['测试'] },
  },
};
ws.writeJson(path.join(w, 'vault', 'write-style.json'), writeStyle2);
assert.ok(emotionFeature(w, emoText) > 0.5);

// 5. 新特征已注册
assert.ok(FEATURES.includes('specificity'));
assert.ok(FEATURES.includes('emotion'));

console.log('PASS 具体性/情感评分特征（方向/画像/注册）');
