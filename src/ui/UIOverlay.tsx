import { AnimatePresence } from 'framer-motion';
import { usePhase } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';
import { MenuScreen } from './screens/MenuScreen';
import { CharacterSelectScreen } from './screens/CharacterSelectScreen';
import { OnlineWaitingScreen } from './screens/OnlineWaitingScreen';
import { ResultScreen } from './screens/ResultScreen';
import { QuestionPanel } from './panels/QuestionPanel';
import { AnswerPanel } from './panels/AnswerPanel';
import { AnswerRevealed } from './panels/AnswerRevealed';
import { EliminationPrompt } from './panels/EliminationPrompt';
import { GuessPanel } from './panels/GuessPanel';
import { SecretCardPanel } from './panels/SecretCardPanel';
import { PhaseTransition } from './overlays/PhaseTransition';
import { AutoEliminatingOverlay } from './overlays/AutoEliminatingOverlay';
import { GuessWrongOverlay } from './overlays/GuessWrongOverlay';
import { TurnIndicator } from './widgets/TurnIndicator';
import { HeaderMenu } from './widgets/HeaderMenu';
import { CPUThinkingIndicator } from './widgets/CPUThinkingIndicator';
import { OpponentCounter } from './widgets/OpponentCounter';
import { ConfirmedTraits } from './widgets/ConfirmedTraits';
import { EndGameVignette } from './widgets/EndGameVignette';
import { useNFTTraitLoader } from '@/shared/hooks/useNFTTraitLoader';

export function UIOverlay() {
  const phase = usePhase();

  // Enrich stub NFT characters with real traits when owned NFTs are available
  useNFTTraitLoader();

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 10,
      touchAction: 'manipulation',
    }}>
      <EndGameVignette />
      <TurnIndicator />

      {/* Unified Settings / Wallet Menu — top-left corner */}
      <HeaderMenu />


      {/* CPU thinking indicator — free mode only */}
      <CPUThinkingIndicator />
      <OpponentCounter />
      <ConfirmedTraits />
      <SecretCardPanel />

      <AnimatePresence mode="wait">
        {phase === GamePhase.MENU && <MenuScreen key="menu" />}

        {(phase === GamePhase.SETUP_P1 || phase === GamePhase.SETUP_P2) && (
          <CharacterSelectScreen key="select" />
        )}

        {/* Online: waiting for opponent to commit character */}
        {phase === GamePhase.ONLINE_WAITING && <OnlineWaitingScreen key="online-waiting" />}

        {(phase === GamePhase.HANDOFF_P1_TO_P2 ||
          phase === GamePhase.HANDOFF_START ||
          phase === GamePhase.HANDOFF_TO_OPPONENT ||
          phase === GamePhase.TURN_TRANSITION) && (
            <PhaseTransition key={`transition-${phase}`} />
          )}

        {phase === GamePhase.QUESTION_SELECT && <QuestionPanel key="question" />}

        {phase === GamePhase.ANSWER_PENDING && <AnswerPanel key="answer" />}

        {phase === GamePhase.ANSWER_REVEALED && <AnswerRevealed key="revealed" />}

        {phase === GamePhase.AUTO_ELIMINATING && <AutoEliminatingOverlay key="auto-elim" />}

        {phase === GamePhase.ELIMINATION && <EliminationPrompt key="elimination" />}

        {phase === GamePhase.GUESS_SELECT && <GuessPanel key="guess" />}

        {phase === GamePhase.GUESS_WRONG && <GuessWrongOverlay key="guess-wrong" />}

        {(phase === GamePhase.GUESS_RESULT || phase === GamePhase.GAME_OVER) && (
          <ResultScreen key="result" />
        )}
      </AnimatePresence>
    </div>
  );
}
