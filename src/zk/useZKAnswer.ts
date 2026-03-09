/**
 * ZK proof generation + on-chain submission for answering questions.
 *
 * Self-contained: all imports from src/zk/ internal paths.
 * Post-merge, hook into the main store via imports from src/core/store/.
 *
 * Exports:
 *   - generateAndSubmitProof(): standalone async — callable from any context
 *   - askQuestionOnChain(): submit ask_question tx on Katana
 *   - useZKAnswer(): React hook wrapper
 *   - prewarmProver() / terminateProver(): worker lifecycle
 */
import { useCallback } from 'react';
import {
  loadCollectionData,
  getCharacterBitmap,
  getCharacterMerklePath,
} from './collectionData';
import { evaluateBit } from './evaluateBit';
import { TRAITS_ROOT, GAME_CONTRACT } from './config';
import { getStarknetAccount, toFeltHex, toDecimalField, splitU256, toBigInt } from './zkSdk';
import type {
  ProveRequest,
  ProveResult,
  WorkerMessage,
} from './workers/prover.worker';

// ─── Singleton worker ─────────────────────────────────────────────────────────

let globalWorker: Worker | null = null;

function getOrCreateWorker(): Worker {
  if (!globalWorker) {
    globalWorker = new Worker(
      new URL('./workers/prover.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return globalWorker;
}

export function prewarmProver(): void {
  getOrCreateWorker();
}

export function terminateProver(): void {
  if (globalWorker) {
    globalWorker.terminate();
    globalWorker = null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GAME_CREATED_SELECTOR =
  '0x1eb99ed24a15baaccc5c9a5458e3fc04f9cc107dbd431ef6e70b4158a253e8f';

function getExecAccount(playerNum?: 1 | 2) {
  const account = getStarknetAccount(playerNum);
  if (!account) {
    throw new Error('No Starknet account connected');
  }
  return account;
}

/**
 * Check a transaction receipt for revert and throw if the tx failed.
 * On Katana dev mode, reverted txs still get included (waitForTransaction resolves),
 * but the execution_status will be 'REVERTED'.
 */
function assertTxSuccess(receipt: any, context: string): void {
  const status = receipt?.execution_status ?? receipt?.status;
  if (typeof status === 'string' && status.toUpperCase() === 'REVERTED') {
    const reason = receipt?.revert_reason ?? receipt?.revert_error ?? 'unknown';
    throw new Error(`${context} tx reverted: ${reason}`);
  }
}

function extractGameIdFromReceipt(receipt: any): string {
  const events: any[] = receipt?.events ?? [];
  for (const ev of events) {
    if (!Array.isArray(ev.keys)) continue;
    const selectorIdx = ev.keys.findIndex(
      (k: string) => String(k).toLowerCase() === GAME_CREATED_SELECTOR,
    );
    if (selectorIdx < 0) continue;
    if (Array.isArray(ev.data) && ev.data.length >= 2) {
      const candidate = toBigInt(ev.data[1]);
      return toFeltHex(candidate);
    }
  }
  throw new Error('Unable to extract game_id from create_game transaction receipt');
}

// ─── Contract calls ───────────────────────────────────────────────────────────

export async function createGameOnChain(playerNum?: 1 | 2): Promise<string> {
  const account = getExecAccount(playerNum);
  const [rootLow, rootHigh] = splitU256(TRAITS_ROOT);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'create_game',
    calldata: [rootLow, rootHigh, '0'],
  }]);
  const receipt = await account.waitForTransaction(tx.transaction_hash);
  assertTxSuccess(receipt, 'create_game');
  return extractGameIdFromReceipt(receipt);
}

export async function joinGameOnChain(gameId: string, playerNum?: 1 | 2): Promise<void> {
  const account = getExecAccount(playerNum);
  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'join_game',
    calldata: [toFeltHex(gameId)],
  }]);
  const joinReceipt = await account.waitForTransaction(tx.transaction_hash);
  assertTxSuccess(joinReceipt, 'join_game');
}

