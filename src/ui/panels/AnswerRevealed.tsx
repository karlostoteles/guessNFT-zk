import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Card } from '../common/Card';
import { useCurrentQuestion, useCpuQuestion, useGameMode, useGameActions } from '@/core/store/selectors';
import { sfx } from '@/shared/audio/sfx';

export function AnswerRevealed() {
  const question = useCurrentQuestion();
  const cpuQuestion = useCpuQuestion();
  const mode = useGameMode();
  const { advancePhase } = useGameActions();

  useEffect(() => {
    if (!question && !cpuQuestion) return;
    if (question) {
      if (question.answer) sfx.answerYes();
      else sfx.answerNo();
    } else if (cpuQuestion) {
      if (cpuQuestion.answer) sfx.answerYes();
      else sfx.answerNo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(advancePhase, 2000);
    return () => clearTimeout(timer);
  }, [advancePhase]);

  if (!question && !cpuQuestion) return null;

  const content = (
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
        zIndex: 9990,
        pointerEvents: 'auto',
        padding: 16,
      }}
    >
      <Card style={{
        width: 'min(440px, 100%)',
        textAlign: 'center',
        pointerEvents: 'auto',
      }}>
        {/* Player's question + answer */}
        {question && (
          <>
            <div style={{
              fontSize: 13,
              color: 'rgba(255,255,254,0.4)',
              marginBottom: 8,
            }}>
              {question.questionText}
            </div>

            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{
                fontSize: 'clamp(36px, 10vw, 56px)',
                fontWeight: 800,
                fontFamily: "'Space Grotesk', sans-serif",
                color: question.answer ? '#4CAF50' : '#E05555',
                textShadow: question.answer
                  ? '0 0 40px rgba(76,175,80,0.4)'
                  : '0 0 40px rgba(224,85,85,0.4)',
                marginBottom: cpuQuestion && (mode === 'free' || mode === 'nft-free') ? 16 : 0,
              }}
            >
              {question.answer ? 'YES' : 'NO'}
            </motion.div>
          </>
        )}

        {/* CPU's simultaneous question (free modes only) */}
        {(mode === 'free' || mode === 'nft-free') && cpuQuestion && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.3 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              textAlign: 'left',
              flexWrap: 'wrap',
            }}
          >
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'rgba(167,139,250,0.7)',
              whiteSpace: 'nowrap',
            }}>
              CPU
            </div>
            <div style={{
              flex: '1 1 120px',
              fontSize: 12,
              color: 'rgba(255,255,254,0.55)',
              minWidth: 0,
            }}>
              {cpuQuestion.questionText}
            </div>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "'Space Grotesk', sans-serif",
              padding: '2px 8px',
              borderRadius: 6,
              background: cpuQuestion.answer
                ? 'rgba(76,175,80,0.18)'
                : 'rgba(224,85,85,0.18)',
              color: cpuQuestion.answer ? '#4CAF50' : '#E05555',
              whiteSpace: 'nowrap',
            }}>
              {cpuQuestion.answer ? 'YES' : 'NO'}
            </div>
          </motion.div>
        )}

        {/* Auto-advance indicator */}
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: 'rgba(255,255,254,0.3)',
            marginTop: 20,
          }}
        >
          CONTINUING...
        </motion.div>
      </Card>
    </motion.div>
  );

  return createPortal(content, document.body);
}
