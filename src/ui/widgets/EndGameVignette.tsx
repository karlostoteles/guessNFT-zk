/**
 * EndGameVignette — screen effects that intensify as tiles dwindle.
 *
 * When remaining tiles ≤ 15:  subtle vignette appears
 * When remaining tiles ≤ 8:   heartbeat SFX begins, border pulses red
 * When remaining tiles ≤ 3:   maximum intensity — screen darkens at edges
 *
 * Renders a full-screen overlay with CSS radial gradient vignette.
 * Completely non-interactive (pointerEvents: none).
 */
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActivePlayer, useEliminatedIds, useGameCharacters, usePhase } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';
import { sfx } from '@/shared/audio/sfx';

const GAMEPLAY_PHASES = new Set([
    GamePhase.QUESTION_SELECT,
    GamePhase.ANSWER_PENDING,
    GamePhase.ANSWER_REVEALED,
    GamePhase.AUTO_ELIMINATING,
    GamePhase.ELIMINATION,
    GamePhase.TURN_TRANSITION,
    GamePhase.GUESS_SELECT,
]);

export function EndGameVignette() {
    const phase = usePhase();
    const activePlayer = useActivePlayer();
    const characters = useGameCharacters();

    // Track OPPONENT's remaining tiles — danger = they're close to guessing YOUR pick
    const opponent = activePlayer === 'player1' ? 'player2' : 'player1';
    const opponentEliminatedIds = useEliminatedIds(opponent);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const remaining = characters.length - opponentEliminatedIds.length;
    const isGameplay = GAMEPLAY_PHASES.has(phase);

    // Intensity levels
    const isHot = isGameplay && remaining <= 15;
    const isDangerous = isGameplay && remaining <= 8;
    const isCritical = isGameplay && remaining <= 3;

    // Vignette opacity: 0 → 0.4 → 0.6 → 0.8
    const vignetteOpacity = isCritical ? 0.8 : isDangerous ? 0.6 : isHot ? 0.35 : 0;

    // Border pulse color
    const pulseColor = isCritical
        ? 'rgba(224,85,85,0.5)'
        : isDangerous
            ? 'rgba(224,85,85,0.3)'
            : 'rgba(232,164,68,0.15)';

    // Heartbeat SFX loop — restarts when pace changes (dangerous → critical)
    useEffect(() => {
        // Clear any existing interval so pace updates properly
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
        if (isDangerous) {
            const play = () => sfx.heartbeat();
            play(); // immediate first beat
            heartbeatRef.current = setInterval(play, isCritical ? 800 : 1200);
        }
        return () => {
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
        };
    }, [isDangerous, isCritical]);

    if (!isHot) return null;

    return (
        <AnimatePresence>
            <motion.div
                key="endgame-vignette"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.0 }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 5,
                }}
            >
                {/* Radial vignette — dark edges */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
                    transition: 'background 1s ease',
                }} />

                {/* Pulsing border glow */}
                {isDangerous && (
                    <motion.div
                        animate={{
                            boxShadow: [
                                `inset 0 0 60px ${pulseColor}`,
                                `inset 0 0 120px ${pulseColor}`,
                                `inset 0 0 60px ${pulseColor}`,
                            ],
                        }}
                        transition={{ duration: isCritical ? 0.8 : 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 0,
                        }}
                    />
                )}
            </motion.div>
        </AnimatePresence>
    );
}
