/**
 * ZKOverlayRouter — Phase routing for ZK-specific UI panels.
 *
 * Documents which phases trigger which ZK UI components.
 * Post-merge, these conditions are added to UIOverlay.tsx.
 *
 * Phase → Component mapping:
 *   PROVING        → ProofSpinner("Generating ZK proof...")
 *   SUBMITTING     → ProofSpinner("Submitting to Starknet...")
 *   VERIFIED       → VerifiedBadge(answer)
 *   REVEAL_WAITING → OnlineWaitingScreen
 *   ANSWER_PENDING (+ proofError) → ErrorRetry
 *   ANSWER_PENDING (+ online asker) → ProofSpinner("Waiting for opponent's answer...")
 *
 * The existing UIOverlay groups ANSWER_PENDING, PROVING, SUBMITTING, VERIFIED
 * together under <AnswerPanel>, which internally routes based on phase.
 */

export const ZK_PHASE_TO_COMPONENT = {
  PROVING: 'ProofSpinner',
  SUBMITTING: 'ProofSpinner',
  VERIFIED: 'VerifiedBadge',
  REVEAL_WAITING: 'OnlineWaitingScreen',
} as const;
