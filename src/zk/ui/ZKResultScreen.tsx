import { motion } from 'framer-motion';
import { Button, Card } from '@/ui/common';
import { useCharacterPreviews } from '@/shared/hooks/useCharacterPreviews';
import {
  useGameActions,
  useGameCharacters,
  usePlayerState,
  useWinner,
} from '@/core/store/selectors';

export function ZKResultScreen() {
  const winner = useWinner();
  const { resetGame } = useGameActions();
  const characters = useGameCharacters();
  const previews = useCharacterPreviews();
  const p1 = usePlayerState('player1');
  const p2 = usePlayerState('player2');

  const p1Character = characters.find((character) => character.id === p1.secretCharacterId) ?? null;
  const p2Character = characters.find((character) => character.id === p2.secretCharacterId) ?? null;

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
        zIndex: 40,
        background: 'rgba(0,0,0,0.9)',
      }}
    >
      <Card style={{ width: 'min(620px, 100%)', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 6 }}>{winner ? '🏆' : '🤝'}</div>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 800,
            fontSize: 30,
            color: winner ? '#E8A444' : '#FFFFFE',
            marginBottom: 4,
          }}
        >
          {winner ? `${winner} wins` : 'Draw'}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.45)', marginBottom: 18 }}>
          ZK Verified
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Player 1 secret', character: p1Character, color: 'rgba(232,164,68,0.9)' },
            { label: 'Player 2 secret', character: p2Character, color: 'rgba(68,168,232,0.9)' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
                padding: 10,
              }}
            >
              <div style={{ fontSize: 11, color: item.color, marginBottom: 6 }}>{item.label}</div>
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.05)',
                  marginBottom: 6,
                }}
              >
                {item.character ? (
                  <img
                    src={previews.get(item.character.id) ?? (item.character as any).imageUrl}
                    alt={item.character.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : null}
              </div>
              <div style={{ fontSize: 12, color: '#FFFFFE' }}>{item.character?.name ?? '-'}</div>
            </div>
          ))}
        </div>

        <Button variant="accent" size="md" onClick={resetGame}>Play Again</Button>
      </Card>
    </motion.div>
  );
}
