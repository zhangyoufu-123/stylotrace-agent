#!/usr/bin/env bash
# 一键公网演示：本地起 Web 工作台 + cloudflared 隧道，输出可给评委的访问链接。
# 用法: bash scripts/demo-tunnel.sh
#   密码默认 stylotrace2026（可用 STYLOTRACE_WEB_PASSWORD 覆盖）
#   端口默认 5177（可用 PORT 覆盖）
# 说明: 链接在脚本运行期间有效（关掉终端即失效）；正式提交建议用 Render/Zeabur 常驻部署。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-5177}"
PASS="${STYLOTRACE_WEB_PASSWORD:-stylotrace2026}"
DATA="${STYLOTRACE_WEB_DATA:-$ROOT/web-data-demo}"

# cloudflared 可能只在 homebrew 目录里，不在非登录 shell 的 PATH 中 → 显式查找
find_cf() {
  if [ -n "${CLOUDFLARED_BIN:-}" ] && [ -x "${CLOUDFLARED_BIN}" ]; then echo "${CLOUDFLARED_BIN}"; return; fi
  for cand in \
    "$(command -v cloudflared 2>/dev/null || true)" \
    /opt/homebrew/bin/cloudflared \
    /usr/local/bin/cloudflared; do
    [ -n "$cand" ] && [ -x "$cand" ] && { echo "$cand"; return; }
  done
}
CF_BIN="$(find_cf || true)"

# node 检查（给出可执行的修复建议，而不是静默失败）
if ! command -v node >/dev/null 2>&1; then
  for cand in ~/.homebrew/bin/node /opt/homebrew/bin/node /usr/local/bin/node; do
    [ -x "$cand" ] && export PATH="$(dirname "$cand"):$PATH" && break
  done
fi
if ! command -v node >/dev/null 2>&1; then
  echo "✗ 找不到 node（需要 Node 18+）。装一个再跑：brew install node" >&2
  exit 1
fi

