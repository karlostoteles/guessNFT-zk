use starknet::ContractAddress;

/// Core game session state. One record per game, keyed by `game_id`.
///
/// Phase transitions:
///   WAITING_FOR_PLAYER2 → COMMIT_PHASE → PLAYING → REVEAL → COMPLETED
///
/// During PLAYING, `awaiting_answer` tracks the sub-state:
///   false → active player (current_turn) selects a question or makes a guess
///   true  → the other player must answer with a ZK proof via `answer_question_with_proof`
///
/// The `current_turn` field is NOT flipped when transitioning to REVEAL — it retains
/// the value set during the last Q&A cycle, which identifies the player who made the guess.
/// `reveal_character` relies on this invariant to resolve the winner correctly.
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Game {
    /// Unique game identifier (derived from `world.uuid()`).
    #[key]
    pub game_id: felt252,
    /// Address of the player who created the game.
    pub player1: ContractAddress,
    /// Address of the player who joined (zero until `join_game` is called).
    pub player2: ContractAddress,
    /// Current game phase — see `constants::PHASE_*`.
    pub phase: u8,
    /// Which player is the active asker/guesser: `1` = player1, `2` = player2.
    /// Not flipped during REVEAL — retains the guesser's identity for winner resolution.
    pub current_turn: u8,
    /// Total number of turns played (incremented on `ask_question` and `make_guess`).
    /// Also used as a turn-specific nonce in ZK proofs to prevent replay attacks.
    pub turn_count: u16,
    /// Address of the winner (zero until the game is completed).
    pub winner: ContractAddress,
    /// Block timestamp when the game was created.
    pub created_at: u64,
    /// Block timestamp of the last state-changing action — used for timeout checks.
    pub last_action_at: u64,
    /// ID of the most recent question asked. Used by `answer_question_with_proof`
    /// to bind the proof to the exact question that was asked (anti-replay).
    pub last_question_id: u16,
    /// Character ID that the active player guessed in `make_guess` — verified during reveal.
    pub guess_character_id: felt252,
    /// Poseidon2 BN254 Merkle root of the character collection — stored as u256 because BN254
    /// outputs may exceed the Stark field prime (~16% of outputs). Committed to at game creation;
    /// never recomputed on-chain (would require hashing 1024 NFT leaves).
    pub traits_root: u256,
    /// Which question schema this game uses (0 = SCHIZODIO v1).
    pub question_set_id: u8,
    /// During PHASE_PLAYING: false = active player must ask/guess, true = other player must answer.
    pub awaiting_answer: bool,
}

/// Commit-reveal record for a single player in a game.
///
/// Players compute `hash = pedersen(character_id, salt)` client-side and submit only the hash
/// on-chain at commit time. After a guess is made, both players reveal `(character_id, salt)`.
/// The contract re-derives the hash and compares it to `hash`, preventing any player from
/// changing their character choice after seeing their opponent's guess.
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Commitment {
    /// Game this commitment belongs to.
    #[key]
    pub game_id: felt252,
    /// Player who made this commitment.
    #[key]
    pub player: ContractAddress,
    /// `pedersen(character_id, salt)` — zero means not yet committed.
    pub hash: felt252,
    /// Poseidon2 BN254 commitment: `hash4(game_id, player, character_id, salt)`.
    /// Separate from `hash` — this binds ZK proofs to the player's specific character choice.
    pub zk_commitment: u256,
    /// True after the player successfully calls `reveal_character`.
    pub revealed: bool,
    /// Revealed character ID (zero before reveal).
    pub character_id: felt252,
}

/// Immutable record of a single turn action (question or final guess).
///
/// Written by `ask_question` (action_type = ACTION_TYPE_QUESTION) or
/// `make_guess` (action_type = ACTION_TYPE_GUESS). The answer is filled in
/// by `answer_question_with_proof`.
#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Turn {
    #[key]
    pub game_id: felt252,
    /// 1-based turn counter within this game.
    #[key]
    pub turn_number: u16,
    /// `ACTION_TYPE_QUESTION` or `ACTION_TYPE_GUESS` — see `constants`.
    pub action_type: u8,
    /// Question template ID chosen by the asker (zero for guess turns).
    pub question_id: u16,
    /// Answer provided by the responding player (false for guess turns).
    pub answer: bool,
    /// Player who asked the question or made the guess.
    pub asked_by: ContractAddress,
    /// Player who answered (zero for guess turns or before answer is submitted).
    pub answered_by: ContractAddress,
    /// Character ID guessed (zero for question turns).
    pub guessed_character_id: felt252,
    /// Block timestamp of the last write to this record.
    pub action_timestamp: u64,
    /// True if the answer was verified by a ZK proof via `answer_question_with_proof`.
    pub proof_verified: bool,
}
