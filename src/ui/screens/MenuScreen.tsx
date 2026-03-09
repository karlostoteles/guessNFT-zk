import { useState } from 'react';
import { sfx } from '@/shared/audio/sfx';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useGameActions } from '@/core/store/selectors';
import { MEME_CHARACTERS } from '@/core/data/memeCharacters';
import {
  generatePlayableCollectionCharacters,
  PLAYABLE_COLLECTION_SIZE,
} from '@/services/starknet/collectionService';
import { useWalletStatus, useWalletAddress } from '@/services/starknet/walletStore';
import { useWalletConnection } from '@/services/starknet/hooks';
import { WalletButton } from '../widgets/WalletButton';
import { useOwnedNFTs } from '@/services/starknet/walletStore';
import { useGameStore } from '@/core/store/gameStore';

type View = 'menu' | 'free-pick';

export function MenuScreen() {
  const [view, setView] = useState<View>('menu');
  const [loading, setLoading] = useState(false);
  const [nftStatus, setNftStatus] = useState<string>('');
  const { startSetup, setGameMode } = useGameActions();

  const handleFreePlay = () => {
    setGameMode('free', MEME_CHARACTERS);
    startSetup();
  };

  const handleZKPlay = () => {
    setGameMode('zk-online');
  };

  /** Instant Schizodio free play — loads the curated playable subset, no wallet needed */
  const handleSchizodioFreePlay = async () => {
    setLoading(true);
    setNftStatus(`Loading ${PLAYABLE_COLLECTION_SIZE} Schizodio cards...`);
    try {
      const playableChars = await generatePlayableCollectionCharacters('nft-free-default', PLAYABLE_COLLECTION_SIZE);
      setGameMode('nft-free', playableChars);
      startSetup();
    } catch (err: any) {
      console.error('[MenuScreen] Collection load failed:', err);
      setNftStatus(`Error: ${err?.message || 'Failed to load collection'}`);
      await new Promise(r => setTimeout(r, 2000));
      setLoading(false);
      setNftStatus('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'auto', zIndex: 20 }}
    >
      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <MenuMain
            key="menu"
            onFreePlay={() => setView('free-pick')}
            onPlayZK={handleZKPlay}
          />
        )}
        {view === 'free-pick' && (
          <FreePickView
            key="free-pick"
            onBack={() => setView('menu')}
            onCTVersion={handleFreePlay}
            onSchizodio={handleSchizodioFreePlay}
            onSchizodioRandom={async () => {
              // Assign the player a random character bypassing the setup phase
              setLoading(true);
              setNftStatus('Assigning random character...');
              try {
                const playableChars = await generatePlayableCollectionCharacters('nft-free-default', PLAYABLE_COLLECTION_SIZE);
                setGameMode('nft-free', playableChars);
                startSetup();
                useGameStore.getState().assignRandomSecretCharacter('player1');
              } catch (err: any) {
                console.error('[MenuScreen] Random collection load failed:', err);
              } finally {
                setLoading(false);
                setNftStatus('');
              }
            }}
            loading={loading}
            nftStatus={nftStatus}
          />
        )}
      </AnimatePresence>

      <LoadingOverlay loading={loading} status={nftStatus} />
    </motion.div>
  );
}

// ─── Shared header / back button ───────────────────────────────────────────────

function SubHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      marginBottom: 32,
    }}>
      <motion.button
        onClick={() => { sfx.click(); onBack(); }}
        whileHover={{ scale: 1.08, background: 'rgba(255,255,255,0.1)' }}
        whileTap={{ scale: 0.94 }}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, padding: '8px 14px',
          cursor: 'pointer', outline: 'none',
          color: 'rgba(255,255,254,0.55)',
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Back
      </motion.button>
      <span style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 18, fontWeight: 700, color: '#FFFFFE',
      }}>
        {title}
      </span>
    </div>
  );
}

// ─── Main menu view ─────────────────────────────────────────────────────────────

interface MenuMainProps {
  onFreePlay: () => void;
  onPlayZK: () => void;
}

