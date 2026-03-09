// circuits/whoiswho_answer/src/merkle.nr
// Recomputes the Merkle root from a leaf + path.
// Uses Poseidon2 (BN254) via poseidon2_permutation -- matches @aztec/bb.js poseidon2Hash().

// Poseidon2 hash of 2 field elements.
// Sponge: state=[a, b, 0, 0], permute, return state[0].
// Matches JS permute([a, b, 0, 0])[0] using bb.js poseidon2Permutation.
fn hash2(a: Field, b: Field) -> Field {
    std::hash::poseidon2_permutation([a, b, 0, 0], 4)[0]
}

// Verify a Merkle path and return the computed root.
// index: the leaf's position in the tree (encoded as little-endian bits).
// path: sibling hashes from leaf level to root level (depth=10 for 1024-leaf tree).
pub fn merkle_verify(
    leaf: Field,
    index: Field,
    path: [Field; 10],
) -> Field {
    let mut current = leaf;
    let index_bits: [u1; 10] = index.to_le_bits();

    for i in 0..10 {
        let sibling = path[i];
        // bit=0 means current is left child: hash(current, sibling)
        // bit=1 means current is right child: hash(sibling, current)
        current = if index_bits[i] == 0 {
            hash2(current, sibling)
        } else {
            hash2(sibling, current)
        };
    }

    current
}
