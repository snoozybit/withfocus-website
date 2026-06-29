#!/usr/bin/env bash
# Debug / fix withfocus.io on Zoho Mail EU via REST API (zmail-cli wrapper).
#
# One-time auth:
#   bash scripts/zmail-login.sh          # browser OAuth, pick zoho.eu
#
# Then:
#   bash scripts/zoho-mail-debug.sh          # show DNS + Zoho domain/user status
#   bash scripts/zoho-mail-debug.sh fix        # verify domain, MX, SPF, enable hosting, DKIM

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAR="${ROOT}/tools/zmail-cli.jar"
DC="${ZOHO_DC:-zoho.eu}"
DOMAIN="${DOMAIN:-withfocus.io}"
MAILBOX="${MAILBOX:-lit@${DOMAIN}}"

die() { echo "error: $*" >&2; exit 1; }

require_jar() {
  [[ -f "${JAR}" ]] || bash "${ROOT}/scripts/install-zmail-cli.sh"
}

zmail() {
  require_jar
  local args=()
  [[ -n "${ZMAIL_CLI_PASSWORD:-}" ]] && args=(-p="${ZMAIL_CLI_PASSWORD}")
  java -jar "${JAR}" "${args[@]}" "$@" --dc="${DC}" -f=JSON 2>&1
}

require_auth() {
  local auth
  auth="$(java -jar "${JAR}" auth list 2>&1 || true)"
  if ! echo "${auth}" | grep -qE '[0-9]{6,}'; then
    die "Zoho CLI not logged in. Run: bash ${ROOT}/scripts/zmail-login.sh"
  fi
}

print_dns() {
  echo "=== DNS (${DOMAIN}) ==="
  echo -n "MX:  "; dig +short "${DOMAIN}" MX | paste -sd ' ' -
  echo -n "TXT: "; dig +short "${DOMAIN}" TXT | paste -sd ' ' -
  echo -n "DKIM zmail._domainkey: "
  dig +short "zmail._domainkey.${DOMAIN}" TXT | head -1 || echo "(missing)"
  echo ""
}

parse_domain_status() {
  python3 - <<'PY'
import json, re, sys
raw = sys.stdin.read()
for line in raw.splitlines():
    line = line.strip()
    if not line.startswith("{"): continue
    try: data = json.loads(line)
    except json.JSONDecodeError: continue
    d = data.get("data", data)
    if isinstance(d, list) and d: d = d[0]
    if not isinstance(d, dict): continue
    keys = [
        "domainName", "domainVerificationStatus", "verified", "isVerified",
        "mxStatus", "spfStatus", "dkimStatus", "isMailHostingEnabled",
        "mailHostingEnabled", "primaryDomain", "cnameRecord", "txtRecord",
    ]
    found = {k: d.get(k) for k in keys if k in d}
    if found:
        print(json.dumps(found, indent=2))
        sys.exit(0)
    # walk nested
    text = json.dumps(d)
    for pat in ["mailHosting", "mxStatus", "verification", "verified", "dkim"]:
        if pat.lower() in text.lower():
            print(json.dumps(d, indent=2)[:4000])
            sys.exit(0)
print("Could not parse domain JSON. Raw output above.")
PY
}

cmd_debug() {
  print_dns
  require_auth

  echo "=== Zoho organization ==="
  zmail orgManagement getOrgDetails | python3 -m json.tool 2>/dev/null || zmail orgManagement getOrgDetails

  echo ""
  echo "=== Domain ${DOMAIN} ==="
  zmail domainManagement fetchSpecificDomain --domainname="${DOMAIN}" | tee /tmp/zoho-domain.json | parse_domain_status

  echo ""
  echo "=== Users ==="
  zmail userManagement fetchAllUsers 2>/dev/null | python3 - <<'PY' || zmail userManagement fetchAllUsers
import json, sys
raw = sys.stdin.read()
for line in raw.splitlines():
    if not line.strip().startswith("{"): continue
    try: data = json.loads(line)
    except: continue
    users = data.get("data", [])
    if isinstance(users, dict):
        users = users.get("users", users.get("accounts", []))
    for u in users if isinstance(users, list) else []:
        email = u.get("primaryEmailAddress") or u.get("emailAddress")
        print(f"  {email}  role={u.get('role','?')}")
PY
}

cmd_fix() {
  require_auth
  print_dns

  echo "=== Step 1: verify domain (TXT) ==="
  zmail domainManagement verifyDomainByTXT --domainname="${DOMAIN}" || true

  echo ""
  echo "=== Step 2: enable mail hosting ==="
  zmail domainManagement enableMailHosting --domainname="${DOMAIN}" || true

  echo ""
  echo "=== Step 3: verify MX ==="
  zmail domainManagement verifyMxRecord --domainname="${DOMAIN}" || true

  echo ""
  echo "=== Step 4: verify SPF ==="
  zmail domainManagement verifySpfRecord --domainname="${DOMAIN}" || true

  echo ""
  echo "=== Step 5: add DKIM (zmail selector) ==="
  zmail domainManagement addDkimDetail --domainname="${DOMAIN}" --selector=zmail --keySize=2048 --isDefault || true

  echo ""
  echo "=== Domain status after fix ==="
  zmail domainManagement fetchSpecificDomain --domainname="${DOMAIN}" | parse_domain_status

  echo ""
  echo "If DKIM was created, add the TXT record in GoDaddy from Zoho Admin → Domains → Email Configuration."
  echo "Then run: bash scripts/zoho-mail-debug.sh fix   (verifyDkimKey step)"
  zmail domainManagement verifyDkimKey --domainname="${DOMAIN}" 2>/dev/null || true
}

case "${1:-debug}" in
  debug) cmd_debug ;;
  fix)   cmd_fix ;;
  *)
    echo "Usage: bash scripts/zoho-mail-debug.sh [debug|fix]"
    exit 1
    ;;
esac
