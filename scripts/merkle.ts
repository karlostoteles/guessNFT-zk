// scripts/merkle.ts
// Poseidon2-based Merkle tree for character membership proofs.
//
// WHY POSEIDON2 (not Pedersen, not SHA-256):
//   - SHA-256 costs ~30k Noir gates per call.
//   - Poseidon2 costs ~30 gates — 1000x cheaper for a depth-10 tree.
//
// HASH CONSTRUCTION (explicit permutation-based sponge):
//   We use bb.js poseidon2Permutation (not poseidon2Hash) because:
//   - poseidon2Permutation matches std::hash::poseidon2_permutation in Noir (verified)
//   - poseidon2Hash uses a different sponge construction (NOT accessible in Noir circuits)
//
//   hash2(a, b): perm([a, b, 0, 0])[0]
//   hash4(a, b, c, d): mid = perm([a, b, c, 0]); perm([mid[0]+d, mid[1], mid[2], mid[3]])[0]
//
//   Matching Noir circuit functions in src/main.nr and src/merkle.nr.
//
// FIELD COMPATIBILITY:
//   Poseidon2 outputs are BN254 field elements (< 2^254).
//   Stark prime ~2^252, so ~16% of outputs exceed felt252 max.
//   Starknet stores hashes as u256; Garaga verifier extracts public inputs as u256.
//
// WASM INIT:
//   Top-level await loads Barretenberg WASM once when first imported.
//   All calls after that are synchronous.

import { BarretenbergSync } from '@aztec/bb.js';

const bb = await BarretenbergSync.new();

// Encode a bigint as a 32-byte big-endian Uint8Array (BN254 field element wire format).
function toBE32(n: bigint): Uint8Array {
  const buf = new Uint8Array(32);
  let v = n;
  for (let i = 31; i >= 0; i--) {
    buf[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

// Call poseidon2Permutation and decode output to bigints.
// Returns the t=4 permuted state.
function permute(a: bigint, b: bigint, c: bigint, d: bigint): [bigint, bigint, bigint, bigint] {
  const result = bb.poseidon2Permutation({
    inputs: [toBE32(a), toBE32(b), toBE32(c), toBE32(d)],
  });
  return result.outputs.map((v: Uint8Array) => BigInt('0x' + Buffer.from(v).toString('hex'))) as [bigint, bigint, bigint, bigint];
}

// Poseidon2 hash of 2 BN254 field elements.
// Sponge: state=[a, b, 0, 0], permute, return state[0].
// Matches: Noir std::hash::poseidon2_permutation([a, b, 0, 0], 4)[0]
function hash2(a: bigint, b: bigint): bigint {
  return permute(a, b, 0n, 0n)[0];
}

// Poseidon2 hash of 4 BN254 field elements.
// Sponge rate=3: absorb first 3, permute, add 4th to state[0], permute, return state[0].
// Matches: Noir hash4(a,b,c,d) in src/main.nr.
function hash4(a: bigint, b: bigint, c: bigint, d: bigint): bigint {
  const mid = permute(a, b, c, 0n);
  return permute(mid[0] + d, mid[1], mid[2], mid[3])[0];
}

// Poseidon2 hash of 5 BN254 field elements.
// Sponge rate=3: absorb first 3, permute, add d to state[0] and e to state[1], permute, return state[0].
// Matches: Noir hash5(a,b,c,d,e) in src/main.nr.
function hash5(a: bigint, b: bigint, c: bigint, d: bigint, e: bigint): bigint {
  const mid = permute(a, b, c, 0n);
  return permute(mid[0] + d, mid[1] + e, mid[2], mid[3])[0];
}

// Empty (padding) leaf value — 0n.
// The Noir circuit uses the same zero for all padding slots beyond the real collection.
export const EMPTY_LEAF: bigint = 0n;

// Leaf = hash5(character_id, limb0, limb1, limb2, limb3)
// bitmap is a [u128; 4] tuple: [limb0, limb1, limb2, limb3]
// Noir: hash5(character_id, bitmap[0] as Field, bitmap[1] as Field, bitmap[2] as Field, bitmap[3] as Field)
export function computeLeaf(characterId: bigint, bitmap: [bigint, bigint, bigint, bigint]): bigint {
  return hash5(characterId, bitmap[0], bitmap[1], bitmap[2], bitmap[3]);
}

// Commitment = hash4(game_id, player, character_id, salt)
// Binds identity and game context — prevents cross-game replay attacks.
// Noir: hash4(game_id, player, character_id, salt)
export function computeCommitment(
  gameId: bigint,
  player: bigint,
  characterId: bigint,
  salt: bigint,
): bigint {
  return hash4(gameId, player, characterId, salt);
}

export interface MerkleTree {
  root: bigint;
  depth: number;
  getPath(leafIndex: number): { siblings: bigint[]; isLeft: boolean[] };
}

export function buildMerkleTree(leaves: bigint[], treeSize: number): MerkleTree {
  if (treeSize & (treeSize - 1)) throw new Error('treeSize must be a power of 2');
  const depth = Math.log2(treeSize);

  // Pad to treeSize with EMPTY_LEAF (= 0n)
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length < treeSize) paddedLeaves.push(EMPTY_LEAF);

  // Build layers bottom-up
  const layers: bigint[][] = [paddedLeaves];
  while (layers[layers.length - 1].length > 1) {
    const current = layers[layers.length - 1];
    const next: bigint[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(hash2(current[i], current[i + 1]));
    }
    layers.push(next);
  }

  const root = layers[layers.length - 1][0];

  function getPath(leafIndex: number): { siblings: bigint[]; isLeft: boolean[] } {
    if (leafIndex < 0 || leafIndex >= treeSize) {
      throw new Error(`leafIndex ${leafIndex} out of range [0, ${treeSize})`);
    }
    const siblings: bigint[] = [];
    const isLeft: boolean[] = [];
    let idx = leafIndex;
    for (let d = 0; d < depth; d++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      siblings.push(layers[d][siblingIdx]);
      isLeft.push(idx % 2 === 0);
      idx = Math.floor(idx / 2);
    }
    return { siblings, isLeft };
  }

  return { root, depth, getPath };
}

// Verify a Merkle path (mirrors the Noir circuit logic).
export function verifyPath(
  leaf: bigint,
  leafIndex: number,
  siblings: bigint[],
  isLeft: boolean[],
  expectedRoot: bigint,
): boolean {
  let current = leaf;
  for (let i = 0; i < siblings.length; i++) {
    current = isLeft[i]
      ? hash2(current, siblings[i])
      : hash2(siblings[i], current);
  }
  return current === expectedRoot;
}
