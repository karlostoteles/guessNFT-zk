import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Card } from '@/ui/common';
import {
  useGameActions,
  useOnlinePlayerNum,
  useQuestionHistory,
} from '@/core/store/selectors';
import {
  SCHIZODIO_QUESTIONS,
  type SchizodioCategory,
} from '@/zk/schizodioQuestions';

export const CATEGORIES: Array<{ key: SchizodioCategory; label: string; icon: string }> = [
  { key: 'accessories', label: 'Accessories', icon: '✨' },
  { key: 'background', label: 'Background', icon: '🖼️' },
  { key: 'body', label: 'Body', icon: '🧍' },
  { key: 'clothing', label: 'Clothing', icon: '👕' },
  { key: 'eyebrows', label: 'Eyebrows', icon: '〰️' },
  { key: 'eyes', label: 'Eyes', icon: '👁️' },
  { key: 'eyewear', label: 'Eyewear', icon: '🕶️' },
  { key: 'hair', label: 'Hair', icon: '💇' },
  { key: 'headwear', label: 'Headwear', icon: '🎩' },
  { key: 'mask', label: 'Mask', icon: '🎭' },
  { key: 'mouth', label: 'Mouth', icon: '👄' },
  { key: 'overlays', label: 'Overlays', icon: '🧿' },
  { key: 'sidekick', label: 'Sidekick', icon: '🐉' },
  { key: 'weapons', label: 'Weapons', icon: '⚔️' },
];

export function getQuestionsForCategory(category: SchizodioCategory) {
  return SCHIZODIO_QUESTIONS.filter((question) => question.category === category);
}

export function getAskedCount(category: SchizodioCategory, askedIds: Set<number>) {
  const items = getQuestionsForCategory(category);
  let count = 0;
  for (const item of items) {
    if (askedIds.has(item.id)) count += 1;
  }
  return count;
}

export function ZKQuestionPanel() {
  const { zkAskQuestion, startGuess } = useGameActions();
  const history = useQuestionHistory();
  const onlinePlayerNum = useOnlinePlayerNum() ?? 1;
  const myPlayer = onlinePlayerNum === 2 ? 'player2' : 'player1';

  const [activeCategory, setActiveCategory] = useState<SchizodioCategory>('hair');

  const askedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const record of history) {
      if (record.askedBy !== myPlayer) continue;
      const id = Number(record.questionId);
      if (!Number.isNaN(id)) ids.add(id);
    }
    return ids;
  }, [history, myPlayer]);

  const questions = useMemo(() => getQuestionsForCategory(activeCategory), [activeCategory]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'auto',
        zIndex: 25,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 12px 0',
      }}
    >
      <Card
        style={{
          width: 'min(980px, 100%)',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingBottom: 12,
          background: 'rgba(12,11,20,0.96)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 800,
                fontSize: 20,
                color: '#E8A444',
              }}
            >
              Ask a Question
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.45)' }}>
              IDs map directly to on-chain question bits.
            </div>
          </div>
          <Button variant="no" size="sm" onClick={startGuess}>Risk It!</Button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          {CATEGORIES.map((category) => {
            const active = category.key === activeCategory;
            const askedCount = getAskedCount(category.key, askedIds);
            const total = getQuestionsForCategory(category.key).length;
            return (
              <button
                key={category.key}
                onClick={() => setActiveCategory(category.key)}
                style={{
                  border: active ? '1px solid rgba(232,164,68,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: active ? 'rgba(232,164,68,0.16)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#E8A444' : 'rgba(255,255,254,0.6)',
                  borderRadius: 999,
                  padding: '6px 10px',
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {category.icon} {category.label} {askedCount}/{total}
              </button>
            );
          })}
        </div>

        <div style={{ overflowY: 'auto', maxHeight: '48vh' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 7 }}>
            {questions.map((question) => {
              const asked = askedIds.has(question.id);
              return (
                <button
                  key={question.id}
                  onClick={() => zkAskQuestion(question.id)}
                  disabled={asked}
                  style={{
                    borderRadius: 10,
                    border: asked ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(232,164,68,0.28)',
                    background: asked ? 'rgba(255,255,255,0.03)' : 'rgba(232,164,68,0.08)',
                    color: asked ? 'rgba(255,255,254,0.28)' : '#FFFFFE',
                    textAlign: 'left',
                    padding: '10px 12px',
                    cursor: asked ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', monospace",
                      minWidth: 38,
                      fontSize: 11,
                      color: asked ? 'rgba(255,255,254,0.22)' : 'rgba(232,164,68,0.9)',
                    }}
                  >
                    #{question.id}
                  </span>
                  <span style={{ flex: 1 }}>{question.text}</span>
                  {asked ? <span style={{ fontSize: 11 }}>asked</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
