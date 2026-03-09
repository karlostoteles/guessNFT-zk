#!/usr/bin/env bash
# scripts/deploy-sepolia.sh — Deploy Garaga verifier + Dojo world to Starknet Sepolia
#
# Prerequisites:
#   1. Create .env.sepolia with your account credentials (see template below)
#   2. Account must be funded with Sepolia ETH
#
# Usage: bash scripts/deploy-sepolia.sh
#
# .env.sepolia template:
#   SEPOLIA_RPC_URL=https://starknet-sepolia.public.blastapi.io
#   SEPOLIA_ACCOUNT_ADDRESS=0x...
#   SEPOLIA_PRIVATE_KEY=0x...
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERIFIER_DIR="$ROOT/packages/verifier"
CONTRACTS_DIR="$ROOT/packages/contracts"
ENV_FILE="$ROOT/.env.sepolia"
ACCOUNTS_FILE="$ROOT/.sncast-accounts.json"
CONTRACT_NAME="UltraKeccakZKHonkVerifier"
SNCAST_ACCOUNT="sepolia0"

# Standard Starknet UDC (same workaround as Katana — sncast 0.51 uses non-standard address)
UDC_ADDRESS="0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf"
DEPLOY_SALT="0x776869736f73776f" # "whoiswo" in hex

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

step() { echo -e "\n${CYAN}${BOLD}[$1/6]${RESET} $2..."; }
ok()   { echo -e "      ${GREEN}✓${RESET} $1"; }
warn() { echo -e "      ${YELLOW}!${RESET} $1"; }
fail() { echo -e "      ${RED}✗${RESET} $1"; exit 1; }

extract_json_field() {
  echo "$1" | python3 -c "
import sys, json
for line in sys.stdin:
    line = line.strip()
    if line.startswith('{'):
        data = json.loads(line)
        val = data.get('$2', '')
        if val:
            print(val)
            break
" 2>/dev/null
}

echo -e "${BOLD}WhoisWho — Deployment to Starknet Sepolia${RESET}"
echo    "────────────────────────────────────────────"

# ── Load config ──
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Missing .env.sepolia${RESET}"
  echo ""
  echo "Create it with:"
  echo "  cat > .env.sepolia << 'EOF'"
  echo "  SEPOLIA_RPC_URL=https://starknet-sepolia.public.blastapi.io"
  echo "  SEPOLIA_ACCOUNT_ADDRESS=0x..."
  echo "  SEPOLIA_PRIVATE_KEY=0x..."
  echo "  EOF"
  exit 1
fi
source "$ENV_FILE"

RPC_URL="${SEPOLIA_RPC_URL:?Set SEPOLIA_RPC_URL in .env.sepolia}"
ACCOUNT_ADDRESS="${SEPOLIA_ACCOUNT_ADDRESS:?Set SEPOLIA_ACCOUNT_ADDRESS in .env.sepolia}"
PRIVATE_KEY="${SEPOLIA_PRIVATE_KEY:?Set SEPOLIA_PRIVATE_KEY in .env.sepolia}"

echo -e "RPC:     ${RPC_URL}"
echo -e "Account: ${ACCOUNT_ADDRESS}"

# ── Step 0: Check RPC is reachable ──
echo -e "\nChecking Sepolia RPC..."
CHAIN_ID=$(curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"starknet_chainId","id":1}' 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',''))" 2>/dev/null)

if [ -z "$CHAIN_ID" ]; then
  fail "Cannot reach Sepolia RPC at $RPC_URL"
fi
ok "Connected (chain_id: $CHAIN_ID)"

# ── Step 1: Import account into sncast ──
step 1 "Importing Sepolia account into sncast"
sncast \
  --accounts-file "$ACCOUNTS_FILE" \
  account import \
    --name "$SNCAST_ACCOUNT" \
    --address "$ACCOUNT_ADDRESS" \
    --private-key "$PRIVATE_KEY" \
    --type oz \
    --url "$RPC_URL" \
    --silent 2>/dev/null || true
ok "Account '$SNCAST_ACCOUNT' available"

# ── Step 2: Build verifier ──
step 2 "Building Garaga verifier (scarb 2.14.0)"
cd "$VERIFIER_DIR"
scarb build 2>&1 | tail -3
ok "Verifier built → target/dev/"

# ── Step 3: Declare verifier on Sepolia ──
step 3 "Declaring verifier on Sepolia (this may take ~30s)"
DECLARE_OUTPUT=$(sncast \
  --accounts-file "$ACCOUNTS_FILE" \
  --account "$SNCAST_ACCOUNT" \
  --json \
  --wait \
  declare \
    --url "$RPC_URL" \
    --contract-name "$CONTRACT_NAME" 2>&1) || true

CLASS_HASH=$(extract_json_field "$DECLARE_OUTPUT" "class_hash")

if [ -z "$CLASS_HASH" ]; then
  if echo "$DECLARE_OUTPUT" | grep -q "already declared"; then
    # Extract class hash from error — sncast sometimes includes it
    CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oE '0x[0-9a-fA-F]{40,}' | head -1)
    if [ -z "$CLASS_HASH" ]; then
      fail "Already declared but cannot determine class hash. Check manually."
    fi
    warn "Already declared"
  else
    echo "$DECLARE_OUTPUT"
    fail "Declare failed. Is the account funded with Sepolia ETH?"
  fi
