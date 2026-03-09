import { useGameStore } from '@/core/store/gameStore';
import { getCommitment } from '@/services/starknet/commitReveal';
import { characterIdToCircuitId, computeAndAttachZKCommitment } from './zkCommitment';
import type { GameStoreInterface } from './useToriiGameSync';

type PlayerId = 'player1' | 'player2';

const COMMITMENT_STORAGE_KEY = 'guessnft_commitments';

interface StoredCommitment {
  playerId: PlayerId;
  characterId: string;
  salt: string;
  commitment: string;
  gameSessionId: string;
  zkCommitment?: string;
}

function readStoredCommitments(): StoredCommitment[] {
  try {
    return JSON.parse(localStorage.getItem(COMMITMENT_STORAGE_KEY) || '[]') as StoredCommitment[];
  } catch {
    return [];
  }
}

function writeStoredCommitments(commitments: StoredCommitment[]) {
  localStorage.setItem(COMMITMENT_STORAGE_KEY, JSON.stringify(commitments));
}

function patchStoredZKCommitment(
  playerId: PlayerId,
  gameSessionId: string,
  zkCommitment: string,
) {
  const commitments = readStoredCommitments();
  const index = commitments.findIndex(
    (entry) => entry.playerId === playerId && entry.gameSessionId === gameSessionId,
  );
  if (index < 0) return;
  commitments[index] = { ...commitments[index], zkCommitment };
  writeStoredCommitments(commitments);
}

function createAdapter(): GameStoreInterface {
  const s = () => useGameStore.getState();
  let lastQuestionId: number | null = null;

  return {
    getPhase: () => s().phase,
    getMode: () => (s().mode === 'zk-online' ? 'online' : s().mode),
    getStarknetGameId: () => s().starknetGameId,
    getOnlinePlayerNum: () => s().onlinePlayerNum,
    getActivePlayer: () => s().activePlayer,
    getPlayers: () => s().players,
    getGameSessionId: () => s().gameSessionId,
    getCurrentQuestion: () => {
      const question = s().currentQuestion;
      if (!question) return null;
      const questionId = Number(question.questionId);
      if (Number.isNaN(questionId)) {
        console.error('[adapter] Invalid questionId in currentQuestion:', question.questionId);
        return null;
      }
      return { questionId, askedBy: question.askedBy };
    },
    getGuessedCharacterId: () => s().guessedCharacterId,
    getProcessedTurnIds: () => s().processedTurnIds,

    setPhase: (phase) => s().setPhase(phase as any),
    setOnlineGame: (gameId, playerNum) => s().setOnlineGame(gameId, '', playerNum),
    startSetup: () => s().startSetup(),
    advanceToGameStart: () => s().advanceToGameStart(),
    setActivePlayer: (player) => s().setActivePlayerDirect(player),
    receiveOpponentQuestion: (questionId, turnNumber) => {
      lastQuestionId = questionId;
      s().zkReceiveOpponentQuestion(questionId, turnNumber);
    },
    applyOpponentAnswer: (answer) => {
      const current = s().currentQuestion;
      const questionId = current ? Number(current.questionId) : lastQuestionId;
      if (questionId == null || Number.isNaN(questionId)) {
        console.error('[adapter] applyOpponentAnswer: missing questionId');
        return;
      }
      s().zkApplyAnswer(questionId, answer);
    },
    receiveOpponentGuess: (characterId, isCorrect, winnerPlayerNum) =>
      s().receiveOpponentGuess(characterId, isCorrect, winnerPlayerNum),
    setProofError: (message) => s().setProofError(message),
    clearProofError: () => s().clearProofError(),
    setVerifiedAnswer: (answer) => s().setVerifiedAnswer(answer),
    setWinner: (player) => s().setWinnerDirect(player),
    setRevealedCharacter: (player, characterId) => {
      const state = s();
      if (state.players[player].secretCharacterId !== characterId) {
        state.setRevealedCharacter(player, characterId);
      }
    },
    addProcessedTurnId: (turnId) => s().addProcessedTurnId(turnId),
    clearProcessedTurnId: (turnId) => s().clearProcessedTurnId(turnId),

    getCommitment: (playerId, gameSessionId) => getCommitment(playerId, gameSessionId),
    characterIdToFelt: (characterId) => `0x${characterIdToCircuitId(characterId).toString(16)}`,
    ensureZKCommitment: async (playerId, gameSessionId, gameId, playerAddress) => {
      const commitment = getCommitment(playerId, gameSessionId);
      if (!commitment) {
        throw new Error(`Missing commitment for ${playerId}:${gameSessionId}`);
      }

      const existingZKCommitment = (commitment as StoredCommitment).zkCommitment;
      if (existingZKCommitment) {
        return { commitment: commitment.commitment, zkCommitment: existingZKCommitment };
      }

      const zkCommitment = await computeAndAttachZKCommitment(
        commitment.characterId,
        commitment.salt,
        gameId,
        playerAddress,
      );
      patchStoredZKCommitment(playerId, gameSessionId, zkCommitment);

      return { commitment: commitment.commitment, zkCommitment };
    },
  };
}

export const gameStoreAdapter = createAdapter();
