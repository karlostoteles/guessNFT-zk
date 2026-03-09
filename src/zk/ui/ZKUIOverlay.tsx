import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useCommitmentStatus,
  useCurrentQuestion,
  useGameMode,
  useGuessedCharacterId,
  useOnlinePlayerNum,
  usePhase,
} from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';
import { gameStoreAdapter } from '@/zk/GameStoreAdapter';
import { useToriiGameSync } from '@/zk/useToriiGameSync';
import { VerifiedBadge } from '@/zk/ui/ProofStatus';
import { ZKCharacterSelect } from '@/zk/ui/ZKCharacterSelect';
import { ZKGuessPanel } from '@/zk/ui/ZKGuessPanel';
import { ZKHeaderMenu } from '@/zk/ui/ZKHeaderMenu';
import { ZKLobbyScreen } from '@/zk/ui/ZKLobbyScreen';
import { ZKQuestionPanel } from '@/zk/ui/ZKQuestionPanel';
import { ZKResultScreen } from '@/zk/ui/ZKResultScreen';
import { ZKSecretCard } from '@/zk/ui/ZKSecretCard';
import { ZKTurnIndicator } from '@/zk/ui/ZKTurnIndicator';
import { ZKWaitingScreen } from '@/zk/ui/ZKWaitingScreen';

function PhaseFlash({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 92,
        transform: 'translateX(-50%)',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(12,11,20,0.88)',
        color: '#FFFFFE',
        padding: '8px 12px',
        fontSize: 12,
      }}
    >
      {label}
    </motion.div>
  );
}

export function ZKUIOverlay() {
  const phase = usePhase();
  const mode = useGameMode();
  const commitmentStatus = useCommitmentStatus();
  const playerNum = useOnlinePlayerNum() ?? 1;
  const currentQuestion = useCurrentQuestion();
  const guessedCharacterId = useGuessedCharacterId();

  const isGuessPending = phase === GamePhase.ANSWER_PENDING && !!guessedCharacterId && !currentQuestion;

  const isMyQuestion = useMemo(() => {
    if (!currentQuestion) return false;
    const myPlayer = playerNum === 2 ? 'player2' : 'player1';
    return currentQuestion.askedBy === myPlayer;
  }, [currentQuestion, playerNum]);

  const waitingMessage = useMemo(() => {
    if (phase !== GamePhase.ONLINE_WAITING) return '';
    if (commitmentStatus !== 'both') {
      return "Waiting for opponent to join and commit...";
    }
    return "Waiting for opponent's question...";
  }, [commitmentStatus, phase]);

  const { proofStatus, revealedAnswer } = useToriiGameSync(gameStoreAdapter);
  const provingQuestionText = currentQuestion?.questionText?.trim();
  const answeringMessage = proofStatus === 'submitting'
    ? 'Submitting ZK proof...'
    : proofStatus === 'proving'
      ? provingQuestionText || 'Generating proof...'
      : 'Preparing ZK proof...';

  if (mode !== 'zk-online') return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <ZKHeaderMenu />
      <ZKTurnIndicator />
      <ZKSecretCard />

      {/* VerifiedBadge lives on its own lifecycle (revealedAnswer state),
          separate from the phase-based AnimatePresence to avoid blocking
          phase transitions with mode="wait". */}
      <AnimatePresence>
        {revealedAnswer !== null ? (
          <VerifiedBadge key={`zk-shared-answer-${revealedAnswer ? 'yes' : 'no'}`} answer={revealedAnswer} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {phase === GamePhase.MENU ? <ZKLobbyScreen key="zk-lobby" /> : null}

        {phase === GamePhase.SETUP_P1 || phase === GamePhase.SETUP_P2 ? (
          <ZKCharacterSelect key="zk-character-select" />
        ) : null}

        {phase === GamePhase.ONLINE_WAITING ? (
          <ZKWaitingScreen key="zk-wait-online" message={waitingMessage} />
        ) : null}

        {phase === GamePhase.QUESTION_SELECT ? <ZKQuestionPanel key="zk-question" /> : null}

        {isGuessPending ? (
          <ZKWaitingScreen key="zk-guess-pending" message="Submitting guess on-chain..." />
        ) : null}

        {phase === GamePhase.ANSWER_PENDING && !isGuessPending && isMyQuestion && revealedAnswer === null ? (
          <ZKWaitingScreen key="zk-answer-pending" message="Waiting for opponent's ZK proof..." />
        ) : null}

        {phase === GamePhase.ANSWER_PENDING && !isGuessPending && !isMyQuestion && revealedAnswer === null ? (
          <ZKWaitingScreen key="zk-answering" message={answeringMessage} />
        ) : null}

        {phase === GamePhase.ANSWER_REVEALED ? <PhaseFlash key="zk-answer-revealed" label="Answer revealed" /> : null}

        {phase === GamePhase.AUTO_ELIMINATING ? <PhaseFlash key="zk-auto" label="Applying eliminations" /> : null}

        {phase === GamePhase.TURN_TRANSITION ? <PhaseFlash key="zk-transition" label="Next turn" /> : null}

        {phase === GamePhase.GUESS_SELECT ? <ZKGuessPanel key="zk-guess" /> : null}

        {phase === GamePhase.GUESS_WRONG ? <PhaseFlash key="zk-guess-wrong" label="Wrong guess" /> : null}

        {phase === GamePhase.REVEAL_WAITING ? (
          <ZKWaitingScreen key="zk-reveal-wait" message="Revealing characters on-chain..." />
        ) : null}

        {phase === GamePhase.GUESS_RESULT || phase === GamePhase.GAME_OVER ? (
          <ZKResultScreen key="zk-result" />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
