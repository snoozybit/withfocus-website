#!/usr/bin/env bash
# Full CLI setup for lit@withfocus.io — Zoho Mail + GoDaddy DNS
#
# Prerequisites (one-time):
#   1. Zoho Mail Forever Free org: https://www.zoho.com/mail/zohomail-pricing.html
#   2. GoDaddy credentials in ~/.godaddy/credentials
#   3. Zoho CLI login: bash scripts/zmail-login.sh
#
# Usage:
#   LIT_EMAIL_PASSWORD='your-password' bash scripts/setup-email-cli.sh
#
# Optional env:
#   ZOHO_DC=zoho.eu          (default; use zoho.com for US)
#   ZMAIL_CLI_PASSWORD=...   (encryption password if you set one on the jar)
#   DOMAIN=withfocus.io
#   MAILBOX=lit@withfocus.io

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAR="${ROOT}/tools/zmail-cli.jar"
DC="${ZOHO_DC:-zoho.eu}"
DOMAIN="${DOMAIN:-withfocus.io}"
MAILBOX="${MAILBOX:-lit@${DOMAIN}}"
LOCAL_PART="${MAILBOX%%@*}"
FIRST_NAME="${FIRST_NAME:-Lit}"
LAST_NAME="${LAST_NAME:-Nankani}"

region="${DC#zoho.}"
if [[ "${region}" == "eu" ]]; then
  MX1="mx.zoho.eu"; MX2="mx2.zoho.eu"; MX3="mx3.zoho.eu"
  SPF='v=spf1 include:zohomail.eu ~all'
else
  MX1="mx.zoho.com"; MX2="mx2.zoho.com"; MX3="mx3.zoho.com"
  SPF='v=spf1 include:zohomail.com ~all'
fi
DMARC="v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:${MAILBOX};"

die() { echo "error: $*" >&2; exit 1; }

require_tools() {
  command -v godaddy >/dev/null || die "godaddy CLI missing (see focus-website/scripts/setup-godaddy-dns.sh)"
  command -v python3 >/dev/null || die "python3 required"
  [[ -f "${JAR}" ]] || bash "${ROOT}/scripts/install-zmail-cli.sh"
  godaddy auth-check >/dev/null || die "GoDaddy auth failed — check ~/.godaddy/credentials"
}

zmail() {
  local args=()
  if [[ -n "${ZMAIL_CLI_PASSWORD:-}" ]]; then
    args=(-p="${ZMAIL_CLI_PASSWORD}")
  fi
  java -jar "${JAR}" "${args[@]}" "$@" -f=JSON --dc="${DC}" 2>&1
}

zmail_has_auth() {
  local out
  out="$(java -jar "${JAR}" ${ZMAIL_CLI_PASSWORD:+-p="${ZMAIL_CLI_PASSWORD}"} auth list 2>&1 || true)"
  echo "${out}" | grep -q "${DC}" || echo "${out}" | grep -qE '[0-9]{6,}'
}

json_find() {
  python3 -c '
import json, re, sys
raw = sys.stdin.read()
for line in raw.splitlines():
    line = line.strip()
    if not line.startswith("{") and not line.startswith("["):
        continue
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        continue
    text = json.dumps(data)
    m = re.search(r"zoho-verification=[^\"\\]+", text)
    if m:
        print(m.group(0))
        sys.exit(0)
    for key in ("txtRecord", "verificationCode", "cnameRecord", "domainVerification"):
        if key in text and "zoho" in text.lower():
            print(text)
            sys.exit(0)
sys.exit(1)
' <<< "$1"
}

find_dkim_from_domain_json() {
  python3 -c '
import json, re, sys
raw = sys.stdin.read()
for line in raw.splitlines():
    line = line.strip()
    if not line.startswith("{"):
        continue
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        continue

    def walk(obj):
        if isinstance(obj, dict):
            host = obj.get("selector") or obj.get("host") or obj.get("txtName")
            val = obj.get("txtValue") or obj.get("value") or obj.get("publicKey")
            if host and val and "domainkey" in str(host).lower():
                print(f"{host}\t{val}")
                return True
            if isinstance(val, str) and val.startswith("v=DKIM1"):
                host = obj.get("selector", "zmail._domainkey")
                print(f"{host}\t{val}")
                return True
            for v in obj.values():
                if walk(v):
                    return True
        elif isinstance(obj, list):
            for item in obj:
                if walk(item):
                    return True
        return False
    if walk(data):
        sys.exit(0)
sys.exit(1)
' <<< "$1"
}

