/**
 * Hook that drives the CPU player when it's player2's turn in free mode.
 * Mount this once in GameScene or a top-level component.
 */
import { useEffect } from 'react';
import { usePhase, useActivePlayer, useGameMode } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';
import { executeCPUTurn } from '@/core/ai/cpuAgent';

export function useCPUPlayer() {
  const phase = usePhase();
  const activePlayer = useActivePlayer();
  const mode = useGameMode();

  useEffect(() => {
    // Only act in free mode when it's the CPU's turn (player2)
    if (mode !== 'free' && mode !== 'nft-free') return;
    if (activePlayer !== 'player2') return;
    if (phase !== GamePhase.QUESTION_SELECT) return;

    executeCPUTurn();
  }, [phase, activePlayer, mode]);
}
