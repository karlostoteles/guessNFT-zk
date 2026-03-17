#!/usr/bin/env bash
# scripts/deploy-verifier-mainnet.sh — Deploy Garaga verifier to Starknet Mainnet
#
# This script ONLY deploys the ZK verifier contract. It does NOT re-migrate the
# Dojo world (which requires updating constants.cairo + game_actions.cairo and
# running `sozo migrate --profile prod`).
#
# Prerequisites:
#   1. scarb 2.14.0 installed
#   2. sncast (snfoundry) installed
#   3. Account must be funded with mainnet ETH
#
# Usage: bash scripts/deploy-verifier-mainnet.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERIFIER_DIR="$ROOT/packages/verifier"
CONTRACTS_DIR="$ROOT/packages/contracts"
ACCOUNTS_FILE="$ROOT/.sncast-accounts.json"
CONTRACT_NAME="UltraKeccakZKHonkVerifier"

# Use the same account as dojo_prod.toml for consistency
RPC_URL="https://api.cartridge.gg/x/starknet/mainnet"
ACCOUNT_ADDRESS="0x4d03bae72dd5fb55902919a6843d188e9d09917b48b8d9a0edf62ae239df296"
PRIVATE_KEY="0x49d21c632b6dcd09b73d629a969cf3772b340860eb8e1a9a00cfd9d645134e1"
SNCAST_ACCOUNT="mainnet0"

# Standard Starknet UDC
UDC_ADDRESS="0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf"
DEPLOY_SALT="0x776869736f73776f" # "whoiswo" in hex

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

step() { echo -e "\n${CYAN}${BOLD}[$1/5]${RESET} $2..."; }
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

echo -e "${BOLD}WhoisWho — Garaga Verifier Deployment to Starknet Mainnet${RESET}"
echo    "──────────────────────────────────────────────────────────"

# Bootstrap sncast accounts file
if [ ! -f "$ACCOUNTS_FILE" ]; then
  echo '{}' > "$ACCOUNTS_FILE"
fi

# ── Step 0: Check RPC is reachable ──
echo -e "\nChecking Mainnet RPC..."
CHAIN_ID=$(curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"starknet_chainId","id":1}' 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',''))" 2>/dev/null)

if [ -z "$CHAIN_ID" ]; then
  fail "Cannot reach Mainnet RPC at $RPC_URL"
fi
ok "Connected (chain_id: $CHAIN_ID)"

# Check account balance
echo -e "Account: $ACCOUNT_ADDRESS"

# ── Step 1: Import account into sncast ──
step 1 "Importing mainnet account into sncast"
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

# ── Step 3: Declare verifier on Mainnet ──
step 3 "Declaring verifier on Mainnet (this may take 30-60s)"
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
    CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oE '0x[0-9a-fA-F]{40,}' | head -1)
    if [ -z "$CLASS_HASH" ]; then
      fail "Already declared but cannot determine class hash. Check manually."
    fi
    warn "Already declared"
  else
    echo "$DECLARE_OUTPUT"
    fail "Declare failed. Is the account funded with mainnet ETH?"
  fi
fi
ok "Class hash: $CLASS_HASH"

# ── Step 4: Deploy verifier via UDC ──
step 4 "Deploying verifier via UDC (this may take 30-60s)"

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

if echo "$EXPECTED_DEPLOY_TX" | grep -q '"error"'; then
  ERR_MSG=$(extract_json_field "$EXPECTED_DEPLOY_TX" "error")
  if echo "$ERR_MSG" | grep -q "is unavailable for deployment"; then
    warn "Contract already deployed at that address"
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

# ── Step 5: Update constants.cairo with mainnet address ──
step 5 "Updating VERIFIER_ADDRESS_MAINNET in contracts"
CONSTANTS_FILE="$CONTRACTS_DIR/src/constants.cairo"

sed -i '' \
  "s|pub const VERIFIER_ADDRESS_MAINNET: felt252 = 0x[0-9a-fA-F]*;|pub const VERIFIER_ADDRESS_MAINNET: felt252 = ${VERIFIER_ADDRESS};|" \
  "$CONSTANTS_FILE"
ok "constants.cairo updated"

# ── Save addresses ──
DEPLOY_ENV="$ROOT/.deploy-mainnet.env"
cat > "$DEPLOY_ENV" <<EOF
VERIFIER_ADDRESS=$VERIFIER_ADDRESS
VERIFIER_CLASS_HASH=$CLASS_HASH
NETWORK=mainnet
RPC_URL=$RPC_URL
EOF
ok "Saved to .deploy-mainnet.env"

# ── Summary ──
echo ""
echo -e "──────────────────────────────────────────────────────────"
echo -e "${GREEN}${BOLD}Mainnet verifier deployment complete!${RESET}"
echo -e "  Verifier class hash:  $CLASS_HASH"
echo -e "  Verifier address:     $VERIFIER_ADDRESS"
echo -e "  Network:              Mainnet"
echo -e "  RPC:                  $RPC_URL"
echo -e "──────────────────────────────────────────────────────────"
echo ""
echo -e "${YELLOW}${BOLD}NEXT STEPS (manual):${RESET}"
echo ""
echo "  1. Update game_actions.cairo to use the mainnet verifier:"
echo "     In packages/contracts/src/systems/game_actions.cairo, change:"
echo "       contract_address_const::<constants::VERIFIER_ADDRESS_SEPOLIA>()"
echo "     to:"
echo "       contract_address_const::<constants::VERIFIER_ADDRESS_MAINNET>()"
echo ""
echo "  2. Rebuild and re-migrate the Dojo world:"
echo "     cd packages/contracts"
echo "     sozo build"
echo "     sozo migrate --profile prod"
echo ""
echo "  3. Update frontend config with new GAME_CONTRACT address if it changed"
echo ""
