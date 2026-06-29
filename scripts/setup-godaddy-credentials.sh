#!/usr/bin/env bash
# Securely store GoDaddy API credentials locally (never commit these).
# Get production keys at https://developer.godaddy.com/keys

set -euo pipefail

CRED_FILE="${HOME}/.godaddy/credentials"

echo "GoDaddy API setup for withfocus.io"
echo "Create a Production key at: https://developer.godaddy.com/keys"
echo "(Not OTE/test — use Production for the live domain.)"
echo ""

read -r -p "API Key: " KEY
read -r -s -p "API Secret: " SECRET
echo ""

if [[ -z "${KEY}" || -z "${SECRET}" ]]; then
  echo "error: key and secret are required" >&2
  exit 1
fi

cat > "${CRED_FILE}" <<EOF
# GoDaddy API credentials - keep mode 600
GODADDY_KEY=${KEY}
GODADDY_SECRET=${SECRET}
GODADDY_ENV=prod
EOF
chmod 600 "${CRED_FILE}"

echo "Saved to ${CRED_FILE}"
echo "Verifying…"
godaddy auth-check
godaddy domains list
