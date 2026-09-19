#!/usr/bin/env bash
# 把当前仓库同步到**公开**代码仓库（zhangyoufu-123/stylotrace-agent）。
#
# 为什么要有这个脚本：之前是手工 rsync + 手工脱敏，靠人记得住。
# 漏一次就是把论文推到公开仓库——这种事不该交给记性。
# 所以这里把三件事固化成流程，并在推送前做守卫检查：
#   1) 只同步代码：排除论文/竞赛材料/凭据/演示数据/打包产物
#   2) 脱敏：把本机绝对路径换成 ~（不泄漏用户名与目录结构）
#   3) 守卫：推送前扫描敏感文件与残留绝对路径，命中就**中止**
#
# 用法:
#   bash scripts/publish-public.sh            # 同步并推送
#   bash scripts/publish-public.sh --dry-run  # 只检查不推送
set -euo pipefail

PUBLIC_REPO="${PUBLIC_REPO:-zhangyoufu-123/stylotrace-agent}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

echo "▶ 同步 $SRC → github.com/$PUBLIC_REPO"

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

git clone -q "https://github.com/${PUBLIC_REPO}.git" "$TMP/pub"

# ── 1) 只搬代码 ──
rsync -a --delete \
  --exclude '.git' \
  --exclude 'docs/competition' \
  --exclude 'docs/论文' \
  --exclude 'docs/legacy' \
  --exclude 'docs/experiments' \
  --exclude '.codex' \
  --exclude '.env' --exclude '.env.*' \
  --exclude 'web-data' --exclude 'web-data-demo' \
  --exclude 'node_modules' \
  --exclude '.stylotrace' \
  --exclude '*.tgz' --exclude '*.zip' \
  --exclude '*.log' \
  "$SRC/" "$TMP/pub/"

# ── 2) 脱敏：本机绝对路径 → ~ ──
node -e '
const fs=require("fs"),path=require("path");
const root=process.argv[1];
let n=0;
(function walk(d){
  for(const e of fs.readdirSync(d,{withFileTypes:true})){
    const p=path.join(d,e.name);
    if(e.name===".git")continue;
    if(e.isDirectory()){walk(p);continue;}
    let s;try{s=fs.readFileSync(p,"utf8");}catch{continue;}
    if(!s.includes("/Users/")&&!s.includes("/home/"))continue;
    const before=s;
    s=s.replace(/\/(?:Users|home)\/[^\/\s"'"'"'`)]+/g,(m)=>m.replace(/^\/(?:Users|home)\/[^\/]+/,"~"));
    if(s!==before){fs.writeFileSync(p,s);n++;}
  }
})(root);
console.log(`  脱敏 ${n} 个文件`);
' "$TMP/pub"

# ── 3) 守卫：推送前必须干净 ──
echo "▶ 推送前守卫检查"
FAIL=0

BAD_FILES="$(find "$TMP/pub" -path "$TMP/pub/.git" -prune -o \
  \( -iname "*论文*" -o -iname "*competition*" -o -iname "*提交包*" -o -name "*.env*" -o -name "*.key" -o -name "*.pem" \) -print 2>/dev/null || true)"
if [ -n "$BAD_FILES" ]; then
  echo "  ✗ 发现不该公开的文件："; echo "$BAD_FILES" | sed 's/^/    /'; FAIL=1
else
  echo "  ✓ 无论文/竞赛材料/凭据"
fi

if grep -rIl --exclude-dir=.git -E "sk-[A-Za-z0-9]{20,}|npm_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}" "$TMP/pub" >/dev/null 2>&1; then
  echo "  ✗ 疑似密钥："; grep -rIl --exclude-dir=.git -E "sk-[A-Za-z0-9]{20,}|npm_[A-Za-z0-9]{20,}" "$TMP/pub" | sed 's/^/    /'; FAIL=1
else
  echo "  ✓ 无密钥"
fi

LEAK="$(grep -rIl --exclude-dir=.git -E "~~" "$TMP/pub" 2>/dev/null || true)"
if [ -n "$LEAK" ]; then
  echo "  ✗ 仍有本机绝对路径："; echo "$LEAK" | sed 's/^/    /'; FAIL=1
else
  echo "  ✓ 无本机绝对路径（用户名未泄漏）"
fi

if [ "$FAIL" -eq 1 ]; then
  echo; echo "中止：守卫检查未通过，**没有推送任何东西**。"
  exit 1
fi

cd "$TMP/pub"
git add -A
if git diff --cached --quiet; then
  echo "▶ 公开仓库已是最新，无需提交"
  exit 0
fi

if [ "$DRY" -eq 1 ]; then
  echo "▶ dry-run：以下文件会被更新（未推送）"
  git diff --cached --stat | tail -20
  exit 0
fi

git -c user.email="zhangyoufu-123@users.noreply.github.com" -c user.name="zhangyoufu-123" \
  commit -q -m "sync: 从主仓库同步（自动脱敏 + 守卫检查）"
git push -q origin HEAD:main
echo "✅ 已推送到 https://github.com/$PUBLIC_REPO"
git log --oneline -1
