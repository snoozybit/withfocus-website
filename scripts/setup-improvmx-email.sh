#!/usr/bin/env bash
# Free email for withfocus.io via ImprovMX (forwarding to your personal inbox).
# No credit card. Receive is free; sending as lit@withfocus.io needs ImprovMX paid
# or Gmail "Send mail as" (see below).
#
# 1. Sign up: https://app.improvmx.com/signup
# 2. Add domain withfocus.io, create alias lit → your@gmail.com
# 3. Run: bash scripts/setup-improvmx-email.sh
#
# Usage:
#   bash scripts/setup-improvmx-email.sh          # apply DNS
#   bash scripts/setup-improvmx-email.sh status   # check DNS

set -euo pipefail

DOMAIN="${DOMAIN:-withfocus.io}"
FORWARD_TO="${FORWARD_TO:-lalitknankani@gmail.com}"

require_godaddy() {
  command -v godaddy >/dev/null || { echo "error: godaddy CLI not found" >&2; exit 1; }
  godaddy auth-check >/dev/null
}

put_mx() {
  local body
  body='[{"data":"mx1.improvmx.com","priority":10,"ttl":3600},{"data":"mx2.improvmx.com","priority":20,"ttl":3600}]'
  godaddy raw PUT "/v1/domains/${DOMAIN}/records/MX/@" --data "${body}"
}

cmd_apply() {
  require_godaddy
  echo "ImprovMX setup for ${DOMAIN}"
  echo ""
  echo "Before DNS: create account at https://app.improvmx.com"
  echo "  • Add domain: ${DOMAIN}"
  echo "  • Alias: lit → ${FORWARD_TO}"
  echo ""
  read -r -p "Done in ImprovMX dashboard? [y/N] " ok
  [[ "${ok,,}" == "y" ]] || { echo "Aborted — finish ImprovMX setup first."; exit 1; }

  echo "Setting MX → ImprovMX…"
  put_mx

  echo "Setting SPF…"
  if godaddy dns list "${DOMAIN}" TXT @ 2>/dev/null | grep -q "spf.improvmx.com"; then
    echo "  (SPF already set)"
  else
    godaddy dns add "${DOMAIN}" TXT @ "v=spf1 include:spf.improvmx.com ~all" --ttl 3600
  fi

  echo ""
  echo "DNS applied. ImprovMX usually activates within 5–30 minutes."
  echo "Mail to lit@${DOMAIN} will forward to ${FORWARD_TO}"
  echo ""
  echo "To SEND as lit@${DOMAIN} from Gmail (optional):"
  echo "  Gmail → Settings → Accounts → Send mail as → add lit@${DOMAIN}"
  echo "  (Outbound SMTP requires ImprovMX Premium, or use Cloudflare Email Routing instead)"
}

cmd_status() {
  require_godaddy
  echo "MX (@):"
  godaddy dns get "${DOMAIN}" MX @ 2>/dev/null || echo "  (none)"
  echo ""
  echo "TXT (@):"
  godaddy dns list "${DOMAIN}" TXT @ 2>/dev/null || true
}

case "${1:-apply}" in
  apply)  cmd_apply ;;
  status) cmd_status ;;
  *)
    echo "Usage: bash scripts/setup-improvmx-email.sh [apply|status]"
    exit 1
    ;;
esac
