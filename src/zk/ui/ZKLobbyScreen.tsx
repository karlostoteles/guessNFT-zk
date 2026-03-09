import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Card } from '@/ui/common';
import { useGameActions } from '@/core/store/selectors';
import {
  generateAllCollectionCharacters,
  generatePlayableCollectionCharacters,
  PLAYABLE_COLLECTION_SIZE,
} from '@/services/starknet/collectionService';
import { loadCollectionData } from '@/zk/collectionData';
import { createGameOnChain, joinGameOnChain } from '@/zk/useZKAnswer';

export function ZKLobbyScreen() {
  const {
    setGameMode,
    setOnlineGame,
    setStarknetGameId,
    clearProofError,
    startSetup,
  } = useGameActions();

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

  const canInteract = !loadingData && !creating && !joining && !continuing;

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
    try {
      const gameId = await createGameOnChain(selectedPlayerNum);
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
    try {
      await joinGameOnChain(normalizedJoinId, selectedPlayerNum);
      await bootstrapLocalStore(normalizedJoinId, selectedPlayerNum, true);
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
    try {
      await bootstrapLocalStore(createdGameId, selectedPlayerNum, true);
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 20,
        background: 'radial-gradient(circle at 50% 20%, rgba(232,164,68,0.12), rgba(15,14,23,0.9) 55%)',
      }}
    >
      <Card style={{ width: 'min(560px, 100%)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 800,
              fontSize: 28,
              color: '#E8A444',
            }}
          >
            ZK On-Chain Lobby
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,254,0.5)' }}>
            Create or join a Starknet game and play with ZK-verified answers.
          </div>
        </div>

        {isDev && (
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
    </motion.div>
  );
}
