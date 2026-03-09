/**
 * Cross-validation: client-side code (src/zk/) vs scripts (scripts/merkle.ts).
 *
 * Uses the SAME test vector from test-vectors.ts and verifies that:
 *   1. zkCommitment.ts hash4 == merkle.ts computeCommitment
 *   2. evaluateBit() matches manual bitmap extraction
 *   3. collectionData bitmap/merklePath match schizodio.json directly
 *   4. Worker input format matches what nargo expects (decimal strings)
 *
 * Run: npx tsx scripts/validate-client-vs-scripts.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// --- Import from scripts (the "source of truth") ---
import { computeCommitment, computeLeaf, verifyPath } from './merkle.ts';

// --- Import from client (src/zk/) ---
import { computeZKCommitment, toBE32, fromBE32, characterIdToCircuitId } from '../src/zk/zkCommitment.ts';
import { evaluateBit } from '../src/zk/evaluateBit.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Same constants as test-vectors.ts
const TEST_SALT         = 0x1234567890abcdefn;
const TEST_GAME_ID      = 0x42n;
const TEST_TURN_ID      = 0x5n;
const TEST_PLAYER       = 0xdeadbeef1234n;
const TEST_CHARACTER_ID = 42;
const TEST_QUESTION_ID  = 104;

let failures = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    failures++;
  } else {
    console.log(`  PASS: ${msg}`);
  }
}

async function main() {
  // Load collection data directly (not via fetch — we're in Node)
  const dataPath = resolve(projectRoot, 'public/collections/schizodio.json');
  const dataset = JSON.parse(readFileSync(dataPath, 'utf8'));
  const char = dataset.characters[TEST_CHARACTER_ID];

  console.log('=== Test 1: Commitment (hash4) — scripts vs client ===');
  const scriptCommitment = computeCommitment(TEST_GAME_ID, TEST_PLAYER, BigInt(TEST_CHARACTER_ID), TEST_SALT);
  const clientCommitment = await computeZKCommitment(TEST_GAME_ID, TEST_PLAYER, BigInt(TEST_CHARACTER_ID), TEST_SALT);
  console.log(`  script: 0x${scriptCommitment.toString(16)}`);
  console.log(`  client: 0x${clientCommitment.toString(16)}`);
  assert(scriptCommitment === clientCommitment, 'Commitments match');

  console.log('\n=== Test 2: Merkle leaf (hash5) — scripts verify against root ===');
  const bitmapLimbs = char.bitmap.map((s: string) => BigInt(s)) as [bigint, bigint, bigint, bigint];
  const leaf = computeLeaf(BigInt(TEST_CHARACTER_ID), bitmapLimbs);
  const siblings = char.merkle_path.map((s: string) => BigInt(s));
  const isLeft = char.merkle_path_is_left;
  const traitsRoot = BigInt(dataset.traits_root);
  const pathValid = verifyPath(leaf, TEST_CHARACTER_ID, siblings, isLeft, traitsRoot);
  assert(pathValid, `Merkle path for char ${TEST_CHARACTER_ID} verifies against root`);

  console.log('\n=== Test 3: evaluateBit() — client matches manual extraction ===');
  const limbIndex = Math.floor(TEST_QUESTION_ID / 128);
  const bitIndex = TEST_QUESTION_ID % 128;
  const manualAnswer = Boolean((bitmapLimbs[limbIndex] >> BigInt(bitIndex)) & 1n);
  const clientAnswer = evaluateBit(char.bitmap as [string, string, string, string], TEST_QUESTION_ID);
  console.log(`  manual: ${manualAnswer}`);
  console.log(`  client: ${clientAnswer}`);
  assert(manualAnswer === clientAnswer, `evaluateBit(${TEST_QUESTION_ID}) matches manual`);

  // Test a few more questions
  for (const qid of [0, 7, 128, 255, 300, 417]) {
    const li = Math.floor(qid / 128);
    const bi = qid % 128;
    const manual = Boolean((bitmapLimbs[li] >> BigInt(bi)) & 1n);
    const client = evaluateBit(char.bitmap as [string, string, string, string], qid);
    assert(manual === client, `evaluateBit(${qid}) = ${client}`);
  }

  console.log('\n=== Test 4: characterIdToCircuitId() ===');
  assert(characterIdToCircuitId('nft_1') === 0n, 'nft_1 → 0');
  assert(characterIdToCircuitId('nft_999') === 998n, 'nft_999 → 998');
  assert(characterIdToCircuitId('42') === 42n, '"42" → 42');

  console.log('\n=== Test 5: Worker input format — decimal string conversion ===');
  // The worker converts hex to decimal. Verify this matches what Prover.toml has.
  const proverToml = readFileSync(resolve(projectRoot, 'packages/circuits/Prover.toml'), 'utf8');

  // Extract commitment from Prover.toml
  const commitmentMatch = proverToml.match(/commitment\s*=\s*"(\d+)"/);
  if (!commitmentMatch) throw new Error('Cannot find commitment in Prover.toml');
  const proverCommitment = BigInt(commitmentMatch[1]);
  assert(proverCommitment === clientCommitment, 'Client commitment == Prover.toml commitment');

  // Extract traits_root from Prover.toml
  const rootMatch = proverToml.match(/traits_root\s*=\s*"(\d+)"/);
  if (!rootMatch) throw new Error('Cannot find traits_root in Prover.toml');
  const proverRoot = BigInt(rootMatch[1]);
  assert(proverRoot === traitsRoot, 'traits_root == Prover.toml traits_root');

  console.log('\n=== Test 6: toBE32/fromBE32 roundtrip ===');
  const testValues = [0n, 1n, 255n, 2n**128n, 2n**254n - 1n, TEST_SALT, traitsRoot, clientCommitment];
  for (const v of testValues) {
    const roundtripped = fromBE32(toBE32(v));
    assert(roundtripped === v, `roundtrip(0x${v.toString(16).slice(0, 16)}...) ok`);
  }

  console.log('\n=== Test 7: Collection data shape ===');
  assert(dataset.characters.length === 999, `999 characters (got ${dataset.characters.length})`);
  assert(typeof dataset.traits_root === 'string', 'traits_root is string');
  assert(char.bitmap.length === 4, 'bitmap has 4 limbs');
  assert(char.merkle_path.length === 10, 'merkle_path has 10 siblings (depth 10)');
  assert(char.merkle_path_is_left.length === 10, 'merkle_path_is_left has 10 booleans');

  // Spot-check a few more characters
  for (const cid of [0, 1, 500, 998]) {
    const c = dataset.characters[cid];
    const bl = c.bitmap.map((s: string) => BigInt(s)) as [bigint, bigint, bigint, bigint];
    const l = computeLeaf(BigInt(cid), bl);
    const sib = c.merkle_path.map((s: string) => BigInt(s));
    const il = c.merkle_path_is_left;
    const valid = verifyPath(l, cid, sib, il, traitsRoot);
    assert(valid, `Merkle path for char ${cid} verifies`);
  }

  console.log(`\n${'='.repeat(60)}`);
  if (failures === 0) {
    console.log('ALL TESTS PASSED — client code matches scripts exactly.');
  } else {
    console.error(`${failures} FAILURE(S) — client and scripts diverge!`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
