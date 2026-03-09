#!/usr/bin/env bash
# scripts/test-verifier-local.sh — Call the Garaga verifier directly on Katana
# Validates that the deployed verifier can verify a proof and return public inputs.
# Usage: bash scripts/test-verifier-local.sh <VERIFIER_ADDRESS>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROOF_CALLDATA="$ROOT/packages/verifier/tests/proof_calldata.txt"
ACCOUNTS_FILE="$ROOT/.sncast-accounts.json"

RPC_URL="http://localhost:5050"
SNCAST_ACCOUNT="katana0"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

DEPLOY_ENV_FILE="${DEPLOY_ENV:-$ROOT/.deploy-local.env}"
if [ -n "${1:-}" ]; then
  VERIFIER_ADDRESS="$1"
elif [ -f "$DEPLOY_ENV_FILE" ]; then
  source "$DEPLOY_ENV_FILE"
  RPC_URL="${RPC_URL:-http://localhost:5050}"
  echo "Loaded from $(basename "$DEPLOY_ENV_FILE") (${NETWORK:-local})"
else
  echo "Usage: bash scripts/test-verifier-local.sh [VERIFIER_ADDRESS]"
  echo "  Or run deploy-local.sh / deploy-sepolia.sh first"
  exit 1
fi

echo -e "${BOLD}WhoisWho — Standalone Verifier Test${RESET}"
echo    "────────────────────────────────────────"

# Check proof calldata exists
if [ ! -f "$PROOF_CALLDATA" ]; then
  echo -e "${RED}✗${RESET} proof_calldata.txt not found. Run: bash scripts/prove.sh"
  exit 1
fi

TOTAL_LINES=$(wc -l < "$PROOF_CALLDATA" | tr -d ' ')
echo -e "Proof calldata: ${TOTAL_LINES} felt252 values"
echo -e "Verifier: ${VERIFIER_ADDRESS}"
echo ""

# Build calldata for sncast: Span<felt252> = [length, elem0, elem1, ...]
# proof_calldata.txt has one hex value per line — we prepend the span length
echo -e "${CYAN}${BOLD}[1/2]${RESET} Preparing calldata..."
CALLDATA_VALUES=$(cat "$PROOF_CALLDATA" | tr '\n' ' ')
FULL_CALLDATA="${TOTAL_LINES} ${CALLDATA_VALUES}"
echo -e "      ${GREEN}✓${RESET} ${TOTAL_LINES} elements + span length prefix"

echo -e "\n${CYAN}${BOLD}[2/2]${RESET} Calling verify_ultra_keccak_zk_honk_proof..."

RESULT=$(sncast \
  --accounts-file "$ACCOUNTS_FILE" \
  --account "$SNCAST_ACCOUNT" \
  --json \
  call \
    --url "$RPC_URL" \
    --contract-address "$VERIFIER_ADDRESS" \
    --function verify_ultra_keccak_zk_honk_proof \
    --calldata $FULL_CALLDATA 2>&1) || {
    echo -e "\n${RED}${BOLD}Verification failed!${RESET}"
    echo "$RESULT"
    exit 1
  }

echo ""
echo -e "────────────────────────────────────────"
echo -e "${GREEN}${BOLD}Verifier returned successfully!${RESET}"
echo ""
echo "Raw result:"
echo "$RESULT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    response = data.get('response', data)
    print(json.dumps(response, indent=2))
except:
    print(sys.stdin.read())
" 2>/dev/null || echo "$RESULT"
echo ""
echo -e "────────────────────────────────────────"
echo "The verifier is working on Katana!"
echo "Next: run the full game flow with: bash scripts/test-e2e-local.sh"
