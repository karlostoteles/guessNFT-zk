/**
 * useToriiGameSync — Torii WASM-based real-time sync for online 1v1 games.
 *
 * Self-contained: all imports from src/zk/ internal paths.
 * Post-merge, this hook will import store/selectors from src/core/store/
 * instead of taking them as parameters.
 *
 * IMPORTANT: This file is preserved as-is for reference. Post-merge wiring
 * will need to:
 * 1. Import useGameStore from src/core/store/gameStore
 * 2. Import GamePhase from src/core/store/types
 * 3. Import getCommitment, characterIdToFelt, ensureZKCommitment from commitReveal
 * 4. Call setZKStoreCallbacks() at mount time
 */
import { useEffect, useRef, useState } from 'react';
import { getToriiClient, WORLD_ADDRESS } from './toriiClient';
import type { Clause, Subscription, Ty, Model } from './toriiClient';
import { getStarknetAccount, toFeltHex } from './zkSdk';
import { loadCollectionData } from './collectionData';
import {
  generateAndSubmitProofWithLifecycle,
  askQuestionOnChain,
  commitCharacterOnChain,
  makeGuessOnChain,
  revealCharacterOnChain,
  prewarmProver,
  terminateProver,
  setZKStoreCallbacks,
} from './useZKAnswer';

export interface ZKSyncUIState {
  proofStatus: 'idle' | 'proving' | 'submitting';
  revealedAnswer: boolean | null;
}

// ─── Types for store interface ──────────────────────────────────────────────

type PlayerId = 'player1' | 'player2';

/**
 * Store interface — the hook talks to the game store through these callbacks.
 * Post-merge, these map directly to useGameStore actions.
 */
export interface GameStoreInterface {
  // State readers
  getPhase(): string;
  getMode(): string;
  getStarknetGameId(): string | null;
  getOnlinePlayerNum(): number | null;
  getActivePlayer(): PlayerId;
  getPlayers(): Record<PlayerId, { secretCharacterId: string | null; eliminatedCharacterIds: string[] }>;
  getGameSessionId(): string;
  getCurrentQuestion(): { questionId: number; askedBy: PlayerId } | null;
  getGuessedCharacterId(): string | null;
  getProcessedTurnIds(): Set<number>;

  // State writers
  setPhase(phase: string): void;
  setOnlineGame(gameId: string, playerNum: 1 | 2): void;
  startSetup(): void;
  advanceToGameStart(): void;
  setActivePlayer(player: PlayerId): void;
  receiveOpponentQuestion(questionId: number, turnNumber: number): void;
  applyOpponentAnswer(answer: boolean): void;
  receiveOpponentGuess(characterId: string, isCorrect: boolean, winnerPlayerNum: 1 | 2 | null): void;
  setProofError(message: string): void;
  clearProofError(): void;
  setVerifiedAnswer(answer: boolean): void;
  setWinner(player: PlayerId): void;
  setRevealedCharacter(player: PlayerId, characterId: string): void;
  addProcessedTurnId(turnId: number): void;
  clearProcessedTurnId(turnId: number): void;

  // Commitment access
  getCommitment(playerId: PlayerId, gameSessionId: string): {
    characterId: string;
    salt: string;
    commitment: string;
    zkCommitment?: string;
  } | null;
  characterIdToFelt(characterId: string): string;
  ensureZKCommitment(
    playerId: PlayerId,
    gameSessionId: string,
    gameId: bigint,
    playerAddress: bigint,
  ): Promise<{ commitment: string; zkCommitment?: string }>;
}

// ─── Helpers: extract typed values from Torii Ty fields ────────────────────

function tyToNumber(ty: Ty | undefined): number {
  if (!ty) return 0;
  if (typeof ty.value === 'number') return ty.value;
  if (typeof ty.value === 'string') return Number(ty.value);
  if (typeof ty.value === 'boolean') return ty.value ? 1 : 0;
  return 0;
}

