/**
 * useAdaptiveGrid
 *
 * Derives the adaptive tile-grid layout and camera position from the
 * current game state.  The active tile count = total characters minus
 * the ones the active player has already eliminated.
 */

import { useMemo } from 'react';
import {
  useGameCharacters,
  useActivePlayer,
  useEliminatedIds,
  useGameMode,
  useOnlinePlayerNum,
} from '@/core/store/selectors';
import {
  computeAdaptiveGrid,
  computeAdaptiveCamera,
  getTileLOD,
  type AdaptiveGridLayout,
  type TileLOD,
} from '@/core/rules/constants';

export interface AdaptiveGridResult {
  layout:      AdaptiveGridLayout;
  cameraPos:   [number, number, number];
  cameraLook:  [number, number, number];
  activeCount: number;
  lod:         TileLOD;
}

export function useAdaptiveGrid(): AdaptiveGridResult {
  const characters   = useGameCharacters();
  const activePlayer = useActivePlayer();
  const mode = useGameMode();
  const onlinePlayerNum = useOnlinePlayerNum();
  const viewPlayer = mode === 'online' || mode === 'zk-online'
    ? (onlinePlayerNum === 2 ? 'player2' : 'player1')
    : activePlayer;
  const eliminatedIds = useEliminatedIds(viewPlayer);

  const activeCount = characters.length - eliminatedIds.length;

  const layout = useMemo(
    () => computeAdaptiveGrid(activeCount),
    [activeCount]
  );

  const camera = useMemo(
    () => computeAdaptiveCamera(activeCount),
    [activeCount]
  );

  const lod = getTileLOD(layout.tileW);

  return {
    layout,
    cameraPos:   camera.position,
    cameraLook:  camera.lookAt,
    activeCount,
    lod,
  };
}