function MenuMain({ onFreePlay, onPlayZK }: MenuMainProps) {
  const { t, i18n } = useTranslation();

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        paddingBottom: 'clamp(16px, 5vh, 10vh)',
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Warm pastel ambient wash behind logo area */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '120%',
        height: '60%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(232,164,68,0.06) 0%, rgba(244,114,182,0.04) 30%, rgba(124,58,237,0.03) 50%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Spacer — pushes content to center when viewport is tall, collapses when scrolling */}
      <div style={{ flex: '1 1 0', minHeight: 0 }} />

      {/* ─── Top Left Controls ─── */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <LoginButtonSection />
      </div>

      {/* ─── Top Right Controls ─── */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, display: 'flex', gap: 10 }}>
        {/* Language Toggle */}
        <motion.button
          onClick={toggleLang}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700,
            color: '#FFFFFE', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
            outline: 'none',
          }}
        >
          {i18n.language.startsWith('es') ? '🇪🇸 ES' : '🇬🇧 EN'}
        </motion.button>
      </div>

      {/* ─── Logo: alive with pulsing glow + breathing scale ─── */}
      <motion.div
        initial={{ y: -120, opacity: 0, scale: 0.6, rotate: -10 }}
        animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 120, damping: 12, mass: 0.8 }}
        style={{
          position: 'relative',
          zIndex: 2,
          marginBottom: 'clamp(-40px, -4vw, -16px)',
        }}
      >
        {/* Blurred gradient glow behind logo — pulses gold/pink/purple */}
        <div
          className="logo-glow-bg"
          style={{
            position: 'absolute',
            inset: '10%',
            borderRadius: '40%',
            background: 'radial-gradient(ellipse at 30% 50%, rgba(232,164,68,0.4) 0%, rgba(244,114,182,0.25) 35%, rgba(124,58,237,0.2) 60%, transparent 80%)',
            filter: 'blur(35px)',
            pointerEvents: 'none',
          }}
        />
        {/* Logo with screen blend — black bg becomes invisible */}
        <motion.img
          src="/newlogo.png"
          alt="guessNFT"
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          style={{
            width: 'clamp(180px, 45vw, 360px)',
            height: 'auto',
            display: 'block',
            mixBlendMode: 'screen',
            position: 'relative',
          }}
        />
      </motion.div>

      {/* ─── Title: Pixar-style jumping letters ─── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '4px',
        marginBottom: 12, position: 'relative', zIndex: 1, width: '90%'
      }}>
        {t('menu.title').split(' ').map((word, wordIdx) => (
          <div key={`word-${wordIdx}`} style={{ display: 'flex', whiteSpace: 'pre' }}>
            {word.split('').map((char, charIdx) => {
              const letterIndex = wordIdx * 10 + charIdx; // rough staggered delay grouping
              return (
                <motion.span
                  key={`char-${wordIdx}-${charIdx}`}
                  initial={{ y: -40, opacity: 0, scale: 0.5 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 10 + Math.random() * 5,
                    delay: 0.6 + (letterIndex * 0.05), // stagger effect
                  }}
                  whileHover={{ y: -10, scale: 1.2, color: "#FFF" }}
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 'clamp(20px, 5vw, 36px)',
                    fontWeight: 800, letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #E8A444 0%, #F472B6 50%, #A78BFA 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 12px rgba(244,114,182,0.25))',
                    display: 'inline-block',
                    cursor: 'default',
                  }}
                >
                  {char}
                </motion.span>
              );
            })}
            {wordIdx !== t('menu.title').split(' ').length - 1 && <span style={{ width: '8px' }}></span>}
          </div>
        ))}
      </div>

      {/* Removed Badge from subtitle area per user request (it was moved to the PlayForReal tile) */}

      {/* ─── Subtitle: gentle fade in ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.95, duration: 0.8 }}
        style={{ fontSize: 15, color: 'rgba(255,255,254,0.55)', fontWeight: 500, marginBottom: 24, textAlign: 'center' }}
      >
        {t('menu.subtitle')}
      </motion.div>

      {/* Pastel accent divider */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.8, ease: 'easeOut' }}
        style={{
          width: 'clamp(120px, 30vw, 200px)',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(244,114,182,0.35), rgba(167,139,250,0.35), transparent)',
          marginBottom: 16,
        }}
      />

      {/* ─── Two main tiles: slide in from sides ─── */}
      <div style={{
        display: 'flex', gap: 'clamp(12px, 3vw, 28px)',
        alignItems: 'stretch', justifyContent: 'center',
        flexWrap: 'wrap',
        marginTop: 20,
        padding: '0 16px',
      }}>
        <motion.div
          initial={{ x: -100, opacity: 0, rotate: -5 }}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          transition={{ delay: 1.1, type: 'spring', stiffness: 130, damping: 16 }}
        >
          <PlayRealTile onClick={onPlayZK} />
        </motion.div>
        <motion.div
          initial={{ x: 100, opacity: 0, rotate: 5 }}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          transition={{ delay: 1.25, type: 'spring', stiffness: 130, damping: 16 }}
        >
          <PlayFreeTile onClick={onFreePlay} />
        </motion.div>
      </div>

      {/* Bottom spacer — mirrors top spacer for centering */}
      <div style={{ flex: '1 1 0', minHeight: 0 }} />
    </motion.div>
  );
}

