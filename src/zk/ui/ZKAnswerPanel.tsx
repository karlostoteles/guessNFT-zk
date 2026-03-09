/**
 * ZKAnswerPanel — Full ZK answer panel with proof lifecycle.
 *
 * Renders the appropriate proof status (spinner/verified/error)
 * based on the current game phase. Falls back to standard answer
 * panel for non-ZK modes.
 *
 * Post-merge, integrate into src/ui/panels/AnswerPanel.tsx.
 */
import { ProofSpinner, VerifiedBadge, ErrorRetry } from './ProofStatus';
import { retryLastProof } from '../useZKAnswer';

export interface ZKAnswerPanelProps {
  phase: string;
  mode: string;
  proofError: string | null;
  questionAnswer: boolean | null;
  isAsker: boolean;
}

export function ZKAnswerPanel({
  phase,
  mode,
  proofError,
  questionAnswer,
  isAsker,
}: ZKAnswerPanelProps) {
  const isZKMode = mode === 'nft' || mode === 'online' || mode === 'zk-online';

  if (!isZKMode) return null;

  // ZK error state
  if (proofError) {
    return (
      <ErrorRetry
        error={proofError}
        onRetry={() => {
          retryLastProof().catch(console.error);
        }}
      />
    );
  }

  // ZK proof states
  if (phase === 'PROVING') {
    return <ProofSpinner step="Generating ZK proof..." />;
  }
  if (phase === 'SUBMITTING') {
    return <ProofSpinner step="Submitting to Starknet..." />;
  }
  if (phase === 'VERIFIED') {
    return <VerifiedBadge answer={questionAnswer} />;
  }

  // Online mode: asker waits for opponent's ZK answer
  if (mode === 'online' && phase === 'ANSWER_PENDING' && isAsker) {
    return <ProofSpinner step="Waiting for opponent's answer..." />;
  }

  return null;
}