export async function commitCharacterOnChain(
  gameId: string,
  commitmentHash: string,
  zkCommitment: string,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);
  const [zkLow, zkHigh] = splitU256(zkCommitment);
  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'commit_character',
    calldata: [toFeltHex(gameId), toFeltHex(commitmentHash), zkLow, zkHigh],
  }]);
  const receipt = await account.waitForTransaction(tx.transaction_hash);
  assertTxSuccess(receipt, 'commit_character');
}

// ─── Standalone proof generation + on-chain submission ────────────────────────

export interface ZKAnswerOpts {
  gameId: string;
  turnId: string;
  commitment: string;
  questionId: number;
  characterId: number;
  salt: string;
  playerNum?: 1 | 2;
}

export interface ZKAnswerLifecycleCallbacks {
  onStatusChange?: (status: 'proving' | 'submitting') => void;
}

// Last proof opts for retry after error
let lastProofOpts: ZKAnswerOpts | null = null;

/**
 * Store interface — post-merge, these callbacks will be wired to the real store.
 * For now, callers must provide them.
 */
export interface ZKStoreCallbacks {
  setPhase: (phase: string) => void;
  clearProofError: () => void;
  setVerifiedAnswer: (answer: boolean) => void;
  setProofError: (message: string) => void;
  clearProcessedTurnId?: (turnId: number) => void;
}

// Module-level store callbacks — set by the sync hook at mount time
let storeCallbacks: ZKStoreCallbacks | null = null;

export function setZKStoreCallbacks(callbacks: ZKStoreCallbacks): void {
  storeCallbacks = callbacks;
}

function getStoreCallbacks(): ZKStoreCallbacks {
  if (!storeCallbacks) {
    throw new Error('ZK store callbacks not initialized. Call setZKStoreCallbacks() first.');
  }
  return storeCallbacks;
}

/**
 * Generate ZK proof and submit it on-chain.
 * Callable from any context (not just React hooks).
 * Manages store phases: PROVING → SUBMITTING → VERIFIED
 */
export async function generateAndSubmitProof(opts: ZKAnswerOpts): Promise<ProveResult> {
  return generateAndSubmitProofWithLifecycle(opts);
}

