/// WhoisWho game logic system.
///
/// Implements all 8 entrypoints of `IGameActions`. Game state is stored in three Dojo models:
/// - `Game`       — session metadata and current phase
/// - `Commitment` — per-player Pedersen + BN254 commitment for commit-reveal and ZK proofs
/// - `Turn`       — immutable record of each question/guess action
///
/// Game flow: WAITING → COMMIT → PLAYING → REVEAL → COMPLETED
///
/// During PLAYING, `Game.awaiting_answer` distinguishes:
///   false → active player (current_turn) calls `ask_question` or `make_guess`
///   true  → the other player calls `answer_question_with_proof`
///
/// Security properties guaranteed on-chain:
/// - Identity:  only registered players may act
/// - Order:     phase + awaiting_answer prevent out-of-turn actions
/// - Integrity: commit-reveal verifies character choice at end of game
/// - Liveness:  timeout mechanism prevents indefinite stalls
#[dojo::contract]
pub mod game_actions {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage};
    use starknet::contract_address::ContractAddressZeroable;
    use starknet::{ContractAddress, contract_address_const, get_block_timestamp, get_caller_address};
    use whoiswho::events::{
        CharacterCommitted, CharacterRevealed, GameCompleted, GameCreated,
        GuessMade, GuessResult, PlayerJoined, QuestionAnsweredVerified, QuestionAsked,
        TimeoutClaimed,
    };
    use whoiswho::interfaces::game_actions::IGameActions;
    use whoiswho::interfaces::verifier::{
        IUltraKeccakZKHonkVerifierDispatcher, IUltraKeccakZKHonkVerifierDispatcherTrait,
    };
    use whoiswho::models::game::{Commitment, Game, Turn};
    use whoiswho::{constants, errors};

    // ---------------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------------

    /// Panics if `game.player1` is zero (game record was never written to storage).
    fn assert_game_exists(game: Game) {
        assert(!game.player1.is_zero(), errors::ERR_GAME_NOT_FOUND);
    }

    /// Panics if `caller` is neither player1 nor player2.
    fn assert_player_in_game(game: Game, caller: ContractAddress) {
        assert(caller == game.player1 || caller == game.player2, errors::ERR_NOT_PLAYER);
    }

    /// Returns the address of the current asker/guesser (the player whose turn it is to ask).
    fn active_player(game: Game) -> ContractAddress {
        if game.current_turn == 1_u8 { game.player1 } else { game.player2 }
    }

    /// Returns the address of the other player (not the current asker/guesser).
    fn other_player(game: Game) -> ContractAddress {
        if game.current_turn == 1_u8 { game.player2 } else { game.player1 }
    }

    /// Returns who must make the NEXT move.
    /// When `awaiting_answer` is true, the answerer (other_player) must act.
    /// Otherwise the active player must act.
    /// Used by `claim_timeout` to identify the non-acting party.
    fn expected_actor(game: Game) -> ContractAddress {
        if game.awaiting_answer { other_player(game) } else { active_player(game) }
    }

    // ---------------------------------------------------------------------------
    // Entrypoints
    // ---------------------------------------------------------------------------

    #[abi(embed_v0)]
    impl GameActionsImpl of IGameActions<ContractState> {
        fn create_game(ref self: ContractState, traits_root: u256, question_set_id: u8) -> felt252 {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let zero = ContractAddressZeroable::zero();
            let game_id: felt252 = world.dispatcher.uuid().into();

            world
                .write_model(
                    @Game {
                        game_id,
                        player1: caller,
                        player2: zero,
                        phase: constants::PHASE_WAITING_FOR_PLAYER2,
                        current_turn: 1_u8,
                        turn_count: 0_u16,
                        winner: zero,
                        created_at: now,
                        last_action_at: now,
                        last_question_id: 0_u16,
                        guess_character_id: 0,
                        traits_root,
                        question_set_id,
                        awaiting_answer: false,
                    },
                );

            world.emit_event(@GameCreated { game_id, player1: caller, created_at: now });
            game_id
        }

        fn join_game(ref self: ContractState, game_id: felt252) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);

            assert_game_exists(game);
            assert(game.phase == constants::PHASE_WAITING_FOR_PLAYER2, errors::ERR_INVALID_PHASE);
            assert(caller != game.player1, errors::ERR_CANNOT_JOIN_OWN_GAME);

            game.player2 = caller;
            game.phase = constants::PHASE_COMMIT_PHASE;
            game.last_action_at = now;
            world.write_model(@game);

            world.emit_event(@PlayerJoined { game_id, player2: caller });
        }

        fn commit_character(
            ref self: ContractState,
            game_id: felt252,
            commitment_hash: felt252,
            zk_commitment: u256,
        ) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);

            assert_game_exists(game);
            assert(game.phase == constants::PHASE_COMMIT_PHASE, errors::ERR_INVALID_PHASE);
            assert_player_in_game(game, caller);
            // A properly derived Pedersen hash is never zero.
            assert(commitment_hash != 0, errors::ERR_INVALID_COMMITMENT);
            // A properly derived BN254 commitment is never zero.
            assert(zk_commitment != 0_u256, errors::ERR_INVALID_COMMITMENT);

            let mut commitment: Commitment = world.read_model((game_id, caller));
            assert(commitment.hash == 0, errors::ERR_ALREADY_COMMITTED);
            commitment =
                Commitment {
                    game_id,
                    player: caller,
                    hash: commitment_hash,
                    zk_commitment,
                    revealed: false,
                    character_id: 0,
                };
            world.write_model(@commitment);

            // Once both players have committed, advance to the gameplay loop.
            let p1_commitment: Commitment = world.read_model((game_id, game.player1));
            let p2_commitment: Commitment = world.read_model((game_id, game.player2));
            if p1_commitment.hash != 0 && p2_commitment.hash != 0 {
                game.phase = constants::PHASE_PLAYING;
                game.current_turn = 1_u8;
                game.awaiting_answer = false;
            }

            game.last_action_at = now;
            world.write_model(@game);
            world.emit_event(@CharacterCommitted { game_id, player: caller, committed_at: now });
        }

        fn ask_question(ref self: ContractState, game_id: felt252, question_id: u16) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);
            let zero = ContractAddressZeroable::zero();

            assert_game_exists(game);
            assert_player_in_game(game, caller);
            assert(game.phase == constants::PHASE_PLAYING, errors::ERR_INVALID_PHASE);
            // Must not be awaiting an answer from the last question.
            assert(!game.awaiting_answer, errors::ERR_AWAITING_ANSWER);
            assert(active_player(game) == caller, errors::ERR_NOT_YOUR_TURN);

            game.turn_count = game.turn_count + 1_u16;
            game.last_question_id = question_id;
            game.awaiting_answer = true;
            game.last_action_at = now;

            world
                .write_model(
                    @Turn {
                        game_id,
                        turn_number: game.turn_count,
                        action_type: constants::ACTION_TYPE_QUESTION,
                        question_id,
                        answer: false,
                        asked_by: caller,
                        answered_by: zero,
                        guessed_character_id: 0,
                        action_timestamp: now,
                        proof_verified: false,
                    },
                );

            world.write_model(@game);
            world
                .emit_event(
                    @QuestionAsked {
                        game_id, turn_number: game.turn_count, question_id, asked_by: caller,
                    },
                );
        }

        fn answer_question_with_proof(
            ref self: ContractState,
            game_id: felt252,
            full_proof_with_hints: Span<felt252>,
        ) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);

            assert_game_exists(game);
            assert_player_in_game(game, caller);
            assert(game.phase == constants::PHASE_PLAYING, errors::ERR_INVALID_PHASE);
            assert(game.awaiting_answer, errors::ERR_INVALID_PHASE);
            // Only the non-active player (the one being questioned) answers.
            assert(active_player(game) != caller, errors::ERR_NOT_YOUR_TURN);

            // ── Garaga calldata layout ────────────────────────────────────────
            // Format: [count=7, PI0_lo, PI0_hi, PI1_lo, PI1_hi, ..., PI6_lo, PI6_hi, ...proof]
            // Public inputs (7 total, each split into lo/hi felt252 for BN254 compatibility):
            //   PI[0] game_id       PI[1] turn_id      PI[2] player
            //   PI[3] commitment    PI[4] question_id  PI[5] traits_root
            //   PI[6] answer_bit   (the circuit's return value)
            // Prefix size = 1 (count) + 7 * 2 (PI lo/hi pairs) = 15 elements.
            assert(full_proof_with_hints.len() >= 15, errors::ERR_INVALID_PROOF_INPUTS);

            // Reconstruct each public input from its lo/hi felt252 pair.
            // U128_BASE = 2^128; the hi limb is multiplied by this before adding the lo limb.
            let proof_game_id =
                *full_proof_with_hints[1] + (*full_proof_with_hints[2] * constants::U128_BASE);
            let proof_turn_id =
                *full_proof_with_hints[3] + (*full_proof_with_hints[4] * constants::U128_BASE);
            let proof_player =
                *full_proof_with_hints[5] + (*full_proof_with_hints[6] * constants::U128_BASE);
            let proof_commitment = u256 {
                low: (*full_proof_with_hints[7]).try_into().unwrap(),
                high: (*full_proof_with_hints[8]).try_into().unwrap(),
            };
            let proof_question_id =
                *full_proof_with_hints[9] + (*full_proof_with_hints[10] * constants::U128_BASE);
            let proof_traits_root = u256 {
                low: (*full_proof_with_hints[11]).try_into().unwrap(),
                high: (*full_proof_with_hints[12]).try_into().unwrap(),
            };
            let answer_raw =
                *full_proof_with_hints[13] + (*full_proof_with_hints[14] * constants::U128_BASE);

            // ── Anti-replay: bind proof to the current game state ─────────────
            // These checks ensure a proof from a different game, turn, player, or
            // question cannot be replayed here.
            assert(proof_game_id == game_id, errors::ERR_PROOF_GAME_MISMATCH);
            assert(proof_turn_id == game.turn_count.into(), errors::ERR_PROOF_TURN_MISMATCH);
            assert(proof_player == caller.into(), errors::ERR_PROOF_PLAYER_MISMATCH);
            assert(
                proof_question_id == game.last_question_id.into(),
                errors::ERR_PROOF_QUESTION_MISMATCH,
            );

            // ── Collection integrity ──────────────────────────────────────────
            // The proof must reference the exact Merkle root this game was created with.
            assert(proof_traits_root == game.traits_root, errors::ERR_PROOF_TRAITS_ROOT_MISMATCH);

            // ── Commitment binding ────────────────────────────────────────────
            // The BN254 commitment in the proof must match what the player committed to on-chain,
            // proving the answer is about their actual chosen character.
            let commitment: Commitment = world.read_model((game_id, caller));
            assert(
                proof_commitment == commitment.zk_commitment, errors::ERR_PROOF_COMMITMENT_MISMATCH,
            );

            // ── ZK verification ───────────────────────────────────────────────
            // Garaga verifier checks that the proof is consistent with the public inputs
            // supplied in the calldata prefix above. If it passes, the answer_bit at PI[6]
            // is cryptographically bound to the player's committed character.
            let verifier_addr = contract_address_const::<constants::VERIFIER_ADDRESS_SEPOLIA>();
            assert(!verifier_addr.is_zero(), errors::ERR_VERIFIER_NOT_DEPLOYED);
            let verifier = IUltraKeccakZKHonkVerifierDispatcher {
                contract_address: verifier_addr,
            };
            let result = verifier.verify_ultra_keccak_zk_honk_proof(full_proof_with_hints);
            assert(result.is_ok(), errors::ERR_PROOF_VERIFICATION_FAILED);

            // ── Advance state: flip turn, clear awaiting_answer ───────────────
            let computed_answer: bool = answer_raw != 0;

            // Write the Turn record BEFORE flipping current_turn so active_player()
            // still refers to the asker if needed during this write.
            let mut turn: Turn = world.read_model((game_id, game.turn_count));
            turn.answer = computed_answer;
            turn.answered_by = caller;
            turn.action_timestamp = now;
            turn.proof_verified = true;
            world.write_model(@turn);

            // Flip turn to the answerer becomes the next asker.
            game.current_turn = if game.current_turn == 1_u8 { 2_u8 } else { 1_u8 };
            game.awaiting_answer = false;
            game.last_action_at = now;
            world.write_model(@game);

            world
                .emit_event(
                    @QuestionAnsweredVerified {
                        game_id,
                        turn_number: turn.turn_number,
                        question_id: game.last_question_id,
                        computed_answer,
                        answerer: caller,
                        proof_verified: true,
                    },
                );
        }

        fn make_guess(ref self: ContractState, game_id: felt252, character_id: felt252) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);
            let zero = ContractAddressZeroable::zero();

            assert_game_exists(game);
            assert_player_in_game(game, caller);
            assert(game.phase == constants::PHASE_PLAYING, errors::ERR_INVALID_PHASE);
            // Cannot guess while waiting for an answer — must finish the current Q&A first.
            assert(!game.awaiting_answer, errors::ERR_AWAITING_ANSWER);
            assert(active_player(game) == caller, errors::ERR_NOT_YOUR_TURN);

            game.turn_count = game.turn_count + 1_u16;
            game.guess_character_id = character_id;
            game.phase = constants::PHASE_REVEAL;
            // NOTE: current_turn is intentionally NOT flipped here. It retains the guesser's
            // identity so that `reveal_character` can determine who guessed and resolve the winner.
            game.last_action_at = now;
            world.write_model(@game);

            world
                .write_model(
                    @Turn {
                        game_id,
                        turn_number: game.turn_count,
                        action_type: constants::ACTION_TYPE_GUESS,
                        question_id: 0, // not applicable for guess turns
                        answer: false,
                        asked_by: caller,
                        answered_by: zero,
                        guessed_character_id: character_id,
                        action_timestamp: now,
                        proof_verified: false,
                    },
                );

            world.emit_event(@GuessMade { game_id, guessed_by: caller, character_id });
        }

        fn reveal_character(
            ref self: ContractState, game_id: felt252, character_id: felt252, salt: felt252,
        ) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);
            let mut commitment: Commitment = world.read_model((game_id, caller));

            assert_game_exists(game);
            assert_player_in_game(game, caller);
            assert(game.phase == constants::PHASE_REVEAL, errors::ERR_INVALID_PHASE);
            assert(commitment.hash != 0, errors::ERR_NO_COMMITMENT);
            assert(!commitment.revealed, errors::ERR_ALREADY_REVEALED);
            // Zero salt is trivially guessable and always invalid.
            assert(salt != 0, errors::ERR_INVALID_REVEAL);

            let expected_hash = core::pedersen::pedersen(character_id, salt);
            assert(expected_hash == commitment.hash, errors::ERR_INVALID_REVEAL);

            commitment.revealed = true;
            commitment.character_id = character_id;
            world.write_model(@commitment);

            world.emit_event(@CharacterRevealed { game_id, player: caller, character_id });

            // Resolve winner once both players have revealed.
            let p1_commitment: Commitment = world.read_model((game_id, game.player1));
            let p2_commitment: Commitment = world.read_model((game_id, game.player2));

            if p1_commitment.revealed && p2_commitment.revealed {
                // `current_turn` was not flipped by `make_guess`, so it still points to the
                // guesser. The guess target is the opponent's character.
                let guesser = active_player(game);
                let target = other_player(game);
                let guess_target = if game.current_turn == 1_u8 {
                    p2_commitment.character_id
                } else {
                    p1_commitment.character_id
                };

                let is_correct = game.guess_character_id == guess_target;
                game.winner = if is_correct { guesser } else { target };
                game.phase = constants::PHASE_COMPLETED;
                game.last_action_at = now;
                world.write_model(@game);
                world.emit_event(@GuessResult { game_id, guessed_by: guesser, is_correct });
                world.emit_event(@GameCompleted { game_id, winner: game.winner });
            }
        }

        fn claim_timeout(ref self: ContractState, game_id: felt252) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();
            let mut game: Game = world.read_model(game_id);
            let zero = ContractAddressZeroable::zero();

            assert_game_exists(game);
            // Cannot claim timeout on a completed game.
            assert(game.phase != constants::PHASE_COMPLETED, errors::ERR_INVALID_PHASE);
            assert(
                now >= game.last_action_at + constants::ACTION_TIMEOUT_SECONDS,
                errors::ERR_TIMEOUT_NOT_REACHED,
            );

            let timed_out_player = if game.phase == constants::PHASE_WAITING_FOR_PLAYER2 {
                // Abandoned game: only the creator can reclaim their slot.
                assert(caller == game.player1, errors::ERR_NOT_PLAYER);
                zero
            } else {
                // The player who should have acted but didn't is the timed-out one.
                let expected = expected_actor(game);
                assert(caller != expected, errors::ERR_CALLER_NOT_ELIGIBLE);
                assert_player_in_game(game, caller);
                expected
            };

            game.winner = caller;
            game.phase = constants::PHASE_COMPLETED;
            game.last_action_at = now;
            world.write_model(@game);

            world.emit_event(@TimeoutClaimed { game_id, claimed_by: caller, timed_out_player });
            world.emit_event(@GameCompleted { game_id, winner: caller });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> WorldStorage {
            self.world(@"whoiswho")
        }
    }
}
