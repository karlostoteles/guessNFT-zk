use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use whoiswho::constants;
use whoiswho::interfaces::game_actions::{IGameActionsDispatcher, IGameActionsDispatcherTrait};
use whoiswho::models::game::{Game, Turn};
use whoiswho::tests::setup::{
    OUTSIDER, PLAYER1, PLAYER2, TEST_ZK_COMMITMENT_P1, TEST_ZK_COMMITMENT_P2,
    create_test_world, do_commits, do_qa_cycle_p1_asks, do_qa_cycle_p2_asks, setup_game,
};

// ---------------------------------------------------------------------------
// Happy path: P1 guesses correctly and wins
// ---------------------------------------------------------------------------

#[test]
fn test_full_game_p1_correct_guess_wins() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    let (char_p1, salt_p1, char_p2, salt_p2) = do_commits(game_actions, game_id);

    do_qa_cycle_p1_asks(ref world, game_actions, game_id);
    do_qa_cycle_p2_asks(ref world, game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, char_p2);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.reveal_character(game_id, char_p1, salt_p1);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.reveal_character(game_id, char_p2, salt_p2);

    let game: Game = world.read_model(game_id);
    assert(game.phase == constants::PHASE_COMPLETED, 'game should be completed');
    assert(game.winner == PLAYER1(), 'P1 should win correct guess');
}

// ---------------------------------------------------------------------------
// Happy path: P1 guesses wrong — P2 wins
// ---------------------------------------------------------------------------

#[test]
fn test_full_game_p1_wrong_guess_p2_wins() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    let (char_p1, salt_p1, char_p2, salt_p2) = do_commits(game_actions, game_id);

    do_qa_cycle_p1_asks(ref world, game_actions, game_id);
    do_qa_cycle_p2_asks(ref world, game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, 999); // wrong character

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.reveal_character(game_id, char_p1, salt_p1);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.reveal_character(game_id, char_p2, salt_p2);

    let game: Game = world.read_model(game_id);
    assert(game.phase == constants::PHASE_COMPLETED, 'game should be completed');
    assert(game.winner == PLAYER2(), 'P2 should win wrong guess');
}

// ---------------------------------------------------------------------------
// Turn enforcement
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected: ('NOT_YOUR_TURN', 'ENTRYPOINT_FAILED'))]
fn test_p2_cannot_ask_on_p1_turn() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    // Phase is PLAYING, awaiting_answer=false, current_turn=1 — P2 asks: must fail
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.ask_question(game_id, 1);
}

#[test]
#[should_panic(expected: ('INVALID_PHASE', 'ENTRYPOINT_FAILED'))]
fn test_cannot_commit_after_commit_phase() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    // Phase advanced to PLAYING — commit must fail
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, core::pedersen::pedersen(99, 99), 0xABCD_u256);
}

// ---------------------------------------------------------------------------
// Commit guards
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected: ('ALREADY_COMMITTED', 'ENTRYPOINT_FAILED'))]
fn test_double_commit_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, core::pedersen::pedersen(1, 101), 0x1_u256);
    game_actions.commit_character(game_id, core::pedersen::pedersen(2, 202), 0x2_u256);
}

#[test]
#[should_panic(expected: ('INVALID_COMMITMENT', 'ENTRYPOINT_FAILED'))]
fn test_zero_pedersen_hash_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, 0, 0x1_u256);
}

#[test]
#[should_panic(expected: ('INVALID_COMMITMENT', 'ENTRYPOINT_FAILED'))]
fn test_zero_zk_commitment_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, core::pedersen::pedersen(1, 101), 0_u256);
}

// ---------------------------------------------------------------------------
// awaiting_answer sub-state guards
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected: ('AWAITING_ANSWER', 'ENTRYPOINT_FAILED'))]
fn test_cannot_ask_when_awaiting_answer() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1); // now awaiting_answer = true

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 2); // must fail
}

