/**
 * ZK proof status UI components.
 *
 * ProofSpinner — shown during PROVING and SUBMITTING phases
 * VerifiedBadge — shown when proof is verified on-chain
 * ErrorRetry — shown when proof generation fails
 *
 * Post-merge, these will be used by ZKAnswerPanel or integrated
 * into src/ui/panels/AnswerPanel.tsx.
 */
import { motion } from 'framer-motion';

// Note: Card and Button components will be at different paths post-merge.
// Using inline styles here to keep this file self-contained.

const cardStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '50%',
  left: '50%',
  transform: 'translate(-50%, 50%)',
  width: 'min(440px, calc(100vw - 32px))',
  textAlign: 'center',
  pointerEvents: 'auto',
  background: 'rgba(15,14,23,0.96)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 20,
  padding: '32px 28px',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
};

export function ProofSpinner({ step }: { step: string }) {
  return (
    <div style={cardStyle}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
        style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(232,164,68,0.2)',
          borderTopColor: '#E8A444',
          borderRadius: '50%',
          margin: '0 auto 20px',
        }}
      />
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 16,
        fontWeight: 600,
        color: '#FFFFFE',
        marginBottom: 8,
      }}>
        {step}
      </div>
      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,254,0.35)',
      }}>
        This may take a moment
      </div>
    </div>
  );
}

export function VerifiedBadge({ answer }: { answer: boolean | null }) {
  return (
    <div style={cardStyle}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          fontSize: 48,
          marginBottom: 16,
        }}
      >
        {answer ? '\u2705' : '\u274C'}
      </motion.div>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 20,
        fontWeight: 700,
        color: '#FFFFFE',
        marginBottom: 8,
      }}>
        {answer ? 'YES' : 'NO'}
      </div>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(124,58,237,0.8)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        ZK Verified
      </div>
    </div>
  );
}

export function ErrorRetry({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>&#x26A0;&#xFE0F;</div>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 16,
        fontWeight: 600,
        color: '#F87171',
        marginBottom: 12,
      }}>
        Proof generation failed
      </div>
      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,254,0.4)',
        marginBottom: 20,
        wordBreak: 'break-word',
      }}>
        {error}
      </div>
      <motion.button
        onClick={onRetry}
        whileHover={{ scale: 1.04, filter: 'brightness(1.1)' }}
        whileTap={{ scale: 0.97 }}
        style={{
          background: 'linear-gradient(135deg, #4ADE80, #22C55E)',
          border: 'none',
          borderRadius: 12,
          padding: '12px 32px',
          color: '#0F0E17',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: 16,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        Retry
      </motion.button>
    </div>
  );
}
