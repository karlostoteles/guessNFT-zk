
// circuits/whoiswho_answer/src/main.nr
// WhoisWho answer-correctness circuit.
//
// Proves:
// 1. The answerer committed to this character (commitment binding)
// 2. The character's bitmap belongs to the official collection (Merkle membership)
// 3. The answer is what the bitmap actually says (question correctness)
// 4. This proof is bound to this specific game turn (anti-replay via public inputs)
//
// The character identity is NEVER revealed on-chain.

use std::hash::poseidon2_permutation;
mod merkle;


// Poseidon2 hash of 4 field elements.
// Sponge rate=3: absorb first 3, permute, add 4th to state[0], permute, return state[0].
// Matches JS: mid=permute([a,b,c,0]); permute([mid[0]+d, mid[1..3]])[0]
fn hash4(a: Field, b: Field, c: Field, d: Field) -> Field {
    let mid = poseidon2_permutation([a, b, c, 0], 4);
    poseidon2_permutation([mid[0] + d, mid[1], mid[2], mid[3]], 4)[0]
}

// Poseidon2 hash of 5 field elements.
// Sponge rate=3: absorb first 3, permute, add d to state[0] and e to state[1], permute, return state[0].
// Matches JS: mid=permute([a,b,c,0]); permute([mid[0]+d, mid[1]+e, mid[2], mid[3]])[0]
fn hash5(a: Field, b: Field, c: Field, d: Field, e: Field) -> Field {
    let mid = poseidon2_permutation([a, b, c, 0], 4);
    poseidon2_permutation([mid[0] + d, mid[1] + e, mid[2], mid[3]], 4)[0]
}

fn main(
    // PUBLIC INPUTS -- appear in the transaction
    game_id:      pub Field,   // ID of the game session
    turn_id:      pub Field,   // Current turn number (anti-replay)
    player:       pub Field,   // Starknet address of the answerer
    commitment:   pub Field,   // Poseidon2([game_id, player, character_id, salt])
    question_id:  pub u16,     // Index of the question asked (0-511, maps to a bit in trait_bitmap)
    traits_root:  pub Field,   // Merkle root of the official character collection

    // PRIVATE INPUTS -- never leave the player's device
    character_id: Field,          // Which of the 999 NFTs the player chose
    salt:         Field,          // Random blinding factor from commit phase
    trait_bitmap: [u128; 4],      // Packed trait attributes (512 bits, bit N = answer to question N)
    merkle_path:  [Field; 10],    // Sibling hashes from leaf to root
) -> pub u1 {

    // Constraint 1: Commitment binding
    // The commitment on-chain was made with THIS exact character and salt.
    let _ = turn_id; // bound via public input; no circuit constraint needed
    let expected_commitment = hash4(game_id, player, character_id, salt);
    assert(expected_commitment == commitment);

    // Constraint 2: Merkle membership
    // (character_id, trait_bitmap[0..3]) is a valid leaf in the official character set.
    // Leaf = hash5(character_id, limb0, limb1, limb2, limb3)
    let leaf = hash5(
        character_id,
        trait_bitmap[0] as Field,
        trait_bitmap[1] as Field,
        trait_bitmap[2] as Field,
        trait_bitmap[3] as Field,
    );
    let computed_root = merkle::merkle_verify(leaf, character_id, merkle_path);
    assert(computed_root == traits_root);

    // Constraint 3: Answer correctness
    // Select the correct 128-bit limb based on question_id, then extract the bit.
    let limb_idx = (question_id / 128) as u8;
    let bit_idx  = (question_id % 128) as u8;
    let limb = if limb_idx == 0 {
        trait_bitmap[0]
    } else if limb_idx == 1 {
        trait_bitmap[1]
    } else if limb_idx == 2 {
        trait_bitmap[2]
    } else {
        trait_bitmap[3]
    };
    let answer_bit = ((limb >> (bit_idx as u128)) & 1) as u1;

    // Anti-replay: game_id and turn_id are public inputs bound into the proof.
    // The Dojo contract verifies they match the current game state.

    answer_bit
}

// Regression: verify poseidon2_permutation matches bb.js poseidon2Permutation.
// bb.js: poseidon2Permutation([1,0,0,0]).outputs[0] = 0x2a04ea...
#[test]
fn test_permutation_matches_bbjs() {
    let out = std::hash::poseidon2_permutation([1, 0, 0, 0], 4);
    let expected: Field = 0x2a04ea402711ced2d4bc39608cc5350a7db4af98ec2950d4d1ec30334d6c2b4;
    assert(out[0] == expected);
}

// Sanity check: hash5 is deterministic.
#[test]
fn test_hash5_deterministic() {
    let a: Field = 1;
    let b: Field = 2;
    let c: Field = 3;
    let d: Field = 4;
    let e: Field = 5;
    assert(hash5(a, b, c, d, e) == hash5(a, b, c, d, e));
    // Different inputs -> different outputs
    assert(hash5(a, b, c, d, e) != hash5(a, b, c, d, 6));
}
