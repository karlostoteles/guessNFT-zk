/**
 * test-e2e-proof-submission.ts
 *
 * Full end-to-end: create game → join → commit → ask → generate REAL proof → submit on-chain.
 *
 * Uses the same libraries as the Web Worker (Noir, bb.js, garaga) but in Node.js.
 * Runs against a live Katana instance with deployed contracts.
 *
 * Usage: npx tsx scripts/test-e2e-proof-submission.ts
 */
import { Account, RpcProvider } from 'starknet';
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend, BarretenbergSync } from '@aztec/bb.js';
import { init as garagaInit, getZKHonkCallData } from 'garaga';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const RPC_URL = 'http://localhost:5050';
const GAME_CONTRACT = '0xb0c00c0dd5d952fb6b704ab99cb9e5aeeb12d9f1e8c142357bebcf5096d624';
const TRAITS_ROOT = '0x296f3664665c3719c1498bd6642ed0e91d527b8d1e058fb6de45aaa5b88f9897';
const GAME_CREATED_SELECTOR = '0x1eb99ed24a15baaccc5c9a5458e3fc04f9cc107dbd431ef6e70b4158a253e8f';

// Two Katana predeployed accounts
const P1 = {
  address: '0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec',
  privateKey: '0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912',
};
const P2 = {
  address: '0x13d9ee239f33fea4f8785b9e3870ade909e20a9599ae7cd62c1c292b73af1b7',
  privateKey: '0x1c9053c053edf324aec366a34c6901b1095b07af69495bffec7d7fe21effb1b',
};

// Test character: Schizodio #42, question_id 104
const CHARACTER_ID = 42;
const QUESTION_ID = 104;
const SALT = 0x1234567890abcdefn;

// ─── Poseidon2 helpers (same as scripts/merkle.ts) ─────────────────────────

function toBE32(n: bigint): Uint8Array {
  const buf = new Uint8Array(32);
  let v = n;
  for (let i = 31; i >= 0; i--) { buf[i] = Number(v & 0xffn); v >>= 8n; }
  return buf;
}

function fromBE32(bytes: Uint8Array): bigint {
  let v = 0n;
  for (let i = 0; i < 32; i++) v = (v << 8n) | BigInt(bytes[i]);
  return v;
}

function add32(a: Uint8Array, b: Uint8Array): Uint8Array {
  return toBE32(fromBE32(a) + fromBE32(b));
}

const ZERO_32 = new Uint8Array(32);

function computeCommitment(bb: BarretenbergSync, gameId: bigint, player: bigint, charId: bigint, salt: bigint): bigint {
  const mid = bb.poseidon2Permutation({
    inputs: [toBE32(gameId), toBE32(player), toBE32(charId), ZERO_32],
  });
  const result = bb.poseidon2Permutation({
    inputs: [add32(mid.outputs[0], toBE32(salt)), mid.outputs[1], mid.outputs[2], mid.outputs[3]],
  });
  return fromBE32(result.outputs[0]);
}

