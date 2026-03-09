/**
 * CharacterGrid — adaptive, animated grid of character tiles.
 *
 * For small collections (<=30 chars): renders all characters with flip/shrink
 * elimination animation.
 *
 * For large collections (>30 chars, e.g. full Schizodio NFTs): renders only
 * non-eliminated characters, capped at MAX_BOARD_TILES. Eliminated tiles
 * vanish instantly and the grid reflows. This keeps draw calls manageable
 * (~150 at 30 tiles vs ~5000 at 999).
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD, computeAdaptiveGrid } from '@/core/rules/constants';
import { useGameCharacters, useActivePlayer, useEliminatedIds, useGameMode, useOnlinePlayerNum } from '@/core/store/selectors';
import { CharacterTile } from './CharacterTile';
import { getOrCreateTexture } from '@/shared/hooks/useCharacterTextures';
import { sfx } from '@/shared/audio/sfx';

const MAX_BOARD_TILES = 30;

interface CharacterGridProps {
  textures: Map<string, THREE.Texture>;
  tileW: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function computeTargetPositions(
  chars: { id: string }[],
  cols: number,
  tileW: number,
  tileH: number,
  gap: number,
): Map<string, [number, number]> {
  const rows = Math.ceil(chars.length / cols);
  const gridW = cols * tileW + (cols - 1) * gap;
  const gridD = rows * tileH + (rows - 1) * gap;
  const startX = -gridW / 2 + tileW / 2;
  const startZ = -gridD / 2 + tileH / 2;

  const map = new Map<string, [number, number]>();
  chars.forEach((char, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    map.set(char.id, [
      startX + col * (tileW + gap),
      startZ + row * (tileH + gap),
    ]);
  });
  return map;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CharacterGrid({ textures, tileW }: CharacterGridProps) {
  return <IndividualGrid textures={textures} tileW={tileW} />;
}

// ─── Individual CharacterTile components ───────────────────────────────────────

type AnimPhase = 'alive' | 'waiting' | 'flipping' | 'shrinking' | 'dead';

interface TileAnim {
  id: string;
  x: number; z: number;
  tx: number; tz: number;
  scale: number;
  targetScale: number;
  flipAngle: number;
  phase: AnimPhase;
  flipDelay: number;
  flipTimer: number;
}

function IndividualGrid({ textures, tileW }: CharacterGridProps) {
  const characters = useGameCharacters();
  const activePlayer = useActivePlayer();
  const mode = useGameMode();
  const onlinePlayerNum = useOnlinePlayerNum();

  const myPlayerKey = mode === 'online' || mode === 'zk-online'
    ? (onlinePlayerNum === 2 ? 'player2' : 'player1')
    : activePlayer;

  const eliminatedIds = useEliminatedIds(myPlayerKey);

  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const pivotRefs = useRef<Map<string, THREE.Group>>(new Map());
  const animRef = useRef<Map<string, TileAnim>>(new Map());

  // Small collection: render ALL characters (animation works on eliminated tiles).
  // Large collection: render only non-eliminated, capped at MAX_BOARD_TILES.
  const isLargeCollection = characters.length > MAX_BOARD_TILES;

  const activeChars = useMemo(() => {
    const elimSet = new Set(eliminatedIds);
    return characters.filter((c) => !elimSet.has(c.id));
  }, [characters, eliminatedIds]);

  const renderChars = useMemo(() => {
    if (!isLargeCollection) return characters;
    return activeChars.slice(0, MAX_BOARD_TILES);
  }, [isLargeCollection, characters, activeChars]);

  // Layout is based on active chars for large collections, render chars for small
  const layoutCount = isLargeCollection
    ? Math.min(activeChars.length, MAX_BOARD_TILES)
    : activeChars.length;

  const layout = useMemo(() => computeAdaptiveGrid(layoutCount), [layoutCount]);

  // Targets are computed for the characters that will actually be rendered
  const layoutChars = isLargeCollection ? renderChars : activeChars;
  const targets = useMemo(
    () => computeTargetPositions(layoutChars, layout.cols, layout.tileW, layout.tileH, layout.gap),
    [layoutChars, layout],
  );

  const eliminatedSet = useMemo(() => new Set(eliminatedIds), [eliminatedIds]);

  // Update animRef when eliminations or targets change
  useEffect(() => {
    const existing = animRef.current;
    const elimSet = new Set(eliminatedIds);
    const newlyEliminated: string[] = [];

    for (const char of renderChars) {
      const isEliminated = elimSet.has(char.id);
      const target = targets.get(char.id);

      if (!existing.has(char.id)) {
        const [tx, tz] = target ?? [0, 0];
        existing.set(char.id, {
          id: char.id, x: tx, z: tz, tx, tz,
          scale: 1, targetScale: 1,
          flipAngle: 0,
          phase: isEliminated ? 'flipping' : 'alive',
          flipDelay: 0,
          flipTimer: 0,
        });
      } else {
        const st = existing.get(char.id)!;
        if (target && (st.phase === 'alive')) {
          st.tx = target[0];
          st.tz = target[1];
        }
        if (isEliminated && st.phase === 'alive') {
          newlyEliminated.push(char.id);
          st.phase = 'waiting';
          st.flipTimer = 0;
        }
        if (!isEliminated && st.phase !== 'alive' && st.phase !== 'waiting') {
          const [tx, tz] = target ? [target[0], target[1]] : [st.tx, st.tz];
          st.phase = 'alive';
          st.scale = 1;
          st.flipAngle = 0;
          st.flipDelay = 0;
          st.flipTimer = 0;
          st.x = tx; st.z = tz; st.tx = tx; st.tz = tz;
          const group = groupRefs.current.get(char.id);
          if (group) {
            group.visible = true;
            group.scale.setScalar(1);
            group.position.set(tx, 0, tz);
          }
          const pivot = pivotRefs.current.get(char.id);
          if (pivot) pivot.rotation.x = 0;
        }
      }
    }

    // Clean up animRef entries for characters no longer rendered
    for (const [id] of existing) {
      if (!renderChars.some(c => c.id === id)) {
        existing.delete(id);
      }
    }

    if (newlyEliminated.length > 0) {
      sfx.tilesCascade(newlyEliminated.length);
      const TOTAL_CASCADE_MS = 800;
      const perTileDelay = Math.min(0.08, TOTAL_CASCADE_MS / 1000 / newlyEliminated.length);
      newlyEliminated.forEach((id, idx) => {
        const st = existing.get(id);
        if (st) st.flipDelay = idx * perTileDelay;
      });
    }
  }, [renderChars, eliminatedIds, targets]);

  // Single useFrame: position lerp + staggered flip + gentle shrink
  useFrame((_, delta) => {
    const tPos = 1 - Math.pow(0.003, delta);
    const tFlip = 1 - Math.pow(0.00005, delta);
    const tScl = 1 - Math.pow(0.0001, delta);

    for (const st of animRef.current.values()) {
      if (st.phase === 'dead') continue;

      const group = groupRefs.current.get(st.id);
      if (!group) continue;

      if (st.phase === 'alive') {
        st.x = lerp(st.x, st.tx, tPos);
        st.z = lerp(st.z, st.tz, tPos);
        group.position.set(st.x, 0, st.z);
      }

      if (st.phase === 'waiting') {
        st.flipTimer += delta;
        if (st.flipTimer >= st.flipDelay) {
          st.phase = 'flipping';
        }
      }

      if (st.phase === 'flipping') {
        st.flipAngle = lerp(st.flipAngle, -Math.PI / 2.2, tFlip * 2);
        const pivot = pivotRefs.current.get(st.id);
        if (pivot) pivot.rotation.x = st.flipAngle;
        if (Math.abs(st.flipAngle + Math.PI / 2.2) < 0.04) {
          st.phase = 'shrinking';
          st.targetScale = 0;
        }
      }

      if (st.phase === 'shrinking') {
        st.scale = lerp(st.scale, 0, tScl * 2);
        group.scale.setScalar(Math.max(0, st.scale));
        if (st.scale < 0.01) {
          group.visible = false;
          st.phase = 'dead';
        }
      }
    }
  });

  return (
    <group position={[0, BOARD.height / 2 + 0.01, 0]}>
      {renderChars.map((char) => {
        const texture = textures.get(char.id) ?? getOrCreateTexture(char.id, char as any);

        return (
          <group
            key={char.id}
            ref={(el) => {
              if (el) {
                groupRefs.current.set(char.id, el);

                if (!animRef.current.has(char.id)) {
                  const target = targets.get(char.id);
                  const [tx, tz] = target ?? [0, 0];
                  animRef.current.set(char.id, {
                    id: char.id, x: tx, z: tz, tx, tz,
                    scale: 1, targetScale: 1,
                    flipAngle: 0, phase: 'alive',
                    flipDelay: 0, flipTimer: 0,
                  });
                  el.position.set(tx, 0, tz);
                } else {
                  const st = animRef.current.get(char.id)!;
                  el.position.set(st.x, 0, st.z);
                  if (st.phase === 'dead') el.visible = false;
                }
              } else {
                groupRefs.current.delete(char.id);
              }
            }}
          >
            <CharacterTile
              characterId={char.id}
              characterName={char.name}
              texture={texture}
              tileW={layout.tileW}
              tileH={layout.tileH}
              pivotRef={(el) => {
                if (el) pivotRefs.current.set(char.id, el);
                else pivotRefs.current.delete(char.id);
              }}
            />
          </group>
        );
      })}
    </group>
  );
}