function tyToBool(ty: Ty | undefined): boolean {
  if (!ty) return false;
  if (typeof ty.value === 'boolean') return ty.value;
  if (typeof ty.value === 'number') return ty.value !== 0;
  if (typeof ty.value === 'string') return ty.value !== '0' && ty.value !== '' && ty.value !== '0x0';
  return false;
}

function tyToHex(ty: Ty | undefined): string {
  if (!ty) return '0x0';
  if (typeof ty.value === 'string') return ty.value;
  if (typeof ty.value === 'number') return '0x' + ty.value.toString(16);
  return '0x0';
}

interface OnChainGame {
  phase: number;
  current_turn: number;
  turn_count: number;
  last_question_id: number;
  awaiting_answer: boolean;
  guess_character_id: string;
  winner: string;
  player1: string;
  player2: string;
  question_set_id: number;
}

function parseGameModel(model: Model): OnChainGame {
  return {
    phase:              tyToNumber(model.phase),
    current_turn:       tyToNumber(model.current_turn),
    turn_count:         tyToNumber(model.turn_count),
    last_question_id:   tyToNumber(model.last_question_id),
    awaiting_answer:    tyToBool(model.awaiting_answer),
    guess_character_id: tyToHex(model.guess_character_id),
    winner:             tyToHex(model.winner),
    player1:            tyToHex(model.player1),
    player2:            tyToHex(model.player2),
    question_set_id:    tyToNumber(model.question_set_id),
  };
}

// Contract phase constants
const PHASE = {
  WAITING_FOR_PLAYER2: 0,
  COMMIT_PHASE: 1,
  PLAYING: 2,
  REVEAL: 3,
  COMPLETED: 4,
} as const;

// ─── Turn query helper ──────────────────────────────────────────────────────

async function queryTurnAnswer(
  gameId: string,
  turnNumber: number,
): Promise<boolean | null> {
  try {
    const client = await getToriiClient();
    const result = await client.getEntities({
      world_addresses: [WORLD_ADDRESS],
      pagination: { limit: 1, cursor: undefined, direction: 'Forward', order_by: [] },
      clause: {
        Keys: {
          keys: [gameId, `0x${turnNumber.toString(16)}`],
          pattern_matching: 'FixedLen',
          models: ['whoiswho-Turn'],
        },
      },
      no_hashed_keys: false,
      models: ['whoiswho-Turn'],
      historical: false,
    });

    const items: any[] = (result as any).items ?? Object.values(result);
    if (!items.length) return null;
    const turnModel = items[0]?.models?.['whoiswho-Turn'];
    if (!turnModel) return null;

    const answeredBy = tyToHex(turnModel.answered_by);
    if (!answeredBy || answeredBy === '0x0') {
      return null;
    }

    const rawAnswer = turnModel.answer;
    const parsed = tyToBool(rawAnswer);
    return parsed;
  } catch (err) {
    console.error('[sync] queryTurnAnswer failed:', err);
    return null;
  }
}

async function resolveTurnAnswer(
  gameId: string,
  turnCount: number,
): Promise<{ turnNumber: number; answer: boolean } | null> {
  const direct = await queryTurnAnswer(gameId, turnCount);
  if (direct !== null) {
    return { turnNumber: turnCount, answer: direct };
  }

  // Some contracts advance turn_count before the previous turn answer is queryable.
  if (turnCount > 0) {
    const prev = await queryTurnAnswer(gameId, turnCount - 1);
    if (prev !== null) {
      return { turnNumber: turnCount - 1, answer: prev };
    }
  }

  return null;
}

// ─── Commitment query helper ─────────────────────────────────────────────────

