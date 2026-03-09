import { motion, AnimatePresence } from 'framer-motion';
import { usePhase, useTurnNumber, useGameMode, useEliminatedIds, useGameCharacters, useActivePlayer } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';

/**
 * TurnIndicator — shows only turn number and tiles remaining.
 * No "Player 1" label, no phase label text.
 */
export function TurnIndicator() {
  const phase = usePhase();
  const activePlayer = useActivePlayer();
  const turnNumber = useTurnNumber();
  const characters = useGameCharacters();
  const eliminatedIds = useEliminatedIds(activePlayer);

  const remaining = characters.length - eliminatedIds.length;
  const total = characters.length;

  // Only show during active gameplay
  const isGameplay =
    phase === GamePhase.QUESTION_SELECT ||
    phase === GamePhase.HANDOFF_TO_OPPONENT ||
    phase === GamePhase.ANSWER_PENDING ||
    phase === GamePhase.ANSWER_REVEALED ||
    phase === GamePhase.AUTO_ELIMINATING ||
    phase === GamePhase.ELIMINATION ||
    phase === GamePhase.TURN_TRANSITION ||
    phase === GamePhase.GUESS_SELECT;

  if (!isGameplay) return null;

  // Player's own tiles: blue → green (blue when many, green when narrowing to 1)
  const ratio = total > 0 ? remaining / total : 1;
  const hue = Math.round(120 + ratio * 100); // 220=blue → 120=green
  const tileColor = `hsl(${hue}, 70%, 55%)`;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`turn-${Math.ceil(turnNumber / 2)}`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed',
          top: 16,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <div style={{
          background: 'rgba(12, 11, 20, 0.82)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(232,164,68,0.22)',
          borderRadius: 12,
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          {/* Turn number */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'rgba(255,255,254,0.35)',
              textTransform: 'uppercase',
            }}>
              Turn
            </span>
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 800,
              fontSize: 16,
              color: '#E8A444',
            }}>
              {Math.ceil(turnNumber / 2)}
            </span>
          </div>

          <div style={{
            width: 1,
            height: 18,
            background: 'rgba(255,255,255,0.1)',
          }} />

          {/* Tiles remaining with green→red color */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <motion.span
              key={remaining}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 800,
                fontSize: 16,
                color: tileColor,
              }}
            >
              {remaining}
            </motion.span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'rgba(255,255,254,0.35)',
              textTransform: 'uppercase',
            }}>
              tiles left
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
