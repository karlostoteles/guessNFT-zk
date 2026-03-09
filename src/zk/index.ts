/**
 * ZK module barrel export.
 *
 * All ZK-specific code for WhoisWho lives in src/zk/.
 * Post-merge, these exports will be imported by the main app code.
 */

// ─── Config ───────────────────────────────────────────────────────────────────
export {
  TRAITS_ROOT,
  GAME_CONTRACT,
  KATANA_RPC,
  KATANA_ACCOUNT_1,
  KATANA_PRIVATE_KEY_1,
  KATANA_ACCOUNT_2,
  KATANA_PRIVATE_KEY_2,
  KATANA_ACCOUNT,
  KATANA_PRIVATE_KEY,
  SESSION_POLICIES,
} from './config';

// ─── Types ────────────────────────────────────────────────────────────────────
export { ZKPhase } from './types';
export type { ZKState, ZKActions, ZKQuestionRecord } from './types';

// ─── Data / Logic ─────────────────────────────────────────────────────────────
export { evaluateBit } from './evaluateBit';
export {
  loadCollectionData,
  getCachedCollectionData,
  getCharacterBitmap,
  getCharacterMerklePath,
} from './collectionData';
export type { CollectionCharacter, CollectionDataset } from './collectionData';
export {
  SCHIZODIO_QUESTIONS,
} from './schizodioQuestions';
export type { SchizodioQuestion, SchizodioCategory } from './schizodioQuestions';

// ─── Store helpers ────────────────────────────────────────────────────────────
export {
  getNftBitmap,
  findSchizodioQuestion,
  evaluateQuestionByBitmap,
  computeAutoEliminations,
} from './zkStore';

// ─── Commitment ───────────────────────────────────────────────────────────────
export {
  computeZKCommitment,
  characterIdToCircuitId,
  generateSalt,
  computeAndAttachZKCommitment,
  toBE32,
  fromBE32,
  add32,
  getBB,
} from './zkCommitment';
export { gameStoreAdapter } from './GameStoreAdapter';

// ─── SDK ──────────────────────────────────────────────────────────────────────
export {
  getStarknetAccount,
  toBigInt,
  toFeltHex,
  toDecimalField,
  splitU256,
} from './zkSdk';

// ─── Contract calls ───────────────────────────────────────────────────────────
export {
  createGameOnChain,
  joinGameOnChain,
  commitCharacterOnChain,
  generateAndSubmitProof,
  retryLastProof,
  askQuestionOnChain,
  eliminateCharactersOnChain,
  makeGuessOnChain,
  revealCharacterOnChain,
  useZKAnswer,
  prewarmProver,
  terminateProver,
  setZKStoreCallbacks,
} from './useZKAnswer';
export type { ZKAnswerOpts, ZKStoreCallbacks } from './useZKAnswer';

// ─── Torii sync ───────────────────────────────────────────────────────────────
export { getToriiClient, resetToriiClient, WORLD_ADDRESS, TORII_URL } from './toriiClient';
export { useToriiGameSync } from './useToriiGameSync';
export type { GameStoreInterface } from './useToriiGameSync';

// ─── CPU agent ────────────────────────────────────────────────────────────────
export { pickBestQuestion, shouldRiskIt } from './zkCpuAgent';

// ─── UI components ────────────────────────────────────────────────────────────
export { ProofSpinner, VerifiedBadge, ErrorRetry } from './ui/ProofStatus';
export { ZKAnswerPanel } from './ui/ZKAnswerPanel';
export { ZKUIOverlay } from './ui/ZKUIOverlay';
export { ZKLobbyScreen } from './ui/ZKLobbyScreen';
export { ZKCharacterSelect } from './ui/ZKCharacterSelect';
export { ZKGuessPanel } from './ui/ZKGuessPanel';
export { ZKResultScreen } from './ui/ZKResultScreen';
export { ZKTurnIndicator } from './ui/ZKTurnIndicator';
export { ZKSecretCard } from './ui/ZKSecretCard';
export { ZKHeaderMenu } from './ui/ZKHeaderMenu';
export { CATEGORIES, getQuestionsForCategory, getAskedCount } from './ui/ZKQuestionPanel';
export { ZKWaitingScreen } from './ui/ZKWaitingScreen';
