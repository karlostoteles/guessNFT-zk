/**
 * ZK Commitment — Poseidon2 BN254 commitment for ZK proofs.
 *
 * Separated from the Pedersen commit-reveal system (which stays in commitReveal.ts).
 * This file handles only the Poseidon2 BN254 commitment used by the Noir circuit.
 *
 * Post-merge, integrate these functions into src/services/starknet/commitReveal.ts.
 */
import { BarretenbergSync } from '@aztec/bb.js';

// ─── Barretenberg helpers ─────────────────────────────────────────────────────

export function toBE32(n: bigint): Uint8Array {
  const buf = new Uint8Array(32);
  let v = n;
  for (let i = 31; i >= 0; i--) { buf[i] = Number(v & 0xffn); v >>= 8n; }
  return buf;
}

export function fromBE32(bytes: Uint8Array): bigint {
  let v = 0n;
  for (let i = 0; i < 32; i++) v = (v << 8n) | BigInt(bytes[i]);
  return v;
}

export function add32(a: Uint8Array, b: Uint8Array): Uint8Array {
  const va = fromBE32(a);
  const vb = fromBE32(b);
  return toBE32(va + vb);
}

const ZERO_32 = new Uint8Array(32);

let bbInstance: BarretenbergSync | null = null;
export async function getBB(): Promise<BarretenbergSync> {
  if (!bbInstance) {
    await BarretenbergSync.initSingleton();
    bbInstance = BarretenbergSync.getSingleton();
  }
  return bbInstance;
}

// ─── Poseidon2 BN254 commitment ───────────────────────────────────────────────

/**
 * Poseidon2 BN254 commitment: hash4(game_id, player, character_id, salt).
 * Matches the circuit's `hash4()` exactly.
 * Returns bigint (stored as u256 on Starknet).
 */
export async function computeZKCommitment(
  gameId: bigint,
  player: bigint,
  characterId: bigint,
  salt: bigint,
): Promise<bigint> {
  const bb = await getBB();
  // hash4: perm([a, b, c, 0]) → mid; perm([mid[0]+d, mid[1], mid[2], mid[3]])[0]
  const mid = bb.poseidon2Permutation({
    inputs: [toBE32(gameId), toBE32(player), toBE32(characterId), ZERO_32],
  });
  const result = bb.poseidon2Permutation({
    inputs: [add32(mid.outputs[0], toBE32(salt)), mid.outputs[1], mid.outputs[2], mid.outputs[3]],
  });
  return fromBE32(result.outputs[0]);
}

/**
 * Convert app character IDs to the circuit's 0-based character index:
 * - "nft_1"   -> 0
 * - "nft_999" -> 998
 * - "42"      -> 42 (already numeric)
 */
export function characterIdToCircuitId(characterId: string): bigint {
  if (characterId.startsWith('nft_')) {
    // nft_X IDs are already 0-based (0–998) — NO subtraction needed.
    const tokenId = Number.parseInt(characterId.slice(4), 10);
    if (!Number.isFinite(tokenId) || tokenId < 0) {
      throw new Error(`Invalid NFT character id: ${characterId}`);
    }
    return BigInt(tokenId);
  }
  return BigInt(characterId);
}

/**
 * Rejection-sampled salt: uniform in [0, STARK_PRIME) with zero modulo bias.
 */
const STARK_PRIME = BigInt('0x800000000000011000000000000000000000000000000000000000000000001');

export function generateSalt(): string {
  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const val = bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
    if (val < STARK_PRIME) return '0x' + val.toString(16);
  }
}

/**
 * Create commitment with ZK commitment (for NFT/online mode).
 * Given a stored Pedersen commitment, computes the Poseidon2 BN254 zkCommitment.
 *
 * Post-merge, this logic integrates into commitReveal.ts's createCommitmentWithZK().
 */
export async function computeAndAttachZKCommitment(
  characterId: string,
  salt: string,
  gameId: bigint,
  playerAddress: bigint,
): Promise<string> {
  const numericId = characterIdToCircuitId(characterId);
  const zkHash = await computeZKCommitment(
    gameId,
    playerAddress,
    numericId,
    BigInt(salt),
  );
  return '0x' + zkHash.toString(16);
}