function u256Calldata(v: bigint): [string, string] {
  const low = '0x' + (v & ((1n << 128n) - 1n)).toString(16);
  const high = '0x' + (v >> 128n).toString(16);
  return [low, high];
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

async function exec(account: Account, entrypoint: string, calldata: string[], label: string): Promise<boolean> {
  try {
    const tx = await account.execute([{ contractAddress: GAME_CONTRACT, entrypoint, calldata }]);
    const receipt = await account.waitForTransaction(tx.transaction_hash);
    const status = (receipt as any).execution_status ?? 'unknown';
    console.log(`  [OK] ${label} — status: ${status}`);
    return true;
  } catch (e: any) {
    const msg = e.message ?? String(e);
    if (msg.includes('REVERTED') || msg.includes('execution_error')) {
      const knownReasons = [
        'Proof game_id mismatch',
        'Proof turn_id mismatch',
        'Proof player mismatch',
        'Proof question_id mismatch',
        'Proof traits_root mismatch',
        'Proof commitment mismatch',
        'ZK proof verification failed',
        'Verifier not deployed',
        'INVALID_PHASE',
        'NOT_YOUR_TURN',
      ];
      const known = knownReasons.find((r) => msg.includes(r));
      const reason = known
        ?? msg.match(/execution_error.*?\\x00([^"\\]+)/)?.[1]
        ?? msg.match(/Failure reason: "([^"]+)"/)?.[1]
        ?? msg.slice(0, 300);
      console.log(`  [REVERTED] ${label} — ${reason}`);
      if (!known) {
        console.log(`  [DEBUG] raw error head: ${msg.slice(0, 1200)}`);
      }
    } else {
      console.log(`  [ERR] ${label} — ${msg.slice(0, 300)}`);
    }
    return false;
  }
}

async function main() {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const acct1 = new Account({ provider, address: P1.address, signer: P1.privateKey });
  const acct2 = new Account({ provider, address: P2.address, signer: P2.privateKey });

  // Load collection data
  const collectionPath = resolve(ROOT, 'public/collections/schizodio.json');
  const collection = JSON.parse(readFileSync(collectionPath, 'utf8')) as {
    traits_root: string;
    characters: Array<{
      id: number;
      bitmap: string[];
      merkle_path: string[];
      merkle_path_is_left: boolean[];
    }>;
  };
  const character = collection.characters[CHARACTER_ID];

  console.log('=== Full E2E: Real proof → Katana ===\n');
  console.log(`Character: #${CHARACTER_ID}`);
  console.log(`Question:  #${QUESTION_ID}`);
  console.log(`Player 1 (asker):   ${P1.address.slice(0, 18)}...`);
  console.log(`Player 2 (prover):  ${P2.address.slice(0, 18)}...`);

  // ── Step 1: Compute ZK commitment ────────────────────────────────────────
  console.log('\n--- Step 1: Compute ZK commitment ---');
  await BarretenbergSync.initSingleton();
  const bbSync = BarretenbergSync.getSingleton();

  // We need the on-chain game_id. Since Dojo uses a counter, the next game will
  // have a specific ID. We'll create the game first, then match.
  // For the commitment, we use game_id as a placeholder — we'll know the actual ID after create_game.
  // BUT the proof must match, so we compute after knowing the game_id.

  // ── Step 2: Create + join game ────────────────────────────────────────────
  console.log('\n--- Step 2: create_game + join_game ---');
  const [rootLow, rootHigh] = u256Calldata(BigInt(TRAITS_ROOT));
  const createTx = await acct1.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'create_game',
    calldata: [rootLow, rootHigh, '0'],
  }]);
  const createReceipt = await acct1.waitForTransaction(createTx.transaction_hash);
  const gameCreatedEvent = ((createReceipt as any).events ?? []).find((ev: any) =>
    Array.isArray(ev.keys) && ev.keys.some((k: string) => String(k).toLowerCase() === GAME_CREATED_SELECTOR)
  );
  if (!gameCreatedEvent?.data?.[1]) {
    throw new Error('Failed to extract game_id from create_game receipt');
  }
  const foundGameId = String(gameCreatedEvent.data[1]);
  const onChainGameId = BigInt(foundGameId);
  console.log(`  Created game_id: ${foundGameId}`);

  const joinOk = await exec(acct2, 'join_game', [foundGameId], 'join_game (P2)');
  if (!joinOk) {
    console.log('FATAL: Cannot join created game');
    return;
  }

  // Now compute the real commitment with the actual game_id
  const zkCommitment = computeCommitment(
    bbSync,
    onChainGameId,
    BigInt(P2.address),
    BigInt(CHARACTER_ID),
    SALT,
  );
  console.log(`  ZK commitment: 0x${zkCommitment.toString(16)}`);

  // ── Step 3: Commit characters ─────────────────────────────────────────────
  console.log('\n--- Step 3: commit_character (both) ---');
  const dummyPedersenCommit = '0xdeadbeef';  // P1's commit (not ZK-verified)
  const [zkLow1, zkHigh1] = u256Calldata(0xabcdef123456n); // P1's dummy zk commitment
  await exec(acct1, 'commit_character', [foundGameId, dummyPedersenCommit, zkLow1, zkHigh1], 'commit P1');

  const pedersenCommitP2 = '0xcafebabe';
  const [zkLow2, zkHigh2] = u256Calldata(zkCommitment);
  const commitOk = await exec(acct2, 'commit_character', [foundGameId, pedersenCommitP2, zkLow2, zkHigh2], 'commit P2 (real ZK commitment)');
  if (!commitOk) { console.log('FATAL: Cannot commit P2'); return; }

  // ── Step 4: Ask question (P1) ─────────────────────────────────────────────
  console.log('\n--- Step 4: ask_question (P1) ---');
  const askOk = await exec(acct1, 'ask_question', [foundGameId, String(QUESTION_ID)], `ask_question(${QUESTION_ID})`);
  if (!askOk) { console.log('FATAL: Cannot ask question'); return; }

  // ── Step 5: Generate REAL proof (P2) ──────────────────────────────────────
  console.log('\n--- Step 5: Generate REAL ZK proof ---');
  console.log('  Loading circuit...');

  const circuitJson = JSON.parse(
    readFileSync(resolve(ROOT, 'packages/circuits/target/whoiswho_answer.json'), 'utf8'),
  );

  await garagaInit();
  const backend = new UltraHonkBackend(circuitJson.bytecode, { threads: 1 });
  const noir = new Noir(circuitJson as any);
  const vk = new Uint8Array(
    readFileSync(resolve(ROOT, 'packages/circuits/target/vk/vk')),
  );
  console.log('  Circuit + VK loaded');

  // Read the game's turn_count from contract. After create+join+commit*2+ask = turn_count should be 1.
  // The contract sets turn_count when transitioning phases. Let's use 1 as default.
  const turnCount = 1n;

  const witnessInputs = {
    game_id: String(onChainGameId),
    turn_id: String(turnCount),
    player: String(BigInt(P2.address)),
    commitment: String(zkCommitment),
    question_id: String(QUESTION_ID),
    traits_root: String(BigInt(TRAITS_ROOT)),
    character_id: String(CHARACTER_ID),
    salt: String(SALT),
    trait_bitmap: character.bitmap,
    merkle_path: character.merkle_path,
  };

  console.log('  Generating witness...');
  const { witness } = await noir.execute(witnessInputs);
  console.log('  Witness generated');

  console.log('  Generating proof (this takes 30-120s)...');
  const startProve = Date.now();
  const proofData = await backend.generateProof(witness, { keccakZK: true });
  const elapsed = ((Date.now() - startProve) / 1000).toFixed(1);
  console.log(`  Proof generated in ${elapsed}s`);

  // Format calldata via garaga
  console.log('  Formatting Starknet calldata...');
  const piBytes = flattenFieldsAsArray(proofData.publicInputs);
  const calldataWithPrefix = getZKHonkCallData(proofData.proof, piBytes, vk);
  const declaredLen = Number(calldataWithPrefix[0] ?? 0n);
  const calldata = calldataWithPrefix.slice(1);
  console.log(`  Calldata: ${calldata.length} elements (declared ${declaredLen})`);
  console.log(`  Proof PIs: ${proofData.publicInputs.join(', ')}`);
  console.log(
    `  Calldata head: ${calldata.slice(0, 15).map((v) => `0x${v.toString(16)}`).join(', ')}`,
  );

  const answerBit = Number(proofData.publicInputs[proofData.publicInputs.length - 1]);
  console.log(`  Answer bit: ${answerBit} (${answerBit ? 'YES' : 'NO'})`);

  // ── Step 6: Submit proof on-chain ─────────────────────────────────────────
  console.log('\n--- Step 6: answer_question_with_proof (P2, REAL proof) ---');
  const proofCalldata = calldata.map(String);
  const submitOk = await exec(
    acct2,
    'answer_question_with_proof',
    [foundGameId, String(proofCalldata.length), ...proofCalldata],
    'answer_question_with_proof (REAL)',
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n========================================');
  if (submitOk) {
    console.log('SUCCESS: Real ZK proof accepted on-chain!');
    console.log('The full pipeline works: Noir → bb.js → garaga → Katana contract');
  } else {
    console.log('FAILED: Proof was rejected. Check revert reason above.');
  }
  console.log('========================================');

  await backend.destroy();
}

main().catch(console.error);
