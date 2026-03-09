import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Card } from '@/ui/common';
import { useCharacterPreviews } from '@/shared/hooks/useCharacterPreviews';
import {
  useActivePlayer,
  useEliminatedIds,
  useGameActions,
  useGameCharacters,
} from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';

export function ZKGuessPanel() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { zkMakeGuess, setPhase } = useGameActions();
  const activePlayer = useActivePlayer();
  const eliminated = useEliminatedIds(activePlayer);
  const characters = useGameCharacters();
  const previews = useCharacterPreviews();

  const eliminatedSet = useMemo(() => new Set(eliminated), [eliminated]);
  const candidates = useMemo(
    () => characters.filter((character) => !eliminatedSet.has(character.id)),
    [characters, eliminatedSet],
  );

  function submitGuess() {
    if (!selectedId) return;
    zkMakeGuess(selectedId);
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
        zIndex: 30,
        background: 'rgba(0,0,0,0.9)',
      }}
    >
      <Card style={{ width: 'min(900px, 100%)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 24, color: '#FF6B6B' }}>
            Final Guess
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.45)' }}>
            Guess is resolved on-chain. Wrong guesses return to the next turn.
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
            {candidates.map((character) => {
              const selected = selectedId === character.id;
              const image = previews.get(character.id) ?? (character as any).imageUrl;
              return (
                <button
                  key={character.id}
                  onClick={() => setSelectedId(character.id)}
                  style={{
                    borderRadius: 10,
                    border: selected ? '2px solid rgba(224,85,85,0.8)' : '1px solid rgba(255,255,255,0.12)',
                    background: selected ? 'rgba(224,85,85,0.18)' : 'rgba(255,255,255,0.04)',
                    padding: 6,
                    color: '#FFFFFE',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden' }}>
                    {image ? (
                      <img
                        src={image}
                        alt={character.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : null}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {character.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={() => setPhase(GamePhase.QUESTION_SELECT)}>
            Back
          </Button>
          <Button variant="no" size="sm" onClick={submitGuess} disabled={!selectedId}>
            Submit Guess
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
