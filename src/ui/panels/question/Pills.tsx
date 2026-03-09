import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

// ─── Waiting pill ─────────────────────────────────────────────────────────────

export function WaitingPill() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      style={{
        pointerEvents: 'none',
        background: 'rgba(15,14,23,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 40,
        padding: '10px 22px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        backdropFilter: 'blur(14px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        color: 'rgba(255,255,254,0.45)',
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 600,
        fontSize: 14,
        whiteSpace: 'nowrap',
      }}
    >
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.6 }}
      >
        ⏳
      </motion.span>
      {t('game.thinking')}
    </motion.div>
  );
}

// ─── Risk-it pill (minimised) ─────────────────────────────────────────────────

export function RiskItPill({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, filter: 'brightness(1.12)' }}
      whileTap={{ scale: 0.97 }}
      style={{
        background: 'linear-gradient(135deg, rgba(232,164,68,0.15), rgba(200,140,50,0.25))',
        border: '1px solid rgba(232,164,68,0.4)',
        borderRadius: 40, padding: '10px 22px',
        display: 'flex', alignItems: 'center', gap: 8,
        cursor: 'pointer', backdropFilter: 'blur(14px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)', outline: 'none',
        color: '#E8A444', fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', pointerEvents: 'auto',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
      {t('game.board')}
    </motion.button>
  );
}

// ─── Ask pill (minimised) ─────────────────────────────────────────────────────

export function AskPill({
  askedCount,
  onClick,
}: { askedCount: number; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, filter: 'brightness(1.1)' }}
      whileTap={{ scale: 0.97 }}
      style={{
        background: 'linear-gradient(135deg, rgba(232,164,68,0.18), rgba(124,58,237,0.18))',
        border: '1px solid rgba(232,164,68,0.35)',
        borderRadius: 40, padding: '10px 22px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer', backdropFilter: 'blur(14px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)', outline: 'none',
        color: '#E8A444', fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', pointerEvents: 'auto',
      }}
    >
      <span style={{ fontSize: 16 }}>❓</span>
      {t('game.ask_question')}
      {askedCount > 0 && (
        <span style={{
          background: 'rgba(232,164,68,0.2)', border: '1px solid rgba(232,164,68,0.25)',
          borderRadius: 12, padding: '1px 8px', fontSize: 11, color: 'rgba(232,164,68,0.7)',
        }}>
          {askedCount} asked
        </span>
      )}
      <span style={{ fontSize: 12, opacity: 0.5 }}>▲</span>
    </motion.button>
  );
}
