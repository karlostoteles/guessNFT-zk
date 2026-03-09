/**
 * ZK-specific types and phase extensions for WhoisWho.
 *
 * These types extend the base game types with ZK proof lifecycle phases
 * and on-chain game state fields. Post-merge, these will be integrated
 * into src/core/store/types.ts.
 */

/** ZK proof lifecycle phases (extend GamePhase enum post-merge) */
export enum ZKPhase {
  PROVING = 'PROVING',             // Web Worker generating ZK proof
  SUBMITTING = 'SUBMITTING',       // Submitting proof tx to Starknet
  VERIFIED = 'VERIFIED',           // On-chain verification confirmed
  REVEAL_WAITING = 'REVEAL_WAITING', // Waiting for both players to reveal characters
}

/** ZK-specific state fields (merge into GameState post-merge) */
export interface ZKState {
  /** On-chain Dojo game ID (felt252 as hex string) */
  starknetGameId: string | null;
  /** ZK proof error message (null when no error) */
  proofError: string | null;
  /** Dedup: turn numbers for which we've already started proof generation */
  processedTurnIds: Set<number>;
}

/** ZK-specific actions (merge into GameActions post-merge) */
export interface ZKActions {
  setPhase: (phase: string) => void;
  setVerifiedAnswer: (answer: boolean) => void;
  setProofError: (message: string) => void;
  clearProofError: () => void;
}

/** Question record with numeric questionId (ZK/bitmap mode) */
export interface ZKQuestionRecord {
  questionId: number;
  questionText: string;
  answer: boolean | null;
  askedBy: 'player1' | 'player2';
  turnNumber: number;
}
