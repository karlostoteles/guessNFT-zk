use dojo::model::ModelStorage;
use dojo::world::{WorldStorage, WorldStorageTrait, world};
use dojo_cairo_test::{
    ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait,
    spawn_test_world,
};
use starknet::{ContractAddress, contract_address_const};
use whoiswho::constants;
use whoiswho::models::game::{Game, Turn};
use whoiswho::events::{
    e_CharacterCommitted, e_CharacterRevealed, e_GameCompleted,
    e_GameCreated, e_GuessMade, e_GuessResult, e_PlayerJoined, e_QuestionAnswered,
    e_QuestionAnsweredVerified, e_QuestionAsked, e_TimeoutClaimed,
};
use whoiswho::interfaces::game_actions::{IGameActionsDispatcher, IGameActionsDispatcherTrait};
use whoiswho::models::game::{m_Commitment, m_Game, m_Turn};
use whoiswho::systems::game_actions::game_actions;

pub fn PLAYER1() -> ContractAddress {
    contract_address_const::<'PLAYER1'>()
}
pub fn PLAYER2() -> ContractAddress {
    contract_address_const::<'PLAYER2'>()
}
pub fn OUTSIDER() -> ContractAddress {
    contract_address_const::<'OUTSIDER'>()
}

/// Non-zero ZK commitment used in tests that need a valid commitment value.
/// Tests that don't exercise ZK proof validation can use this as a placeholder.
pub const TEST_ZK_COMMITMENT_P1: u256 = u256 { low: 0xDEAD0001, high: 0 };
pub const TEST_ZK_COMMITMENT_P2: u256 = u256 { low: 0xDEAD0002, high: 0 };

pub fn create_test_world() -> (WorldStorage, IGameActionsDispatcher) {
    let ndef = NamespaceDef {
        namespace: "whoiswho",
        resources: [
            TestResource::Model(m_Game::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Commitment::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Model(m_Turn::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_GameCreated::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_PlayerJoined::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_CharacterCommitted::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_QuestionAsked::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_QuestionAnswered::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_QuestionAnsweredVerified::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_GuessMade::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_GuessResult::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_CharacterRevealed::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_TimeoutClaimed::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Event(e_GameCompleted::TEST_CLASS_HASH.try_into().unwrap()),
            TestResource::Contract(game_actions::TEST_CLASS_HASH.try_into().unwrap()),
        ]
            .span(),
    };

    let cdef: Span<ContractDef> = [
        ContractDefTrait::new(@"whoiswho", @"game_actions")
            .with_writer_of([dojo::utils::bytearray_hash(@"whoiswho")].span()),
    ]
        .span();

    let mut world = spawn_test_world(world::TEST_CLASS_HASH.try_into().unwrap(), [ndef].span());
    world.sync_perms_and_inits(cdef);

    let (game_actions_addr, _) = world.dns(@"game_actions").unwrap();
    let dispatcher = IGameActionsDispatcher { contract_address: game_actions_addr };

    (world, dispatcher)
}

/// Create a game and have P2 join. Returns game_id.
/// Uses zero traits_root for non-ZK tests. ZK tests create games directly with a real root.
pub fn setup_game(game_actions: IGameActionsDispatcher) -> felt252 {
    starknet::testing::set_contract_address(PLAYER1());
    let game_id = game_actions.create_game(0_u256, 0_u8);

    starknet::testing::set_contract_address(PLAYER2());
    game_actions.join_game(game_id);

    game_id
}

/// Commit characters for both players. Returns (char_p1, salt_p1, char_p2, salt_p2).
pub fn do_commits(
    game_actions: IGameActionsDispatcher, game_id: felt252,
) -> (felt252, felt252, felt252, felt252) {
    let char_p1: felt252 = 1;
    let salt_p1: felt252 = 101;
    let char_p2: felt252 = 2;
    let salt_p2: felt252 = 202;

    starknet::testing::set_contract_address(PLAYER1());
    game_actions
        .commit_character(
            game_id, core::pedersen::pedersen(char_p1, salt_p1), TEST_ZK_COMMITMENT_P1,
        );

    starknet::testing::set_contract_address(PLAYER2());
    game_actions
        .commit_character(
            game_id, core::pedersen::pedersen(char_p2, salt_p2), TEST_ZK_COMMITMENT_P2,
        );

    (char_p1, salt_p1, char_p2, salt_p2)
}

/// Run one Q&A cycle starting from P1 asking.
/// Simulates the answer step via direct state write (unit tests cannot generate ZK proofs).
/// After this call: awaiting_answer=false, current_turn=2 (P2 is the next asker).
pub fn do_qa_cycle_p1_asks(
    ref world: WorldStorage, game_actions: IGameActionsDispatcher, game_id: felt252,
) {
    starknet::testing::set_contract_address(PLAYER1());
    game_actions.ask_question(game_id, 1); // arbitrary question_id

    // Impersonate the game_actions contract to pass WRITER role checks.
    starknet::testing::set_contract_address(game_actions.contract_address);
    let mut game: Game = world.read_model(game_id);
    let mut turn: Turn = world.read_model((game_id, game.turn_count));
    turn.answer = true;
    turn.answered_by = PLAYER2();
    world.write_model(@turn);
    // Mirror what answer_question_with_proof does: flip turn, clear awaiting_answer.
    game.awaiting_answer = false;
    game.current_turn = 2_u8;
    world.write_model(@game);
}

/// Run one Q&A cycle starting from P2 asking.
/// Simulates the answer step via direct state write (unit tests cannot generate ZK proofs).
/// After this call: awaiting_answer=false, current_turn=1 (P1 is the next asker).
pub fn do_qa_cycle_p2_asks(
    ref world: WorldStorage, game_actions: IGameActionsDispatcher, game_id: felt252,
) {
    starknet::testing::set_contract_address(PLAYER2());
    game_actions.ask_question(game_id, 2); // arbitrary question_id

    // Impersonate the game_actions contract to pass WRITER role checks.
    starknet::testing::set_contract_address(game_actions.contract_address);
    let mut game: Game = world.read_model(game_id);
    let mut turn: Turn = world.read_model((game_id, game.turn_count));
    turn.answer = false;
    turn.answered_by = PLAYER1();
    world.write_model(@turn);
    // Mirror what answer_question_with_proof does: flip turn, clear awaiting_answer.
    game.awaiting_answer = false;
    game.current_turn = 1_u8;
    world.write_model(@game);
}
