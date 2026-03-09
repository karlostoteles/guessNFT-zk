/**
 * OnlineWaitingScreen
 *
 * Shown in ONLINE_WAITING phase — local player has committed their character,
 * waiting for the opponent to do the same.
 *
 * Renders as a small chip at the bottom of the screen so the 3D board is
 * fully visible while waiting. P1 (creator) sees a compact room code to copy.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineRoomCode, useOnlinePlayerNum, useQuestionHistory } from '@/core/store/selectors';

export function OnlineWaitingScreen() {
  const roomCode  = useOnlineRoomCode();
  const playerNum = useOnlinePlayerNum();
  const history = useQuestionHistory();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCreator = playerNum === 1;
  const opponentKey = playerNum === 2 ? 'player1' : 'player2';

  const lastOpponentQuestion = [...history].reverse().find(
    (q) => q.askedBy === opponentKey,
  );

  const statusText = isCreator
    ? 'Waiting for opponent to commit'
    : lastOpponentQuestion
      ? `Opponent asks: ${lastOpponentQuestion.questionText}`
      : 'Waiting for opponent to ask the first question';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'auto',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Main chip */}
      <div style={{
        background: 'rgba(15,14,23,0.82)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(232,164,68,0.25)',
        borderRadius: 16,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,164,68,0.08)',
        minWidth: 0,
      }}>
        {/* Pulsing dots */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18 }}
              style={{ width: 7, height: 7, borderRadius: '50%', background: '#E8A444' }}
            />
          ))}
        </div>

        {/* Status text */}
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: 'rgba(255,255,254,0.55)',
          whiteSpace: lastOpponentQuestion ? 'normal' : 'nowrap',
          maxWidth: 360,
        }}>
          {statusText}
        </div>

        {/* Room code (creator only) */}
        {isCreator && roomCode && (
          <>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

            <motion.button
              onClick={handleCopy}
              whileHover={{ scale: 1.06, filter: 'brightness(1.15)' }}
              whileTap={{ scale: 0.95 }}
              title="Click to copy room code"
              style={{
                background: 'rgba(232,164,68,0.12)',
                border: '1px solid rgba(232,164,68,0.3)',
                borderRadius: 10,
                padding: '5px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                outline: 'none',
                flexShrink: 0,
              }}
            >
              <span style={{
                fontFamily: "'Space Grotesk', monospace",
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: '0.2em',
                color: '#E8A444',
                filter: 'drop-shadow(0 0 8px rgba(232,164,68,0.4))',
              }}>
                {roomCode}
              </span>

              <AnimatePresence mode="wait">
                <motion.span
                  key={copied ? 'copied' : 'copy'}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    fontSize: 11,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 600,
                    color: copied ? '#4ADE80' : 'rgba(255,255,254,0.3)',
                  }}
                >
                  {copied ? '✓' : '⎘'}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </>
        )}
      </div>

      {/* Small label below */}
      {isCreator && (
        <div style={{
          fontSize: 11,
          fontFamily: "'Space Grotesk', sans-serif",
          color: 'rgba(255,255,254,0.2)',
          letterSpacing: '0.04em',
        }}>
          Share this code with your opponent · tap to copy
        </div>
      )}

      {!isCreator && lastOpponentQuestion && (
        <div style={{
          fontSize: 11,
          fontFamily: "'Space Grotesk', sans-serif",
          color: 'rgba(255,255,254,0.28)',
          letterSpacing: '0.02em',
          maxWidth: 360,
          textAlign: 'center',
        }}>
          Answer is sent automatically. Waiting for your turn.
        </div>
      )}
    </motion.div>
  );
}
