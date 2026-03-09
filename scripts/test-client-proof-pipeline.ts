/**
 * test-client-proof-pipeline.ts
 *
 * Exercises the EXACT same code path as the Web Worker (prover.worker.ts):
 *   Noir.execute → UltraHonkBackend.generateProof → garaga.getZKHonkCallData
 *
 * No Katana required — all validation is local.
 *
 * Validates:
 *   1. Commitment computed by src/zk matches scripts/merkle
 *   2. Noir witness generation succeeds with client-formatted inputs
 *   3. UltraHonk proof generation succeeds with keccakZK flag
 *   4. Garaga calldata has correct structure (prefix, PI offsets, answer bit)
 *   5. bb CLI verify accepts the proof (cross-validates JS prover vs CLI verifier)
 *   6. Multiple characters × multiple questions produce correct answer bits
 *   7. evaluateBit matches circuit return value in every case
 *
 * Run: npx tsx scripts/test-client-proof-pipeline.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend, BarretenbergSync } from '@aztec/bb.js';
import { init as garagaInit, getZKHonkCallData } from 'garaga';

// Client-side imports (src/zk/) — the code under test
import { computeZKCommitment, toBE32, fromBE32 } from '../src/zk/zkCommitment.ts';
import { evaluateBit } from '../src/zk/evaluateBit.ts';

// Script-side imports (scripts/) — the reference implementation
import { computeCommitment } from './merkle.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CIRCUITS = resolve(ROOT, 'packages/circuits');

// ─── Test configuration ──────────────────────────────────────────────────────

const TRAITS_ROOT = '0x296f3664665c3719c1498bd6642ed0e91d527b8d1e058fb6de45aaa5b88f9897';
const SALT = 0x1234567890abcdefn;
const GAME_ID = 0x42n;
const TURN_ID = 1n;
const PLAYER = 0xdeadbeef1234n;

// Test matrix: [characterId, questionId]
// MUST include both YES and NO answers to validate both circuit paths.
// YES bits per character (from bitmap analysis):
//   Char #0:   [76, 104, 108, 185, 197, 246, 264, 303, 386, 402]
//   Char #42:  [50, 97, 127, 183, 213, 233, 314, 390]
//   Char #500: [37, 96, 146, 181, 199, 250, 316, 373]
const TEST_CASES: [number, number][] = [
  // NO answers — different limbs
  [0,   0],       // first char, first bit, limb 0 → NO
  [42,  104],     // same as test-vectors.ts baseline → NO
  [42,  128],     // limb 1, bit 0 → NO
  [42,  300],     // limb 2 → NO
  [998, 200],     // last character → NO

  // YES answers — critical: validates circuit returns 1
  [0,   76],      // char 0, limb 0, bit 76 → YES
  [0,   264],     // char 0, limb 2, bit 8 → YES
  [0,   402],     // char 0, limb 3, bit 18 → YES
  [42,  50],      // char 42, limb 0, bit 50 → YES
  [42,  127],     // char 42, limb 0, last bit → YES
  [42,  233],     // char 42, limb 1 → YES
  [42,  390],     // char 42, limb 3 → YES
  [500, 37],      // char 500, limb 0 → YES
  [500, 373],     // char 500, limb 2 → YES
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDecimalField(value: string | number | bigint): string {
  const raw = typeof value === 'string' ? value.trim() : String(value);
  if (raw.startsWith('0x') || raw.startsWith('0X')) return BigInt(raw).toString(10);
  if (/^\d+$/.test(raw)) return raw;
  throw new Error(`Invalid numeric field input: "${value}"`);
}

function flattenFieldsAsArray(fields: string[]): Uint8Array {
  const result = new Uint8Array(fields.length * 32);
  for (let i = 0; i < fields.length; i++) {
    let v = BigInt(fields[i]);
    for (let j = 31; j >= 0; j--) {
      result[i * 32 + j] = Number(v & 0xffn);
      v >>= 8n;
    }
  }
  return result;
}

let failures = 0;
let passes = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    failures++;
  } else {
    console.log(`  PASS: ${msg}`);
    passes++;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const totalStart = Date.now();

  // Load assets (same as worker does at init time)
  console.log('=== Loading assets ===');
  const circuitJson = JSON.parse(
    readFileSync(resolve(CIRCUITS, 'target/whoiswho_answer.json'), 'utf8'),
  );
  const vk = new Uint8Array(readFileSync(resolve(CIRCUITS, 'target/vk/vk')));
  const collection = JSON.parse(
    readFileSync(resolve(ROOT, 'public/collections/schizodio.json'), 'utf8'),
  );
  console.log(`  Circuit bytecode: ${(circuitJson.bytecode.length / 1024).toFixed(0)}KB`);
  console.log(`  VK: ${vk.length} bytes`);
  console.log(`  Characters: ${collection.characters.length}`);

  // Init WASM (same as worker's ensureInit)
  console.log('\n=== Initializing WASM ===');
  await garagaInit();
  const backend = new UltraHonkBackend(circuitJson.bytecode, { threads: 1 });
  const noir = new Noir(circuitJson as any);
  console.log('  Noir + UltraHonk + Garaga initialized');

  // Run test cases
  for (const [charId, questionId] of TEST_CASES) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Character #${charId}, Question #${questionId}`);
    console.log(`${'─'.repeat(60)}`);

    const char = collection.characters[charId];
    if (!char) {
      console.error(`  SKIP: character ${charId} not in collection`);
      continue;
    }

    const bitmap = char.bitmap as [string, string, string, string];
    const merklePath = char.merkle_path as string[];

    // ── 1. Commitment cross-check ──
    console.log('  --- Commitment ---');
    const clientCommitment = await computeZKCommitment(GAME_ID, PLAYER, BigInt(charId), SALT);
    const scriptCommitment = computeCommitment(GAME_ID, PLAYER, BigInt(charId), SALT);
    assert(clientCommitment === scriptCommitment, 'zkCommitment.ts == merkle.ts');

    // ── 2. evaluateBit prediction ──
    console.log('  --- evaluateBit ---');
    const expectedAnswer = evaluateBit(bitmap, questionId);
    const expectedBit = expectedAnswer ? 1 : 0;
    console.log(`    predicted answer: ${expectedBit} (${expectedAnswer ? 'YES' : 'NO'})`);

    // ── 3. Build witness inputs (EXACT same format as prover.worker.ts) ──
    console.log('  --- Noir witness ---');
    const witnessInputs = {
      game_id:      toDecimalField(String(GAME_ID)),
      turn_id:      toDecimalField(String(TURN_ID)),
      player:       toDecimalField(String(PLAYER)),
      commitment:   toDecimalField(String(clientCommitment)),
      question_id:  String(questionId),
      traits_root:  toDecimalField(TRAITS_ROOT),
      character_id: String(charId),
      salt:         toDecimalField(String(SALT)),
      trait_bitmap:  bitmap.map(v => toDecimalField(v)),
      merkle_path:   merklePath.map(v => toDecimalField(v)),
    };

    let witness: Uint8Array;
    try {
      const result = await noir.execute(witnessInputs);
      witness = result.witness;
      assert(true, 'Noir witness generation succeeded');
    } catch (err: any) {
      assert(false, `Noir witness generation FAILED: ${err.message}`);
      continue;
    }

    // ── 4. Generate proof (same as worker: keccakZK: true) ──
    console.log('  --- UltraHonk proof ---');
    let proofData: { proof: Uint8Array; publicInputs: string[] };
    const proveStart = Date.now();
    try {
      proofData = await backend.generateProof(witness, { keccakZK: true });
      const elapsed = ((Date.now() - proveStart) / 1000).toFixed(1);
      assert(true, `Proof generated in ${elapsed}s`);
    } catch (err: any) {
      assert(false, `Proof generation FAILED: ${err.message}`);
      continue;
    }

    // ── 5. Validate public inputs ──
    console.log('  --- Public inputs ---');
    const pis = proofData.publicInputs;
    // Circuit has 6 pub inputs + 1 return value = 7 total
    assert(pis.length === 7, `PI count = ${pis.length} (expected 7)`);
    assert(BigInt(pis[0]) === GAME_ID, `PI[0] game_id = ${pis[0]}`);
    assert(BigInt(pis[1]) === TURN_ID, `PI[1] turn_id = ${pis[1]}`);
    assert(BigInt(pis[2]) === PLAYER, `PI[2] player = ${pis[2]}`);
    assert(BigInt(pis[3]) === clientCommitment, `PI[3] commitment matches`);
    assert(BigInt(pis[4]) === BigInt(questionId), `PI[4] question_id = ${questionId}`);
    assert(BigInt(pis[5]) === BigInt(TRAITS_ROOT), `PI[5] traits_root matches`);

    // Return value = answer bit
    const circuitAnswer = Number(pis[6]);
    assert(circuitAnswer === expectedBit, `PI[6] answer = ${circuitAnswer} (evaluateBit predicted ${expectedBit})`);

    // ── 6. Garaga calldata formatting (same as worker) ──
    console.log('  --- Garaga calldata ---');
    const piBytes = flattenFieldsAsArray(pis);
    let calldataWithPrefix: string[];
    try {
      calldataWithPrefix = getZKHonkCallData(proofData.proof, piBytes, vk);
      assert(calldataWithPrefix.length > 15, `Calldata length = ${calldataWithPrefix.length}`);
    } catch (err: any) {
      assert(false, `Garaga calldata FAILED: ${err.message}`);
      continue;
    }

    // Validate Garaga prefix structure
    const declaredLen = Number(calldataWithPrefix[0]);
    assert(
      declaredLen === calldataWithPrefix.length - 1,
      `Garaga prefix: declared ${declaredLen}, actual ${calldataWithPrefix.length - 1}`,
    );

    // Strip prefix (same as worker does)
    const calldata = calldataWithPrefix.slice(1);

    // Validate public input offsets in calldata (Garaga format: each PI = 2 felts [lo, hi])
    // Index 0 = count(7), then PI[0] at [1,2], PI[1] at [3,4], etc.
    const piCount = Number(calldata[0]);
    assert(piCount === 7, `Calldata PI count = ${piCount} (expected 7)`);

    // PI[0] (game_id) at calldata[1] (lo), calldata[2] (hi)
    const cdGameIdLo = BigInt(calldata[1]);
    const cdGameIdHi = BigInt(calldata[2]);
    assert(cdGameIdLo === GAME_ID && cdGameIdHi === 0n, `Calldata game_id lo/hi correct`);

    // PI[4] (question_id) at calldata[9] (lo), calldata[10] (hi)
    const cdQidLo = BigInt(calldata[9]);
    assert(cdQidLo === BigInt(questionId), `Calldata question_id = ${questionId}`);

    // PI[6] (answer) at calldata[13] (lo)
    const cdAnswer = BigInt(calldata[13]);
    assert(Number(cdAnswer) === expectedBit, `Calldata answer_bit = ${expectedBit}`);

    // ── 7. Cross-validate with bb CLI verify (first test case only) ──
    if (charId === 42 && questionId === 104) {
      console.log('  --- bb CLI cross-validation ---');
      const tmpDir = resolve(CIRCUITS, '_test_tmp');
      mkdirSync(tmpDir, { recursive: true });

      // Write proof + public_inputs in the format bb expects
      writeFileSync(resolve(tmpDir, 'proof'), proofData.proof);

      // bb expects public_inputs as a binary file: each field as 32 bytes BE
      writeFileSync(resolve(tmpDir, 'public_inputs'), piBytes);

      try {
        // bb prints to stderr (C++ program), so check exit code (0 = verified)
        execSync(
          `bb verify -k ./target/vk/vk -p ./_test_tmp/proof -i ./_test_tmp/public_inputs --oracle_hash keccak`,
          { cwd: CIRCUITS, timeout: 30000 },
        );
        assert(true, 'bb CLI verify accepts JS-generated proof (exit 0)');
      } catch (err: any) {
        assert(false, `bb CLI verify REJECTED the proof: ${err.stderr?.toString() ?? err.message}`);
      }

      // Cleanup
      execSync(`rm -rf ${tmpDir}`);
    }
  }

  // ── Summary ──
  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Ran ${TEST_CASES.length} test cases in ${totalElapsed}s`);
  console.log(`${passes} passed, ${failures} failed`);
  if (failures === 0) {
    console.log('\nALL TESTS PASSED');
    console.log('Client proof pipeline (Noir → UltraHonk → Garaga) is fully operational.');
    console.log('evaluateBit matches circuit output for every test case.');
    console.log('Garaga calldata structure is correct (prefix, PI offsets, answer bit).');
  } else {
    console.error(`\n${failures} FAILURE(S) — investigate above.`);
    process.exit(1);
  }

  await backend.destroy();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