#[test]
#[should_panic(expected: ('AWAITING_ANSWER', 'ENTRYPOINT_FAILED'))]
fn test_cannot_guess_when_awaiting_answer() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1); // now awaiting_answer = true

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, 1); // must fail
}

// ---------------------------------------------------------------------------
// Reveal guards
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected: ('INVALID_REVEAL', 'ENTRYPOINT_FAILED'))]
fn test_reveal_wrong_character_rejected() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    let (_, salt_p1, char_p2, _) = do_commits(game_actions, game_id);

    do_qa_cycle_p1_asks(ref world, game_actions, game_id);
    do_qa_cycle_p2_asks(ref world, game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, char_p2);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.reveal_character(game_id, 99, salt_p1); // wrong character_id
}

#[test]
#[should_panic(expected: ('INVALID_REVEAL', 'ENTRYPOINT_FAILED'))]
fn test_reveal_wrong_salt_rejected() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    let (char_p1, _, char_p2, _) = do_commits(game_actions, game_id);

    do_qa_cycle_p1_asks(ref world, game_actions, game_id);
    do_qa_cycle_p2_asks(ref world, game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, char_p2);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.reveal_character(game_id, char_p1, 999); // wrong salt
}

#[test]
#[should_panic(expected: ('INVALID_REVEAL', 'ENTRYPOINT_FAILED'))]
fn test_reveal_zero_salt_rejected() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    let (char_p1, _, char_p2, _) = do_commits(game_actions, game_id);

    do_qa_cycle_p1_asks(ref world, game_actions, game_id);
    do_qa_cycle_p2_asks(ref world, game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, char_p2);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.reveal_character(game_id, char_p1, 0);
}

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

#[test]
fn test_player1_claims_timeout_on_abandoned_game() {
    let (mut world, game_actions) = create_test_world();

    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game(0_u256, 0_u8);

    starknet::testing::set_block_timestamp(46);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.claim_timeout(game_id);

    let game: Game = world.read_model(game_id);
    assert(game.phase == constants::PHASE_COMPLETED, 'game should be completed');
    assert(game.winner == PLAYER1(), 'P1 should win abandoned game');
}

#[test]
#[should_panic(expected: ('NOT_PLAYER', 'ENTRYPOINT_FAILED'))]
fn test_outsider_cannot_claim_timeout_on_abandoned_game() {
    let (_, game_actions) = create_test_world();

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.create_game(0_u256, 0_u8);
    let game_id: felt252 = 0;

    starknet::testing::set_block_timestamp(46);

    starknet::testing::set_contract_address(OUTSIDER());
    game_actions.claim_timeout(game_id);
}

#[test]
#[should_panic(expected: ('CALLER_NOT_ELIGIBLE', 'ENTRYPOINT_FAILED'))]
fn test_active_player_cannot_self_claim_timeout() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_block_timestamp(46);

    // P1 is the expected actor — they cannot claim against themselves.
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.claim_timeout(game_id);
}

#[test]
fn test_inactive_player_claims_timeout_mid_game() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_block_timestamp(46);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.claim_timeout(game_id);

    let game: Game = world.read_model(game_id);
    assert(game.phase == constants::PHASE_COMPLETED, 'game should be completed');
    assert(game.winner == PLAYER2(), 'P2 should win on P1 timeout');
}

#[test]
#[should_panic(expected: ('TIMEOUT_NOT_REACHED', 'ENTRYPOINT_FAILED'))]
fn test_timeout_not_yet_reached_reverts() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_block_timestamp(10);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.claim_timeout(game_id);
}

