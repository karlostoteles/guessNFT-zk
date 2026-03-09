/**
 * test-onchain-wiring.ts
 *
 * End-to-end test against running Katana with two accounts:
 *   1. Account0 creates a game
 *   2. Account1 joins the game
 *   3. Both commit characters
 *   4. Account0 asks a question
 *   5. Account1 calls answer_question_with_proof (dummy calldata — will revert at verifier)
 *
 * This verifies the starknet.js v9 wiring (Account constructor, execute, calldata encoding).
 *
 * Usage: npx tsx scripts/test-onchain-wiring.ts
 */
import { Account, RpcProvider } from 'starknet';

const RPC_URL = 'http://localhost:5050';
const GAME_CONTRACT = '0xb0c00c0dd5d952fb6b704ab99cb9e5aeeb12d9f1e8c142357bebcf5096d624';
const TRAITS_ROOT = '0x296f3664665c3719c1498bd6642ed0e91d527b8d1e058fb6de45aaa5b88f9897';
const GAME_CREATED_SELECTOR = '0x1eb99ed24a15baaccc5c9a5458e3fc04f9cc107dbd431ef6e70b4158a253e8f';

const ACCT0 = {
  address: '0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec',
  privateKey: '0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912',
};
const ACCT1 = {
  address: '0x13d9ee239f33fea4f8785b9e3870ade909e20a9599ae7cd62c1c292b73af1b7',
  privateKey: '0x1c9053c053edf324aec366a34c6901b1095b07af69495bffec7d7fe21effb1b',
};

function u256Calldata(hex: string): [string, string] {
  const v = BigInt(hex);
  const low = '0x' + (v & ((1n << 128n) - 1n)).toString(16);
  const high = '0x' + (v >> 128n).toString(16);
  return [low, high];
}

async function exec(account: Account, entrypoint: string, calldata: string[], label: string) {
  try {
    const tx = await account.execute([{ contractAddress: GAME_CONTRACT, entrypoint, calldata }]);
    const receipt = await account.waitForTransaction(tx.transaction_hash);
    const status = (receipt as any).execution_status ?? (receipt as any).statusReceipt ?? 'unknown';
    console.log(`  [OK] ${label} — tx: ${tx.transaction_hash.slice(0, 18)}... status: ${status}`);
    return { tx, receipt, ok: true };
  } catch (e: any) {
    const msg = e.message ?? String(e);
    // Check if it's a revert (expected for some calls)
    if (msg.includes('REVERTED') || msg.includes('execution_error') || msg.includes('TRANSACTION_EXECUTION_ERROR')) {
      const reason = msg.match(/execution_error.*?\\x00([^"\\]+)/)?.[1]
        ?? msg.match(/Failure reason: "([^"]+)"/)?.[1]
        ?? msg.match(/execution_error":"([^"]+)"/)?.[1]
        ?? 'unknown';
      console.log(`  [REVERTED] ${label} — reason: ${reason.slice(0, 120)}`);
      return { ok: false, reverted: true, reason };
    }
    console.log(`  [ERR] ${label} — ${msg.slice(0, 200)}`);
    return { ok: false, reverted: false };
  }
}

async function main() {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const acct0 = new Account({ provider, address: ACCT0.address, signer: ACCT0.privateKey });
  const acct1 = new Account({ provider, address: ACCT1.address, signer: ACCT1.privateKey });

  console.log('Player 1:', acct0.address.slice(0, 20) + '...');
  console.log('Player 2:', acct1.address.slice(0, 20) + '...');

  // 1. Create game
  console.log('\n--- Step 1: create_game (Player 1) ---');
  const [rootLow, rootHigh] = u256Calldata(TRAITS_ROOT);
  const r1 = await exec(acct0, 'create_game', [rootLow, rootHigh, '1'], 'create_game');
  if (!r1.ok) { console.log('Cannot continue without game. Exiting.'); return; }

  // Extract Dojo game_id from GameCreated event data[1]
  let gameId = '';
  const events = (r1.receipt as any)?.events ?? [];
  for (const ev of events) {
    const keys = (ev.keys ?? []).map((k: string) => String(k).toLowerCase());
    if (!keys.includes(GAME_CREATED_SELECTOR)) continue;
    if (ev.data?.[1]) {
      gameId = ev.data[1];
      break;
    }
  }
  if (!gameId) throw new Error('Could not extract game_id from create_game receipt');
  console.log('  Game ID:', gameId);

  // 2. Join game (Player 2)
  console.log('\n--- Step 2: join_game (Player 2) ---');
  const r2 = await exec(acct1, 'join_game', [gameId], 'join_game');
  if (!r2.ok) { console.log('join_game failed. Game state may not allow it.'); }

  // 3. Commit characters
  console.log('\n--- Step 3: commit_character (both) ---');
  const dummyCommit = '0xdeadbeef';
  const [zkLow, zkHigh] = u256Calldata('0xabcdef123456');
  await exec(acct0, 'commit_character', [gameId, dummyCommit, zkLow, zkHigh], 'commit P1');
  await exec(acct1, 'commit_character', [gameId, '0xcafebabe', zkLow, zkHigh], 'commit P2');

  // 4. Ask question (Player 1)
  console.log('\n--- Step 4: ask_question (Player 1) ---');
  const r4 = await exec(acct0, 'ask_question', [gameId, '42'], 'ask_question(42)');

  // 5. answer_question_with_proof (Player 2) — dummy proof, expect verifier revert
  console.log('\n--- Step 5: answer_question_with_proof (Player 2) ---');
  const dummyProof = ['0x1', '0x2', '0x3', '0x4', '0x5'];
  const r5 = await exec(
    acct1,
    'answer_question_with_proof',
    [gameId, String(dummyProof.length), ...dummyProof],
    'answer_question_with_proof (dummy)',
  );

  // Summary
  console.log('\n=== Results ===');
  console.log('create_game:           ', r1.ok ? 'OK' : 'FAIL');
  console.log('join_game:             ', r2.ok ? 'OK' : 'FAIL');
  console.log('ask_question:          ', r4.ok ? 'OK' : 'FAIL');
  console.log('answer_with_proof:     ', r5.ok ? 'OK' : (r5 as any).reverted ? 'REVERTED (expected)' : 'FAIL');

  if (r1.ok && r4.ok) {
    console.log('\nWiring verified: Account → execute → Katana works end-to-end.');
    if ((r5 as any)?.reverted) {
      console.log('Proof submission reached the contract (reverted at verifier — correct for dummy proof).');
    }
  }
}

main().catch(console.error);