put_godaddy_mx() {
  local body
  body=$(python3 -c 'import json,sys; print(json.dumps([
    {"data": sys.argv[1], "priority": 10, "ttl": 3600},
    {"data": sys.argv[2], "priority": 20, "ttl": 3600},
    {"data": sys.argv[3], "priority": 50, "ttl": 3600},
  ]))' "$MX1" "$MX2" "$MX3")
  godaddy raw PUT "/v1/domains/${DOMAIN}/records/MX/@" --data "${body}"
}

wait_for_dns() {
  echo "Waiting 30s for DNS propagation…"
  sleep 30
}

require_tools

if ! zmail_has_auth; then
  die "Zoho CLI not logged in. Run: bash ${ROOT}/scripts/zmail-login.sh"
fi

[[ -n "${LIT_EMAIL_PASSWORD:-}" ]] || die "Set LIT_EMAIL_PASSWORD for the new mailbox"

echo "==> Adding domain ${DOMAIN} to Zoho (skip if already added)…"
zmail domainManagement addDomain --domainName="${DOMAIN}" || true

echo "==> Fetching domain verification TXT from Zoho…"
domain_json="$(zmail domainManagement fetchSpecificDomain --domainname="${DOMAIN}")"
verify_txt="$(json_find "${domain_json}" || true)"
if [[ -z "${verify_txt}" ]]; then
  echo "${domain_json}"
  die "Could not find zoho-verification TXT in Zoho response. Is the domain already verified?"
fi
echo "   ${verify_txt}"

echo "==> Adding verification TXT via GoDaddy…"
if godaddy dns list "${DOMAIN}" TXT @ 2>/dev/null | grep -q "zoho-verification"; then
  echo "   (verification TXT already present)"
else
  godaddy dns add "${DOMAIN}" TXT @ "${verify_txt}" --ttl 600
fi

wait_for_dns

echo "==> Verifying domain in Zoho…"
zmail domainManagement verifyDomainByTXT --domainname="${DOMAIN}"

echo "==> Enabling mail hosting…"
zmail domainManagement enableMailHosting --domainname="${DOMAIN}" || true

echo "==> Creating DKIM key in Zoho…"
zmail domainManagement addDkimDetail --domainname="${DOMAIN}" --selector=zmail --keySize=2048 --isDefault || true

domain_json="$(zmail domainManagement fetchSpecificDomain --domainname="${DOMAIN}")"
dkim_line="$(find_dkim_from_domain_json "${domain_json}" || true)"
ZOHO_DKIM_HOST=""; ZOHO_DKIM_VALUE=""
if [[ -n "${dkim_line}" ]]; then
  ZOHO_DKIM_HOST="$(echo "${dkim_line}" | cut -f1)"
  ZOHO_DKIM_VALUE="$(echo "${dkim_line}" | cut -f2-)"
  echo "   DKIM host: ${ZOHO_DKIM_HOST}"
fi

echo "==> Configuring GoDaddy DNS (MX, SPF, DKIM, DMARC)…"
put_godaddy_mx
if ! godaddy dns list "${DOMAIN}" TXT @ 2>/dev/null | grep -q "v=spf1"; then
  godaddy dns add "${DOMAIN}" TXT @ "${SPF}" --ttl 3600
fi
if [[ -n "${ZOHO_DKIM_HOST}" && -n "${ZOHO_DKIM_VALUE}" ]]; then
  if ! godaddy dns list "${DOMAIN}" TXT "${ZOHO_DKIM_HOST}" 2>/dev/null | grep -q "DKIM1"; then
    godaddy dns add "${DOMAIN}" TXT "${ZOHO_DKIM_HOST}" "${ZOHO_DKIM_VALUE}" --ttl 3600
  fi
fi
godaddy dns set "${DOMAIN}" TXT _dmarc "${DMARC}" --ttl 3600

wait_for_dns

echo "==> Verifying MX / SPF / DKIM in Zoho…"
zmail domainManagement verifyMxRecord --domainname="${DOMAIN}" || true
zmail domainManagement verifySpfRecord --domainname="${DOMAIN}" || true
if [[ -n "${ZOHO_DKIM_HOST}" ]]; then
  zmail domainManagement verifyDkimKey --domainname="${DOMAIN}" || true
fi

echo "==> Creating mailbox ${MAILBOX}…"
zmail userManagement addUser \
  --primaryEmailAddress="${MAILBOX}" \
  --password="${LIT_EMAIL_PASSWORD}" \
  --firstName="${FIRST_NAME}" \
  --lastName="${LAST_NAME}" \
  --displayName="${FIRST_NAME}" \
  --role=super_admin \
  --country=gb \
  --language=En \
  --timeZone="Europe/London" \
  --oneTimePassword=false || echo "   (user may already exist)"

echo ""
echo "Done."
echo "  Webmail: https://mail.${DC}/"
echo "  Inbox:   ${MAILBOX}"
echo "  DNS:     bash ${ROOT}/scripts/setup-zoho-email.sh status"
