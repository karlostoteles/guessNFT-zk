import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStatus, useWalletUsername, useWalletAddress, useOwnedNFTs } from '@/services/starknet/walletStore';
import { useWalletConnection } from '@/services/starknet/hooks';
import { IPFS_GATEWAYS, resolveUrl } from '@/services/starknet/nftService';
import type { SchizodioNFT } from '@/services/starknet/types';
import { sfx } from '@/shared/audio/sfx';

/**
 * Persistent wallet status widget — top-left corner.
 * Click → dropdown panel anchored directly below the button.
 * No full-screen modal; click outside (transparent backdrop) to close.
 */
export function WalletButton() {
  const status = useWalletStatus();
  const username = useWalletUsername();
  const address = useWalletAddress();
  const nfts = useOwnedNFTs();
  const { disconnectWallet, refreshNFTs } = useWalletConnection();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isConnected = status === 'connected' || status === 'ready' || status === 'loading_nfts';
  const displayName = username || (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '');

  // Hide the widget entirely if not connected (requested: "only display later the user there")
  // The main Login button is now central on the MenuScreen.
  if (!address || !isConnected) return null;

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setOpen(false);
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await refreshNFTs();
    setRefreshing(false);
  };

  return (
    <>
      {/* ── Transparent click-outside backdrop ──────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="wallet-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { sfx.click(); setOpen(false); }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 98,
              cursor: 'default',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Anchor container (fixed to top-left) ────────────────────── */}
      {/*   zIndex 100 so the dropdown rides above the backdrop (98)    */}
      <div style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 100,
        pointerEvents: 'auto',
      }}>

        {/* Button chip */}
        <motion.div
          onClick={() => { sfx.click(); setOpen((v) => !v); }}
          whileHover={{ borderColor: 'rgba(124, 58, 237, 0.7)' }}
          style={{
            background: 'rgba(15, 14, 23, 0.88)',
            border: '1px solid rgba(124, 58, 237, 0.35)',
            borderRadius: 12,
            padding: '8px 14px',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {/* Green dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#4CAF50',
            boxShadow: '0 0 8px rgba(76,175,80,0.6)',
            flexShrink: 0,
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600, fontSize: 12, color: '#FFFFFE',
            }}>
              {displayName}
            </span>
            {status === 'ready' && nfts.length > 0 && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,254,0.4)' }}>
                {nfts.length} SCHIZO{nfts.length > 1 ? 's' : ''}
              </span>
            )}
            {status === 'loading_nfts' && (
              <span style={{ fontSize: 10, color: 'rgba(124,58,237,0.7)' }}>Loading NFTs…</span>
            )}
          </div>

          {/* Chevron */}
          <span style={{
            fontSize: 9,
            color: 'rgba(255,255,254,0.35)',
            marginLeft: 2,
            transition: 'transform 0.2s',
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
        </motion.div>

        {/* ── Dropdown panel — anchored via position:absolute ─────── */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="wallet-panel"
              initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 8,
                width: 'min(360px, calc(100vw - 32px))',
                maxHeight: 'calc(100vh - 100px)',
                background: 'rgba(13, 12, 20, 0.97)',
                border: '1px solid rgba(124, 58, 237, 0.35)',
                borderRadius: 16,
                boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transformOrigin: 'top left',
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7C3AED, #E8A444)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                  <div>
                    <div style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700, fontSize: 15, color: '#FFFFFE', lineHeight: 1.2,
                    }}>
                      {username || displayName}
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3,
                      padding: '1px 7px',
                      background: 'rgba(76,175,80,0.12)',
                      border: '1px solid rgba(76,175,80,0.28)',
                      borderRadius: 20,
                    }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: '#4CAF50', boxShadow: '0 0 5px rgba(76,175,80,0.6)',
                      }} />
                      <span style={{ fontSize: 10, color: '#81C784', fontFamily: "'Space Grotesk', sans-serif" }}>
                        Connected
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { sfx.click(); setOpen(false); }}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 7,
                    color: 'rgba(255,255,254,0.4)',
                    width: 26, height: 26,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    outline: 'none', flexShrink: 0,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Body — scrollable */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '14px 18px 4px' }}>

                {/* Wallet address */}
                {address && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 10,
                      color: 'rgba(255,255,254,0.3)',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: 6,
                    }}>
                      Wallet Address
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      padding: '9px 11px',
                    }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: 'rgba(255,255,254,0.55)',
                        flex: 1,
                        wordBreak: 'break-all',
                        lineHeight: 1.55,
                      }}>
                        {address}
                      </span>
                      <motion.button
                        onClick={() => { sfx.click(); handleCopy(); }}
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.94 }}
                        style={{
                          background: copied ? 'rgba(76,175,80,0.18)' : 'rgba(124,58,237,0.18)',
                          border: `1px solid ${copied ? 'rgba(76,175,80,0.4)' : 'rgba(124,58,237,0.4)'}`,
                          borderRadius: 7,
                          color: copied ? '#81C784' : '#A78BFA',
                          fontSize: 11,
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 600,
                          padding: '4px 9px',
                          cursor: 'pointer',
                          outline: 'none',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          marginTop: 1,
                          transition: 'background 0.18s, border-color 0.18s, color 0.18s',
                        }}
                      >
                        {copied ? '✓ Copied' : 'Copy'}
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* NFT gallery */}
                {nfts.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}>
                      <span style={{
                        fontSize: 10,
                        color: 'rgba(255,255,254,0.3)',
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}>
                        SCHIZODIO · {nfts.length} token{nfts.length > 1 ? 's' : ''}
                      </span>
                      <motion.button
                        onClick={() => { sfx.click(); handleRefresh(); }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title="Refresh NFT images"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: refreshing ? 'default' : 'pointer',
                          color: 'rgba(255,255,254,0.3)',
                          fontSize: 13,
                          padding: '2px 4px',
                          outline: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          animation: refreshing ? 'spin 1s linear infinite' : 'none',
                        }}
                      >
                        ↻
                      </motion.button>
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 6,
                    }}>
                      {nfts.map((nft) => (
                        <NftCard key={nft.tokenId} nft={nft} />
                      ))}
                    </div>
                  </div>
                )}

                {nfts.length === 0 && status === 'ready' && (
                  <div style={{
                    textAlign: 'center',
                    padding: '12px 0 16px',
                    color: 'rgba(255,255,254,0.2)',
                    fontSize: 12,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    No SCHIZODIO NFTs detected
                  </div>
                )}
              </div>

              {/* Footer — disconnect */}
              <div style={{
                padding: '12px 18px 14px',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                flexShrink: 0,
              }}>
                <motion.button
                  onClick={() => { sfx.click(); handleDisconnect(); }}
                  whileHover={{ background: 'rgba(239,68,68,0.16)' }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    width: '100%',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.22)',
                    borderRadius: 9,
                    padding: '10px 16px',
                    color: '#FCA5A5',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'background 0.18s',
                  }}
                >
                  Disconnect Wallet
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// ─── NFT Card ─────────────────────────────────────────────────────────────────