#[test]
#[should_panic(expected: ('INVALID_PHASE', 'ENTRYPOINT_FAILED'))]
fn test_cannot_claim_timeout_on_completed_game() {
    let (mut world, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    let (char_p1, salt_p1, char_p2, salt_p2) = do_commits(game_actions, game_id);

    do_qa_cycle_p1_asks(ref world, game_actions, game_id);
    do_qa_cycle_p2_asks(ref world, game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.make_guess(game_id, char_p2);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.reveal_character(game_id, char_p1, salt_p1);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.reveal_character(game_id, char_p2, salt_p2);

    // Game is now PHASE_COMPLETED — timeout should be rejected.
    starknet::testing::set_block_timestamp(1000);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.claim_timeout(game_id);
}

// ---------------------------------------------------------------------------
// Join guards
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected: ('CANNOT_JOIN_OWN_GAME', 'ENTRYPOINT_FAILED'))]
fn test_cannot_join_own_game() {
    let (_, game_actions) = create_test_world();

    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game(0_u256, 0_u8);

    game_actions.join_game(game_id);
}

#[test]
#[should_panic(expected: ('INVALID_PHASE', 'ENTRYPOINT_FAILED'))]
fn test_third_player_cannot_join_full_game() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);

    starknet::testing::set_contract_address(OUTSIDER());
    game_actions.join_game(game_id);
}

// ---------------------------------------------------------------------------
// ZK proof path guards
// ---------------------------------------------------------------------------

/// Builds a valid 15-element public inputs prefix for Garaga snforge calldata.
/// Useful as a base to derive "one field wrong" test cases from.
///
/// Layout: [count=7, PI0_lo, PI0_hi, PI1_lo, PI1_hi, ..., PI6_lo, PI6_hi]
/// PIs in order: game_id, turn_id, player, commitment, question_id, traits_root, answer_bit
fn make_valid_public_inputs(
    game_id: felt252,
    player: starknet::ContractAddress,
    zk_commitment: u256,
    traits_root: u256,
) -> Span<felt252> {
    array![
        7,                          // [0]  count of public inputs
        game_id,                    // [1]  PI[0] lo — game_id
        0,                          // [2]  PI[0] hi
        1,                          // [3]  PI[1] lo — turn_id = 1
        0,                          // [4]  PI[1] hi
        player.into(),              // [5]  PI[2] lo — player address
        0,                          // [6]  PI[2] hi
        zk_commitment.low.into(),   // [7]  PI[3] lo — commitment lo
        zk_commitment.high.into(),  // [8]  PI[3] hi — commitment hi
        1,                          // [9]  PI[4] lo — question_id = 1
        0,                          // [10] PI[4] hi
        traits_root.low.into(),     // [11] PI[5] lo — traits_root lo
        traits_root.high.into(),    // [12] PI[5] hi — traits_root hi
        1,                          // [13] PI[6] lo — answer_bit = 1 (yes)
        0,                          // [14] PI[6] hi
    ]
        .span()
}

#[test]
#[should_panic(expected: ('INVALID_PROOF_INPUTS', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_too_short_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions
        .answer_question_with_proof(
            game_id, array![7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].span(),
        );
}

#[test]
#[should_panic(expected: ('PROOF_GAME_ID_MISMATCH', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_wrong_game_id_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    starknet::testing::set_contract_address(PLAYER2());
    // game_id + 1 at PI[0] lo
    game_actions
        .answer_question_with_proof(
            game_id,
            array![
                7,
                game_id + 1,
                0,
                1,
                0,
                PLAYER2().into(),
                0,
                TEST_ZK_COMMITMENT_P2.low.into(),
                TEST_ZK_COMMITMENT_P2.high.into(),
                1,
                0,
                0,
                0,
                1,
                0,
            ]
                .span(),
        );
}

#[test]
#[should_panic(expected: ('PROOF_TURN_ID_MISMATCH', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_replay_attack_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1); // turn_count = 1

    starknet::testing::set_contract_address(PLAYER2());
    // turn_id = 999 at PI[1] lo (correct is 1)
    game_actions
        .answer_question_with_proof(
            game_id,
            array![
                7,
                game_id,
                0,
                999,
                0,
                PLAYER2().into(),
                0,
                TEST_ZK_COMMITMENT_P2.low.into(),
                TEST_ZK_COMMITMENT_P2.high.into(),
                1,
                0,
                0,
                0,
                1,
                0,
            ]
                .span(),
        );
}

