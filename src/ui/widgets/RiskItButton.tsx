/**
 * RiskItButton — floating gameplay "RISK IT" / "GUESS NOW" button.
 *
 * Visible during gameplay phases. Pulsates red when the opponent is
 * in the danger zone (≤ 8 tiles remaining), urging the player to guess
 * before the opponent does.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { usePhase, useActivePlayer, useEliminatedIds, useGameCharacters, useGameActions, useGameMode, useOnlinePlayerNum } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';
import { sfx } from '@/shared/audio/sfx';

const VISIBLE_PHASES = new Set([
    GamePhase.QUESTION_SELECT,
    GamePhase.ANSWER_PENDING,
    GamePhase.ANSWER_REVEALED,
    GamePhase.AUTO_ELIMINATING,
    GamePhase.TURN_TRANSITION,
]);

export function RiskItButton() {
    const phase = usePhase();
    const activePlayer = useActivePlayer();
    const characters = useGameCharacters();
    const mode = useGameMode();
    const onlinePlayerNum = useOnlinePlayerNum();
    const { startGuess } = useGameActions();

    // Track opponent's remaining tiles for danger detection
    const opponent = activePlayer === 'player1' ? 'player2' : 'player1';
    const opponentEliminatedIds = useEliminatedIds(opponent);
    const opponentRemaining = characters.length - opponentEliminatedIds.length;

    const isVisible = VISIBLE_PHASES.has(phase);

    // In online mode only show on your turn
    const isMyTurn = mode !== 'online' || (
        (activePlayer === 'player1' && onlinePlayerNum === 1) ||
        (activePlayer === 'player2' && onlinePlayerNum === 2)
    );

    // Only show during QUESTION_SELECT (when player can actually act)
    const canAct = phase === GamePhase.QUESTION_SELECT && isMyTurn;

    const isDangerous = opponentRemaining <= 8;
    const isCritical = opponentRemaining <= 3;

    const handleClick = () => {
        if (!canAct) return;
        sfx.riskIt();
        startGuess();
    };

    if (!isVisible) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.button
                    key="risk-it-btn"
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={isDangerous ? {
                        opacity: canAct ? 1 : 0.45,
                        scale: [1, 1.04, 1],
                        y: 0,
                        boxShadow: [
                            '0 0 10px rgba(220,38,38,0.2), 0 4px 16px rgba(0,0,0,0.4)',
                            '0 0 30px rgba(220,38,38,0.5), 0 4px 16px rgba(0,0,0,0.4)',
                            '0 0 10px rgba(220,38,38,0.2), 0 4px 16px rgba(0,0,0,0.4)',
                        ],
                    } : {
                        opacity: canAct ? 1 : 0.45,
                        scale: 1,
                        y: 0,
                    }}
                    exit={{ opacity: 0, scale: 0.8, y: 20 }}
                    transition={isDangerous ? {
                        duration: isCritical ? 0.8 : 1.4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    } : {
                        type: 'spring', stiffness: 400, damping: 25,
                    }}
                    onClick={handleClick}
                    disabled={!canAct}
                    style={{
                        position: 'fixed',
                        bottom: 'clamp(100px, 15vh, 140px)',
                        right: 16,
                        zIndex: 40,
                        padding: isDangerous ? '12px 20px' : '10px 16px',
                        border: isDangerous
                            ? '2px solid rgba(220,38,38,0.6)'
                            : '1px solid rgba(232,164,68,0.35)',
                        borderRadius: 14,
                        background: isDangerous
                            ? 'rgba(220,38,38,0.18)'
                            : 'rgba(15,14,23,0.88)',
                        backdropFilter: 'blur(12px)',
                        color: isDangerous ? '#FCA5A5' : '#E8A444',
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 800,
                        fontSize: isDangerous ? 14 : 12,
                        letterSpacing: '0.06em',
                        cursor: canAct ? 'pointer' : 'default',
                        outline: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        pointerEvents: 'auto',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                    whileHover={canAct ? { scale: 1.08 } : {}}
                    whileTap={canAct ? { scale: 0.94 } : {}}
                >
                    {isDangerous ? (
                        <>
                            <span style={{ fontSize: 16 }}>⚡</span>
                            GUESS NOW
                        </>
                    ) : (
                        <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            RISK IT
                        </>
                    )}
                </motion.button>
            )}
        </AnimatePresence>
    );
}
