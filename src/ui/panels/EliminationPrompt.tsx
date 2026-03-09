import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useCurrentQuestion, useActivePlayer, useEliminatedIds, useGameActions } from '@/core/store/selectors';
import { COLORS } from '@/core/rules/constants';

export function EliminationPrompt() {
  const question = useCurrentQuestion();
  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const { finishElimination } = useGameActions();
  const colors = activePlayer === 'player1' ? COLORS.player1 : COLORS.player2;

  return (
    <Card style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(500px, calc(100vw - 32px))',
      pointerEvents: 'auto',
    }}>
      {/* Show the Q&A result */}
      {question && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,254,0.7)' }}>
            {question.questionText}
          </div>
          <div style={{
            padding: '4px 12px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 14,
            fontFamily: "'Space Grotesk', sans-serif",
            background: question.answer ? 'rgba(76,175,80,0.2)' : 'rgba(224,85,85,0.2)',
            color: question.answer ? '#4CAF50' : '#E05555',
          }}>
            {question.answer ? 'YES' : 'NO'}
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            color: '#FFFFFE',
            marginBottom: 4,
          }}>
            Click tiles to eliminate characters
          </div>
          <div style={{
            fontSize: 12,
            color: 'rgba(255,255,254,0.4)',
          }}>
            {eliminatedIds.length} eliminated total
          </div>
        </div>

        <Button
          variant="accent"
          size="md"
          onClick={finishElimination}
        >
          Done
        </Button>
      </div>
    </Card>
  );
}
