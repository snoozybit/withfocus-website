#!/usr/bin/env bash
# Configure GoDaddy DNS for Zoho Mail on withfocus.io
#
# BEFORE running this script:
#   1. Sign up: https://www.zoho.com/mail/zohomail-pricing.html (Forever Free)
#   2. Add domain withfocus.io in Zoho Admin Console
#   3. Prefer GoDaddy "one-click" verify in Zoho if offered (Domain Connect)
#   4. If manual verify: copy the TXT or CNAME from Zoho and run:
#        ZOHO_VERIFY='zoho-verification=zb....zmverify.zoho.com' bash scripts/setup-zoho-email.sh verify
#   5. Create mailbox lit@withfocus.io in Zoho
#   6. Copy SPF + DKIM from Zoho Admin → Email Configuration, then run:
#        bash scripts/setup-zoho-email.sh mail
#
# Usage:
#   bash scripts/setup-zoho-email.sh verify   # domain ownership TXT only
#   bash scripts/setup-zoho-email.sh mail       # MX + SPF + DKIM + DMARC
#   bash scripts/setup-zoho-email.sh status     # show current email DNS

set -euo pipefail

DOMAIN="${DOMAIN:-withfocus.io}"
# Use "eu" if you signed up at mail.zoho.eu, otherwise "com"
ZOHO_REGION="${ZOHO_REGION:-eu}"

if [[ "${ZOHO_REGION}" == "eu" ]]; then
  MX1="mx.zoho.eu"
  MX2="mx2.zoho.eu"
  MX3="mx3.zoho.eu"
  SPF='v=spf1 include:zohomail.eu ~all'
else
  MX1="mx.zoho.com"
  MX2="mx2.zoho.com"
  MX3="mx3.zoho.com"
  SPF='v=spf1 include:zohomail.com ~all'
fi

DMARC='v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:lit@withfocus.io;'

require_godaddy() {
  if ! command -v godaddy >/dev/null 2>&1; then
    echo "error: godaddy CLI not found" >&2
    exit 1
  fi
  godaddy auth-check >/dev/null
}

put_mx() {
  local body
  body=$(python3 -c 'import json,sys; print(json.dumps([
    {"data": sys.argv[1], "priority": 10, "ttl": 3600},
    {"data": sys.argv[2], "priority": 20, "ttl": 3600},
    {"data": sys.argv[3], "priority": 50, "ttl": 3600},
  ]))' "$MX1" "$MX2" "$MX3")
  godaddy raw PUT "/v1/domains/${DOMAIN}/records/MX/@" --data "${body}"
}

cmd_verify() {
  require_godaddy
  if [[ -z "${ZOHO_VERIFY:-}" ]]; then
    echo "Paste the verification string from Zoho Admin Console (Domains → withfocus.io → TXT method)."
    echo "Example: zoho-verification=zb12345678.zmverify.zoho.eu"
    read -r -p "ZOHO_VERIFY: " ZOHO_VERIFY
  fi
  if [[ -z "${ZOHO_VERIFY}" ]]; then
    echo "error: ZOHO_VERIFY is required" >&2
    exit 1
  fi
  echo "Adding Zoho domain verification TXT…"
  godaddy dns add "${DOMAIN}" TXT @ "${ZOHO_VERIFY}" --ttl 600
  echo "Done. Wait 5–15 min, then click Verify in Zoho Admin Console."
}

cmd_mail() {
  require_godaddy
  echo "Setting MX records (${MX1}, ${MX2}, ${MX3})…"
  put_mx
  echo "OK"

  echo "Setting SPF…"
  godaddy dns add "${DOMAIN}" TXT @ "${SPF}" --ttl 3600
  echo "OK"

  if [[ -n "${ZOHO_DKIM_HOST:-}" && -n "${ZOHO_DKIM_VALUE:-}" ]]; then
    echo "Setting DKIM (${ZOHO_DKIM_HOST})…"
    godaddy dns add "${DOMAIN}" TXT "${ZOHO_DKIM_HOST}" "${ZOHO_DKIM_VALUE}" --ttl 3600
    echo "OK"
  else
    echo ""
    echo "DKIM not configured (optional env vars missing)."
    echo "In Zoho: Admin Console → Domains → withfocus.io → Email Configuration → DKIM"
    echo "Then re-run:"
    echo "  ZOHO_DKIM_HOST='zmail._domainkey' ZOHO_DKIM_VALUE='v=DKIM1; ...' bash scripts/setup-zoho-email.sh mail"
    echo ""
  fi

  echo "Updating DMARC…"
  godaddy dns set "${DOMAIN}" TXT _dmarc "${DMARC}" --ttl 3600
  echo "OK"

  echo ""
  echo "Email DNS configured for ${DOMAIN}"
  echo "Verify each record in Zoho Admin Console → Email Configuration."
  echo "Then sign in at https://mail.zoho.${ZOHO_REGION}/ with lit@${DOMAIN}"
}

cmd_status() {
  require_godaddy
  echo "MX:"
  godaddy dns get "${DOMAIN}" MX @ 2>/dev/null || echo "  (none)"
  echo ""
  echo "TXT (@ and _dmarc):"
  godaddy dns list "${DOMAIN}" TXT 2>/dev/null || true
}

case "${1:-help}" in
  verify) cmd_verify ;;
  mail)   cmd_mail ;;
  status) cmd_status ;;
  *)
    echo "Usage: bash scripts/setup-zoho-email.sh {verify|mail|status}"
    exit 1
    ;;
esac
