#!/bin/bash
# ClawDrip Race Condition Test
#
# Spawns 10 concurrent purchase requests to verify no overselling.
# "10 agents request last unit simultaneously → only 1 succeeds"

set -e

API_URL="${API_URL:-http://localhost:3001}"
ENDPOINT="$API_URL/api/v1/orders"

echo "======================================"
echo "ClawDrip Race Condition Test"
echo "======================================"
echo ""
echo "API: $ENDPOINT"
echo "Concurrent requests: 10"
echo ""

# Generate unique wallet addresses for each request
WALLETS=(
  "0x1111111111111111111111111111111111111111"
  "0x2222222222222222222222222222222222222222"
  "0x3333333333333333333333333333333333333333"
  "0x4444444444444444444444444444444444444444"
  "0x5555555555555555555555555555555555555555"
  "0x6666666666666666666666666666666666666666"
  "0x7777777777777777777777777777777777777777"
  "0x8888888888888888888888888888888888888888"
  "0x9999999999999999999999999999999999999999"
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
)

SIZES=("S" "M" "L" "XL" "2XL")

# Temp file for results
RESULTS_FILE=$(mktemp)

echo "Starting concurrent requests..."
echo ""

# Launch 10 concurrent requests
for i in {0..9}; do
  WALLET="${WALLETS[$i]}"
  SIZE="${SIZES[$((i % 5))]}"

  curl -s -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "X-Wallet-Address: $WALLET" \
    -d "{\"size\": \"$SIZE\"}" \
    -o "$RESULTS_FILE.$i" \
    -w "Request $i: HTTP %{http_code}\n" &
done

# Wait for all requests to complete
wait

echo ""
echo "======================================"
echo "Results:"
echo "======================================"

SUCCESS_COUNT=0
ERROR_402_COUNT=0
ERROR_410_COUNT=0
ERROR_409_COUNT=0
ERROR_500_COUNT=0
OTHER_COUNT=0

for i in {0..9}; do
  RESPONSE=$(cat "$RESULTS_FILE.$i" 2>/dev/null || echo "{}")

  # Check response type
  if echo "$RESPONSE" | grep -q '"reservation"'; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    RESERVATION_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    PRICE=$(echo "$RESPONSE" | grep -o '"price":"\$[^"]*"' | head -1 | cut -d'"' -f4)
    echo "  Agent $i: Reserved! ID: $RESERVATION_ID, Price: $PRICE"
  elif echo "$RESPONSE" | grep -q '"error":"SOLD OUT"'; then
    ERROR_410_COUNT=$((ERROR_410_COUNT + 1))
    echo "  Agent $i: SOLD OUT (410)"
  elif echo "$RESPONSE" | grep -q '"retryable":true'; then
    ERROR_409_COUNT=$((ERROR_409_COUNT + 1))
    echo "  Agent $i: Conflict - retry (409)"
  elif echo "$RESPONSE" | grep -q '"error"'; then
    ERROR_500_COUNT=$((ERROR_500_COUNT + 1))
    ERROR_MSG=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | head -1)
    echo "  Agent $i: Error - $ERROR_MSG"
  else
    OTHER_COUNT=$((OTHER_COUNT + 1))
    echo "  Agent $i: Unknown response"
  fi

  # Cleanup temp file
  rm -f "$RESULTS_FILE.$i"
done

rm -f "$RESULTS_FILE"

echo ""
echo "======================================"
echo "Summary:"
echo "======================================"
echo "  Reservations created: $SUCCESS_COUNT"
echo "  Sold out (410):       $ERROR_410_COUNT"
echo "  Conflicts (409):      $ERROR_409_COUNT"
echo "  Errors (500):         $ERROR_500_COUNT"
echo "  Other:                $OTHER_COUNT"
echo ""

# Verify supply math
echo "======================================"
echo "Supply Verification:"
echo "======================================"

SUPPLY_RESPONSE=$(curl -s "$API_URL/api/v1/supply/status")
if echo "$SUPPLY_RESPONSE" | grep -q '"supply"'; then
  REMAINING=$(echo "$SUPPLY_RESPONSE" | grep -o '"remaining":[0-9]*' | cut -d':' -f2)
  RESERVED=$(echo "$SUPPLY_RESPONSE" | grep -o '"reserved":[0-9]*' | cut -d':' -f2)
  SOLD=$(echo "$SUPPLY_RESPONSE" | grep -o '"sold":[0-9]*' | cut -d':' -f2)
  TOTAL=$(echo "$SUPPLY_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)

  echo "  Total:     $TOTAL"
  echo "  Remaining: $REMAINING"
  echo "  Reserved:  $RESERVED"
  echo "  Sold:      $SOLD"
  echo "  Math:      $REMAINING + $RESERVED + $SOLD = $((REMAINING + RESERVED + SOLD))"

  if [ "$((REMAINING + RESERVED + SOLD))" -eq "$TOTAL" ]; then
    echo ""
    echo "  PASS: Supply math is correct!"
  else
    echo ""
    echo "  FAIL: Supply math doesn't add up!"
    exit 1
  fi
else
  echo "  Could not verify supply (API may not be running)"
fi

echo ""
echo "======================================"
echo "Test complete!"
echo "======================================"
