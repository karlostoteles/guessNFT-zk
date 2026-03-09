import { motion, AnimatePresence } from 'framer-motion';
import { useTextureProgress, useTextureReady } from '@/core/store/selectors';

export function CollectionLoadingOverlay() {
  const { loaded, total } = useTextureProgress();
  const ready = useTextureReady();
  const visible = !ready && total > 0;
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="collection-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 14, 23, 0.8)',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'all',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              background: 'rgba(15, 14, 23, 0.85)',
              backdropFilter: 'blur(20px)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '32px 40px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              minWidth: 280,
            }}
          >
            <div style={{
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              fontWeight: 600,
              fontSize: 16,
              color: '#FFFFFE',
              letterSpacing: '0.02em',
            }}>
              Loading Collection...
            </div>

            {/* Progress bar */}
            <div style={{
              width: '100%',
              height: 6,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <motion.div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #E8A444, #F0C674)',
                  borderRadius: 3,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            </div>

            <div style={{
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              fontWeight: 400,
              fontSize: 13,
              color: 'rgba(255,255,254,0.6)',
            }}>
              {loaded} / {total} images
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
