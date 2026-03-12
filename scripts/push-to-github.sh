#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "用法: GITHUB_TOKEN=... $0 <github_repo_url> [branch]"
  echo "示例: GITHUB_TOKEN=ghp_xxx $0 https://github.com/yourname/aupi.git main"
  exit 1
fi

REPO_URL="$1"
BRANCH="${2:-main}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "错误: 未设置 GITHUB_TOKEN 环境变量"
  echo "请先执行: export GITHUB_TOKEN=你的GitHub个人访问令牌"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "错误: 当前目录不是 Git 仓库"
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  CURRENT_BRANCH="$BRANCH"
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "检测到未提交改动，自动提交中..."
  git add .
  git commit -m "chore: auto-commit before GitHub push"
fi

if ! git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch -M "$BRANCH"
fi

AUTHED_URL="${REPO_URL/https:\/\//https://x-access-token:${GITHUB_TOKEN}@}"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$AUTHED_URL"
else
  git remote add origin "$AUTHED_URL"
fi

echo "推送到 GitHub..."
git push -u origin "$BRANCH"

# 清理，避免 token 留在 git remote
git remote set-url origin "$REPO_URL"

echo "✅ 推送完成：$REPO_URL ($BRANCH)"