/**
 * Displays one NFT thumbnail, cycling through IPFS gateways on load failure.
 * rawImageIpfs is the original ipfs:// URL (stored alongside imageUrl for retries).
 */
function NftCard({ nft }: { nft: SchizodioNFT & { rawImageIpfs?: string } }) {
  const rawIpfs = (nft as any).rawImageIpfs as string | undefined;
  // gatewayIdx = 0 → nft.imageUrl (already resolved with gateway 0)
  // gatewayIdx = 1..N → try next gateways using raw ipfs:// path
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const hue = (parseInt(nft.tokenId, 10) * 47) % 360;

  const resolvedSrc = (() => {
    if (!nft.imageUrl && !rawIpfs) return '';
    if (gatewayIdx === 0) return nft.imageUrl;
    if (rawIpfs) return resolveUrl(rawIpfs, gatewayIdx);
    return '';
  })();

  const showImage = !!resolvedSrc;
  const allGatewaysFailed = gatewayIdx >= IPFS_GATEWAYS.length;

  const handleError = () => {
    if (rawIpfs && gatewayIdx < IPFS_GATEWAYS.length - 1) {
      console.warn(`[NftCard] gateway ${gatewayIdx} failed for #${nft.tokenId}, trying next`);
      setGatewayIdx((i) => i + 1);
    } else {
      console.warn(`[NftCard] all gateways failed for #${nft.tokenId}`);
      setGatewayIdx(IPFS_GATEWAYS.length); // mark as exhausted
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      style={{
        borderRadius: 9,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'default',
      }}
    >
      <div style={{
        aspectRatio: '1/1',
        background: (showImage && !allGatewaysFailed)
          ? '#000'
          : `linear-gradient(135deg, hsl(${hue},55%,16%), hsl(${hue + 40},45%,10%))`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {showImage && !allGatewaysFailed ? (
          <img
            key={gatewayIdx}
            src={resolvedSrc}
            alt={nft.name}
            onError={handleError}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{
            fontFamily: "'Space Grotesk', monospace",
            fontWeight: 700,
            fontSize: 15,
            color: `hsla(${hue},70%,68%,0.9)`,
          }}>
            #{nft.tokenId}
          </span>
        )}
      </div>
      <div style={{
        padding: '4px 6px 6px',
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 9,
        fontWeight: 600,
        color: 'rgba(255,255,254,0.45)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {nft.name}
      </div>
    </motion.div>
  );
}
