#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
AGENT_NAME="${AGENT_NAME:-CodexClawd}"
SIZE="${SIZE:-M}"
IDEA="${IDEA:-cyber lobster guardian sigil}"
STYLE="${STYLE:-streetwear}"
SIMULATE_FUNDING="${SIMULATE_FUNDING:-0}"

echo "== ClawDrip Agentic Flow E2E =="
echo "BASE_URL=${BASE_URL}"

post_json() {
  local url="$1"
  local body="$2"
  curl -sS -X POST "${url}" \
    -H "Content-Type: application/json" \
    -d "${body}"
}

extract_json() {
  local js="$1"
  node -e "const fs=require('fs');const x=JSON.parse(fs.readFileSync(0,'utf8'));const v=(${js});if(v===undefined||v===null){process.exit(2)};if(typeof v==='object'){console.log(JSON.stringify(v))}else{console.log(String(v))}"
}

echo
echo "1) Prompt assist"
PA_RESP="$(post_json "${BASE_URL}/api/v1/design/prompt-assist" "{\"idea\":\"${IDEA}\",\"style\":\"${STYLE}\"}")"
ENHANCED_PROMPT="$(printf '%s' "${PA_RESP}" | extract_json 'x.enhancedPrompt' || true)"
if [[ -n "${ENHANCED_PROMPT}" ]]; then
  echo "   prompt-assist: ok"
else
  echo "   prompt-assist: failed"
  echo "${PA_RESP}"
fi

echo
echo "2) Gift create (debut fallback if no designId)"
GIFT_REQ="{\"agentName\":\"${AGENT_NAME}\",\"size\":\"${SIZE}\"}"
GIFT_RESP="$(post_json "${BASE_URL}/api/v1/gift/create" "${GIFT_REQ}")"
GIFT_ID="$(printf '%s' "${GIFT_RESP}" | extract_json 'x.gift.id')"
PAY_URL="$(printf '%s' "${GIFT_RESP}" | extract_json 'x.gift.payUrl')"
SHARE_IMAGE_URL="$(printf '%s' "${GIFT_RESP}" | extract_json 'x.gift.shareImageUrl')"
echo "   giftId=${GIFT_ID}"
echo "   payUrl=${PAY_URL}"
echo "   shareImageUrl=${SHARE_IMAGE_URL}"

echo
echo "3) Status fetch"
STATUS_RESP="$(curl -sS "${BASE_URL}/api/v1/gift/${GIFT_ID}/status")"
STATUS="$(printf '%s' "${STATUS_RESP}" | extract_json 'x.status')"
echo "   status=${STATUS}"

echo
echo "4) Share-image fetch"
HTTP_CODE="$(curl -sS -o /tmp/clawdrip-share-image.svg -w "%{http_code}" "${BASE_URL}/api/v1/gift/${GIFT_ID}/share-image")"
if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "   share-image fetch failed: HTTP ${HTTP_CODE}"
  exit 1
fi
echo "   saved /tmp/clawdrip-share-image.svg"

if [[ "${SIMULATE_FUNDING}" == "1" ]]; then
  echo
  echo "5) Simulate funding (non-production only)"
  SIM_RESP="$(post_json "${BASE_URL}/api/v1/gift/${GIFT_ID}/simulate-funding" "{\"amount\":35}")"
  echo "   $(printf '%s' "${SIM_RESP}" | extract_json 'x.status')"
fi

echo
echo "E2E script finished."
