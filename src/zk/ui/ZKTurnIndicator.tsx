import { AnimatePresence, motion } from 'framer-motion';
import {
  useEliminatedIds,
  useGameCharacters,
  useGameMode,
  useOnlinePlayerNum,
  usePhase,
  useTurnNumber,
} from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';

const VISIBLE_PHASES = new Set<GamePhase>([
  GamePhase.QUESTION_SELECT,
  GamePhase.ANSWER_PENDING,
  GamePhase.PROVING,
  GamePhase.SUBMITTING,
  GamePhase.VERIFIED,
  GamePhase.ANSWER_REVEALED,
  GamePhase.AUTO_ELIMINATING,
  GamePhase.TURN_TRANSITION,
  GamePhase.GUESS_SELECT,
  GamePhase.REVEAL_WAITING,
]);

export function ZKTurnIndicator() {
  const phase = usePhase();
  const mode = useGameMode();
  const onlinePlayerNum = useOnlinePlayerNum();
  const turn = useTurnNumber();
  const characters = useGameCharacters();
  const viewPlayer = mode === 'online' || mode === 'zk-online'
    ? (onlinePlayerNum === 2 ? 'player2' : 'player1')
    : 'player1';
  const eliminated = useEliminatedIds(viewPlayer);

  if (!VISIBLE_PHASES.has(phase)) return null;

  const remaining = characters.length - eliminated.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        style={{
          position: 'fixed',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(232,164,68,0.28)',
            background: 'rgba(12,11,20,0.84)',
            backdropFilter: 'blur(10px)',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 12, color: 'rgba(255,255,254,0.5)' }}>Turn</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, color: '#E8A444' }}>{turn}</span>
          <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.14)' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,254,0.5)' }}>Tiles</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, color: '#4ADE80' }}>{remaining}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
