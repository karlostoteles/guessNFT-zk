import { useState } from 'react';
import { motion } from 'framer-motion';
import { KATANA_ACCOUNT_1, KATANA_ACCOUNT_2 } from '@/zk/config';
import { useGameActions, useOnlinePlayerNum } from '@/core/store/selectors';
import { useWalletAddress, useWalletUsername } from '@/services/starknet/walletStore';

export function ZKHeaderMenu() {
  const { resetGame } = useGameActions();
  const playerNum = useOnlinePlayerNum() ?? 1;
  const [open, setOpen] = useState(false);

  const walletAddress = useWalletAddress();
  const walletUsername = useWalletUsername();
  const isDev = import.meta.env.DEV;

  // In PROD use Controller wallet address; in DEV use Katana accounts
  const address = isDev
    ? (playerNum === 2 ? KATANA_ACCOUNT_2 : KATANA_ACCOUNT_1)
    : walletAddress;

  const shortAddress = address
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : 'Not connected';

  const label = isDev
    ? 'Katana account'
    : (walletUsername ?? 'Controller wallet');

  return (
    <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 30, pointerEvents: 'auto' }}>
      <motion.button
        onClick={() => setOpen((value) => !value)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        style={{
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(12,11,20,0.85)',
          color: '#FFFFFE',
          fontSize: 12,
          padding: '8px 10px',
          cursor: 'pointer',
        }}
      >
        ☰
      </motion.button>

      {open ? (
        <div
          style={{
            marginTop: 8,
            width: 240,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(12,11,20,0.95)',
            backdropFilter: 'blur(10px)',
            padding: 10,
          }}
        >
          <div style={{ fontSize: 10, color: 'rgba(255,255,254,0.4)', marginBottom: 4 }}>{label}</div>
          <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 11, color: '#E8A444', marginBottom: 10 }}>
            {shortAddress}
          </div>
          <button
            onClick={() => {
              resetGame();
              setOpen(false);
            }}
            style={{
              width: '100%',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.07)',
              color: '#FFFFFE',
              padding: '8px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Return to Menu
          </button>
        </div>
      ) : null}
    </div>
  );
}
