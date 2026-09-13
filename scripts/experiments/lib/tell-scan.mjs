// 实验脚本用的 tell 检测器：实现已移到 agent/src/ai-tells.js，这里只做转发，
// 保证"实验里量产出的尺子"和"产品里给用户的诊断"永远是同一份代码，不会各自漂移。
export { TELLS, tellScan, renderTellReport, deAiDirective, detectOneLineCloser, detectRepeatedOpenings, detectHeadingEcho } from '../../../agent/src/ai-tells.js';
