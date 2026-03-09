import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useCurrentQuestion, useActivePlayer, useEliminatedIds, useGameActions, useGameCharacters } from '@/core/store/selectors';
import { sfx } from '@/shared/audio/sfx';

const AUTO_ADVANCE_MS = 2200;

export function AutoEliminatingOverlay() {
  const question = useCurrentQuestion();
  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const characters = useGameCharacters();
  const { advancePhase } = useGameActions();
  const [progress, setProgress] = useState(0);

  const remaining = characters.length - eliminatedIds.length;

  useEffect(() => { sfx.tileFlip(); }, []);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / AUTO_ADVANCE_MS, 1));
    }, 30);
    const timer = setTimeout(advancePhase, AUTO_ADVANCE_MS);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [advancePhase]);

  // Color for remaining tiles (blue→green)
  const ratio = characters.length > 0 ? remaining / characters.length : 1;
  const hue = Math.round(120 + ratio * 100);
  const tileColor = `hsl(${hue}, 70%, 55%)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.95 }}
      transition={{ duration: 0.25, type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        position: 'fixed',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 30,
        width: 'min(500px, calc(100vw - 32px))',
      }}
    >
      <div style={{
        background: 'rgba(12, 11, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(232,164,68,0.25)',
        borderRadius: 16,
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      }}>
        {/* Question trait + answer */}
        {question && (
          <>
            <div style={{
              flex: 1,
              minWidth: 0,
            }}>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255,255,254,0.7)',
                fontFamily: "'Space Grotesk', sans-serif",
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {question.questionText}
              </div>
            </div>

            <div style={{
              padding: '4px 14px',
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 14,
              fontFamily: "'Space Grotesk', sans-serif",
              background: question.answer ? 'rgba(76,175,80,0.2)' : 'rgba(224,85,85,0.2)',
              color: question.answer ? '#4CAF50' : '#E05555',
              border: `1px solid ${question.answer ? 'rgba(76,175,80,0.3)' : 'rgba(224,85,85,0.3)'}`,
              flexShrink: 0,
            }}>
              {question.answer ? 'YES' : 'NO'}
            </div>

            <div style={{
              width: 1,
              height: 28,
              background: 'rgba(255,255,255,0.1)',
              flexShrink: 0,
            }} />
          </>
        )}

        {/* Tiles remaining */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}>
          <motion.span
            key={remaining}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: 22,
              color: tileColor,
            }}
          >
            {remaining}
          </motion.span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,254,0.35)',
            letterSpacing: '0.08em',
          }}>
            left
          </span>
        </div>

        {/* Progress bar */}
        <div style={{
          width: 50,
          height: 4,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 3,
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <motion.div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #E8A444, #F0C674)',
              borderRadius: 3,
              width: `${progress * 100}%`,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
