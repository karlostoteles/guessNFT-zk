/// Game not found (player1 address is zero — uuid was never written).
pub const ERR_GAME_NOT_FOUND: felt252 = 'GAME_NOT_FOUND';
/// The current game phase does not allow the requested action.
pub const ERR_INVALID_PHASE: felt252 = 'INVALID_PHASE';
/// Caller is not player1 or player2 of this game.
pub const ERR_NOT_PLAYER: felt252 = 'NOT_PLAYER';
/// Caller is not the expected actor for this action (wrong turn or wrong sub-state).
pub const ERR_NOT_YOUR_TURN: felt252 = 'NOT_YOUR_TURN';
/// The game is awaiting the opponent's ZK proof answer before the next question can be asked.
pub const ERR_AWAITING_ANSWER: felt252 = 'AWAITING_ANSWER';
/// The game creator cannot join their own game.
pub const ERR_CANNOT_JOIN_OWN_GAME: felt252 = 'CANNOT_JOIN_OWN_GAME';
/// Caller already submitted a commitment for this game.
pub const ERR_ALREADY_COMMITTED: felt252 = 'ALREADY_COMMITTED';
/// Caller has no commitment stored — must call `commit_character` first.
pub const ERR_NO_COMMITMENT: felt252 = 'NO_COMMITMENT';
/// Caller already revealed their character in this game.
pub const ERR_ALREADY_REVEALED: felt252 = 'ALREADY_REVEALED';
/// `claim_timeout` called before `ACTION_TIMEOUT_SECONDS` has elapsed.
pub const ERR_TIMEOUT_NOT_REACHED: felt252 = 'TIMEOUT_NOT_REACHED';
/// Active player cannot claim timeout against themselves.
pub const ERR_CALLER_NOT_ELIGIBLE: felt252 = 'CALLER_NOT_ELIGIBLE';
/// Reveal failed: `pedersen(character_id, salt)` does not match the stored commitment,
/// or salt is zero.
pub const ERR_INVALID_REVEAL: felt252 = 'INVALID_REVEAL';
/// Commitment hash is zero — invalid; a properly derived Pedersen hash is never zero.
pub const ERR_INVALID_COMMITMENT: felt252 = 'INVALID_COMMITMENT';

// ---------------------------------------------------------------------------
// ZK proof errors
// ---------------------------------------------------------------------------

/// `full_proof_with_hints` array does not contain the minimum required elements.
pub const ERR_INVALID_PROOF_INPUTS: felt252 = 'INVALID_PROOF_INPUTS';
/// The `game_id` encoded in the proof public inputs does not match the on-chain game.
pub const ERR_PROOF_GAME_MISMATCH: felt252 = 'PROOF_GAME_ID_MISMATCH';
/// The `turn_id` in the proof does not match the current `game.turn_count` (replay attack).
pub const ERR_PROOF_TURN_MISMATCH: felt252 = 'PROOF_TURN_ID_MISMATCH';
/// The `player` address in the proof does not match the caller.
pub const ERR_PROOF_PLAYER_MISMATCH: felt252 = 'PROOF_PLAYER_MISMATCH';
/// The `question_id` in the proof does not match `game.last_question_id`.
pub const ERR_PROOF_QUESTION_MISMATCH: felt252 = 'PROOF_QUESTION_MISMATCH';
/// The `traits_root` in the proof does not match `game.traits_root`.
pub const ERR_PROOF_TRAITS_ROOT_MISMATCH: felt252 = 'PROOF_TRAITS_ROOT_MISMATCH';
/// The `commitment` in the proof does not match the stored `commitment.zk_commitment`.
pub const ERR_PROOF_COMMITMENT_MISMATCH: felt252 = 'PROOF_COMMITMENT_MISMATCH';
/// The Garaga verifier rejected the proof.
pub const ERR_PROOF_VERIFICATION_FAILED: felt252 = 'ZK_PROOF_FAILED';
/// The Garaga verifier contract address is zero — not deployed yet.
pub const ERR_VERIFIER_NOT_DEPLOYED: felt252 = 'VERIFIER_NOT_DEPLOYED';
