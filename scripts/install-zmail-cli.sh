#!/usr/bin/env bash
# Download official Zoho Mail CLI (zmail-cli.jar)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAR="${ROOT}/tools/zmail-cli.jar"
URL="https://www.zoho.com/mail/3938191/ZMAIL_CLI/zmail-cli.jar"

if ! java -version >/dev/null 2>&1; then
  echo "error: Java 17+ required. Install: brew install openjdk" >&2
  exit 1
fi

mkdir -p "${ROOT}/tools"
echo "Downloading Zoho Mail CLI…"
curl -fsSL -o "${JAR}" "${URL}"
echo "Installed: ${JAR}"
echo "Next: bash ${ROOT}/scripts/zmail-login.sh"
