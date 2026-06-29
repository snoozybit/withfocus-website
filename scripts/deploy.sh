#!/usr/bin/env bash
# Deploy focus-website to GitHub Pages and configure GoDaddy DNS for withfocus.io.
#
# Prerequisites:
#   1. Run: bash scripts/setup-godaddy-credentials.sh
#   2. gh auth login (already done if gh auth status works)
#
# Usage: bash scripts/deploy.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${GITHUB_REPO:-snoozybit/withfocus-website}"
BRANCH="${GITHUB_BRANCH:-main}"

cd "${ROOT}"

if ! gh auth status >/dev/null 2>&1; then
  echo "error: run 'gh auth login' first" >&2
  exit 1
fi

if [[ ! -d .git ]]; then
  git init -b "${BRANCH}"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  if gh repo view "${REPO}" >/dev/null 2>&1; then
    git remote add origin "https://github.com/${REPO}.git"
  else
    echo "Creating GitHub repo ${REPO}…"
    gh repo create "${REPO}" --public --source=. --remote=origin --push=false
  fi
fi

git add index.html assets/ CNAME scripts/ .gitignore
git diff --cached --quiet && echo "No file changes to commit." || git commit -m "Deploy Focus marketing site"

git push -u origin "${BRANCH}"

echo "Enabling GitHub Pages…"
gh api "repos/${REPO}/pages" \
  -X POST \
  -f "build_type=legacy" \
  -f "source[branch]=${BRANCH}" \
  -f "source[path]=/" \
  2>/dev/null || gh api "repos/${REPO}/pages" -X PUT -f "build_type=legacy" -f "source[branch]=${BRANCH}" -f "source[path]=/"

gh api "repos/${REPO}/pages" -X PUT -f "cname=withfocus.io" 2>/dev/null || true

echo ""
echo "GitHub Pages URL: https://${REPO%/*}.github.io/${REPO#*/}/"
echo "Custom domain target: https://withfocus.io (after DNS propagates)"
echo ""

if godaddy auth-check >/dev/null 2>&1; then
  bash "${ROOT}/scripts/setup-godaddy-dns.sh"
else
  echo "GoDaddy credentials not configured yet."
  echo "Run: bash scripts/setup-godaddy-credentials.sh"
  echo "Then: bash scripts/setup-godaddy-dns.sh"
fi
