import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameActions, useGameCharacters, useGuessedCharacterId, useActivePlayer } from '@/core/store/selectors';
import { sfx } from '@/shared/audio/sfx';

/**
 * Wrong Risk It overlay — shows the guessed character with an X,
 * then auto-advances after 2.5s. Game continues, no one loses.
 */
export function GuessWrongOverlay() {
  const { advancePhase } = useGameActions();
  const characters = useGameCharacters();
  const guessedId = useGuessedCharacterId();
  const guessedChar = characters.find((c) => c.id === guessedId);
  const activePlayer = useActivePlayer();
  const isOpponent = activePlayer === 'player2';

  useEffect(() => {
    sfx.wrongGuess();
    const timer = setTimeout(() => advancePhase(), 2800);
    return () => clearTimeout(timer);
  }, [advancePhase]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(224, 85, 85, 0.15)',
        backdropFilter: 'blur(12px)',
        zIndex: 30,
        pointerEvents: 'auto',
      }}
    >
      <motion.div
        initial={{ scale: 0.5, rotate: -5 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 250, damping: 18 }}
        style={{ textAlign: 'center' }}
      >
        {/* Big X */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          transition={{ duration: 0.4 }}
          style={{
            fontSize: 96,
            lineHeight: 1,
            marginBottom: 16,
          }}
        >
          ❌
        </motion.div>

        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 36,
          fontWeight: 800,
          color: '#E05555',
          textShadow: '0 0 40px rgba(224,85,85,0.5)',
          marginBottom: 8,
        }}>
          {isOpponent ? "Opponent Wrong!" : "Wrong!"}
        </div>

        {guessedChar && (
          <div style={{
            fontSize: 16,
            color: 'rgba(255,255,254,0.5)',
            marginBottom: 4,
          }}>
            {guessedChar.name} is not the secret character
          </div>
        )}

        <div style={{
          fontSize: 13,
          color: 'rgba(255,255,254,0.25)',
          marginTop: 12,
        }}>
          Game continues...
        </div>

        {/* Progress bar */}
        <motion.div
          style={{
            marginTop: 24,
            width: 200,
            height: 3,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflow: 'hidden',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 2.8, ease: 'linear' }}
            style={{
              height: '100%',
              background: '#E05555',
              borderRadius: 2,
            }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
