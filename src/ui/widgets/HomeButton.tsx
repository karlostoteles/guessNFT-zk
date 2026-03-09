import { motion } from 'framer-motion';
import { useGameActions, usePhase } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';
import { useWalletAddress } from '@/services/starknet/walletStore';
import { sfx } from '@/shared/audio/sfx';

/**
 * Global Home button — top-left corner (next to Wallet).
 * Resets game state and returns to Menu.
 */
export function HomeButton() {
    const phase = usePhase();
    const { resetGame } = useGameActions();
    const walletAddress = useWalletAddress();

    // Don't show on Menu screen
    if (phase === GamePhase.MENU) return null;

    // Sit at far-left when no wallet chip is present, otherwise after it
    const leftOffset = walletAddress ? 170 : 16;

    return (
        <motion.button
            onClick={() => { sfx.click(); resetGame(); }}
            whileHover={{ scale: 1.1, background: 'rgba(255,255,255,0.1)' }}
            whileTap={{ scale: 0.9 }}
            style={{
                position: 'fixed',
                top: 16,
                left: leftOffset,
                zIndex: 100,
                pointerEvents: 'auto',
                background: 'rgba(15, 14, 23, 0.88)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 12,
                padding: '8px 14px',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: '#FFFFFE',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Home</span>
        </motion.button>
    );
}