// ─── Tile: Play with Privacy zk ────────────────────────────────────────────────

function PlayRealTile({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    if (isClicked) return;
    sfx.cardClick();
    setIsClicked(true);
    setTimeout(() => {
      onClick();
      setIsClicked(false);
    }, 250);
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={!isClicked ? { scale: 1.04, y: -6, boxShadow: '0 0 56px rgba(232,164,68,0.35), 0 8px 32px rgba(0,0,0,0.5)' } : {}}
      whileTap={!isClicked ? { scale: 0.97 } : {}}
      animate={isClicked ? { scale: 0.95, rotateX: 60, y: 15, opacity: 0 } : { scale: 1, rotateX: 0, y: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeIn' }}
      initial={false}
      style={{
        transformPerspective: 800,
        transformOrigin: 'bottom center',
        width: 'clamp(156px, 42vw, 188px)',
        height: 'clamp(228px, 60vw, 272px)',
        background: 'linear-gradient(165deg, #1c1228 0%, #0e0c1e 100%)',
        border: '1.5px solid rgba(232,164,68,0.5)', borderRadius: 16,
        cursor: 'pointer', outline: 'none', padding: 0, overflow: 'hidden',
        boxShadow: '0 0 28px rgba(232,164,68,0.16), 0 4px 20px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}
    >
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <img
          src="/vs_background.jpg"
          alt="1Vs1 Background"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 60%, rgba(14,12,30,0.9) 100%)',
        }} />
        {/* Removed 1Vs1 text svg */}
        {/* Premiere Badge embedded inside the card at bottom */}
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(232,164,68,0.2)', border: '1px solid rgba(232,164,68,0.4)',
          borderRadius: 8, padding: '2px 8px', fontSize: 9, fontWeight: 700,
          letterSpacing: '0.08em', color: '#E8A444',
          fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' as const,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          {t('menu.badge')}
        </div>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(232,164,68,0.45), transparent)', flexShrink: 0 }} />
      <div style={{ padding: '11px 13px 13px', textAlign: 'left', fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFE', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {t('menu.play_real')}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(232,164,68,0.65)', fontWeight: 700, marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          {t('menu.play_real_sub')}
        </div>
      </div>
      <div style={{
        position: 'absolute', top: 9, right: 9, width: 6, height: 6, borderRadius: '50%',
        background: '#E8A444', boxShadow: '0 0 8px rgba(232,164,68,0.9)',
      }} />
    </motion.button>
  );
}

// ─── Tile: Play for Free ───────────────────────────────────────────────────────

function PlayFreeTile({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    if (isClicked) return;
    sfx.cardClick();
    setIsClicked(true);
    setTimeout(() => {
      onClick();
      setIsClicked(false);
    }, 250);
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={!isClicked ? { scale: 1.04, y: -6, boxShadow: '0 0 48px rgba(124,58,237,0.3), 0 8px 32px rgba(0,0,0,0.5)' } : {}}
      whileTap={!isClicked ? { scale: 0.97 } : {}}
      animate={isClicked ? { scale: 0.95, rotateX: 60, y: 15, opacity: 0 } : { scale: 1, rotateX: 0, y: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeIn' }}
      initial={false}
      style={{
        transformPerspective: 800,
        transformOrigin: 'bottom center',
        width: 'clamp(156px, 42vw, 188px)',
        height: 'clamp(228px, 60vw, 272px)',
        background: 'linear-gradient(165deg, #101428 0%, #080c1e 100%)',
        border: '1.5px solid rgba(124,58,237,0.4)', borderRadius: 16,
        cursor: 'pointer', outline: 'none', padding: 0, overflow: 'hidden',
        boxShadow: '0 0 22px rgba(124,58,237,0.12), 0 4px 20px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}
    >
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img
          src="/images/practice-bg.jpg"
          alt="Practice Background"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 40%, rgba(8,12,30,0.95) 100%)',
        }} />
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.38), transparent)', flexShrink: 0 }} />
      <div style={{ padding: '11px 13px 13px', textAlign: 'left', fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFE', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {t('menu.practice')}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(167,139,250,0.65)', fontWeight: 700, marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          {t('menu.practice_sub')}
        </div>
      </div>
      <div style={{
        position: 'absolute', top: 9, right: 9, width: 6, height: 6, borderRadius: '50%',
        background: '#7C3AED', boxShadow: '0 0 8px rgba(124,58,237,0.9)',
      }} />
    </motion.button>
  );
}

// ─── Free pick sub-view ─────────────────────────────────────────────────────────

interface FreePickProps {
  onBack: () => void;
  onCTVersion: () => void;
  onSchizodio: () => void;
  loading?: boolean;
  nftStatus?: string;
  onSchizodioRandom: () => void;
}

function FreePickView({ onBack, onCTVersion, onSchizodio, onSchizodioRandom, loading, nftStatus }: FreePickProps) {
  const { t } = useTranslation();
  const { connectWallet } = useWalletConnection();
  const walletStatus = useWalletStatus();
  const ownedNFTs = useOwnedNFTs();
  const [showNoNFTModal, setShowNoNFTModal] = useState(false);

  const handleSchizodioClick = () => {
    if (loading) return;
    if (walletStatus !== 'ready') {
      connectWallet();
      return;
    }
    // Logged in. Check NFTs.
    if (ownedNFTs.length === 0) {
      setShowNoNFTModal(true);
    } else {
      onSchizodio();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
        padding: 24,
      }}
    >
      <div style={{ width: 'min(480px, 100%)', display: 'flex', flexDirection: 'column' }}>
        <SubHeader onBack={onBack} title={t('menu.practice')} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* CT Version */}
          <OptionCard
            onClick={onCTVersion}
            accent="#7C3AED"
            accentRgb="124,58,237"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
              </svg>
            }
            title={t('menu.ct_version')}
            subtitle={t('menu.ct_version_sub')}
            tag="24 CHARS"
          />
          {/* Schizodio vs AI — requires login, prompts random if 0 NFTs */}
          <OptionCard
            onClick={handleSchizodioClick}
            accent="#E8A444"
            accentRgb="232,164,68"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2c-4.4 0-8 3.6-8 8 0 5 4 9 4 12h8c0-3 4-7 4-12 0-4.4-3.6-8-8-8z" />
                <path d="M5 10c0-3.9 3.1-7 7-7s7 3.1 7 7" />
                <path d="M12 11v2" />
                <path d="M9 14h6" />
              </svg>
            }
            title={nftStatus || t('menu.nft_version')}
            subtitle={walletStatus === 'ready' ? "Play with the full Schizodio collection." : "Login required to play Schizodio mode."}
            tag="999 CHARS"
            disabled={loading}
          />
        </div>
      </div>

      {/* No NFT Modal */}
      <AnimatePresence>
        {showNoNFTModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(15,14,23,0.85)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                width: '100%', maxWidth: 400,
                background: '#1c1228', border: '1px solid rgba(232,164,68,0.4)',
                borderRadius: 24, padding: 32,
                display: 'flex', flexDirection: 'column', gap: 24,
                boxShadow: '0 24px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💀</div>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 24,
                  color: '#FFFFFE', margin: '0 0 8px 0'
                }}>
                  No Schizodios Found
                </h3>
                <p style={{
                  color: 'rgba(255,255,254,0.7)', fontSize: 15,
                  lineHeight: 1.5, margin: 0
                }}>
                  You need a Schizodio to select your own character. You can still play by letting us assign you a random character!
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  onClick={() => {
                    sfx.click();
                    setShowNoNFTModal(false);
                    onSchizodioRandom();
                  }}
                  style={{
                    width: '100%', padding: '16px',
                    background: '#E8A444', color: '#0f0e17',
                    border: 'none', borderRadius: 12,
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700,
                    cursor: 'pointer', outline: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  🎲 Play with Random
                </button>
                <button
                  onClick={() => {
                    sfx.click();
                    window.open('https://schizodio.art', '_blank');
                  }}
                  style={{
                    width: '100%', padding: '16px',
                    background: 'rgba(255,255,255,0.05)', color: '#FFFFFE',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600,
                    cursor: 'pointer', outline: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  🛒 Get an NFT at schizodio.art
                </button>
                <button
                  onClick={() => {
                    sfx.click();
                    setShowNoNFTModal(false);
                  }}
                  style={{
                    width: '100%', padding: '12px',
                    background: 'transparent', color: 'rgba(255,255,254,0.5)',
                    border: 'none', borderRadius: 12,
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', outline: 'none', marginTop: 8,
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Real pick sub-view ─────────────────────────────────────────────────────────

interface RealPickProps {
  onBack: () => void;
  onNormal: () => void;
}

function RealPickView({ onBack, onNormal }: RealPickProps) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div style={{ width: 'min(480px, 100%)', display: 'flex', flexDirection: 'column', paddingTop: 24, paddingBottom: 32 }}>
        <SubHeader onBack={onBack} title={t('menu.play_real')} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          <CollectionBadge label="SCHIZODIO" accentRgb="232,164,68" />
          <OptionCard
            onClick={onNormal}
            accent="#E8A444"
            accentRgb="232,164,68"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                <path d="M13 19l6 2 3-3-2-6" />
                <path d="M9.5 14.5L3 21" />
                <path d="M21 3l-6.5 6.5" />
              </svg>
            }
            title={t('menu.normal')}
            subtitle={t('menu.normal_sub')}
            tag={t('menu.online')}
          />
          <OptionCard
            onClick={() => { }}
            accent="#E05555"
            accentRgb="224,85,85"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.5 3.5 6.5 1.5 2 1.5 3.5 1.5 4.5a2.5 2.5 0 0 1-5 0Z" />
                <path d="M12 22s-7-3-7-8c0-3.5 4.5-5.5 4.5-5.5s1.5 2.5 1.5 4c0 1.5-1.5 2.5-1.5 4 0 2 2.5 2 2.5 2s2.5 0 2.5-2c0-1.5-1.5-2.5-1.5-4 0-1.5 1.5-4 1.5-4s4.5 2 4.5 5.5c0 5-7 8-7 8Z" />
              </svg>
            }
            title={t('menu.schizo_mode')}
            subtitle={t('menu.schizo_mode_sub')}
            tag={t('menu.coming_soon')}
            disabled
          />
        </div>

        {/* ─── DUCKS Collection ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          <CollectionBadge label="DUCKS" accentRgb="251,191,36" />
          <OptionCard
            onClick={() => { }}
            accent="#FBBF24"
            accentRgb="251,191,36"
            icon="🦆"
            title="Starknet Ducks"
            subtitle="The quackiest collection descends on the board"
            tag={t('menu.coming_soon')}
            disabled
          />
        </div>

        {/* ─── BLOBERT Collection ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          <CollectionBadge label="BLOBERT" accentRgb="167,139,250" />
          <OptionCard
            onClick={() => { }}
            accent="#A78BFA"
            accentRgb="167,139,250"
            icon="🔮"
            title="Blobert"
            subtitle="A magical assembly of highly intelligent blobs"
            tag={t('menu.coming_soon')}
            disabled
          />
        </div>

        {/* ─── SCHIZOSOL Collection ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CollectionBadge label="SCHIZOSOL" accentRgb="20,241,149" />
          <OptionCard
            onClick={() => { }}
            accent="#14F195"
            accentRgb="20,241,149"
            icon="⛓️"
            title="SchizoSol"
            subtitle="The Solana integration expands the madness"
            tag={t('menu.coming_soon')}
            disabled
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Reusable collection section badge ──────────────────────────────────────

function CollectionBadge({ label, accentRgb }: { label: string; accentRgb: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 12,
    }}>
      <div style={{
        background: `rgba(${accentRgb},0.1)`,
        border: `1px solid rgba(${accentRgb},0.25)`,
        borderRadius: 8, padding: '4px 12px',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        color: `rgba(${accentRgb},0.7)`,
        fontFamily: "'Space Grotesk', sans-serif",
        textTransform: 'uppercase' as const,
      }}>
        ⬡ {label} Collection
      </div>
    </div>
  );
}

// ─── Reusable horizontal option card ───────────────────────────────────────────

interface OptionCardProps {
  onClick: () => void;
  accent: string;
  accentRgb: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tag: string;
  disabled?: boolean;
}

function OptionCard({ onClick, accent, accentRgb, icon, title, subtitle, tag, disabled }: OptionCardProps) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isClicked, setIsClicked] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isClicked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const degX = (y - centerY) / 8;
    const degY = (centerX - x) / 12;
    setRotateX(degX);
    setRotateY(degY);
  };

  const handleMouseLeave = () => {
    if (isClicked) return;
    setRotateX(0);
    setRotateY(0);
  };

  const handleClick = () => {
    if (disabled || isClicked) return;
    sfx.cardClick();
    setIsClicked(true);
    setTimeout(() => {
      onClick();
      // Reset after transition complete (if staying on screen)
      // setIsClicked(false); 
    }, 300);
  };

  return (
    <div style={{ perspective: '800px', width: '100%' }}>
      <motion.button
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={isClicked
          ? { rotateX: 60, opacity: 0, y: 20, scale: 0.95 }
          : { rotateX, rotateY, opacity: 1, y: 0, scale: 1 }
        }
        whileHover={(disabled || isClicked) ? {} : { scale: 1.02 }}
        whileTap={(disabled || isClicked) ? {} : { scale: 0.98, rotateX: 0, rotateY: 0 }}
        transition={{
          type: isClicked ? 'spring' : 'tween',
          stiffness: 300,
          damping: 20,
          duration: isClicked ? 0.3 : 0.1
        }}
        style={{
          position: 'relative',
          background: disabled
            ? 'rgba(255,255,255,0.03)'
            : `linear-gradient(145deg, rgba(${accentRgb},0.2) 0%, rgba(${accentRgb},0.08) 100%)`,
          border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : `rgba(${accentRgb},0.45)`}`,
          borderRadius: 18,
          padding: '20px 22px',
          cursor: (disabled || isClicked) ? 'not-allowed' : 'pointer',
          outline: 'none',
          textAlign: 'left',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          opacity: disabled ? 0.4 : 1,
          boxShadow: (disabled || isClicked)
            ? '0 4px 12px rgba(0,0,0,0.2)'
            : `0 12px 28px rgba(0,0,0,0.35), 0 0 0 1px rgba(${accentRgb}, 0.1), inset 0 1px 1px rgba(255,255,255,0.1)`,
          transformStyle: 'preserve-3d',
          transformOrigin: 'bottom center',
          fontFamily: "'Space Grotesk', sans-serif",
          overflow: 'hidden',
        }}
      >
        {/* Shine/Reflection effect */}
        {!disabled && !isClicked && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.05) 100%)',
            pointerEvents: 'none',
            zIndex: 1,
          }} />
        )}

        {/* Noise texture overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          opacity: 0.04, mixBlendMode: 'overlay',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* Icon slot - recessed look */}
        <div style={{
          width: 56, height: 56, borderRadius: 14, flexShrink: 0,
          background: disabled ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.25)',
          border: `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : `rgba(${accentRgb},0.3)`}`,
          boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
          color: (disabled || isClicked) ? 'rgba(255,255,254,0.2)' : accent,
          zIndex: 2,
          position: 'relative',
          transform: 'translateZ(20px)',
        }} >
          {icon}
        </div>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0, zIndex: 2, transform: 'translateZ(10px)' }}>
          <div style={{
            fontSize: 16, fontWeight: 800,
            color: (disabled || isClicked) ? 'rgba(255,255,254,0.3)' : '#FFFFFE',
            letterSpacing: '-0.02em', marginBottom: 4,
            textShadow: (disabled || isClicked) ? 'none' : '0 2px 4px rgba(0,0,0,0.3)',
          }}>
            {title}
          </div>
          <div style={{
            fontSize: 12, color: 'rgba(255,255,254,0.35)',
            fontWeight: 400, lineHeight: 1.45,
          }}>
            {subtitle}
          </div>
        </div>

        {/* Tag - floating forward */}
        <div style={{
          flexShrink: 0,
          background: (disabled || isClicked) ? 'rgba(255,255,255,0.04)' : `rgba(${accentRgb},0.25)`,
          border: `1px solid ${(disabled || isClicked) ? 'rgba(255,255,255,0.06)' : `rgba(${accentRgb},0.5)`}`,
          borderRadius: 8, padding: '4px 11px',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
          color: (disabled || isClicked) ? 'rgba(255,255,254,0.2)' : '#FFF',
          textTransform: 'uppercase' as const,
          zIndex: 3,
          transform: 'translateZ(30px)',
          boxShadow: (disabled || isClicked) ? 'none' : `0 4px 12px rgba(0,0,0,0.25), 0 0 10px rgba(${accentRgb}, 0.2)`,
        }}>
          {tag}
        </div>
      </motion.button>
    </div>
  );
}