# 端口占用 → 自动换端口，避免"打不开"
port_busy() { curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$1/health"; }
if port_busy "$PORT"; then
  echo "⚠ 端口 $PORT 已有服务在跑（可能是上一次没关干净）"
  PORT=$((PORT + 1))
  while port_busy "$PORT"; do PORT=$((PORT + 1)); done
  echo "  → 改用端口 $PORT"
fi

mkdir -p "$DATA"

# ── 清理上次没关干净、指向"没人监听的端口"的隧道 ──
# 这种残留隧道最坏：链接还在、点开必然 502，用户完全不知道发生了什么。
# 只杀"目标端口确实没有服务"的那几个，正在用的隧道不动。
cleanup_dead_tunnels() {
  # 注意：本脚本开了 set -euo pipefail，而"没找到匹配"时 pgrep 返回 1，
  # 直接接管道会把整条管道判成失败、脚本静默退出（踩过一次）。
  # 所以先单独取结果并吞掉非零退出码，再判断要不要处理。
  local found
  found="$(pgrep -fl "cloudflared tunnel --url http://127.0.0.1:" 2>/dev/null || true)"
  [ -n "$found" ] || return 0
  printf '%s\n' "$found" | while read -r line; do
    pid="${line%% *}"
    tport="$(printf '%s' "$line" | sed -n 's/.*127\.0\.0\.1:\([0-9]\+\).*/\1/p')"
    [ -n "$tport" ] || continue
    if [ "$tport" != "$PORT" ] && ! lsof -nP -iTCP:"$tport" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "  清理失效隧道 pid=$pid（端口 $tport 上没有服务，那个链接必然是 502）"
      kill "$pid" 2>/dev/null || true
    fi
  done
  return 0
}
echo "▶ 检查上次的残留 …"
cleanup_dead_tunnels
echo "  ✓ 无失效隧道占用"

echo "▶ 启动 Web 工作台（真实 LLM 模式，BYOK 或本机已发现密钥）…"
STYLOTRACE_WEB_DATA="$DATA" STYLOTRACE_WEB_PASSWORD="$PASS" PORT="$PORT" \
  node "$ROOT/web/server.mjs" > /tmp/stylotrace-web.log 2>&1 &
WEB_PID=$!

for _ in $(seq 1 20); do
  if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/health"; then break; fi
  sleep 1
done

if ! curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$PORT/health"; then
  echo "✗ Web 启动失败，日志：/tmp/stylotrace-web.log" >&2
  tail -20 /tmp/stylotrace-web.log >&2 || true
  kill "$WEB_PID" 2>/dev/null || true
  exit 1
fi
echo
echo "  ✅ 本地地址: http://127.0.0.1:$PORT"
echo "  🔑 访问密码: $PASS"
echo "  （浏览器打开上面地址 → 输入密码 → 即可使用）"

if [ -z "$CF_BIN" ]; then
  echo
  echo "⚠ 未找到 cloudflared → 只能本机用，没有公网链接。"
  echo "  修：brew install cloudflared （装完重跑本脚本）"
  echo "  或：直接用本地地址演示（评委看录屏同样有效）"
  wait "$WEB_PID"
  exit 0
fi

echo "▶ 建立公网隧道 …"
: > /tmp/cf-tunnel.log
# 协议默认用 http2 而不是 QUIC：云隧道的 QUIC 走 UDP，开着代理/VPN（clash、mihomo 之类）
# 的机器上 UDP 很容易被干扰，表现就是隧道"看着还在、点开 502"：
#   ERR failed to accept QUIC stream: timeout: no recent network activity
# http2 走 TCP，在这类网络下稳得多。想强制回 QUIC: CF_PROTOCOL=quic bash scripts/demo-tunnel.sh
CF_PROTO="${CF_PROTOCOL:-http2}"
"$CF_BIN" tunnel --url "http://127.0.0.1:$PORT" --no-autoupdate --protocol "$CF_PROTO" > /tmp/cf-tunnel.log 2>&1 &
CF_PID=$!

URL=""
for _ in $(seq 1 45); do
  # 注意：cloudflared 日志里也会出现 API 端点 https://api.trycloudflare.com，必须排除，否则会拿到错地址
  URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cf-tunnel.log 2>/dev/null | grep -v '^https://api\.trycloudflare\.com$' | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 2
done

if [ -n "$URL" ]; then
  # 打印链接前先自己验一次公网可达性——"链接给了但打不开"比没链接更糟。
  # 注意：quick tunnel 从建好到真正可访问通常要 20–60 秒，所以这里要等够，
  # 等太短会把"还没就绪"误报成"打不开"。
  HTTP_CODE=""
  for _ in $(seq 1 25); do
    HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 "$URL/health" 2>/dev/null || true)"
    [ "$HTTP_CODE" = "200" ] && break
    sleep 3
  done
  echo
  echo "  ✅ 公网链接（发给评委 / 录屏用）: $URL"
  echo "  🔑 密码: $PASS"
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✅ 公网自检通过（/health 返回 200），现在点开就能用"
  else
    echo "  ⚠ 本机这次没能自检通过（HTTP ${HTTP_CODE:-无响应}）。"
    echo "    这多半是本机代理/网络的问题，不代表链接坏了——请直接用浏览器点开上面链接确认一次。"
    echo "    若确实打不开：tail -20 /tmp/cf-tunnel.log，或直接用本地地址 http://127.0.0.1:$PORT"
  fi
else
  echo
  echo "⚠ 未能建立公网隧道（网络受限或被墙）；本地地址仍可用。"
  echo "  排查: cat /tmp/cf-tunnel.log | tail -20"
  echo "  备选: 用 Render/Zeabur 常驻部署（见 docs/competition/06-部署与访问链接说明.md）"
fi

echo
echo "──────────────────────────────────────────────"
echo " 现在请保持这个窗口打开！（关闭窗口 = 链接失效）"
echo " 结束演示：按 Ctrl+C"
echo "──────────────────────────────────────────────"
trap 'kill "$WEB_PID" "$CF_PID" 2>/dev/null || true' EXIT INT TERM

# ── 互相监督 ──
# 之前的写法是光 wait：Web 服务挂了、隧道还活着，链接照旧在，
# 点开只有一个 502，而且没有任何提示（用户就是这么被坑的）。
# 现在两边互相看着：谁先倒下，立刻收掉另一个并说清原因。
while :; do
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo
    echo "✗ 本地 Web 服务已退出 → 这个链接必然 502，已自动关闭隧道。"
    echo "  最后 20 行日志："
    tail -20 /tmp/stylotrace-web.log 2>/dev/null | sed 's/^/    /' || true
    echo "  重新开始：重跑 bash scripts/demo-tunnel.sh"
    kill "$CF_PID" 2>/dev/null || true
    exit 1
  fi
  if [ -n "$CF_PID" ] && ! kill -0 "$CF_PID" 2>/dev/null; then
    echo
    echo "⚠ 隧道已断开（本地服务仍在跑）。"
    echo "  本地仍可用: http://127.0.0.1:$PORT（密码 $PASS）"
    echo "  想重新要公网链接：Ctrl+C 后重跑本脚本。"
    exit 0
  fi
  sleep 2
done