async function queryCommitmentCharacterId(
  gameId: string,
  playerAddress: string,
): Promise<string | null> {
  try {
    const client = await getToriiClient();
    const result = await client.getEntities({
      world_addresses: [WORLD_ADDRESS],
      pagination: { limit: 1, cursor: undefined, direction: 'Forward', order_by: [] },
      clause: {
        Keys: {
          keys: [gameId, playerAddress],
          pattern_matching: 'FixedLen',
          models: ['whoiswho-Commitment'],
        },
      },
      no_hashed_keys: false,
      models: ['whoiswho-Commitment'],
      historical: false,
    });

    const items: any[] = (result as any).items ?? Object.values(result);
    if (!items.length) return null;
    const commitModel = items[0]?.models?.['whoiswho-Commitment'];
    if (!commitModel) return null;

    const revealed = tyToBool(commitModel.revealed);
    if (!revealed) return null;

    const charIdFelt = tyToHex(commitModel.character_id);
    if (!charIdFelt || charIdFelt === '0x0') return 'nft_0';
    const numericId = Number(BigInt(charIdFelt));
    return `nft_${numericId}`;
  } catch (err) {
    console.error('[sync] queryCommitmentCharacterId failed:', err);
    return null;
  }
}

// ─── Main hook ───────────────────────────────────────────────────────────────

/**
 * Torii game sync hook.
 *
 * Post-merge: call with no args, read store directly via useGameStore.
 * Pre-merge (isolated): requires a GameStoreInterface to communicate with the store.
 */
