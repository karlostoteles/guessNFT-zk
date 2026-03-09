#!/usr/bin/env bash
# scripts/prove.sh — Full ZK proof pipeline for WhoisWho
# Runs from project root. Usage: bash scripts/prove.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CIRCUITS="$ROOT/packages/circuits"
VERIFIER_TESTS="$ROOT/packages/verifier/tests"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

step() { echo -e "\n${CYAN}${BOLD}[$1/7]${RESET} $2..."; }
ok()   { echo -e "      ${GREEN}✓${RESET} $1"; }

echo -e "${BOLD}WhoisWho ZK Proof Pipeline${RESET}"
echo    "────────────────────────────────────────"

step 1 "Compiling Noir circuit"
cd "$CIRCUITS"
nargo build
ok "Circuit compiled → target/whoiswho_answer.json"

step 2 "Generating test vectors"
cd "$ROOT"
npx tsx scripts/test-vectors.ts 2>&1 | grep -E "character_id|question_id|expected_answer|traits_root|commitment|Written"
ok "Prover.toml written"

step 3 "Solving witness"
cd "$CIRCUITS"
OUTPUT=$(nargo execute witness_out 2>&1)
echo "$OUTPUT" | grep -E "solved|output|Witness"
ok "Witness solved → target/witness_out.gz"

step 4 "Generating verification key"
bb write_vk \
  -b ./target/whoiswho_answer.json \
  -o ./target/vk \
  --oracle_hash keccak 2>&1 | grep -v "^$"
ok "VK written → target/vk/vk"

step 5 "Generating proof"
rm -rf ./proof_out
bb prove \
  -b ./target/whoiswho_answer.json \
  -w ./target/witness_out.gz \
  -k ./target/vk/vk \
  -o ./proof_out \
  --oracle_hash keccak 2>&1 | grep -v "^$"
PROOF_SIZE=$(wc -c < ./proof_out/proof)
ok "Proof written → proof_out/proof (${PROOF_SIZE} bytes)"

step 6 "Verifying proof locally"
bb verify \
  -k ./target/vk/vk \
  -p ./proof_out/proof \
  -i ./proof_out/public_inputs \
  --oracle_hash keccak 2>&1 | grep -v "^$"
ok "Local verification passed"

step 7 "Generating Starknet calldata"
cd "$ROOT"
garaga calldata \
  --system ultra_keccak_zk_honk \
  --vk packages/circuits/target/vk/vk \
  --proof packages/circuits/proof_out/proof \
  --public-inputs packages/circuits/proof_out/public_inputs \
  --format snforge \
  --output-path "$VERIFIER_TESTS" 2>&1 | grep -v "^$"
PI_COUNT=$(head -1 "$VERIFIER_TESTS/proof_calldata.txt")
LINES=$(wc -l < "$VERIFIER_TESTS/proof_calldata.txt")
ok "Calldata written → packages/verifier/tests/proof_calldata.txt (${LINES} lines, ${PI_COUNT} public inputs)"

echo ""
echo -e "────────────────────────────────────────"
echo -e "${GREEN}${BOLD}All 7 steps completed successfully.${RESET}"
echo -e "The proof is valid and ready for on-chain submission."
echo -e "────────────────────────────────────────"
