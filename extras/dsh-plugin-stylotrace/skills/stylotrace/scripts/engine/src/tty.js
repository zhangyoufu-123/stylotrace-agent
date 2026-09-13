// 交互模式的统一前置检查。
//
// 背景：MCP / 宿主 agent / 管道里没有 TTY，readline 会立刻关闭，
// 用户只看到一句 "readline was closed" 然后进程退出——对宿主就是"这工具不能用"。
// 之前是每个交互入口各写一遍，结果修了 agent 漏了 clarify/interview/credentials。
// 所以抽成一处，新加交互入口时直接复用。

/**
 * 没有可交互终端时，打印替代用法并返回 false（调用方据此直接 return）。
 * @param alternatives 替代命令说明（几行字符串）
 * @returns 是否可以继续走交互流程
 */
export function canPrompt(alternatives = '') {
  if (process.stdin.isTTY) return true;
  console.log(
    '这是交互模式，但当前没有可交互的终端（比如被 MCP / 宿主 agent / 管道调起）。\n' +
      (alternatives
        ? `请改用这些命令：\n${alternatives}`
        : '请改用对应的单步命令（--once）或 MCP 工具。'),
  );
  return false;
}