// ─── Login Button Section ──────────────────────────────────────────────────

function LoginButtonSection() {
  const { t } = useTranslation();
  const status = useWalletStatus();
  const address = useWalletAddress();
  const { connectWallet } = useWalletConnection();
  const isConnected = status === 'connected' || status === 'ready' || status === 'loading_nfts';
  const isConnecting = status === 'connecting' || status === 'loading_nfts';

  if (isConnected && address) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0 }}
      style={{ marginBottom: 8 }}
    >
      <motion.button
        onClick={connectWallet}
        disabled={isConnecting}
        whileHover={isConnecting ? {} : { scale: 1.04, filter: 'brightness(1.1)', boxShadow: '0 0 40px rgba(124,58,237,0.45)' }}
        whileTap={isConnecting ? {} : { scale: 0.97 }}
        style={{
          background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
          border: '1px solid rgba(124,58,237,0.5)',
          borderRadius: 12,
          padding: '12px 32px',
          color: '#FFFFFE',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: 15,
          cursor: isConnecting ? 'wait' : 'pointer',
          opacity: isConnecting ? 0.7 : 1,
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 0 20px rgba(124,58,237,0.25)',
        }}
      >
        {isConnecting ? <><Spinner /> {t('auth.authenticating')}</> : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, opacity: 0.9 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            {t('auth.login')}
          </>
        )}
      </motion.button>
    </motion.div>
  );
}

function Spinner({ large }: { large?: boolean }) {
  const size = large ? 32 : 14;
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      style={{
        width: size, height: size,
        border: `${large ? 3 : 2}px solid rgba(255,255,254,0.2)`,
        borderTopColor: '#FFFFFE',
        borderRadius: '50%',
      }}
    />
  );
}

function LoadingOverlay({ loading, status }: { loading: boolean; status: string }) {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 14, 23, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            pointerEvents: 'auto',
          }}
        >
          <Card style={{ padding: '40px 60px', textAlign: 'center', minWidth: 280 }}>
            <Spinner large />
            <div style={{
              marginTop: 24,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 18,
              color: '#FFFFFE',
              letterSpacing: '-0.01em',
            }}>
              {status || 'Loading...'}
            </div>
            <div style={{
              marginTop: 8,
              fontSize: 12,
              color: 'rgba(255,255,254,0.4)',
            }}>
              Please wait while we sync with the blockchain
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: 16,
      padding: 24,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      ...style,
    }}>
      {children}
    </div>
  );
}
