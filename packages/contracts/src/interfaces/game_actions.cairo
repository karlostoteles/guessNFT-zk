/// Public interface for the WhoisWho game contract.
///
/// Game flow: WAITING → COMMIT → PLAYING → REVEAL → COMPLETED
///
/// During PLAYING, `Game.awaiting_answer` tracks the sub-state:
///   false → active player (current_turn) calls `ask_question` or `make_guess`
///   true  → the other player calls `answer_question_with_proof`
///
/// All state-changing functions take a `game_id` to identify the session.
/// Turn order and phase validity are enforced on-chain; invalid calls revert.
#[starknet::interface]
pub trait IGameActions<T> {
    /// Creates a new game. Caller becomes player1.
    /// `traits_root` is the Poseidon2 BN254 Merkle root of the character collection (stored as
    /// u256 because BN254 outputs may exceed the Stark field prime).
    /// `question_set_id` identifies which question schema is in use (0 = SCHIZODIO v1).
    /// Returns the new `game_id` (derived from `world.uuid()`).
    fn create_game(ref self: T, traits_root: u256, question_set_id: u8) -> felt252;

    /// Joins an existing game as player2. Caller must not be player1.
    /// Advances phase from `WAITING_FOR_PLAYER2` to `COMMIT_PHASE`.
    fn join_game(ref self: T, game_id: felt252);

    /// Records both commitment hashes for the caller.
    /// `commitment_hash`: Starknet Pedersen hash for the reveal phase (`pedersen(character_id, salt)`).
    /// `zk_commitment`: Poseidon2 BN254 commitment for ZK proofs (`hash4(game_id, player, character_id, salt)`).
    /// When both players have committed, phase advances to `PLAYING`.
    fn commit_character(
        ref self: T, game_id: felt252, commitment_hash: felt252, zk_commitment: u256,
    );

    /// Active player asks a question identified by `question_id`.
    /// Sets `awaiting_answer = true`; the other player must now call `answer_question_with_proof`.
    fn ask_question(ref self: T, game_id: felt252, question_id: u16);

    /// Non-active player answers with a ZK proof.
    /// `full_proof_with_hints`: calldata produced by `garaga calldata` (proof + public inputs).
    /// The contract validates anti-replay, commitment consistency, and collection integrity,
    /// then calls the Garaga verifier to confirm the proof. The answer is extracted from
    /// the public outputs of the verified proof.
    /// On success: `awaiting_answer = false`, turn flips to the other player.
    fn answer_question_with_proof(
        ref self: T,
        game_id: felt252,
        full_proof_with_hints: Span<felt252>,
    );

    /// Active player makes their final character guess.
    /// Advances phase to `REVEAL`; winner determined after both players reveal.
    fn make_guess(ref self: T, game_id: felt252, character_id: felt252);

    /// Verifies `pedersen(character_id, salt) == stored_commitment` and records the reveal.
    /// When both players have revealed, the contract resolves the winner and completes the game.
    fn reveal_character(ref self: T, game_id: felt252, character_id: felt252, salt: felt252);

    /// Claims a win by timeout if the expected actor has been inactive for at least
    /// `ACTION_TIMEOUT_SECONDS`. Only the other player (or player1 for abandoned games) may call.
    fn claim_timeout(ref self: T, game_id: felt252);
}
