import { useGameStore } from './gameStore';
import { PlayerId } from './types';

export const usePhase = () => useGameStore((s) => s.phase);
export const useGameMode = () => useGameStore((s) => s.mode);
export const useGameCharacters = () => useGameStore((s) => s.characters);
export const useActivePlayer = () => useGameStore((s) => s.activePlayer);
export const useTurnNumber = () => useGameStore((s) => s.turnNumber);
export const useBoardRotation = () => useGameStore((s) => s.boardRotation);
export const useCurrentQuestion = () => useGameStore((s) => s.currentQuestion);
export const useCpuQuestion = () => useGameStore((s) => s.cpuQuestion);
export const useQuestionHistory = () => useGameStore((s) => s.questionHistory);
export const useWinner = () => useGameStore((s) => s.winner);
export const useGuessedCharacterId = () => useGameStore((s) => s.guessedCharacterId);
export const useGameSessionId = () => useGameStore((s) => s.gameSessionId);
export const useCommitmentStatus = () => useGameStore((s) => s.commitmentStatus);
export const useOnlineGameId = () => useGameStore((s) => s.onlineGameId);
export const useOnlineRoomCode = () => useGameStore((s) => s.onlineRoomCode);
export const useOnlinePlayerNum = () => useGameStore((s) => s.onlinePlayerNum);
export const useStarknetGameId = () => useGameStore((s) => s.starknetGameId);
export const useProofError = () => useGameStore((s) => s.proofError);
export const useProcessedTurnIds = () => useGameStore((s) => s.processedTurnIds);

export const useTextureProgress = () => useGameStore((s) => s.textureProgress);
export const useTextureReady = () => useGameStore((s) =>
  s.textureProgress.total > 0 && s.textureProgress.loaded >= s.textureProgress.total
);

export const usePlayerState = (player: PlayerId) =>
  useGameStore((s) => s.players[player]);

export const useEliminatedIds = (player: PlayerId) =>
  useGameStore((s) => s.players[player].eliminatedCharacterIds);

// Actions are stable — grab them directly from the store, not via selector
// This avoids creating a new object each render (which causes infinite loops)
const actions = {
  get setGameMode() { return useGameStore.getState().setGameMode; },
  get startSetup() { return useGameStore.getState().startSetup; },
  get selectSecretCharacter() { return useGameStore.getState().selectSecretCharacter; },
  get advancePhase() { return useGameStore.getState().advancePhase; },
  get askQuestion() { return useGameStore.getState().askQuestion; },
  get answerQuestion() { return useGameStore.getState().answerQuestion; },
  get toggleElimination() { return useGameStore.getState().toggleElimination; },
  get finishElimination() { return useGameStore.getState().finishElimination; },
  get startGuess() { return useGameStore.getState().startGuess; },
  get makeGuess() { return useGameStore.getState().makeGuess; },
  get cancelGuess() { return useGameStore.getState().cancelGuess; },
  get resetGame() { return useGameStore.getState().resetGame; },
  get setOnlineGame() { return useGameStore.getState().setOnlineGame; },
  get recoverOnlineGame() { return useGameStore.getState().recoverOnlineGame; },
  get advanceToGameStart() { return useGameStore.getState().advanceToGameStart; },
  get receiveOpponentQuestion() { return useGameStore.getState().receiveOpponentQuestion; },
  get applyOpponentAnswer() { return useGameStore.getState().applyOpponentAnswer; },
  get receiveOpponentGuess() { return useGameStore.getState().receiveOpponentGuess; },
  get applyGuessResult() { return useGameStore.getState().applyGuessResult; },
  get goBackToSetupP1() { return useGameStore.getState().goBackToSetupP1; },
  get enrichNFTCharacters() { return useGameStore.getState().enrichNFTCharacters; },
  get setPhase() { return useGameStore.getState().setPhase; },
  get setVerifiedAnswer() { return useGameStore.getState().setVerifiedAnswer; },
  get setProofError() { return useGameStore.getState().setProofError; },
  get clearProofError() { return useGameStore.getState().clearProofError; },
  get setActivePlayerDirect() { return useGameStore.getState().setActivePlayerDirect; },
  get setStarknetGameId() { return useGameStore.getState().setStarknetGameId; },
  get addProcessedTurnId() { return useGameStore.getState().addProcessedTurnId; },
  get clearProcessedTurnId() { return useGameStore.getState().clearProcessedTurnId; },
  get setWinnerDirect() { return useGameStore.getState().setWinnerDirect; },
  get setTextureProgress() { return useGameStore.getState().setTextureProgress; },
  get zkAskQuestion() { return useGameStore.getState().zkAskQuestion; },
  get zkReceiveOpponentQuestion() { return useGameStore.getState().zkReceiveOpponentQuestion; },
  get zkApplyAnswer() { return useGameStore.getState().zkApplyAnswer; },
  get zkSelectSecretCharacter() { return useGameStore.getState().zkSelectSecretCharacter; },
  get zkMakeGuess() { return useGameStore.getState().zkMakeGuess; },
};

export const useGameActions = () => actions;
