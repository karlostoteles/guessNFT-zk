import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Card } from '@/ui/common';
import { useGameActions } from '@/core/store/selectors';
import {
  generateAllCollectionCharacters,
  generatePlayableCollectionCharacters,
  PLAYABLE_COLLECTION_SIZE,
} from '@/services/starknet/collectionService';
import { loadCollectionData } from '@/zk/collectionData';
import { createGameOnChain, joinGameOnChain } from '@/zk/useZKAnswer';
import { useWalletAddress, useWalletUsername, useWalletStatus } from '@/services/starknet/walletStore';
import { useWalletConnection } from '@/services/starknet/hooks';

// ─── Flow Step Component ────────────────────────────────────────────────────

function FlowStep({
  num,
  title,
  desc,
  accent,
  delay,
}: {
  num: number;
  title: string;
  desc: string;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: `rgba(${accent},0.15)`,
          border: `1px solid rgba(${accent},0.35)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 800,
          color: `rgb(${accent})`,
          fontFamily: "'Space Grotesk', sans-serif",
          flexShrink: 0,
        }}
      >
        {num}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#FFFFFE',
            fontFamily: "'Space Grotesk', sans-serif",
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'rgba(255,255,254,0.45)',
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Connector line between flow steps ──────────────────────────────────────

function FlowConnector({ accent, delay }: { accent: string; delay: number }) {
  return (
    <motion.div
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ delay, duration: 0.3 }}
      style={{
        width: 2,
        height: 20,
        marginLeft: 15,
        background: `linear-gradient(to bottom, rgba(${accent},0.3), rgba(${accent},0.08))`,
        transformOrigin: 'top',
      }}
    />
  );
}

// ─── Main Lobby Screen ──────────────────────────────────────────────────────

export function ZKLobbyScreen() {
  const {
    setGameMode,
    setOnlineGame,
    setStarknetGameId,
    clearProofError,
    startSetup,
  } = useGameActions();

  const [view, setView] = useState<'welcome' | 'lobby'>('welcome');
  const [loadingData, setLoadingData] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameIdInput, setGameIdInput] = useState('');
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [selectedPlayerNum, setSelectedPlayerNum] = useState<1 | 2>(1);

  const isDev = import.meta.env.DEV;
  const walletAddress = useWalletAddress();
  const walletUsername = useWalletUsername();
  const walletStatus = useWalletStatus();
  const { connectWallet } = useWalletConnection();
  const isWalletConnected = !isDev && !!walletAddress;

  useEffect(() => {
    let mounted = true;
    setLoadingData(true);
    Promise.all([loadCollectionData(), generateAllCollectionCharacters()])
      .catch((err) => {
        console.error('[zk-lobby] preload failed:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingData(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const canInteract = !loadingData && !creating && !joining && !continuing && (isDev || isWalletConnected);

  const normalizedJoinId = useMemo(() => {
    const raw = gameIdInput.trim();
    if (!raw) return '';
    return raw.startsWith('0x') ? raw : `0x${raw}`;
  }, [gameIdInput]);

  async function bootstrapLocalStore(
    gameId: string,
    playerNum: 1 | 2,
    enterSetup: boolean,
  ) {
    const characters = await generatePlayableCollectionCharacters(gameId, PLAYABLE_COLLECTION_SIZE);
    clearProofError();
    setGameMode('zk-online', characters);
    setOnlineGame(gameId, '', playerNum);
    setStarknetGameId(gameId);
    if (enterSetup) {
      startSetup();
    }
  }

  async function handleCreate() {
    setError(null);
    setCreating(true);
    const creatorPlayerNum: 1 | 2 = isDev ? selectedPlayerNum : 1;
    try {
      const gameId = await createGameOnChain(creatorPlayerNum);
      setCopied(false);
      setCreatedGameId(gameId);
      setGameIdInput(gameId);
      setShowJoinInput(false);
    } catch (err) {
      console.error('[zk-lobby] create failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (!normalizedJoinId) {
      setError('Enter a game ID to join');
      return;
    }

    setError(null);
    setJoining(true);
    const joinerPlayerNum: 1 | 2 = isDev ? selectedPlayerNum : 2;
    try {
      await joinGameOnChain(normalizedJoinId, joinerPlayerNum);
      await bootstrapLocalStore(normalizedJoinId, joinerPlayerNum, true);
    } catch (err) {
      console.error('[zk-lobby] join failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setJoining(false);
    }
  }

  async function handleContinueAsCreator() {
    if (!createdGameId) return;
    setError(null);
    setContinuing(true);
    const creatorPlayerNum: 1 | 2 = isDev ? selectedPlayerNum : 1;
    try {
      await bootstrapLocalStore(createdGameId, creatorPlayerNum, true);
    } catch (err) {
      console.error('[zk-lobby] continue failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setContinuing(false);
    }
  }

  async function handleCopyCode() {
    if (!createdGameId) return;
    try {
      await navigator.clipboard.writeText(createdGameId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy the game ID automatically. Please copy it manually.');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'auto',
        zIndex: 20,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(232,164,68,0.08) 0%, rgba(15,14,23,0.95) 50%)',
      }}
    >
      <AnimatePresence mode="wait">
        {view === 'welcome' ? (
          <WelcomeView key="welcome" onPlay={() => setView('lobby')} />
        ) : (
          <LobbyView
            key="lobby"
            onBack={() => setView('welcome')}
            isDev={isDev}
            walletAddress={walletAddress}
            walletUsername={walletUsername}
            walletStatus={walletStatus}
            isWalletConnected={isWalletConnected}
            connectWallet={connectWallet}
            canInteract={canInteract}
            loadingData={loadingData}
            creating={creating}
            joining={joining}
            continuing={continuing}
            error={error}
            gameIdInput={gameIdInput}
            setGameIdInput={setGameIdInput}
            normalizedJoinId={normalizedJoinId}
            createdGameId={createdGameId}
            copied={copied}
            showJoinInput={showJoinInput}
            setShowJoinInput={setShowJoinInput}
            setError={setError}
            setCreatedGameId={setCreatedGameId}
            selectedPlayerNum={selectedPlayerNum}
            setSelectedPlayerNum={setSelectedPlayerNum}
            handleCreate={handleCreate}
            handleJoin={handleJoin}
            handleContinueAsCreator={handleContinueAsCreator}
            handleCopyCode={handleCopyCode}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Welcome View ───────────────────────────────────────────────────────────

function WelcomeView({ onPlay }: { onPlay: () => void }) {
  const AMBER = '232,164,68';
  const PURPLE = '167,139,250';
  const GREEN = '76,175,80';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 20px 40px',
        minHeight: '100%',
      }}
    >
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
        style={{ textAlign: 'center', marginBottom: 8 }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'rgba(232,164,68,0.7)',
            fontFamily: "'Space Grotesk', sans-serif",
            marginBottom: 8,
          }}
        >
          guessNFT
        </div>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(28px, 7vw, 40px)',
            fontWeight: 800,
            color: '#FFFFFE',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          ZK Privacy Mode
        </h1>
        <div
          style={{
            fontSize: 14,
            color: 'rgba(255,255,254,0.5)',
            marginTop: 10,
            maxWidth: 360,
            lineHeight: 1.6,
          }}
        >
          Play the classic guessing game with zero-knowledge proofs.
          Your answers are verified on-chain without revealing your secret character.
        </div>
      </motion.div>

      {/* Divider */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        style={{
          width: 'clamp(100px, 30vw, 180px)',
          height: 1,
          background: `linear-gradient(90deg, transparent, rgba(${AMBER},0.35), transparent)`,
          margin: '28px 0',
        }}
      />

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{
          width: 'min(440px, 100%)',
          marginBottom: 32,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,254,0.3)',
            fontFamily: "'Space Grotesk', sans-serif",
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          How the Privacy Engine Works
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          <FlowStep
            num={1}
            title="Commit Your Character"
            desc="You pick a secret character and commit its hash on-chain. Nobody can see your choice."
            accent={AMBER}
            delay={0.5}
          />
          <FlowConnector accent={AMBER} delay={0.6} />

          <FlowStep
            num={2}
            title="Opponent Asks a Trait Question"
            desc={'"Does your character have sunglasses?" — the question is recorded on the Starknet blockchain.'}
            accent={PURPLE}
            delay={0.7}
          />
          <FlowConnector accent={PURPLE} delay={0.8} />

          <FlowStep
            num={3}
            title="Generate a ZK Proof"
            desc="Your browser generates a zero-knowledge proof locally using Noir circuits. The proof confirms the answer is correct for your committed character, without revealing which character it is."
            accent={GREEN}
            delay={0.9}
          />
          <FlowConnector accent={GREEN} delay={1.0} />

          <FlowStep
            num={4}
            title="On-Chain Verification"
            desc="The Garaga verifier contract on Starknet validates the proof. If valid, the answer is accepted — fully trustless, no cheating possible."
            accent={AMBER}
            delay={1.1}
          />
          <FlowConnector accent={AMBER} delay={1.2} />

          <FlowStep
            num={5}
            title="Guess & Reveal"
            desc="When you're ready to guess, reveal your character on-chain and the contract verifies it matches your original commitment."
            accent={PURPLE}
            delay={1.3}
          />
        </div>
      </motion.div>

      {/* Play Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, type: 'spring', stiffness: 200, damping: 20 }}
        style={{ width: 'min(440px, 100%)' }}
      >
        <motion.button
          onClick={onPlay}
          whileHover={{ scale: 1.03, boxShadow: '0 0 48px rgba(232,164,68,0.3)' }}
          whileTap={{ scale: 0.97 }}
          style={{
            width: '100%',
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #E8A444, #D4913A)',
            border: '1px solid rgba(232,164,68,0.6)',
            borderRadius: 14,
            color: '#0f0e17',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 18,
            fontWeight: 800,
            cursor: 'pointer',
            outline: 'none',
            boxShadow: '0 0 24px rgba(232,164,68,0.2), 0 4px 16px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Start Playing
        </motion.button>
      </motion.div>

      {/* Footer badge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        style={{
          marginTop: 28,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          fontSize: 11,
          color: 'rgba(255,255,254,0.25)',
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <span>Starknet</span>
        <span style={{ opacity: 0.3 }}>|</span>
        <span>Noir Circuits</span>
        <span style={{ opacity: 0.3 }}>|</span>
        <span>Garaga Verifier</span>
      </motion.div>
    </motion.div>
  );
}

// ─── Lobby View (Create / Join game) ────────────────────────────────────────

interface LobbyViewProps {
  onBack: () => void;
  isDev: boolean;
  walletAddress: string | null;
  walletUsername: string | null;
  walletStatus: string;
  isWalletConnected: boolean;
  connectWallet: () => void;
  canInteract: boolean;
  loadingData: boolean;
  creating: boolean;
  joining: boolean;
  continuing: boolean;
  error: string | null;
  gameIdInput: string;
  setGameIdInput: (v: string) => void;
  normalizedJoinId: string;
  createdGameId: string | null;
  copied: boolean;
  showJoinInput: boolean;
  setShowJoinInput: (v: boolean) => void;
  setError: (v: string | null) => void;
  setCreatedGameId: (v: string | null) => void;
  selectedPlayerNum: 1 | 2;
  setSelectedPlayerNum: (v: 1 | 2) => void;
  handleCreate: () => void;
  handleJoin: () => void;
  handleContinueAsCreator: () => void;
  handleCopyCode: () => void;
}

function LobbyView({
  onBack,
  isDev,
  walletAddress,
  walletUsername,
  walletStatus,
  isWalletConnected,
  connectWallet,
  canInteract,
  loadingData,
  creating,
  joining,
  continuing,
  error,
  gameIdInput,
  setGameIdInput,
  normalizedJoinId,
  createdGameId,
  copied,
  showJoinInput,
  setShowJoinInput,
  setError,
  setCreatedGameId,
  selectedPlayerNum,
  setSelectedPlayerNum,
  handleCreate,
  handleJoin,
  handleContinueAsCreator,
  handleCopyCode,
}: LobbyViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        padding: 20,
      }}
    >
      <div style={{ width: 'min(560px, 100%)' }}>
        {/* Back button */}
        <motion.button
          onClick={onBack}
          whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.95 }}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '8px 14px',
            cursor: 'pointer',
            outline: 'none',
            color: 'rgba(255,255,254,0.55)',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 20,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </motion.button>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 800,
                fontSize: 24,
                color: '#E8A444',
              }}
            >
              ZK Game Lobby
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,254,0.5)' }}>
              Create or join a Starknet game with ZK-verified answers.
            </div>
          </div>

          {isDev ? (
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'center',
                alignItems: 'center',
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                fontSize: 12,
              }}
            >
              <span style={{ color: 'rgba(255,255,254,0.45)' }}>Katana account</span>
              <Button
                size="sm"
                variant={selectedPlayerNum === 1 ? 'accent' : 'secondary'}
                onClick={() => setSelectedPlayerNum(1)}
              >
                P1
              </Button>
              <Button
                size="sm"
                variant={selectedPlayerNum === 2 ? 'accent' : 'secondary'}
                onClick={() => setSelectedPlayerNum(2)}
              >
                P2
              </Button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'center',
                alignItems: 'center',
                padding: '10px 12px',
                background: isWalletConnected ? 'rgba(76,175,80,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isWalletConnected ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
                fontSize: 12,
              }}
            >
              {isWalletConnected ? (
                <>
                  <span style={{ color: '#4CAF50', fontWeight: 600 }}>
                    {walletUsername ?? `${walletAddress!.slice(0, 8)}...${walletAddress!.slice(-6)}`}
                  </span>
                  <span style={{ color: 'rgba(255,255,254,0.3)' }}>connected</span>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="accent"
                  onClick={() => connectWallet()}
                  disabled={walletStatus === 'connecting'}
                >
                  {walletStatus === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            <Button
              variant="accent"
              size="lg"
              onClick={handleCreate}
              disabled={!canInteract}
            >
              {creating ? 'Creating game...' : 'Create Game'}
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                setError(null);
                setShowJoinInput(true);
                setCreatedGameId(null);
              }}
              disabled={!canInteract}
            >
              Join Game
            </Button>
          </div>

          {showJoinInput && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: 10,
              }}
            >
              <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.6)' }}>
                Paste game ID and click Play Game
              </div>
              <input
                value={gameIdInput}
                onChange={(e) => setGameIdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="0x..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  outline: 'none',
                  color: '#FFFFFE',
                  fontFamily: "'Space Grotesk', monospace",
                  fontSize: 13,
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowJoinInput(false)}
                  disabled={joining}
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={handleJoin}
                  disabled={!canInteract || !normalizedJoinId}
                  style={{ flex: 1 }}
                >
                  {joining ? 'Joining...' : 'Play Game'}
                </Button>
              </div>
            </div>
          )}

          {loadingData && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.4)', textAlign: 'center' }}>
              Loading Schizodio collection and bitmap data...
            </div>
          )}

          {createdGameId && (
            <div
              style={{
                background: 'rgba(232,164,68,0.08)',
                border: '1px solid rgba(232,164,68,0.25)',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 11, color: 'rgba(232,164,68,0.75)', marginBottom: 4 }}>
                Created game ID
              </div>
              <div
                style={{
                  fontFamily: "'Space Grotesk', monospace",
                  fontSize: 12,
                  color: '#E8A444',
                  wordBreak: 'break-all',
                }}
              >
                {createdGameId}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyCode}
                >
                  {copied ? 'Copied' : 'Copy code'}
                </Button>
                <Button
                  size="sm"
                  variant="accent"
                  onClick={handleContinueAsCreator}
                  disabled={continuing}
                >
                  {continuing ? 'Opening setup...' : 'Play Game'}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                background: 'rgba(224,85,85,0.12)',
                border: '1px solid rgba(224,85,85,0.3)',
                borderRadius: 10,
                padding: '10px 12px',
                color: '#FF9A9A',
                fontSize: 12,
                wordBreak: 'break-word',
              }}
            >
              {error}
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
