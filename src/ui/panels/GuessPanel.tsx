import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useCharacterPreviews } from '@/shared/hooks/useCharacterPreviews';
import { useActivePlayer, useEliminatedIds, useCurrentQuestion, useGameActions, useGameCharacters } from '@/core/store/selectors';
import { sfx } from '@/shared/audio/sfx';

export function GuessPanel() {
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const currentQuestion = useCurrentQuestion();
  const { makeGuess, cancelGuess } = useGameActions();
  const previews = useCharacterPreviews();
  const characters = useGameCharacters();
  const midTurn = currentQuestion !== null;
  const elimSet = new Set(eliminatedIds);

  // Only show active (non-eliminated) tiles for faster rendering
  const activeCharacters = characters.filter((c) => !elimSet.has(c.id));

  const remainingCount = characters.length - elimSet.size;

  const handleCharClick = (charId: string) => {
    sfx.click();
    setSelectedCharId(prev => prev === charId ? null : charId);
  };

  const handleConfirmGuess = () => {
    if (!selectedCharId) return;
    sfx.riskIt();
    makeGuess(selectedCharId);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 20,
      }}
    >
      <Card style={{
        width: 'min(800px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 120px)', // Leave space for top and bottom headers
        marginTop: '60px', // Push down so it doesn't overlap Opponent Counter and Header Button
        overflowY: 'auto',
        position: 'relative',
        padding: '32px 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <AnimatePresence mode="wait">
            {!selectedCharId ? (
              <motion.div
                key="board-header"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#FFFFFE',
                  letterSpacing: '-0.02em',
                  marginBottom: 6,
                }}>
                  📋 The Board
                </div>
                <div style={{
                  fontSize: 14,
                  color: 'rgba(255,255,254,0.4)',
                  marginBottom: 16,
                }}>
                  Select a character to risk your turn
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="risk-header"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 28,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #FF6B6B, #E05555)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.02em',
                  marginBottom: 6,
                }}>
                  🎯 Ready to Guess?
                </div>
                <div style={{
                  fontSize: 14,
                  color: '#FF6B6B',
                  fontWeight: 600,
                  marginBottom: 16,
                }}>
                  DANGER: Guess wrong and you lose your turn!
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 12,
          }}>
            <div style={{
              fontSize: 13,
              color: '#E8A444',
              fontWeight: 700,
              background: 'rgba(232,164,68,0.1)',
              padding: '4px 12px',
              borderRadius: 20,
              border: '1px solid rgba(232,164,68,0.2)',
            }}>
              {remainingCount} candidates remaining
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button variant="secondary" size="md" onClick={cancelGuess}>
              {midTurn ? 'End Turn' : 'Close Board'}
            </Button>

            <AnimatePresence>
              {selectedCharId && (
                <motion.div
                  initial={{ width: 0, opacity: 0, scale: 0.8 }}
                  animate={{ width: 'auto', opacity: 1, scale: 1 }}
                  exit={{ width: 0, opacity: 0, scale: 0.8 }}
                  style={{ display: 'inline-block', overflow: 'hidden' }}
                >
                  <Button
                    variant="no"
                    size="md"
                    onClick={handleConfirmGuess}
                    style={{
                      background: 'linear-gradient(135deg, #E05555, #C04444)',
                      borderColor: '#FF6B6B',
                      boxShadow: '0 0 24px rgba(224,85,85,0.5)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    🎯 Guess NOW!
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(80px, calc(50% - 8px)), 1fr))',
          gap: 8,
          padding: 8,
          maxHeight: 'min(360px, 45vh)',
          overflowY: 'auto',
        }}>
          {activeCharacters.map((char) => {
            const isEliminated = false; // All shown are active
            const isSelected = selectedCharId === char.id;
            return (
              <motion.button
                key={char.id}
                onClick={() => !isEliminated && handleCharClick(char.id)}
                whileHover={isEliminated ? {} : {
                  scale: 1.05,
                  borderColor: isSelected ? 'rgba(224,85,85,0.8)' : 'rgba(232,164,68,0.5)',
                  background: isSelected ? 'rgba(224,85,85,0.15)' : 'rgba(255,255,255,0.08)',
                }}
                whileTap={isEliminated ? {} : { scale: 0.95 }}
                style={{
                  background: isEliminated
                    ? 'rgba(255,255,255,0.02)'
                    : isSelected
                      ? 'rgba(224,85,85,0.15)'
                      : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${isEliminated
                    ? 'rgba(255,255,255,0.05)'
                    : isSelected
                      ? 'rgba(224,85,85,0.6)'
                      : 'rgba(252,192,64,0.25)'
                    }`,
                  borderRadius: 12,
                  padding: 8,
                  cursor: isEliminated ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  opacity: isEliminated ? 0.2 : 1,
                  transition: 'border-color 0.2s, background 0.2s',
                  position: 'relative',
                  boxShadow: isSelected ? '0 0 20px rgba(224,85,85,0.3)' : 'none',
                }}
              >
                {isSelected && !isEliminated && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                      position: 'absolute',
                      top: -1,
                      right: -1,
                      background: '#E05555',
                      color: 'white',
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      zIndex: 2,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}
                  >
                    ✓
                  </motion.div>
                )}
                <img
                  src={previews.get(char.id)}
                  alt={char.name}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 8,
                    objectFit: 'cover',
                    filter: isEliminated ? 'grayscale(1)' : 'none',
                  }}
                />
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  color: isEliminated ? 'rgba(255,255,254,0.4)' : '#FFFFFE',
                  textAlign: 'center',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {char.name}
                </span>
              </motion.button>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
