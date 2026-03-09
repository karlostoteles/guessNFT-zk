/// Maximum seconds a player may be inactive before their opponent can claim a timeout win.
pub const ACTION_TIMEOUT_SECONDS: u64 = 45;

// ---------------------------------------------------------------------------
// Game phases — stored as `u8` in `Game.phase`.
// Within PHASE_PLAYING, `Game.awaiting_answer` distinguishes the two sub-states:
//   false → active player (current_turn) must ask a question or make a guess
//   true  → the other player must call `answer_question_with_proof`
// ---------------------------------------------------------------------------

/// Waiting for a second player to call `join_game`.
pub const PHASE_WAITING_FOR_PLAYER2: u8 = 0;
/// Both players must call `commit_character` before gameplay begins.
pub const PHASE_COMMIT_PHASE: u8 = 1;
/// Main gameplay loop. Sub-state tracked by `Game.awaiting_answer`.
pub const PHASE_PLAYING: u8 = 2;
/// Both players must call `reveal_character` to verify commits and determine the winner.
pub const PHASE_REVEAL: u8 = 3;
/// Game over — `Game.winner` holds the winning address.
pub const PHASE_COMPLETED: u8 = 4;

// ---------------------------------------------------------------------------
// Turn action types — stored in `Turn.action_type`.
// ---------------------------------------------------------------------------

/// The turn record represents a question asked by the active player.
pub const ACTION_TYPE_QUESTION: u8 = 0;
/// The turn record represents a final guess by the active player.
pub const ACTION_TYPE_GUESS: u8 = 1;

// ---------------------------------------------------------------------------
// ZK proof helpers
// ---------------------------------------------------------------------------

/// 2^128 — used to reconstruct u256 values from Garaga's lo/hi felt252 pairs.
pub const U128_BASE: felt252 = 0x100000000000000000000000000000000;

// ---------------------------------------------------------------------------
// ZK verifier — deployed Garaga verifier contract addresses.
// ---------------------------------------------------------------------------

/// Garaga UltraKeccakZKHonk verifier on Sepolia testnet.
pub const VERIFIER_ADDRESS_SEPOLIA: felt252 = 0x31706993a5ad13ace1db4980af8f8285e8d6af4a3b3451de94071baf1c9a1d4;
/// Garaga UltraKeccakZKHonk verifier on Mainnet — fill in before mainnet deployment.
/// WARNING: Deploying with this value at 0x0 means all ZK proofs will fail on mainnet.
pub const VERIFIER_ADDRESS_MAINNET: felt252 = 0x0;

// ---------------------------------------------------------------------------
// Question set IDs — identifies which question schema is in use.
// ---------------------------------------------------------------------------

/// SCHIZODIO collection v1 (418-bit schema, depth-10 Merkle tree, 1024 leaves).
pub const QUESTION_SET_SCHIZODIO_V1: u8 = 0;
