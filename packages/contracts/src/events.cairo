use starknet::ContractAddress;

/// Emitted when a new game session is created via `create_game`.
#[derive(Drop, Serde)]
#[dojo::event]
pub struct GameCreated {
    #[key]
    game_id: felt252,
    player1: ContractAddress,
    created_at: u64,
}

/// Emitted when a second player joins via `join_game`.
#[derive(Drop, Serde)]
#[dojo::event]
pub struct PlayerJoined {
    #[key]
    game_id: felt252,
    player2: ContractAddress,
}

/// Emitted each time a player submits their commitment via `commit_character`.
#[derive(Drop, Serde)]
#[dojo::event]
pub struct CharacterCommitted {
    #[key]
    game_id: felt252,
    #[key]
    player: ContractAddress,
    committed_at: u64,
}

/// Emitted when the active player asks a question via `ask_question`.
#[derive(Drop, Serde)]
#[dojo::event]
pub struct QuestionAsked {
    #[key]
    game_id: felt252,
    turn_number: u16,
    question_id: u16,
    asked_by: ContractAddress,
}

/// Emitted when the opponent answers a question with a valid ZK proof via
/// `answer_question_with_proof`. The answer is extracted from the verified proof output.
#[derive(Drop, Serde)]
#[dojo::event]
pub struct QuestionAnsweredVerified {
    #[key]
    game_id: felt252,
    turn_number: u16,
    question_id: u16,
    computed_answer: bool,
    answerer: ContractAddress,
    proof_verified: bool,
}

/// Emitted when the active player makes their final guess via `make_guess`.
#[derive(Drop, Serde)]
#[dojo::event]
pub struct GuessMade {
    #[key]
    game_id: felt252,
    guessed_by: ContractAddress,
    character_id: felt252,
}

/// Emitted after both reveals complete, reporting whether the guess was correct.
#[derive(Drop, Serde)]
#[dojo::event]
pub struct GuessResult {
    #[key]
    game_id: felt252,
    guessed_by: ContractAddress,
    is_correct: bool,
}

/// Emitted each time a player successfully reveals via `reveal_character`.
#[derive(Drop, Serde)]
#[dojo::event]
pub struct CharacterRevealed {
    #[key]
    game_id: felt252,
    player: ContractAddress,
    character_id: felt252,
}

/// Emitted when a player wins via `claim_timeout`.
/// `timed_out_player` is zero when the game was abandoned before P2 joined.
#[derive(Drop, Serde)]
#[dojo::event]
pub struct TimeoutClaimed {
    #[key]
    game_id: felt252,
    claimed_by: ContractAddress,
    timed_out_player: ContractAddress,
}

/// Emitted when the game reaches `PHASE_COMPLETED` by any means (reveal or timeout).
#[derive(Drop, Serde)]
#[dojo::event]
pub struct GameCompleted {
    #[key]
    game_id: felt252,
    winner: ContractAddress,
}

// RESERVED — kept for future non-ZK answer path (not emitted yet).
#[derive(Drop, Serde)]
#[dojo::event]
pub struct QuestionAnswered {
    #[key]
    game_id: felt252,
    turn_number: u16,
    answer: bool,
    answered_by: ContractAddress,
}
