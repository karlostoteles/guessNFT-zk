/**
 * Commit-Reveal scheme for guessNFT on Starknet.
 *
 * How it works:
 *   1. COMMIT:  player picks a character, generates random salt.
 *               commitment = pedersen_hash(character_id_felt, salt)
 *               Phase 1 (local):  commitment stored in localStorage
 *               Phase 2 (on-chain): tx call game_contract.commit_character(commitment)
 *
 *   2. PLAY:    questions/answers happen. Neither player can change their character
 *               after committing because they don't know the salt the other used.
 *
 *   3. REVEAL:  at game end, each player reveals (character_id, salt).
 *               Phase 1: verify hash(character_id, salt) === stored_commitment
 *               Phase 2: game_contract.reveal_character(char_id, salt) — contract verifies
 *
 * This file is Phase 1: fully local, no contract. The API surface matches what Phase 2
 * will look like, so wiring up the contract later is a drop-in replacement.
 *
 * Cryptographic note:
 *   Starknet uses Pedersen hash natively. Here we use a JS Pedersen from starknet.js
 *   so commitments are compatible with what the future Cairo contract will verify.
 */
import { hash } from 'starknet';
import { getAccount } from './sdk';
import { GAME_CONTRACT } from './config';

const STORAGE_KEY = 'guessnft_commitments';

export interface Commitment {
  playerId: 'player1' | 'player2';
  characterId: string;
  salt: string;        // hex string, 32 bytes
  commitment: string;  // hex Pedersen hash
  gameSessionId: string;
}

/**
 * Generate a cryptographically random salt guaranteed to be within the
 * Stark field: 0 <= salt < P  (P ≈ 2^251.58).
 *
 * Generate 32 raw bytes then reduce mod P — this keeps the full entropy
 * distribution while preventing the "PedersenArg should be 0 <= value <
 * CURVE.P" crash that starknet.js throws when the salt exceeds the prime.
 */
const STARK_PRIME = BigInt('0x800000000000011000000000000000000000000000000000000000000000001');

function generateSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = BigInt('0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(''));
  return '0x' + (raw % STARK_PRIME).toString(16);
}

/**
 * Convert a character ID string to a felt252-compatible numeric value.
 *
 * For NFT characters ("nft_X"), returns the 0-based token index as a felt.
 * This MUST match the encoding used by the ZK circuit (characterIdToCircuitId)
 * and the GameStoreAdapter, so that pedersen(charFelt, salt) is consistent
 * across commit, reveal, and proof generation.
 */
function characterIdToFelt(characterId: string): string {
  if (characterId.startsWith('nft_')) {
    const tokenId = parseInt(characterId.slice(4), 10);
    if (!Number.isFinite(tokenId) || tokenId < 0) {
      throw new Error(`Invalid NFT character id: ${characterId}`);
    }
    return '0x' + BigInt(tokenId).toString(16);
  }
  // Non-NFT: treat as a numeric string directly
  return '0x' + BigInt(characterId).toString(16);
}

/**
 * Compute the commitment: pedersen(character_id_felt, salt).
 * This matches what the Cairo contract will compute:
 *   let commitment = pedersen(char_felt, salt);
 */
function computeCommitment(characterIdFelt: string, salt: string): string {
  return hash.computePedersenHash(characterIdFelt, salt);
}

// ─── Phase 1 API (local storage) ─────────────────────────────────────────────

function loadAll(): Commitment[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAll(commitments: Commitment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(commitments));
}

/**
 * Create and store a commitment for a player's character choice.
 * Call this immediately when the player selects their secret character.
 * Returns the commitment object (store the salt securely until reveal).
 */
export function createCommitment(
  playerId: 'player1' | 'player2',
  characterId: string,
  gameSessionId: string
): Commitment {
  const salt = generateSalt();
  const characterIdFelt = characterIdToFelt(characterId);
  const commitment = computeCommitment(characterIdFelt, salt);

  const c: Commitment = { playerId, characterId, salt, commitment, gameSessionId };

  // Store locally (Phase 1). Phase 2: also call game_contract.commit_character(commitment)
  const all = loadAll().filter(
    (x) => !(x.playerId === playerId && x.gameSessionId === gameSessionId)
  );
  saveAll([...all, c]);

  return c;
}

/**
 * Verify a reveal: checks that hash(characterId, salt) === stored commitment.
 * Returns true if valid, false if tampered.
 */
export function verifyReveal(
  playerId: 'player1' | 'player2',
  characterId: string,
  salt: string,
  gameSessionId: string
): boolean {
  const all = loadAll();
  const stored = all.find((c) => c.playerId === playerId && c.gameSessionId === gameSessionId);

  if (!stored) {
    console.warn('[commitReveal] No stored commitment found for', playerId);
    return false;
  }

  const characterIdFelt = characterIdToFelt(characterId);
  const recomputed = computeCommitment(characterIdFelt, salt);
  const valid = recomputed === stored.commitment;

  if (!valid) {
    console.error('[commitReveal] COMMITMENT MISMATCH — possible cheating!', {
      stored: stored.commitment,
      recomputed,
    });
  }

  return valid;
}

/**
 * Retrieve the stored commitment for a player (includes salt for reveal).
 */
export function getCommitment(
  playerId: 'player1' | 'player2',
  gameSessionId: string
): Commitment | null {
  return loadAll().find((c) => c.playerId === playerId && c.gameSessionId === gameSessionId) ?? null;
}

/**
 * Clear commitments for a finished game session.
 */
export function clearCommitments(gameSessionId: string) {
  saveAll(loadAll().filter((c) => c.gameSessionId !== gameSessionId));
}

/**
 * Generate a unique game session ID.
 */
export function generateGameSessionId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Phase 2 stubs (on-chain) ─────────────────────────────────────────────────
// When the Cairo contract is deployed, replace the Phase 1 localStorage calls above
// with these Starknet transaction calls. The commitment value stays identical.
export async function submitCommitmentOnChain(
  commitment: string,
  gameId: string
): Promise<string> {
  const account = getAccount();
  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'commit_character',
    calldata: [gameId, commitment],
  }]);

  // controller.execute returns an object with transaction_hash or directly the string depending on version.
  // Cast to any and return the hash.
  return (tx as any).transaction_hash || String(tx);
}

/**
 * [Phase 2 stub] Reveal character on-chain.
 */
export async function revealCharacterOnChain(
  characterId: string,
  salt: string,
  gameId: string
): Promise<string> {
  const account = getAccount();
  const characterIdFelt = characterIdToFelt(characterId);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'reveal_character',
    calldata: [gameId, characterIdFelt, salt],
  }]);

  return (tx as any).transaction_hash || String(tx);
}

/**
 * [Phase 2 stub] Deposit wager on-chain.
 */
export async function depositWagerOnChain(
  gameId: string,
  tokenId: string
): Promise<string> {
  const account = getAccount();

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'deposit_wager',
    // Uint256 is split into low and high segments (tokenId, 0)
    calldata: [gameId, tokenId, '0'],
  }]);

  return (tx as any).transaction_hash || String(tx);
}

/**
 * [Phase 2 stub] Concede game on-chain (sends both wagers to opponent).
 */
export async function opponentWonOnChain(
  gameId: string
): Promise<string> {
  const account = getAccount();

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'opponent_won',
    calldata: [gameId],
  }]);

  return (tx as any).transaction_hash || String(tx);
}
