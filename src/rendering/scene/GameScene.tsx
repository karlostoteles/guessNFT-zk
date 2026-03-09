import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment } from './Environment';
import { Board } from './Board';
import { CharacterGrid } from './CharacterGrid';
import { MysteryCard } from './MysteryCard';
import { CameraController } from './CameraController';
import { useCharacterTextures, useCardBackTexture } from '@/shared/hooks/useCharacterTextures';
import { useAdaptiveGrid } from '@/shared/hooks/useAdaptiveGrid';
import { useBoardRotation } from '@/core/store/selectors';
import { BOARD } from '@/core/rules/constants';
import { useCPUPlayer } from '@/shared/hooks/useCPUPlayer';

export function GameScene() {
  useCPUPlayer(); // Drive CPU opponent in free mode

  const { layout }      = useAdaptiveGrid();
  const { textures }    = useCharacterTextures();
  const cardBackTexture = useCardBackTexture();
  const boardRotation   = useBoardRotation();
  const boardRef        = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (boardRef.current) {
      const target  = boardRotation;
      const current = boardRef.current.rotation.y;
      boardRef.current.rotation.y = current + (target - current) * (1 - Math.pow(0.02, delta));
    }
  });

  return (
    <>
      <CameraController />
      <Environment />

      <group rotation={[BOARD.tiltAngle, 0, 0]}>
        <group ref={boardRef}>
          <Board width={layout.gridW} depth={layout.gridD} />
          <CharacterGrid textures={textures} tileW={layout.tileW} />
          <MysteryCard textures={textures} cardBackTexture={cardBackTexture} />
        </group>
      </group>
    </>
  );
}
