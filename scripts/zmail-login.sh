#!/usr/bin/env bash
# One-time Zoho Mail CLI login (browser OAuth). Run before setup-email-cli.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAR="${ROOT}/tools/zmail-cli.jar"
DC="${ZOHO_DC:-zoho.eu}"

if [[ ! -f "${JAR}" ]]; then
  bash "${ROOT}/scripts/install-zmail-cli.sh"
fi

echo "Zoho Mail CLI login (${DC})"
echo ""
echo "1. First launch may ask for an encryption password (stores tokens locally)."
echo "2. A browser URL will appear — log in and accept permissions."
echo ""

if [[ -n "${ZMAIL_CLI_PASSWORD:-}" ]]; then
  exec java -jar "${JAR}" -p="${ZMAIL_CLI_PASSWORD}" login --dc "${DC}"
fi

exec java -jar "${JAR}" login --dc "${DC}"
