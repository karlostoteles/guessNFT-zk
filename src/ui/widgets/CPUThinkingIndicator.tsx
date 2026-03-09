import { motion, AnimatePresence } from 'framer-motion';
import { usePhase, useActivePlayer, useGameMode } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';

/**
 * Small pulsing banner shown when the CPU is taking its turn in free mode.
 * Appears at the top of the screen during QUESTION_SELECT when player2 is active.
 */
export function CPUThinkingIndicator() {
  const phase = usePhase();
  const activePlayer = useActivePlayer();
  const mode = useGameMode();

  const visible =
    mode === 'free' &&
    activePlayer === 'player2' &&
    phase === GamePhase.QUESTION_SELECT;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="cpu-thinking"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(16,14,30,0.88)',
            border: '1px solid rgba(124,58,237,0.35)',
            borderRadius: 30,
            padding: '8px 20px',
            pointerEvents: 'none',
            zIndex: 15,
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Pulsing dot */}
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#A78BFA',
              flexShrink: 0,
            }}
          />
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(255,255,254,0.7)',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}>
            CPU is thinking…
          </span>
          {/* Three dot animation */}
          <DotLoader />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DotLoader() {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -4, 0] }}
          transition={{
            repeat: Infinity,
            duration: 0.7,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'rgba(167,139,250,0.6)',
          }}
        />
      ))}
    </div>
  );
}
