/**
 * SecretCardPanel
 *
 * Always-visible 120px card showing the local player's secret character.
 * Click flips to show what the opponent has guessed about you (in red).
 * On mobile, shrinks to 80px. Positioned bottom-left, above QuestionPanel.
 */
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { usePhase, useGameMode, useOnlinePlayerNum, useQuestionHistory } from '@/core/store/selectors';
import { useGameStore } from '@/core/store/gameStore';
import { GamePhase } from '@/core/store/types';
import { QUESTIONS_BY_ID } from '@/core/data/questions';
import { getTraitCategory, getCategoryConfig } from './question/zoneConfig';
import { useIsMobile } from '@/shared/hooks/useMediaQuery';
import { toSafeNftImageUrl } from '@/shared/utils/schizodioImage';

const GAMEPLAY_PHASES = new Set([
  GamePhase.QUESTION_SELECT,
  GamePhase.HANDOFF_TO_OPPONENT,
  GamePhase.ANSWER_PENDING,
  GamePhase.ANSWER_REVEALED,
  GamePhase.AUTO_ELIMINATING,
  GamePhase.ELIMINATION,
  GamePhase.TURN_TRANSITION,
  GamePhase.GUESS_SELECT,
  GamePhase.GUESS_WRONG,
]);

export function SecretCardPanel() {
  const { t } = useTranslation();
  const phase = usePhase();
  const mode = useGameMode();
  const playerNum = useOnlinePlayerNum();
  const history = useQuestionHistory();
  const isMobile = useIsMobile();
  const [flipped, setFlipped] = useState(false);

  const myPlayer = mode === 'online'
    ? (playerNum === 2 ? 'player2' : 'player1')
    : 'player1';
  const opponent = myPlayer === 'player1' ? 'player2' : 'player1';

  const players = useGameStore(s => s.players);
  const characters = useGameStore(s => s.characters);
  const secretId = players[myPlayer].secretCharacterId;
  const myChar = secretId ? characters.find(c => c.id === secretId) : null;

  const opponentTraits = useMemo(() => {
    const traits: { label: string; answer: boolean }[] = [];
    for (const record of history) {
      if (record.askedBy !== opponent || record.answer === null) continue;
      const q = QUESTIONS_BY_ID.get(record.questionId);
      if (!q) continue;
      const text = q.text
        .replace(/^Does your character (have |wear |carry )?/i, '')
        .replace(/\?$/, '');
      traits.push({ label: text, answer: record.answer });
    }
    return traits;
  }, [history, opponent]);

  if (!GAMEPLAY_PHASES.has(phase) || !myChar) return null;

  const tokenId = (myChar as any).tokenId ?? (secretId?.startsWith('nft_') ? secretId.replace('nft_', '') : undefined);
  const imageUrl = toSafeNftImageUrl((myChar as any).imageUrl, tokenId);

  const SIZE = isMobile ? 120 : 180;

  return (
    <AnimatePresence>
      <motion.div
        key="secret-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.3 }}
        style={{
          position: 'fixed',
          bottom: isMobile ? 10 : 16,
          left: isMobile ? 8 : 16,
          zIndex: 15,
          pointerEvents: 'auto',
          perspective: 800,
        }}
      >
        <motion.div
          onClick={() => setFlipped(f => !f)}
          style={{
            width: SIZE,
            cursor: 'pointer',
            transformStyle: 'preserve-3d',
          }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* ── FRONT: NFT portrait ── */}
          <div style={{ backfaceVisibility: 'hidden' }}>
            <div style={{
              background: 'rgba(15,14,23,0.92)',
              border: '2px solid rgba(232,164,68,0.5)',
              borderRadius: isMobile ? 10 : 14,
              overflow: 'hidden',
              boxShadow: '0 6px 24px rgba(0,0,0,0.6), 0 0 16px rgba(232,164,68,0.15)',
            }}>
              <div style={{ width: SIZE - 4, height: SIZE - 4, position: 'relative', overflow: 'hidden' }}>
                {imageUrl ? (
                  <img src={imageUrl} alt={myChar.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(232,164,68,0.2), rgba(124,58,237,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 24 : 32 }}>🎭</div>
                )}
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'rgba(232,164,68,0.9)', borderRadius: 6,
                  padding: isMobile ? '2px 6px' : '4px 8px',
                  fontSize: isMobile ? 10 : 12, fontWeight: 800, color: '#0F0E17',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  YOU
                </div>
              </div>
            </div>
            <div style={{
              marginTop: 6, textAlign: 'center',
              fontSize: isMobile ? 10 : 12, fontWeight: 800,
              color: 'rgba(232,164,68,0.4)',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.04em',
            }}>
              {t('game.my_card')}
            </div>
          </div>

          {/* ── BACK: Opponent's guessed traits ── */}
          <div style={{
            backfaceVisibility: 'hidden',
            position: 'absolute', top: 0, left: 0, width: SIZE,
            transform: 'rotateY(180deg)',
          }}>
            <div style={{
              background: 'rgba(15,14,23,0.95)',
              border: '2px solid rgba(224,85,85,0.5)',
              borderRadius: isMobile ? 10 : 14,
              overflow: 'hidden',
              boxShadow: '0 6px 24px rgba(0,0,0,0.6), 0 0 16px rgba(224,85,85,0.15)',
              padding: isMobile ? '5px 4px' : '8px 6px',
              height: SIZE - 4,
              overflowY: 'auto',
            }}>
              <div style={{
                fontSize: isMobile ? 10 : 12, fontWeight: 800,
                letterSpacing: '0.08em', color: 'rgba(224,85,85,0.7)',
                textTransform: 'uppercase', textAlign: 'center',
                marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif",
              }}>
                🕵️ {t('game.they_know')}
              </div>
              {opponentTraits.length === 0 ? (
                <div style={{ fontSize: isMobile ? 10 : 12, color: 'rgba(255,255,254,0.25)', textAlign: 'center', padding: '16px 0', fontStyle: 'italic' }}>
                  {t('game.nothing_yet')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {opponentTraits.map((t, i) => (
                    <div key={i} style={{
                      fontSize: isMobile ? 10 : 12, padding: '4px 6px', borderRadius: 4,
                      background: t.answer ? 'rgba(224,85,85,0.12)' : 'rgba(255,255,255,0.03)',
                      color: t.answer ? '#FF6B6B' : 'rgba(255,255,254,0.25)',
                      fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                      lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {t.answer ? '✓' : '✗'} {t.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{
              marginTop: 6, textAlign: 'center',
              fontSize: isMobile ? 10 : 12, fontWeight: 800,
              color: 'rgba(224,85,85,0.4)',
              fontFamily: "'Space Grotesk', sans-serif",
            }}>
              {t('game.enemy_info')}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence >
  );
}
