import type { Character } from '@/core/data/characters';
import type { NFTAttribute } from '@/services/starknet/types';

export type GameMode = 'free' | 'nft' | 'online' | 'nft-free' | 'zk-online';

export enum GamePhase {
  MENU = 'MENU',
  SETUP_P1 = 'SETUP_P1',
  HANDOFF_P1_TO_P2 = 'HANDOFF_P1_TO_P2',
  SETUP_P2 = 'SETUP_P2',
  ONLINE_WAITING = 'ONLINE_WAITING', // waiting for opponent to commit (online mode)
  HANDOFF_START = 'HANDOFF_START',
  QUESTION_SELECT = 'QUESTION_SELECT',
  HANDOFF_TO_OPPONENT = 'HANDOFF_TO_OPPONENT',
  ANSWER_PENDING = 'ANSWER_PENDING',
  PROVING = 'PROVING',
  SUBMITTING = 'SUBMITTING',
  VERIFIED = 'VERIFIED',
  ANSWER_REVEALED = 'ANSWER_REVEALED',
  REVEAL_WAITING = 'REVEAL_WAITING',
  AUTO_ELIMINATING = 'AUTO_ELIMINATING', // tiles flipping down automatically
  ELIMINATION = 'ELIMINATION',
  TURN_TRANSITION = 'TURN_TRANSITION',
  GUESS_SELECT = 'GUESS_SELECT',
  GUESS_WRONG = 'GUESS_WRONG',   // Wrong Risk It — brief reveal, turn ends, game continues
  GUESS_RESULT = 'GUESS_RESULT', // Correct guess — winner declared
  GAME_OVER = 'GAME_OVER',
}

export type PlayerId = 'player1' | 'player2';

export interface QuestionRecord {
  questionId: string;
  questionText: string;
  traitKey: string;
  traitValue: string | boolean;
  answer: boolean | null;
  askedBy: PlayerId;
  turnNumber: number;
}

export interface PlayerState {
  secretCharacterId: string | null;
  eliminatedCharacterIds: string[];
}

export interface GameState {
  phase: GamePhase;
  mode: GameMode;
  characters: Character[];
  activePlayer: PlayerId;
  turnNumber: number;
  boardRotation: number; // Y-axis rotation in radians, 0 or PI
  players: Record<PlayerId, PlayerState>;
  currentQuestion: QuestionRecord | null;
  /** CPU's question for the current simultaneous round (free mode only). */
  cpuQuestion: QuestionRecord | null;
  questionHistory: QuestionRecord[];
  winner: PlayerId | null;
  guessedCharacterId: string | null;
  // Commit-reveal: unique ID per game session for commitment storage
  gameSessionId: string;
  // Whether both players have valid on-chain (or local) commitments
  commitmentStatus: 'none' | 'partial' | 'both';
  // Online multiplayer metadata (null in free/nft mode)
  onlineGameId: string | null;
  onlineRoomCode: string | null;
  onlinePlayerNum: 1 | 2 | null;
  // ZK online metadata
  starknetGameId: string | null;
  proofError: string | null;
  processedTurnIds: Set<number>;
  // Global client settings
  soundEnabled: boolean;
  dangerZoneEnabled: boolean;
  // Rendering infrastructure — texture loading progress (not game logic)
  textureProgress: { loaded: number; total: number };
}

export interface GameActions {
  setGameMode: (mode: GameMode, characters?: Character[]) => void;
  startSetup: () => void;
  selectSecretCharacter: (player: PlayerId, characterId: string) => void;
  assignRandomSecretCharacter: (player: PlayerId) => void;
  advancePhase: () => void;
  askQuestion: (questionId: string) => void;
  answerQuestion: (answer: boolean) => void;
  toggleElimination: (characterId: string) => void;
  finishElimination: () => void;
  startGuess: () => void;
  makeGuess: (characterId: string) => void;
  cancelGuess: () => void;
  resetGame: () => void;
  goBackToSetupP1: () => void;
  // Online-specific actions (called by useOnlineGameSync hook)
  setOnlineGame: (gameId: string, roomCode: string, playerNum: 1 | 2) => void;
  recoverOnlineGame: (characters: Character[]) => void;
  advanceToGameStart: () => void;
  receiveOpponentQuestion: (questionId: string, answer: boolean) => void;
  applyOpponentAnswer: (answer: boolean) => void;
  receiveOpponentGuess: (characterId: string, isCorrect: boolean, winnerPlayerNum: 1 | 2 | null) => void;
  applyGuessResult: (isCorrect: boolean, winner: PlayerId | null) => void;
  /** Enrich stub NFT characters with real trait attributes from fetchTraitsBatch(). */
  enrichNFTCharacters: (traitMap: Map<string, NFTAttribute[]>) => void;
  // Settings toggle
  setSoundEnabled: (enabled: boolean) => void;
  setDangerZoneEnabled: (enabled: boolean) => void;
  // Texture loading
  setTextureProgress: (progress: { loaded: number; total: number }) => void;
  // ZK thin setters
  setPhase: (phase: GamePhase) => void;
  setVerifiedAnswer: (answer: boolean) => void;
  setProofError: (msg: string) => void;
  clearProofError: () => void;
  setActivePlayerDirect: (player: PlayerId) => void;
  setStarknetGameId: (id: string) => void;
  addProcessedTurnId: (id: number) => void;
  clearProcessedTurnId: (id: number) => void;
  setWinnerDirect: (winner: PlayerId | null) => void;
  setRevealedCharacter: (player: PlayerId, characterId: string) => void;
  // ZK game actions
  zkSelectSecretCharacter: (player: PlayerId, characterId: string) => void;
  zkAskQuestion: (questionId: number) => void;
  zkReceiveOpponentQuestion: (questionId: number, turnNumber: number) => void;
  zkApplyAnswer: (questionId: number, answer: boolean) => void;
  zkMakeGuess: (characterId: string) => void;
}