#[test]
#[should_panic(expected: ('PROOF_PLAYER_MISMATCH', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_wrong_player_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    starknet::testing::set_contract_address(PLAYER2());
    // OUTSIDER at PI[2] lo instead of PLAYER2
    game_actions
        .answer_question_with_proof(
            game_id,
            array![
                7,
                game_id,
                0,
                1,
                0,
                OUTSIDER().into(),
                0,
                TEST_ZK_COMMITMENT_P2.low.into(),
                TEST_ZK_COMMITMENT_P2.high.into(),
                1,
                0,
                0,
                0,
                1,
                0,
            ]
                .span(),
        );
}

#[test]
#[should_panic(expected: ('PROOF_QUESTION_MISMATCH', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_wrong_question_id_rejected() {
    let (_, game_actions) = create_test_world();
    let game_id = setup_game(game_actions);
    do_commits(game_actions, game_id);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1); // question_id = 1

    starknet::testing::set_contract_address(PLAYER2());
    // question_id = 5 at PI[4] lo (correct is 1)
    game_actions
        .answer_question_with_proof(
            game_id,
            array![
                7,
                game_id,
                0,
                1,
                0,
                PLAYER2().into(),
                0,
                TEST_ZK_COMMITMENT_P2.low.into(),
                TEST_ZK_COMMITMENT_P2.high.into(),
                5,
                0,
                0,
                0,
                1,
                0,
            ]
                .span(),
        );
}

#[test]
#[should_panic(expected: ('PROOF_TRAITS_ROOT_MISMATCH', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_wrong_traits_root_rejected() {
    let (_, game_actions) = create_test_world();
    let traits_root: u256 = 0xdeadbeef_u256;

    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game(traits_root, 0_u8);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.join_game(game_id);
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, core::pedersen::pedersen(1, 101), 0x1_u256);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.commit_character(game_id, core::pedersen::pedersen(2, 202), 0x2_u256);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    starknet::testing::set_contract_address(PLAYER2());
    // traits_root = 0 at PI[5] (actual is 0xdeadbeef)
    game_actions
        .answer_question_with_proof(
            game_id, array![7, game_id, 0, 1, 0, PLAYER2().into(), 0, 0x2, 0, 1, 0, 0, 0, 1, 0]
                .span(),
        );
}

#[test]
#[should_panic(expected: ('PROOF_COMMITMENT_MISMATCH', 'ENTRYPOINT_FAILED'))]
fn test_answer_with_proof_wrong_commitment_rejected() {
    let (_, game_actions) = create_test_world();

    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game(0_u256, 0_u8);
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.join_game(game_id);
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.commit_character(game_id, core::pedersen::pedersen(1, 101), 0x1_u256);
    starknet::testing::set_contract_address(PLAYER2());
    // P2 commits with zk_commitment = 0xabcd1234
    game_actions.commit_character(game_id, core::pedersen::pedersen(2, 202), 0xabcd1234_u256);

    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1);

    starknet::testing::set_contract_address(PLAYER2());
    // commitment = 0x1 at PI[3] (actual P2 commitment is 0xabcd1234)
    game_actions
        .answer_question_with_proof(
            game_id, array![7, game_id, 0, 1, 0, PLAYER2().into(), 0, 0x1, 0, 1, 0, 0, 0, 1, 0]
                .span(),
        );
}

// ---------------------------------------------------------------------------
// Game creation
// ---------------------------------------------------------------------------

#[test]
fn test_create_game_stores_traits_root_and_question_set_id() {
    let (mut world, game_actions) = create_test_world();
    let traits_root: u256 = 0x1234567890abcdef_u256;
    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game(traits_root, 3_u8);

    let game: Game = world.read_model(game_id);
    assert(game.traits_root == traits_root, 'traits_root not stored');
    assert(game.question_set_id == 3_u8, 'question_set_id not stored');
}
