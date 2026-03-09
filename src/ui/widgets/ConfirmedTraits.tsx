/**
 * ConfirmedTraits — card-shaped widget showing MY confirmed traits (YES answers).
 * Matches the same dimensions as SecretCardPanel for visual symmetry.
 * Positioned bottom-right, mirroring "My Card" on the left.
 *
 * Shows a stack of confirmed traits scrollable within the card.
 */
import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { QUESTIONS } from '@/core/data/questions';
import {
    useQuestionHistory, useActivePlayer, usePhase, useGameMode,
} from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';
import { useIsMobile } from '@/shared/hooks/useMediaQuery';

const GAMEPLAY_PHASES = new Set([
    GamePhase.QUESTION_SELECT,
    GamePhase.ANSWER_REVEALED,
    GamePhase.ANSWER_PENDING,
    GamePhase.ELIMINATION,
    GamePhase.AUTO_ELIMINATING,
    GamePhase.TURN_TRANSITION,
    GamePhase.GUESS_SELECT,
]);

export function ConfirmedTraits() {
    const { t } = useTranslation();
    const phase = usePhase();
    const mode = useGameMode();
    const history = useQuestionHistory();
    const activePlayer = useActivePlayer();
    const isMobile = useIsMobile();

    const confirmedTraits = useMemo(() => {
        return history
            .filter((r) => r.askedBy === activePlayer && r.answer === true)
            .map((r) => {
                const q = QUESTIONS.find((q) => q.id === r.questionId);
                return {
                    id: r.questionId,
                    text: q?.text || r.questionText,
                    icon: q?.icon || '✓',
                };
            });
    }, [history, activePlayer]);

    if (!GAMEPLAY_PHASES.has(phase)) return null;

    const SIZE = isMobile ? 120 : 180;

    return (
        <AnimatePresence>
            <motion.div
                key="confirmed-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.4 }}
                style={{
                    position: 'fixed',
                    bottom: isMobile ? 10 : 16,
                    right: isMobile ? 8 : 16,
                    zIndex: 15,
                    pointerEvents: 'auto',
                    width: SIZE,
                }}
            >
                <div style={{
                    background: 'rgba(15,14,23,0.92)',
                    border: '2px solid rgba(74,222,128,0.4)',
                    borderRadius: isMobile ? 10 : 14,
                    overflow: 'hidden',
                    boxShadow: '0 6px 24px rgba(0,0,0,0.6), 0 0 16px rgba(74,222,128,0.12)',
                    height: SIZE - 4,
                    padding: isMobile ? '5px 4px' : '8px 6px',
                    overflowY: 'auto',
                }}>
                    {/* Header */}
                    <div style={{
                        fontSize: isMobile ? 10 : 12,
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        color: '#4ADE80',
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        marginBottom: 4,
                        fontFamily: "'Space Grotesk', sans-serif",
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 3,
                    }}>
                        ✅ {t('game.i_know')}
                        <span style={{
                            fontSize: isMobile ? 11 : 13,
                            background: 'rgba(74,222,128,0.2)',
                            borderRadius: 4,
                            padding: '0 3px',
                            color: '#4ADE80',
                        }}>
                            {confirmedTraits.length}
                        </span>
                    </div>

                    {/* Trait list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {confirmedTraits.map((trait) => (
                            <div
                                key={trait.id}
                                style={{
                                    fontSize: isMobile ? 10 : 11,
                                    padding: '4px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(74,222,128,0.08)',
                                    color: 'rgba(255,255,254,0.6)',
                                    fontFamily: "'Space Grotesk', sans-serif",
                                    fontWeight: 600,
                                    lineHeight: 1.2,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <span style={{ color: '#4ADE80', fontSize: isMobile ? 10 : 12 }}>✓</span>{' '}
                                {stripPrefix(trait.text)}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Label below */}
                <div style={{
                    marginTop: 6,
                    textAlign: 'center',
                    fontSize: isMobile ? 10 : 12,
                    fontWeight: 800,
                    color: 'rgba(74,222,128,0.4)',
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: '0.04em',
                }}>
                    {t('game.confirmed')}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

/** Strip "Does your character have..." prefix for display */
function stripPrefix(text: string): string {
    const prefixes = [
        'Does your character have a ',
        'Does your character have an ',
        'Does your character have ',
        'Does your character wear a ',
        'Does your character wear an ',
        'Does your character wear ',
        'Does your character carry a ',
        'Is your character a ',
        'Is your character ',
        'Does your character ',
    ];
    let result = text;
    for (const p of prefixes) {
        if (result.startsWith(p)) {
            result = result.slice(p.length);
            break;
        }
    }
    result = result.replace(/\?$/, '').trim();
    return result.charAt(0).toUpperCase() + result.slice(1);
}
