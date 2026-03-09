import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useCharacterPreviews } from '@/shared/hooks/useCharacterPreviews';
import {
  useGameCharacters,
  useOnlinePlayerNum,
  usePlayerState,
  useQuestionHistory,
} from '@/core/store/selectors';
import { findSchizodioQuestion } from '@/zk/zkStore';

export function ZKSecretCard() {
  const playerNum = useOnlinePlayerNum() ?? 1;
  const myPlayer = playerNum === 2 ? 'player2' : 'player1';
  const myState = usePlayerState(myPlayer);
  const characters = useGameCharacters();
  const history = useQuestionHistory();
  const previews = useCharacterPreviews();

  const character = characters.find((item) => item.id === myState.secretCharacterId) ?? null;

  const knownTraits = useMemo(() => {
    const entries = history
      .filter((record) => record.askedBy === myPlayer && record.answer === true)
      .map((record) => {
        const questionId = Number(record.questionId);
        const question = Number.isNaN(questionId) ? null : findSchizodioQuestion(questionId);
        return question?.text ?? record.questionText;
      });

    return entries.slice(-5);
  }, [history, myPlayer]);

  if (!character) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 20,
        pointerEvents: 'auto',
        width: 168,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(12,11,20,0.86)',
        backdropFilter: 'blur(10px)',
        padding: 8,
      }}
    >
      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
        <img
          src={previews.get(character.id) ?? (character as any).imageUrl}
          alt={character.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <div style={{ fontSize: 10, color: 'rgba(232,164,68,0.78)', marginBottom: 4 }}>Your secret</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, color: '#FFFFFE', marginBottom: 6 }}>
        {character.name}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,254,0.35)', marginBottom: 4 }}>Confirmed traits</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 80, overflowY: 'auto' }}>
        {knownTraits.length > 0 ? (
          knownTraits.map((trait) => (
            <div
              key={trait}
              style={{
                fontSize: 10,
                color: 'rgba(255,255,254,0.6)',
                background: 'rgba(74,222,128,0.1)',
                borderRadius: 6,
                padding: '3px 5px',
              }}
            >
              ✓ {trait}
            </div>
          ))
        ) : (
          <div style={{ fontSize: 10, color: 'rgba(255,255,254,0.28)' }}>No confirmed traits yet.</div>
        )}
      </div>
    </motion.div>
  );
}
