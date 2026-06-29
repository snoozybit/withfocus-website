#!/usr/bin/env bash
# Point withfocus.io DNS at GitHub Pages via GoDaddy API.
# Requires ~/.godaddy/credentials (see scripts/setup-godaddy-credentials.sh)

set -euo pipefail

DOMAIN="${DOMAIN:-withfocus.io}"
GITHUB_USER="${GITHUB_USER:-snoozybit}"
WWW_CNAME="${WWW_CNAME:-${GITHUB_USER}.github.io}"

# GitHub Pages apex A records (https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
GITHUB_A=(
  "185.199.108.153"
  "185.199.109.153"
  "185.199.110.153"
  "185.199.111.153"
)

if ! command -v godaddy >/dev/null 2>&1; then
  echo "error: godaddy CLI not found. Run: curl -fsSL https://raw.githubusercontent.com/softorize/godaddy-cli/main/install.sh | bash" >&2
  exit 1
fi

echo "Checking GoDaddy credentials…"
godaddy auth-check

echo "Verifying domain ${DOMAIN} is in your GoDaddy account…"
godaddy domain get "${DOMAIN}" >/dev/null

echo "Setting apex A records for GitHub Pages…"
payload="["
for ip in "${GITHUB_A[@]}"; do
  if [[ "${payload}" != "[" ]]; then payload+=","; fi
  payload+='{"data":"'"${ip}"'","ttl":600}'
done
payload+="]"
godaddy raw PUT "/v1/domains/${DOMAIN}/records/A/@" \
  -H "Content-Type: application/json" \
  -d "${payload}"

echo "Setting www CNAME → ${WWW_CNAME}…"
godaddy dns set "${DOMAIN}" CNAME www "${WWW_CNAME}" --ttl 600

echo ""
echo "DNS updated for ${DOMAIN}"
echo "  @   → GitHub Pages (${GITHUB_A[*]})"
echo "  www → ${WWW_CNAME}"
echo ""
echo "Propagation usually takes 5–60 minutes."
