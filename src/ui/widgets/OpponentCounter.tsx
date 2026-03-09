import { motion } from 'framer-motion';
import { useActivePlayer, useEliminatedIds, useGameCharacters, usePhase } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';

/**
 * OpponentCounter — shows opponent's tiles remaining with green→red color.
 */
export function OpponentCounter() {
    const phase = usePhase();
    const activePlayer = useActivePlayer();
    const characters = useGameCharacters();

    const opponent = activePlayer === 'player1' ? 'player2' : 'player1';
    const eliminatedByOpponent = useEliminatedIds(opponent);

    const total = characters.length;
    const remaining = total - (eliminatedByOpponent?.length || 0);

    const isVisible =
        phase === GamePhase.QUESTION_SELECT ||
        phase === GamePhase.ANSWER_PENDING ||
        phase === GamePhase.ANSWER_REVEALED ||
        phase === GamePhase.AUTO_ELIMINATING ||
        phase === GamePhase.ELIMINATION ||
        phase === GamePhase.GUESS_SELECT;

    if (!isVisible) return null;

    // Opponent tiles: blue when many (safe), red when few (danger)
    const ratio = total > 0 ? remaining / total : 1;
    const hue = Math.round(ratio * 200 + 0); // 200=blue → 0=red
    const tileColor = `hsl(${hue}, 75%, 55%)`;
    const tileBgColor = `hsla(${hue}, 75%, 55%, 0.12)`;
    const tileBorderColor = `hsla(${hue}, 75%, 55%, 0.3)`;

    return (
        <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{
                position: 'fixed',
                top: 64,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                zIndex: 50,
                pointerEvents: 'none',
            }}
        >
            <div style={{
                background: 'rgba(12, 11, 20, 0.82)',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${tileBorderColor}`,
                borderRadius: '12px',
                padding: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
                <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    color: 'rgba(255,255,254,0.4)',
                    textTransform: 'uppercase',
                }}>
                    Opponent
                </span>

                <motion.span
                    key={remaining}
                    initial={{ scale: 1.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: tileColor,
                        fontFamily: "'Space Grotesk', sans-serif",
                        textShadow: `0 0 10px ${tileBgColor}`,
                    }}
                >
                    {remaining}
                </motion.span>

                <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.25)',
                }}>
                    / {total}
                </span>

                {/* Progress bar with green→red gradient */}
                <div style={{
                    width: 60,
                    height: 3,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    overflow: 'hidden',
                }}>
                    <motion.div
                        initial={{ width: '100%' }}
                        animate={{ width: `${(remaining / total) * 100}%` }}
                        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                        style={{
                            height: '100%',
                            background: `linear-gradient(90deg, ${tileColor}, ${tileColor}88)`,
                        }}
                    />
                </div>
            </div>
        </motion.div>
    );
}