export async function generateAndSubmitProofWithLifecycle(
  opts: ZKAnswerOpts,
  lifecycle?: ZKAnswerLifecycleCallbacks,
): Promise<ProveResult> {
  lastProofOpts = opts;
  const store = getStoreCallbacks();
  lifecycle?.onStatusChange?.('proving');
  store.clearProofError();

  const account = getExecAccount(opts.playerNum);
  const worker = getOrCreateWorker();
  const id = crypto.randomUUID();

  const dataset = await loadCollectionData();
  const bitmap = getCharacterBitmap(dataset, opts.characterId);
  const merkle_path = getCharacterMerklePath(dataset, opts.characterId);

  // Diagnostic: predict what the circuit SHOULD return
  const localPrediction = evaluateBit(bitmap, opts.questionId);
  console.log('[zk-debug] === generateAndSubmitProof ===');
  console.log('[zk-debug] local prediction:', localPrediction ? 'YES (1)' : 'NO (0)');

  const req: ProveRequest = {
    type: 'prove',
    id,
    game_id: toDecimalField(opts.gameId),
    turn_id: toDecimalField(opts.turnId),
    player: toDecimalField(String(account.address)),
    commitment: toDecimalField(opts.commitment),
    question_id: opts.questionId,
    traits_root: toDecimalField(TRAITS_ROOT),
    character_id: opts.characterId,
    salt: toDecimalField(opts.salt),
    bitmap,
    merkle_path,
  };

  try {
    // 1. Generate proof via Web Worker
    const result = await new Promise<ProveResult>((resolve, reject) => {
      const handler = (e: MessageEvent<WorkerMessage>) => {
        if (e.data.id !== id) return;

        if (e.data.type === 'progress') {
          if (e.data.step === 'proving') lifecycle?.onStatusChange?.('proving');
        } else {
          worker.removeEventListener('message', handler);
          if (e.data.type === 'result') {
            resolve(e.data);
          } else {
            reject(new Error(e.data.message));
          }
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage(req);
    });

    // 2. Submit proof on-chain
    lifecycle?.onStatusChange?.('submitting');

    const tx = await account.execute([{
      contractAddress: GAME_CONTRACT,
      entrypoint: 'answer_question_with_proof',
      calldata: [
        toFeltHex(opts.gameId),
        String(result.proofCalldata.length),
        ...result.proofCalldata,
      ],
    }]);

    const proofReceipt = await account.waitForTransaction(tx.transaction_hash);
    assertTxSuccess(proofReceipt, 'answer_question_with_proof');

    // 3. Mark verified
    const circuitAnswer = Boolean(result.answerBit);
    console.log('[zk-debug] === PROOF RESULT ===');
    console.log('[zk-debug] circuit answerBit:', result.answerBit, '→', circuitAnswer ? 'YES' : 'NO');
    console.log('[zk-debug] local prediction was:', localPrediction ? 'YES' : 'NO');
    if (circuitAnswer !== localPrediction) {
      console.error('[zk-debug] MISMATCH! Circuit disagrees with evaluateBit. Inputs may differ.');
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    getStoreCallbacks().setProofError(msg);
    throw err;
  }
}

/**
 * Retry the last failed proof generation.
 */
export async function retryLastProof(
  clearProcessedTurnId?: (turnId: number) => void,
  lifecycle?: ZKAnswerLifecycleCallbacks,
): Promise<ProveResult | null> {
  if (!lastProofOpts) return null;
  const store = getStoreCallbacks();
  store.clearProofError();
  const clearTurn =
    clearProcessedTurnId ?? store.clearProcessedTurnId;
  if (clearTurn) {
    clearTurn(Number(lastProofOpts.turnId));
  }
  return generateAndSubmitProofWithLifecycle(lastProofOpts, lifecycle);
}

/**
 * Submit ask_question on-chain (Katana).
 */
export async function askQuestionOnChain(
  gameId: string,
  questionId: number,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'ask_question',
    calldata: [toFeltHex(gameId), String(questionId)],
  }]);

  const receipt = await account.waitForTransaction(tx.transaction_hash);
  assertTxSuccess(receipt, 'ask_question');
}

/**
 * Submit eliminate_characters on-chain.
 */
export async function eliminateCharactersOnChain(
  gameId: string,
  eliminatedBitmap: bigint,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'eliminate_characters',
    calldata: [toFeltHex(gameId), toFeltHex(eliminatedBitmap)],
  }]);

  const receipt = await account.waitForTransaction(tx.transaction_hash);
  assertTxSuccess(receipt, 'eliminate_characters');
}

/**
 * Submit make_guess on-chain.
 */
export async function makeGuessOnChain(
  gameId: string,
  characterIdFelt: string,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'make_guess',
    calldata: [toFeltHex(gameId), toFeltHex(characterIdFelt)],
  }]);

  const receipt = await account.waitForTransaction(tx.transaction_hash);
  assertTxSuccess(receipt, 'make_guess');
}

/**
 * Submit reveal_character on-chain.
 */
export async function revealCharacterOnChain(
  gameId: string,
  characterIdFelt: string,
  salt: string,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'reveal_character',
    calldata: [toFeltHex(gameId), toFeltHex(characterIdFelt), toFeltHex(salt)],
  }]);

  const receipt = await account.waitForTransaction(tx.transaction_hash);
  assertTxSuccess(receipt, 'reveal_character');
}

// ─── React Hook (thin wrapper) ───────────────────────────────────────────────

export function useZKAnswer() {
  const generateProof = useCallback(
    (opts: ZKAnswerOpts) => generateAndSubmitProof(opts),
    [],
  );

  return { generateProof, prewarmProver, terminateProver };
}
