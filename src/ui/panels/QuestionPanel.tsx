/**
 * QuestionPanel — bottom-sheet UI for picking questions.
 *
 * This is the orchestrator. All visual sub-components live in ./question/:
 *   Pills.tsx           — WaitingPill, RiskItPill, AskPill
 *   SchizodioSilhouette — interactive SVG body (NFT/online mode)
 *   NFTModeBody         — silhouette column + zone question list
 *   FreeModeBody        — classic category tabs + question grid
 *   QuestionButtons     — NFTQuestionButton, FreeQuestionButton
 *   zoneConfig.ts       — ZONE_CONFIG, ZONES constants
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QUESTIONS, type Question } from '@/core/data/questions';
import {
  useGameActions, useQuestionHistory, useActivePlayer,
  usePhase, useGameCharacters, usePlayerState, useGameMode, useOnlinePlayerNum,
  useEliminatedIds,
} from '@/core/store/selectors';
import { sfx } from '@/shared/audio/sfx';
import { WaitingPill, RiskItPill, AskPill } from './question/Pills';
import { RarityInfoButton } from './question/QuestionButtons';
import { NFTModeBody } from './question/NFTModeBody';
import { FreeModeBody } from './question/FreeModeBody';
import { useIsMobile } from '@/shared/hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';

export function QuestionPanel() {
  const { t } = useTranslation();
  const [minimised, setMinimised] = useState(false);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  const mode = useGameMode();
  const { askQuestion, startGuess } = useGameActions();
  const history = useQuestionHistory();
  const activePlayer = useActivePlayer();
  const characters = useGameCharacters();
  const playerState = usePlayerState(activePlayer);
  const onlinePlayerNum = useOnlinePlayerNum();
  const isMobile = useIsMobile();

  const isNFTMode = mode === 'nft' || mode === 'online' || mode === 'nft-free';

  // In online mode check if it's actually my turn
  const isMyTurn = mode !== 'online' || (
    (activePlayer === 'player1' && onlinePlayerNum === 1) ||
    (activePlayer === 'player2' && onlinePlayerNum === 2)
  );

  const askedIds = useMemo(
    () => new Set(
      history.filter((q) => q.askedBy === activePlayer).map((q) => q.questionId)
    ),
    [history, activePlayer],
  );

  // Characters still on the board (not eliminated by this player)
  const remaining = useMemo(
    () => characters.filter((c) => !playerState.eliminatedCharacterIds.includes(c.id)),
    [characters, playerState.eliminatedCharacterIds],
  );

  // Opponent's remaining tiles — danger = they're close to guessing YOUR pick
  const opponent = activePlayer === 'player1' ? 'player2' : 'player1';
  const opponentEliminatedIds = useEliminatedIds(opponent);
  const opponentRemaining = characters.length - opponentEliminatedIds.length;
  const isDangerous = opponentRemaining <= 8;



  const handleRiskIt = () => { sfx.riskIt(); startGuess(); };

  const handleAsk = (q: Question) => {
    if (askedIds.has(q.id)) return;
    sfx.question();
    askQuestion(q.id);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
      zIndex: 30, pointerEvents: 'none',
      paddingTop: isMobile ? 80 : 0, // Prevent overlap with header on mobile
    }}>
      <AnimatePresence mode="wait">

        {/* Waiting for opponent (online simultaneous mode) */}
        {!isMyTurn && <WaitingPill key="waiting" />}

        {/* Minimised — two floating pills */}
        {isMyTurn && minimised && (
          <motion.div
            key="minimised"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{ display: 'flex', gap: 8, paddingBottom: 20, pointerEvents: 'auto' }}
          >
            <RiskItPill onClick={handleRiskIt} />
            <AskPill askedCount={askedIds.size} onClick={() => setMinimised(false)} />
          </motion.div>
        )}

        {/* Expanded panel */}
        {isMyTurn && !minimised && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            style={{
              width: 'min(820px, 100vw)',
              maxHeight: 'min(620px, 65vh)',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 'clamp(0px, calc((100vw - 820px) * 999), 20px) clamp(0px, calc((100vw - 820px) * 999), 20px) 0 0',
              background: 'rgba(12,11,20,0.97)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderBottom: 'none',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.65)',
              overflow: 'hidden',
              pointerEvents: 'auto',
            }}
          >
            {/* ── Header ── */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'flex-start' : 'center',
              justifyContent: 'space-between',
              padding: isMobile ? '10px 14px' : '14px 18px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
              gap: isMobile ? 12 : 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: isMobile ? 16 : 18 }}>❓</span>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700, fontSize: isMobile ? 15 : 17, margin: 0, color: '#FFFFFE',
                }}>
                  {t('game.ask_question')}
                </h3>
                {askedIds.size > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 600, color: 'rgba(255,255,254,0.3)',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 20, padding: '1px 8px',
                  }}>
                    {askedIds.size} asked
                  </span>
                )}
                {isNFTMode && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                    color: 'rgba(232,164,68,0.55)',
                    background: 'rgba(232,164,68,0.08)',
                    border: '1px solid rgba(232,164,68,0.18)',
                    borderRadius: 20, padding: '1px 8px',
                  }}>
                    {t('game.schizodio_traits')}
                  </span>
                )}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: isMobile ? '100%' : 'auto',
                justifyContent: isMobile ? 'space-between' : 'flex-end'
              }}>
                {isDangerous && (
                  <motion.button
                    onClick={handleRiskIt}
                    animate={{ boxShadow: ['0 0 0px rgba(220,38,38,0)', '0 0 15px rgba(220,38,38,0.6)', '0 0 0px rgba(220,38,38,0)'] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      background: 'rgba(220,38,38,0.15)',
                      border: '1px solid rgba(220,38,38,0.5)',
                      borderRadius: 8, padding: '5px 12px',
                      cursor: 'pointer', outline: 'none', color: '#FCA5A5',
                      fontSize: 12, fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 800, letterSpacing: '0.05em',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {t('game.risk_it').toUpperCase()}!
                  </motion.button>
                )}
                <motion.button
                  onClick={handleRiskIt}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(232,164,68,0.15), rgba(200,140,50,0.25))',
                    border: '1px solid rgba(232,164,68,0.4)',
                    borderRadius: 8, padding: '5px 12px',
                    cursor: 'pointer', outline: 'none', color: '#E8A444',
                    fontSize: 12, fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                    flex: isMobile ? 1 : 'none',
                    justifyContent: 'center',
                  }}
                >
                  📋 {t('game.board')}
                </motion.button>
                {isNFTMode && <RarityInfoButton />}
                <motion.button
                  onClick={() => setMinimised(true)}
                  whileHover={{ scale: 1.08, background: 'rgba(255,255,255,0.12)' }}
                  whileTap={{ scale: 0.94 }}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '5px 12px',
                    cursor: 'pointer', outline: 'none',
                    color: 'rgba(255,255,254,0.45)',
                    fontSize: 12, fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
                    flex: isMobile ? 1 : 'none',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: 10 }}>▼</span> Hide
                </motion.button>
              </div>
            </div>

            {/* ── Body: delegate to mode-specific component ── */}
            {isNFTMode ? (
              <NFTModeBody
                activeZone={activeZone}
                hoveredZone={hoveredZone}
                setActiveZone={setActiveZone}
                setHoveredZone={setHoveredZone}
                askedIds={askedIds}
                remaining={remaining}
                onAsk={handleAsk}
              />
            ) : (
              <FreeModeBody
                askedIds={askedIds}
                remaining={remaining}
                onAsk={handleAsk}
              />
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