export function useToriiGameSync(store: GameStoreInterface): ZKSyncUIState {
  const subscriptionRef = useRef<Subscription | null>(null);
  const lastProcessedKeyRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eliminateInFlightRef = useRef(false);
  const revealInFlightRef = useRef(false);
  const revealAttemptsRef = useRef(0);
  const MAX_REVEAL_ATTEMPTS = 3;
  const proofInFlightRef = useRef(false);
  const commitInFlightRef = useRef(false);
  const committedForSessionRef = useRef<string | null>(null);
  const sentQuestionRef = useRef<number | null>(null);
  const sentGuessRef = useRef<string | null>(null);
  const appliedAnswerTurnsRef = useRef<Set<number>>(new Set());
  const answerRevealInFlightRef = useRef(false);
  const handleUpdateInFlightRef = useRef(false);
  const gameCompletedRef = useRef(false);
  const [proofStatus, setProofStatus] = useState<'idle' | 'proving' | 'submitting'>('idle');
  const [revealedAnswer, setRevealedAnswer] = useState<boolean | null>(null);

  const mode = store.getMode();
  const starknetGameId = store.getStarknetGameId();
  const onlinePlayerNum = store.getOnlinePlayerNum();

  const myChainAddress = (): string => {
    const account = getStarknetAccount(onlinePlayerNum as 1 | 2 ?? undefined);
    return account ? String(account.address) : '0x0';
  };

  // Wire ZK store callbacks
  useEffect(() => {
    setZKStoreCallbacks({
      setPhase: store.setPhase,
      clearProofError: store.clearProofError,
      setVerifiedAnswer: store.setVerifiedAnswer,
      setProofError: store.setProofError,
      clearProcessedTurnId: store.clearProcessedTurnId,
    });
  }, [store]);

  // Pre-warm prover + collection data cache
  useEffect(() => {
    if (mode !== 'online') return;
    prewarmProver();
    loadCollectionData().catch((err) =>
      console.error('[torii-sync] Failed to pre-load collection data:', err),
    );
    return () => terminateProver();
  }, [mode]);

  // Push commitment on-chain when character is selected
  useEffect(() => {
    if (mode !== 'online' || !starknetGameId || !onlinePlayerNum) return;
    if (store.getPhase() !== 'ONLINE_WAITING') return;
    if (commitInFlightRef.current) return;

    const myKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    const commitment = store.getCommitment(myKey, store.getGameSessionId());
    if (!commitment) return;

    const gameId = starknetGameId;
    const playerNum = onlinePlayerNum as 1 | 2;
    const sessionKey = `${gameId}:${store.getGameSessionId()}:${playerNum}`;
    if (committedForSessionRef.current === sessionKey) return;

    commitInFlightRef.current = true;
    const chainAddr = myChainAddress();

    store.ensureZKCommitment(myKey, store.getGameSessionId(), BigInt(gameId), BigInt(chainAddr))
      .then((updatedCommitment) =>
        commitCharacterOnChain(
          gameId,
          updatedCommitment.commitment,
          updatedCommitment.zkCommitment!,
          playerNum,
        ),
      )
      .then(() => {
        committedForSessionRef.current = sessionKey;
      })
      .catch((err) => {
        console.error('[torii-sync] Commitment (useEffect) failed:', err);
        lastProcessedKeyRef.current = null;
      })
      .finally(() => {
        commitInFlightRef.current = false;
      });
  }, [store.getPhase(), mode, starknetGameId, onlinePlayerNum]);

  // Send ask_question on-chain when I ask a question
  useEffect(() => {
    if (mode !== 'online' || !starknetGameId || !onlinePlayerNum) return;
    if (store.getPhase() !== 'ANSWER_PENDING') return;

    const currentQuestion = store.getCurrentQuestion();
    if (!currentQuestion) return;

    const myKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    if (currentQuestion.askedBy !== myKey) return;
    if (sentQuestionRef.current === currentQuestion.questionId) return;

    sentQuestionRef.current = currentQuestion.questionId;

    askQuestionOnChain(starknetGameId, currentQuestion.questionId, onlinePlayerNum as 1 | 2)
      .catch(console.error);
  }, [store.getPhase(), starknetGameId]);

  // Send make_guess on-chain when I make a guess
  useEffect(() => {
    if (mode !== 'online' || !starknetGameId || !onlinePlayerNum) return;
    if (store.getPhase() !== 'ANSWER_PENDING') return;

    const guessedCharacterId = store.getGuessedCharacterId();
    if (!guessedCharacterId) return;
    if (store.getCurrentQuestion()) return;
    if (sentGuessRef.current === guessedCharacterId) return;

    sentGuessRef.current = guessedCharacterId;

    const charIdFelt = store.characterIdToFelt(guessedCharacterId);
    makeGuessOnChain(starknetGameId, charIdFelt, onlinePlayerNum as 1 | 2)
      .catch((err) => {
        console.error('[sync-debug] GUESS SUBMIT: makeGuessOnChain FAILED:', err);
      });
  }, [store.getGuessedCharacterId(), store.getPhase(), starknetGameId]);

  // Subscribe to Game entity via Torii
  useEffect(() => {
    if (mode !== 'online' || !starknetGameId || !onlinePlayerNum) return;

    const gameId = starknetGameId;
    const playerNum = onlinePlayerNum as 1 | 2;
    let cancelled = false;

    async function setupSubscription() {
      try {
        const client = await getToriiClient();

        const initialEntity = await client.getEntities({
          world_addresses: [WORLD_ADDRESS],
          pagination: { limit: 1, cursor: undefined, direction: 'Forward', order_by: [] },
          clause: {
            Keys: {
              keys: [gameId],
              pattern_matching: 'FixedLen',
              models: ['whoiswho-Game'],
            },
          },
          no_hashed_keys: false,
          models: ['whoiswho-Game'],
          historical: false,
        });

        if (cancelled) return;

        const items: any[] = (initialEntity as any).items ?? Object.values(initialEntity);
        if (items.length > 0) {
          const gameModel = items[0].models?.['whoiswho-Game'];
          if (gameModel) {
            handleGameUpdate(parseGameModel(gameModel), gameId, playerNum).catch(err => console.error('[sync-debug] handleGameUpdate THREW:', err));
          }
        }

        const clause: Clause = {
          Keys: {
            keys: [gameId],
            pattern_matching: 'VariableLen',
            models: ['whoiswho-Game'],
          },
        };

        const sub = await client.onEntityUpdated(
          clause,
          [WORLD_ADDRESS],
          (...args: unknown[]) => {
            if (cancelled) return;

            let gameModel: Model | undefined;

            if (typeof args[0] === 'string' && args[1] && typeof args[1] === 'object') {
              const models = args[1] as Record<string, Model>;
              gameModel = models['whoiswho-Game'];
            } else if (args[0] && typeof args[0] === 'object' && 'models' in (args[0] as object)) {
              const entity = args[0] as { models: Record<string, Model> };
              gameModel = entity.models?.['whoiswho-Game'];
            } else if (Array.isArray(args[0])) {
              const entities = args[0] as Array<{ models: Record<string, Model> }>;
              if (entities.length > 0) {
                gameModel = entities[0].models?.['whoiswho-Game'];
              }
            }

            if (gameModel) {
              handleGameUpdate(parseGameModel(gameModel), gameId, playerNum).catch(err => console.error('[sync-debug] handleGameUpdate THREW:', err));
            } else {
              console.warn('[torii-sync] Received update but could not parse Game model. Args:', args);
            }
          },
        );

        if (cancelled) {
          sub.cancel();
          return;
        }

        subscriptionRef.current = sub;
      } catch (err) {
        console.error('[torii-sync] Failed to set up subscription:', err);
      }
    }

    setupSubscription();

    pollIntervalRef.current = setInterval(async () => {
      if (cancelled) return;
      try {
        const client = await getToriiClient();
        const result = await client.getEntities({
          world_addresses: [WORLD_ADDRESS],
          pagination: { limit: 1, cursor: undefined, direction: 'Forward', order_by: [] },
          clause: {
            Keys: {
              keys: [gameId],
              pattern_matching: 'FixedLen',
              models: ['whoiswho-Game'],
            },
          },
          no_hashed_keys: false,
          models: ['whoiswho-Game'],
          historical: false,
        });
        const items: any[] = (result as any).items ?? Object.values(result);
        if (items.length > 0) {
          const gameModel = items[0].models?.['whoiswho-Game'];
          if (gameModel) {
            handleGameUpdate(parseGameModel(gameModel), gameId, playerNum).catch(err => console.error('[sync-debug] handleGameUpdate THREW:', err));
          }
        }
      } catch {
        // Polling failure is non-fatal
      }
    }, 3000);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.cancel();
        subscriptionRef.current = null;
      }
      lastProcessedKeyRef.current = null;
      proofInFlightRef.current = false;
      commitInFlightRef.current = false;
      eliminateInFlightRef.current = false;
      revealInFlightRef.current = false;
      revealAttemptsRef.current = 0;
      gameCompletedRef.current = false;
      appliedAnswerTurnsRef.current.clear();
      answerRevealInFlightRef.current = false;
      setProofStatus('idle');
      setRevealedAnswer(null);
    };
  }, [mode, starknetGameId, onlinePlayerNum]);

  // ─── Retrieve opponent's answer from Turn model ────────────────────────
  async function applyOpponentAnswerFromTurn(
    gameId: string,
    turnCount: number,
  ): Promise<number | null> {
    if (answerRevealInFlightRef.current) {
      lastProcessedKeyRef.current = null;
      return null;
    }

    let resolved = await resolveTurnAnswer(gameId, turnCount);
    if (resolved === null) {
      await new Promise(r => setTimeout(r, 300));
      resolved = await resolveTurnAnswer(gameId, turnCount);
    }

    if (resolved === null) {
      console.warn('[sync] Turn answer not available for turn context', turnCount);
      lastProcessedKeyRef.current = null;
      return null;
    }

    if (appliedAnswerTurnsRef.current.has(resolved.turnNumber)) {
      // If fallback resolved to a previously applied turn, wait for the
      // requested turn to become queryable instead of replaying stale data.
      if (resolved.turnNumber !== turnCount) {
        lastProcessedKeyRef.current = null;
        return null;
      }
      return resolved.turnNumber;
    }

    answerRevealInFlightRef.current = true;
    // Mark turn as applied BEFORE the reveal delay so concurrent
    // handleGameUpdate calls see it in alreadyHandled checks.
    appliedAnswerTurnsRef.current.add(resolved.turnNumber);
    try {
      setRevealedAnswer(resolved.answer);
      setProofStatus('idle');
      await new Promise((r) => setTimeout(r, 1000));
      setRevealedAnswer(null);
      store.applyOpponentAnswer(resolved.answer);
    } finally {
      answerRevealInFlightRef.current = false;
    }
    return resolved.turnNumber;
  }

  // ─── Submit commitment on-chain ─────────────────────────────────────────
  async function triggerCommitment(gameId: string, playerNum: 1 | 2) {
    if (commitInFlightRef.current) return;

    const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
    const commitment = store.getCommitment(myKey, store.getGameSessionId());
    if (!commitment) return;

    const sessionKey = `${gameId}:${store.getGameSessionId()}:${playerNum}`;
    if (committedForSessionRef.current === sessionKey) return;

    commitInFlightRef.current = true;
    const chainAddr = myChainAddress();
    try {
      const updatedCommitment = await store.ensureZKCommitment(
        myKey,
        store.getGameSessionId(),
        BigInt(gameId),
        BigInt(chainAddr),
      );
      await commitCharacterOnChain(
        gameId,
        updatedCommitment.commitment,
        updatedCommitment.zkCommitment!,
        playerNum,
      );
      committedForSessionRef.current = sessionKey;
    } catch (err) {
      console.error('[torii-sync] Commitment submission failed:', err);
      lastProcessedKeyRef.current = null;
    } finally {
      commitInFlightRef.current = false;
    }
  }

  // ─── Phase change handler ──────────────────────────────────────────────
  async function handleGameUpdate(game: OnChainGame, gameId: string, myPlayerNum: 1 | 2) {
    // Once COMPLETED is processed, ignore all further updates (stale subscription
    // events with older phases like REVEAL would otherwise regress the store phase).
    if (gameCompletedRef.current) return;

    const stateKey = `${game.phase}:${Number(game.awaiting_answer)}:${game.turn_count}:${game.current_turn}`;
    if (lastProcessedKeyRef.current === stateKey) return;

    // Serialize: only one handleGameUpdate in-flight at a time.
    // Without this, stale subscription events racing during the 1s reveal
    // delay can bypass alreadyHandled guards and regress the phase.
    if (handleUpdateInFlightRef.current) {
      // Don't update lastProcessedKeyRef — the next poll will retry.
      return;
    }

    lastProcessedKeyRef.current = stateKey;
    handleUpdateInFlightRef.current = true;


    try {
    switch (game.phase) {
      case PHASE.WAITING_FOR_PLAYER2: {
        const currentPhase = store.getPhase();
        if (currentPhase !== 'SETUP_P1' && currentPhase !== 'SETUP_P2') {
          store.setPhase('ONLINE_WAITING');
        }
        break;
      }

      case PHASE.COMMIT_PHASE: {
        const myKey: PlayerId = myPlayerNum === 1 ? 'player1' : 'player2';
        const hasCharacter = !!store.getPlayers()[myKey].secretCharacterId;
        if (!hasCharacter) {
          store.startSetup();
        } else {
          store.setPhase('ONLINE_WAITING');
        }
        triggerCommitment(gameId, myPlayerNum);
        const sessionKey = `${gameId}:${store.getGameSessionId()}:${myPlayerNum}`;
        if (committedForSessionRef.current !== sessionKey) {
          lastProcessedKeyRef.current = null;
        }
        break;
      }

      case PHASE.PLAYING: {
        const myPlayerKey: PlayerId = myPlayerNum === 1 ? 'player1' : 'player2';

        if (!game.awaiting_answer) {

          if (game.turn_count === 0) {
            store.advanceToGameStart();
          }

          const alreadyAppliedForContext =
            appliedAnswerTurnsRef.current.has(game.turn_count);


          if (game.turn_count > 0 && !alreadyAppliedForContext) {
            try {
              const appliedTurn = await applyOpponentAnswerFromTurn(gameId, game.turn_count);
              if (appliedTurn === null) {
                return;
              }
              // appliedAnswerTurnsRef is now updated inside applyOpponentAnswerFromTurn
              // (before the reveal delay) to close the race window.
            } catch (err) {
              console.error('[sync-debug] applyOpponentAnswerFromTurn THREW:', err);
              return;
            }
          }

          // Keep local board perspective stable; `current_turn` decides only who can act on-chain.
          try {
            store.setActivePlayer(myPlayerKey);
            const targetPhase = game.current_turn === myPlayerNum ? 'QUESTION_SELECT' : 'ONLINE_WAITING';
            store.setPhase(targetPhase);
          } catch (err) {
            console.error('[sync-debug] setActivePlayer or setPhase THREW:', err);
          }

        } else {
          // Guard: skip stale awaiting_answer=true updates if we already
          // applied the answer for this turn (poll/subscription can deliver
          // old state after the post-answer state was already processed).
          if (answerRevealInFlightRef.current) break;
          const alreadyHandled = appliedAnswerTurnsRef.current.has(game.turn_count);
          if (alreadyHandled) break;

          const iAmAnswerer = game.current_turn !== myPlayerNum;
          const isGuessPending = game.guess_character_id !== '0x0' && game.guess_character_id !== '0x00' && game.guess_character_id !== '0x0000000000000000000000000000000000000000000000000000000000000000';


          if (isGuessPending) {
            // Opponent submitted a guess, not a question — skip proof generation.
            // Defender auto-reveals so the contract can compare.
            store.setPhase('REVEAL_WAITING');
            triggerAutoReveal(gameId, myPlayerNum);
          } else if (iAmAnswerer) {
            const alreadyProcessed = store.getProcessedTurnIds().has(game.turn_count);
            if (!proofInFlightRef.current && !alreadyProcessed) {
              store.addProcessedTurnId(game.turn_count);
              proofInFlightRef.current = true;
              setProofStatus('proving');
              store.setActivePlayer(myPlayerKey);
              store.receiveOpponentQuestion(game.last_question_id, game.turn_count);
              triggerProofGeneration(gameId, game, myPlayerNum);
            }
          } else {
            setProofStatus('idle');
            store.setPhase('ANSWER_PENDING');
          }
        }
        break;
      }

      case PHASE.REVEAL: {
        if (revealInFlightRef.current) break;
        if (revealAttemptsRef.current >= MAX_REVEAL_ATTEMPTS) {
          console.error('[sync-debug] PHASE.REVEAL: max reveal attempts reached. Giving up.');
          store.setProofError('Reveal failed after multiple attempts. Please restart the game.');
          break;
        }
        revealAttemptsRef.current += 1;
        store.setPhase('REVEAL_WAITING');
        triggerAutoReveal(gameId, myPlayerNum);
        break;
      }

      case PHASE.COMPLETED: {
        gameCompletedRef.current = true;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (subscriptionRef.current) {
          subscriptionRef.current.cancel();
          subscriptionRef.current = null;
        }
        const winnerAddr = game.winner;
        const winnerPlayer: PlayerId = winnerAddr === game.player1 ? 'player1' : 'player2';

        // Read revealed character IDs from both commitments
        await resolveRevealedCharacters(gameId, game, myPlayerNum);

        store.setWinner(winnerPlayer);
        store.setPhase('GAME_OVER');
        break;
      }

      default:
        console.warn(`[torii-sync] Unknown contract phase: ${game.phase}`);
        break;
    }
    } finally {
      handleUpdateInFlightRef.current = false;
    }
  }

  // ─── Async side effects ────────────────────────────────────────────────
  async function triggerProofGeneration(gameId: string, game: OnChainGame, playerNum: 1 | 2) {
    const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
    const mySecretId = store.getPlayers()[myKey].secretCharacterId;
    if (!mySecretId) {
      proofInFlightRef.current = false;
      return;
    }

    const commitment = store.getCommitment(myKey, store.getGameSessionId());
    if (!commitment) {
      console.warn('[torii-sync] No commitment found — cannot generate proof');
      proofInFlightRef.current = false;
      return;
    }

    // nft_X IDs are already 0-based (0–998) — NO subtraction needed.
    // schizodio.json uses characters[X].id = X, and collectionService creates id = `nft_${raw.id}`.
    const numericCharId = mySecretId.startsWith('nft_')
      ? parseInt(mySecretId.slice(4), 10)
      : parseInt(mySecretId, 10);

    if (isNaN(numericCharId) || numericCharId < 0) {
      console.warn('[torii-sync] Invalid character ID for proof:', mySecretId);
      proofInFlightRef.current = false;
      return;
    }

    const usedCommitment = commitment.zkCommitment ?? commitment.commitment;

    try {
      const result = await generateAndSubmitProofWithLifecycle({
        gameId,
        turnId: String(game.turn_count),
        commitment: usedCommitment,
        questionId: game.last_question_id,
        characterId: numericCharId,
        salt: commitment.salt,
        playerNum,
      }, {
        onStatusChange: (status) => setProofStatus(status),
      });

      const answer = Boolean(result.answerBit);
    } catch (err) {
      console.error('[torii-sync] Proof generation/submission failed:', err);
      lastProcessedKeyRef.current = null;
    } finally {
      proofInFlightRef.current = false;
      setProofStatus('idle');
    }
  }

  async function resolveRevealedCharacters(gameId: string, game: OnChainGame, myPlayerNum: 1 | 2) {
    try {
      const opponentKey: PlayerId = myPlayerNum === 1 ? 'player2' : 'player1';
      const opponentAddr = myPlayerNum === 1 ? game.player2 : game.player1;
      const myAddr = myPlayerNum === 1 ? game.player1 : game.player2;

      // Query opponent's revealed character
      const opponentCharId = await queryCommitmentCharacterId(gameId, opponentAddr);
      if (opponentCharId) {
        store.setRevealedCharacter(opponentKey, opponentCharId);
      }

      // Also set own character from contract (in case local store lost it)
      const myKey: PlayerId = myPlayerNum === 1 ? 'player1' : 'player2';
      const myCharId = await queryCommitmentCharacterId(gameId, myAddr);
      if (myCharId && !store.getPlayers()[myKey].secretCharacterId) {
        store.setRevealedCharacter(myKey, myCharId);
      }
    } catch (err) {
      console.error('[sync] resolveRevealedCharacters failed:', err);
    }
  }

  function triggerAutoReveal(gameId: string, playerNum: 1 | 2) {
    if (revealInFlightRef.current) {
      return;
    }
    // If Torii reports PHASE.REVEAL, make_guess is already accepted on-chain.
    // Do not block reveal waiting on local makeGuessOnChain promise settlement.
    revealInFlightRef.current = true;

    const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
    const sessionId = store.getGameSessionId();
    const commitment = store.getCommitment(myKey, sessionId);


    if (!commitment) {
      console.error('[REVEAL] NO COMMITMENT FOUND');
      store.setProofError('Cannot reveal: commitment not found in localStorage.');
      revealInFlightRef.current = false;
      return;
    }

    const charIdFelt = store.characterIdToFelt(commitment.characterId);

    revealCharacterOnChain(gameId, charIdFelt, commitment.salt, playerNum).then(
      () => {
        revealInFlightRef.current = false;
        // Don't need to do anything else — the next poll will see PHASE.COMPLETED
      },
      (err) => {
        console.error('[REVEAL] *** FAILED ***', err?.message ?? err);
        revealInFlightRef.current = false;
        // Allow the next poll cycle to retry by clearing the processed key
        lastProcessedKeyRef.current = null;
      },
    );
  }

  return {
    proofStatus,
    revealedAnswer,
  };
}
