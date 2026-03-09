import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePhase, useActivePlayer, useGameActions, useGameMode, useTurnNumber, useEliminatedIds, useGameCharacters } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';
import { COLORS } from '@/core/rules/constants';

export function PhaseTransition() {
  const phase = usePhase();
  const activePlayer = useActivePlayer();
  const mode = useGameMode();
  const turnNumber = useTurnNumber();
  const { advancePhase } = useGameActions();
  const characters = useGameCharacters();
  const eliminatedIds = useEliminatedIds(activePlayer);

  // Auto-advance ALL transitions
  const isSinglePlayer = mode === 'free' || mode === 'nft-free';
  const isAutoTransition =
    phase === GamePhase.TURN_TRANSITION ||
    (isSinglePlayer && (phase === GamePhase.HANDOFF_START ||
      phase === GamePhase.HANDOFF_TO_OPPONENT));

  useEffect(() => {
    if (!isAutoTransition) return;
    const timer = setTimeout(advancePhase, 1500);
    return () => clearTimeout(timer);
  }, [isAutoTransition, advancePhase]);

  const isCPU = mode === 'free' && activePlayer === 'player2';

  // Compute stats
  const totalChars = characters.length;
  const eliminatedCount = eliminatedIds?.length || 0;
  const remainingCount = totalChars - eliminatedCount;

  let title = '';
  let subtitle = '';
  let showStats = false;

  switch (phase) {
    case GamePhase.HANDOFF_P1_TO_P2:
      title = 'Pass to Player 2';
      subtitle = 'Player 2, pick your secret character';
      break;
    case GamePhase.HANDOFF_START:
      title = 'Game Begins!';
      subtitle = 'Player 1 goes first';
      break;
    case GamePhase.HANDOFF_TO_OPPONENT: {
      const opponent = activePlayer === 'player1' ? 'Player 2' : 'Player 1';
      title = `Pass to ${opponent}`;
      subtitle = 'They need to answer your question';
      break;
    }
    case GamePhase.TURN_TRANSITION:
      if (mode === 'free' || mode === 'nft-free') {
        title = `Round ${turnNumber}`;
        showStats = true;
      } else {
        const nextLabel = isCPU ? 'CPU' : activePlayer === 'player1' ? 'Player 1' : 'Player 2';
        title = `${nextLabel}'s Turn`;
        showStats = true;
      }
      break;
    default:
      return null;
  }

  const colors = activePlayer === 'player1' ? COLORS.player1 : COLORS.player2;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={isAutoTransition ? undefined : advancePhase}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isAutoTransition ? 'default' : 'pointer',
        pointerEvents: 'auto',
        zIndex: 20,
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        style={{ textAlign: 'center' }}
      >
        {/* Title */}
        <motion.div
          initial={{ y: -10 }}
          animate={{ y: 0 }}
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 38,
            fontWeight: 800,
            color: colors.primary,
            marginBottom: showStats ? 16 : 12,
            textShadow: `0 0 40px ${colors.primary}60`,
          }}
        >
          {title}
        </motion.div>

        {/* Eliminated tile counter animation */}
        {showStats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              marginBottom: 28,
            }}
          >
            {/* Eliminated */}
            <div style={{ textAlign: 'center' }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: '#E05555',
                  textShadow: '0 0 20px rgba(224,85,85,0.4)',
                }}
              >
                {eliminatedCount}
              </motion.div>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'rgba(224,85,85,0.6)',
                letterSpacing: '0.1em',
                marginTop: 2,
              }}>
                ELIMINATED
              </div>
            </div>

            {/* Divider */}
            <div style={{
              width: 1,
              height: 40,
              background: 'rgba(255,255,255,0.1)',
            }} />

            {/* Remaining */}
            <div style={{ textAlign: 'center' }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: '#4ADE80',
                  textShadow: '0 0 20px rgba(74,222,128,0.3)',
                }}
              >
                {remainingCount}
              </motion.div>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'rgba(74,222,128,0.5)',
                letterSpacing: '0.1em',
                marginTop: 2,
              }}>
                REMAINING
              </div>
            </div>
          </motion.div>
        )}

        {!showStats && subtitle && (
          <div style={{
            fontSize: 16,
            color: 'rgba(255,255,254,0.5)',
            marginBottom: 28,
          }}>
            {subtitle}
          </div>
        )}

        {/* Pulsing dots — all transitions now auto-advance */}
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          style={{
            display: 'flex',
            gap: 6,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: colors.primary,
                opacity: 0.7,
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
