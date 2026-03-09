#!/usr/bin/env bash
# scripts/deploy-local.sh — Deploy Garaga verifier + Dojo world to local Katana
# Prerequisites: katana --dev --dev.no-fee
# Usage: bash scripts/deploy-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERIFIER_DIR="$ROOT/packages/verifier"
CONTRACTS_DIR="$ROOT/packages/contracts"

# Katana default account (seed 0) — same as dojo_dev.toml
RPC_URL="http://localhost:5050"
ACCOUNT_ADDRESS="0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec"
PRIVATE_KEY="0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912"
SNCAST_ACCOUNT="katana0"
ACCOUNTS_FILE="$ROOT/.sncast-accounts.json"
CONTRACT_NAME="UltraKeccakZKHonkVerifier"

# Standard Starknet UDC address (sncast 0.51 uses a different one that Katana doesn't have)
UDC_ADDRESS="0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf"
DEPLOY_SALT="0x1"

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

step() { echo -e "\n${CYAN}${BOLD}[$1/6]${RESET} $2..."; }
ok()   { echo -e "      ${GREEN}✓${RESET} $1"; }
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

echo -e "${BOLD}WhoisWho — Local Deployment to Katana${RESET}"
echo    "────────────────────────────────────────"

# Bootstrap sncast accounts file for fresh clones.
if [ ! -f "$ACCOUNTS_FILE" ]; then
  echo '{}' > "$ACCOUNTS_FILE"
fi

# ── Step 0: Check Katana is running ──
echo -e "\nChecking Katana at ${RPC_URL}..."
if ! curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"starknet_chainId","id":1}' > /dev/null 2>&1; then
  fail "Katana not running at $RPC_URL. Start with: katana --dev --dev.no-fee"
fi
ok "Katana is running"

# ── Step 1: Import Katana account into sncast ──
step 1 "Importing Katana account into sncast"
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

# ── Step 3: Declare verifier on Katana ──
step 3 "Declaring verifier on Katana"
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
    # Extract class hash from error message or compiled artifact
    CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oE '0x[0-9a-fA-F]{40,}' | head -1)
    if [ -z "$CLASS_HASH" ]; then
      fail "Already declared but cannot determine class hash. Restart Katana for a clean state."
    fi
    echo "  (already declared)"
  else
    echo "$DECLARE_OUTPUT"
    fail "Declare failed"
  fi
fi
ok "Class hash: $CLASS_HASH"

# ── Step 4: Deploy verifier via UDC invoke ──
# sncast 0.51 uses a non-standard UDC address, so we call the real UDC directly.
step 4 "Deploying verifier via UDC"
DEPLOY_OUTPUT=$(sncast \
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
if echo "$DEPLOY_OUTPUT" | grep -q '"error"'; then
  echo "$DEPLOY_OUTPUT"
  fail "Deploy via UDC failed"
fi

TX_HASH=$(extract_json_field "$DEPLOY_OUTPUT" "transaction_hash")
if [ -z "$TX_HASH" ]; then
  # Fallback: parse from message line
  TX_HASH=$(echo "$DEPLOY_OUTPUT" | grep -oE '0x[0-9a-fA-F]{20,}' | head -1)
fi

# Extract deployed address from ContractDeployed event in tx receipt
VERIFIER_ADDRESS=$(curl -s "$RPC_URL" -X POST -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"starknet_getTransactionReceipt\",\"params\":{\"transaction_hash\":\"$TX_HASH\"},\"id\":1}" \
  | python3 -c "
import sys, json
receipt = json.load(sys.stdin).get('result', {})
for ev in receipt.get('events', []):
    # UDC ContractDeployed event: data[0] = deployed address
    if ev.get('from_address', '').endswith('${UDC_ADDRESS#0x}') or '41a78e741e5af2fec' in ev.get('from_address', ''):
        print(ev['data'][0])
        break
" 2>/dev/null)

if [ -z "$VERIFIER_ADDRESS" ]; then
  fail "Could not extract deployed address from tx receipt ($TX_HASH)"
fi
ok "Verifier deployed at: $VERIFIER_ADDRESS"

# ── Step 5: Update constants.cairo ──
step 5 "Updating VERIFIER_ADDRESS in contracts"
CONSTANTS_FILE="$CONTRACTS_DIR/src/constants.cairo"

sed -i '' \
  "s|pub const VERIFIER_ADDRESS_SEPOLIA: felt252 = 0x[0-9a-fA-F]*;|pub const VERIFIER_ADDRESS_SEPOLIA: felt252 = ${VERIFIER_ADDRESS};|" \
  "$CONSTANTS_FILE"
ok "constants.cairo updated with $VERIFIER_ADDRESS"

# ── Step 6: Build & migrate Dojo world ──
step 6 "Building & migrating Dojo world"
cd "$CONTRACTS_DIR"
sozo build 2>&1 | tail -3
ok "Dojo contracts built"

sozo migrate 2>&1 | tail -10
ok "Dojo world migrated to Katana"

# Extract GAME_CONTRACT from updated manifest and sync to client config
GAME_CONTRACT=$(python3 -c "
import json, sys
with open('$CONTRACTS_DIR/manifest_dev.json') as f:
    m = json.load(f)
for c in m.get('contracts', []):
    if c.get('tag') == 'whoiswho-game_actions':
        print(c['address'])
        sys.exit(0)
sys.exit(1)
" 2>/dev/null)

if [ -n "$GAME_CONTRACT" ]; then
  sed -i '' "s|export const GAME_CONTRACT = '0x[0-9a-fA-F]*';|export const GAME_CONTRACT = '$GAME_CONTRACT';|" \
    "$ROOT/src/services/starknet/config.ts"
  ok "src/services/starknet/config.ts → GAME_CONTRACT=$GAME_CONTRACT"
else
  echo "  (warn) Could not extract game_actions address from manifest — config.ts unchanged"
fi

# ── Summary ──
echo ""
echo -e "────────────────────────────────────────"
echo -e "${GREEN}${BOLD}Deployment complete!${RESET}"
echo -e "  Verifier class hash:  $CLASS_HASH"
echo -e "  Verifier address:     $VERIFIER_ADDRESS"
echo -e "  Dojo world:           0x04f057e1fead04aae0e8d385d109b3cd66dbe472216035698c23764d3330a61d"
echo -e "  Katana RPC:           $RPC_URL"
echo -e "────────────────────────────────────────"
echo ""
# Save addresses for other scripts
DEPLOY_ENV="$ROOT/.deploy-local.env"
cat > "$DEPLOY_ENV" <<EOF
VERIFIER_ADDRESS=$VERIFIER_ADDRESS
VERIFIER_CLASS_HASH=${CLASS_HASH:-}
WORLD_ADDRESS=0x04f057e1fead04aae0e8d385d109b3cd66dbe472216035698c23764d3330a61d
GAME_CONTRACT=${GAME_CONTRACT:-}
EOF
ok "Saved to .deploy-local.env"

echo ""
echo "Next: test the verifier standalone:"
echo "  bash scripts/test-verifier-local.sh"
