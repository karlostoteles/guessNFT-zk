import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Card } from '@/ui/common';
import { useCharacterPreviews } from '@/shared/hooks/useCharacterPreviews';
import {
  useGameActions,
  useGameCharacters,
  useOnlinePlayerNum,
  usePlayerState,
} from '@/core/store/selectors';

export function ZKCharacterSelect() {
  const characters = useGameCharacters();
  const playerNum = useOnlinePlayerNum() ?? 1;
  const playerId = playerNum === 2 ? 'player2' : 'player1';
  const playerState = usePlayerState(playerId);
  const previews = useCharacterPreviews();
  const { zkSelectSecretCharacter } = useGameActions();

  const [selectedId, setSelectedId] = useState<string | null>(playerState.secretCharacterId);
  const [submitting, setSubmitting] = useState(false);

  const sorted = useMemo(
    () => [...characters].sort((a, b) => a.name.localeCompare(b.name)),
    [characters],
  );

  async function confirmSelection() {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    try {
      zkSelectSecretCharacter(playerId, selectedId);
    } finally {
      setSubmitting(false);
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
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Card style={{ width: 'min(980px, 100%)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 800,
              fontSize: 24,
              color: '#E8A444',
            }}
          >
            Choose Your Secret Schizodio
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,254,0.45)' }}>
            Pick one character. Commitment is generated locally, then submitted on-chain.
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
              gap: 8,
            }}
          >
            {sorted.map((character) => {
              const selected = selectedId === character.id;
              const image = previews.get(character.id) ?? (character as any).imageUrl;
              return (
                <button
                  key={character.id}
                  onClick={() => setSelectedId(character.id)}
                  style={{
                    borderRadius: 10,
                    border: selected
                      ? '2px solid rgba(232,164,68,0.8)'
                      : '1px solid rgba(255,255,255,0.12)',
                    background: selected ? 'rgba(232,164,68,0.12)' : 'rgba(255,255,255,0.04)',
                    padding: 6,
                    cursor: 'pointer',
                    color: '#FFFFFE',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={character.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : null}
                  </div>
                  <div
                    style={{
                      marginTop: 5,
                      fontSize: 10,
                      fontFamily: "'Space Grotesk', sans-serif",
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {character.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.4)' }}>
            {selectedId ? `Selected: ${selectedId}` : 'Select a character to continue'}
          </div>
          <Button
            variant="accent"
            size="md"
            onClick={confirmSelection}
            disabled={!selectedId || submitting}
          >
            {submitting ? 'Committing...' : 'Confirm Character'}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