fi
ok "Class hash: $CLASS_HASH"

# ── Step 4: Deploy verifier via UDC ──
step 4 "Deploying verifier via UDC (this may take ~30s)"

# First check if already deployed at the deterministic address
EXPECTED_DEPLOY_TX=$(sncast \
  --accounts-file "$ACCOUNTS_FILE" \
  --account "$SNCAST_ACCOUNT" \
  --json \
  --wait \
  invoke \
    --url "$RPC_URL" \
    --contract-address "$UDC_ADDRESS" \
    --function deployContract \
    --calldata \
      "$CLASS_HASH" \
      "$DEPLOY_SALT" \
      0x0 \
      0x0 \
  2>&1) || true

# Check for errors
if echo "$EXPECTED_DEPLOY_TX" | grep -q '"error"'; then
  ERR_MSG=$(extract_json_field "$EXPECTED_DEPLOY_TX" "error")
  if echo "$ERR_MSG" | grep -q "is unavailable for deployment"; then
    warn "Contract already deployed at that address"
    # We know the salt and class_hash, compute or find the address
  else
    echo "$EXPECTED_DEPLOY_TX"
    fail "Deploy via UDC failed. Check account balance."
  fi
fi

TX_HASH=$(extract_json_field "$EXPECTED_DEPLOY_TX" "transaction_hash")
if [ -z "$TX_HASH" ]; then
  TX_HASH=$(echo "$EXPECTED_DEPLOY_TX" | grep -oE '0x[0-9a-fA-F]{20,}' | head -1)
fi

if [ -n "$TX_HASH" ]; then
  # Extract deployed address from ContractDeployed event
  VERIFIER_ADDRESS=$(curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"starknet_getTransactionReceipt\",\"params\":{\"transaction_hash\":\"$TX_HASH\"},\"id\":1}" \
    | python3 -c "
import sys, json
receipt = json.load(sys.stdin).get('result', {})
for ev in receipt.get('events', []):
    from_addr = ev.get('from_address', '')
    if '41a78e741e5af2fec' in from_addr:
        print(ev['data'][0])
        break
" 2>/dev/null)
fi

if [ -z "${VERIFIER_ADDRESS:-}" ]; then
  fail "Could not extract deployed address. Check tx: $TX_HASH"
fi
ok "Verifier deployed at: $VERIFIER_ADDRESS"

# ── Step 5: Update constants.cairo ──
step 5 "Updating VERIFIER_ADDRESS_SEPOLIA in contracts"
CONSTANTS_FILE="$CONTRACTS_DIR/src/constants.cairo"

sed -i '' \
  "s|pub const VERIFIER_ADDRESS_SEPOLIA: felt252 = 0x[0-9a-fA-F]*;|pub const VERIFIER_ADDRESS_SEPOLIA: felt252 = ${VERIFIER_ADDRESS};|" \
  "$CONSTANTS_FILE"
ok "constants.cairo updated"

# ── Step 6: Build Dojo contracts (migrate is manual for Sepolia) ──
step 6 "Building Dojo contracts"
cd "$CONTRACTS_DIR"
sozo build 2>&1 | tail -3
ok "Dojo contracts built"

echo ""
warn "Dojo migration to Sepolia is NOT automatic."
echo "      Run manually when ready:"
echo "      cd packages/contracts && sozo migrate --profile prod"
echo "      Then re-run this script (or run the sync manually):"
echo "        GAME_CONTRACT=\$(python3 -c \"import json; m=json.load(open('packages/contracts/manifest_prod.json')); [print(c['address']) for c in m['contracts'] if c.get('tag')=='whoiswho-game_actions']\")"
echo "        sed -i '' \"s|export const GAME_CONTRACT = '0x[0-9a-fA-F]*';|export const GAME_CONTRACT = '\$GAME_CONTRACT';|\" src/starknet/config.ts"

# ── Save addresses ──
DEPLOY_ENV="$ROOT/.deploy-sepolia.env"
cat > "$DEPLOY_ENV" <<EOF
VERIFIER_ADDRESS=$VERIFIER_ADDRESS
VERIFIER_CLASS_HASH=$CLASS_HASH
NETWORK=sepolia
RPC_URL=$RPC_URL
EOF
ok "Saved to .deploy-sepolia.env"

# ── Summary ──
echo ""
echo -e "────────────────────────────────────────────"
echo -e "${GREEN}${BOLD}Sepolia deployment complete!${RESET}"
echo -e "  Verifier class hash:  $CLASS_HASH"
echo -e "  Verifier address:     $VERIFIER_ADDRESS"
echo -e "  Network:              Sepolia"
echo -e "  RPC:                  $RPC_URL"
echo -e "────────────────────────────────────────────"
echo ""
echo "Test the verifier:"
echo "  DEPLOY_ENV=.deploy-sepolia.env bash scripts/test-verifier-local.sh"
