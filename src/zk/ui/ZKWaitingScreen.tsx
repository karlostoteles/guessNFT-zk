import { motion } from 'framer-motion';
import { Card } from '@/ui/common';
import { retryLastProof } from '@/zk/useZKAnswer';
import { useProofError } from '@/core/store/selectors';

interface ZKWaitingScreenProps {
  message: string;
}

export function ZKWaitingScreen({ message }: ZKWaitingScreenProps) {
  const proofError = useProofError();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <Card style={{ width: 'min(420px, calc(100vw - 24px))', textAlign: 'center', pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              animate={{ y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
              transition={{ repeat: Infinity, duration: 1, delay: index * 0.15 }}
              style={{ width: 8, height: 8, borderRadius: '50%', background: '#E8A444' }}
            />
          ))}
        </div>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 18,
            color: '#FFFFFE',
            marginBottom: 8,
          }}
        >
          {message}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.42)' }}>
          ZK proof generation can take 30-120 seconds.
        </div>

        {proofError ? (
          <div
            style={{
              marginTop: 14,
              background: 'rgba(224,85,85,0.14)',
              border: '1px solid rgba(224,85,85,0.3)',
              borderRadius: 10,
              padding: 10,
            }}
          >
            <div style={{ color: '#FFAAAA', fontSize: 12, marginBottom: 8 }}>{proofError}</div>
            <button
              onClick={() => {
                retryLastProof().catch(console.error);
              }}
              style={{
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: '#FFFFFE',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Retry Proof
            </button>
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
}
