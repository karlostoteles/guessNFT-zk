import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useWinner, useGuessedCharacterId, useGameActions, usePlayerState, useGameCharacters, useGameMode, useGameSessionId, usePhase } from '@/core/store/selectors';
import { useCharacterPreviews } from '@/shared/hooks/useCharacterPreviews';
import { GamePhase } from '@/core/store/types';
import { COLORS } from '@/core/rules/constants';
import { sfx } from '@/shared/audio/sfx';
import { getCommitment, verifyReveal, opponentWonOnChain } from '@/services/starknet/commitReveal';
import { useOnlinePlayerNum } from '@/core/store/selectors';

export function ResultScreen() {
  const winner = useWinner();
  const phase = usePhase();
  const guessedId = useGuessedCharacterId();
  const mode = useGameMode();
  const gameSessionId = useGameSessionId();

  // Identify local player (must be before isMyWin)
  const playerNum = useOnlinePlayerNum();
  const myPlayer = mode === 'online' ? (playerNum === 2 ? 'player2' : 'player1') : 'player1';

  const isDraw = winner === null;
  const isMyWin = !isDraw && winner === myPlayer;

  useEffect(() => {
    if (isDraw || isMyWin) sfx.win();
    else sfx.lose();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { resetGame } = useGameActions();
  const p1State = usePlayerState('player1');
  const p2State = usePlayerState('player2');
  const characters = useGameCharacters();
  const previews = useCharacterPreviews();

  // In NFT mode: verify both players honoured their commitments
  const [p1Verified, setP1Verified] = useState<boolean | null>(null);
  const [p2Verified, setP2Verified] = useState<boolean | null>(null);

  const [conceding, setConceding] = useState(false);
  const [conceded, setConceded] = useState(false);

  useEffect(() => {
    if (mode !== 'nft') return;
    if (p1State.secretCharacterId) {
      const c = getCommitment('player1', gameSessionId);
      if (c) setP1Verified(verifyReveal('player1', p1State.secretCharacterId, c.salt, gameSessionId));
    }
    if (p2State.secretCharacterId) {
      const c = getCommitment('player2', gameSessionId);
      if (c) setP2Verified(verifyReveal('player2', p2State.secretCharacterId, c.salt, gameSessionId));
    }
  }, [mode, gameSessionId, p1State.secretCharacterId, p2State.secretCharacterId]);

  // Only render in final phases
  const isFinalPhase = phase === GamePhase.GUESS_RESULT || phase === GamePhase.GAME_OVER;
  if (!isFinalPhase) return null;

  const winnerLabel = isDraw ? null : winner === 'player1' ? 'Player 1' : 'CPU / Player 2';
  const winnerColor = isDraw
    ? '#E8A444'
    : winner === 'player1' ? COLORS.player1.primary : COLORS.player2.primary;

  const p1Secret = characters.find((c) => c.id === p1State.secretCharacterId);
  const p2Secret = characters.find((c) => c.id === p2State.secretCharacterId);
  const guessedChar = characters.find((c) => c.id === guessedId);
  const showCommitProof = mode === 'nft' && (p1Verified !== null || p2Verified !== null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 30,
      }}
    >
      <Card style={{ textAlign: 'center', maxWidth: 480, position: 'relative', overflow: 'hidden' }}>
        {/* Floating confetti */}
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 0, x: (Math.random() - 0.5) * 200 }}
            animate={{ opacity: [0, 1, 0], y: [0, -140 - Math.random() * 250], x: (Math.random() - 0.5) * 400, rotate: Math.random() * 720 }}
            transition={{ duration: 2.5 + Math.random(), delay: Math.random() * 0.6, repeat: Infinity, repeatDelay: Math.random() * 2 }}
            style={{
              position: 'absolute',
              width: Math.random() > 0.5 ? 8 : 5,
              height: Math.random() > 0.5 ? 8 : 5,
              borderRadius: Math.random() > 0.5 ? '50%' : 2,
              background: ['#E8A444', '#44A8E8', '#4CAF50', '#E05555', '#9C27B0', '#FF6B6B', '#FACC15'][i % 7],
              left: '50%', bottom: '50%',
              pointerEvents: 'none',
            }}
          />
        ))}

        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }}
        >
          {/* Trophy / handshake icon */}
          <div style={{ fontSize: 56, marginBottom: 8 }}>
            {isDraw ? '🤝' : '🏆'}
          </div>

          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 40,
            fontWeight: 800,
            color: winnerColor,
            textShadow: `0 0 60px ${winnerColor}60`,
            marginBottom: 6,
          }}>
            {isDraw ? 'DRAW!' : `${winnerLabel} Wins!`}
          </div>

          {isDraw && (
            <div style={{ fontSize: 14, color: 'rgba(255,255,254,0.45)', marginBottom: 24 }}>
              Both guessed correctly at the same time
            </div>
          )}

          {!isDraw && guessedChar && (
            <div style={{ fontSize: 14, color: 'rgba(255,255,254,0.45)', marginBottom: 24 }}>
              Correctly guessed <strong style={{ color: '#FFFFFE' }}>{guessedChar.name}</strong>
            </div>
          )}

          {/* Secret character reveal */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 20,
            marginBottom: 32,
          }}>
            {[
              { label: "P1's Secret", secret: p1Secret, color: COLORS.player1.primary },
              { label: "P2's Secret", secret: p2Secret, color: COLORS.player2.primary },
            ].map(({ label, secret, color }) => secret && (
              <motion.div
                key={secret.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                style={{ textAlign: 'center' }}
              >
                {/* Portrait thumbnail */}
                {previews.get(secret.id) && (
                  <div style={{
                    width: 120,
                    height: 120,
                    borderRadius: 14,
                    overflow: 'hidden',
                    border: `3px solid ${color}80`,
                    marginBottom: 10,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    boxShadow: `0 4px 24px ${color}30`,
                  }}>
                    <img
                      src={previews.get(secret.id)}
                      alt={secret.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div style={{ fontSize: 11, color, marginBottom: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: '#FFFFFE' }}>
                  {secret.name}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Commit-reveal integrity badge (NFT mode only) */}
          {showCommitProof && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 20,
                padding: '8px 16px',
                background: p1Verified && p2Verified
                  ? 'rgba(76, 175, 80, 0.12)'
                  : 'rgba(224, 85, 85, 0.12)',
                border: `1px solid ${p1Verified && p2Verified ? 'rgba(76,175,80,0.3)' : 'rgba(224,85,85,0.3)'}`,
                borderRadius: 10,
              }}
            >
              <span style={{ fontSize: 14 }}>
                {p1Verified && p2Verified ? '✅' : '⚠️'}
              </span>
              <span style={{
                fontSize: 11,
                color: p1Verified && p2Verified
                  ? 'rgba(76,175,80,0.9)'
                  : 'rgba(224,85,85,0.9)',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}>
                {p1Verified && p2Verified
                  ? 'Commit-reveal verified — fair play confirmed'
                  : 'Commitment mismatch detected!'}
              </span>
            </motion.div>
          )}

          {(mode === 'nft' || mode === 'online') && !isDraw && winner !== myPlayer && !conceded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} style={{ marginBottom: 20 }}>
              <Button
                variant={conceding ? 'secondary' : 'primary'}
                size="lg"
                disabled={conceding}
                style={{ backgroundColor: conceding ? undefined : '#E05555', color: '#fff' }}
                onClick={async () => {
                  try {
                    setConceding(true);
                    await opponentWonOnChain(gameSessionId);
                    setConceded(true);
                  } catch (err) {
                    console.error(err);
                    alert('Failed to surrender NFT. Check console.');
                  } finally {
                    setConceding(false);
                  }
                }}
              >
                {conceding ? 'Transferring NFT...' : 'I Lost (Surrender NFT)'}
              </Button>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
                Requires Cartridge Session authorization.
              </div>
            </motion.div>
          )}

          <Button variant="accent" size="lg" onClick={resetGame}>
            Play Again
          </Button>
        </motion.div>
      </Card>
    </motion.div>
  );
}
