import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useActivePlayer, useGameMode, useOnlinePlayerNum, usePlayerState } from '@/core/store/selectors';
import { BOARD } from '@/core/rules/constants';

interface MysteryCardProps {
  textures: Map<string, THREE.Texture>;
  cardBackTexture: THREE.CanvasTexture;
}

function makeLabel(): THREE.CanvasTexture {
  const W = 320, H = 80;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, W, H);

  // Dark pill background
  ctx.fillStyle = 'rgba(10, 8, 30, 0.78)';
  ctx.beginPath();
  ctx.roundRect(4, 10, W - 8, H - 18, 14);
  ctx.fill();

  // Gold accent top bar
  ctx.fillStyle = '#E8A444';
  ctx.fillRect(28, 11, W - 56, 3);

  ctx.font = 'bold 30px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Text shadow
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillText('YOUR PICK', W / 2 + 1, H / 2 + 2);

  // Gold text
  ctx.fillStyle = '#E8C060';
  ctx.fillText('YOUR PICK', W / 2, H / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function MysteryCard({ textures, cardBackTexture }: MysteryCardProps) {
  const activePlayer = useActivePlayer();
  const mode = useGameMode();
  const onlinePlayerNum = useOnlinePlayerNum();
  const viewPlayer = mode === 'online' || mode === 'zk-online'
    ? (onlinePlayerNum === 2 ? 'player2' : 'player1')
    : activePlayer;
  const playerState = usePlayerState(viewPlayer);
  const secretId = playerState.secretCharacterId;
  const secretTexture = secretId ? textures.get(secretId) : null;
  const labelTex = useRef<THREE.CanvasTexture | null>(null);
  if (!labelTex.current) labelTex.current = makeLabel();

  useEffect(() => {
    const tex = labelTex.current;
    return () => {
      if (tex) tex.dispose();
    };
  }, []);

  const cardWidth = 1.9;
  const cardHeight = 2.5;
  const DEPTH = 0.06;
  const BORDER = 0.055;

  return (
    <group
      position={[0, BOARD.height / 2 + 0.02, BOARD.depth / 2 - 0.5]}
      rotation={[-0.3, 0, 0]}
    >
      {/* Gold glow border — slightly larger, slightly set back */}
      <mesh position={[0, 0, -0.008]}>
        <boxGeometry args={[cardWidth + BORDER * 2, cardHeight + BORDER * 2, DEPTH - 0.01]} />
        <meshStandardMaterial
          color="#b88820"
          emissive="#E8A444"
          emissiveIntensity={0.38}
          roughness={0.22}
          metalness={0.9}
        />
      </mesh>

      {/* Card body — rich dark blue-purple, premium feel */}
      <mesh castShadow>
        <boxGeometry args={[cardWidth, cardHeight, DEPTH]} />
        <meshStandardMaterial
          color="#16143a"
          roughness={0.48}
          metalness={0.12}
          emissive="#3a2a6a"
          emissiveIntensity={0.06}
        />
      </mesh>

      {/* Front face — portrait or card back */}
      <mesh position={[0, 0, DEPTH / 2 + 0.001]}>
        <planeGeometry args={[cardWidth - 0.14, cardHeight - 0.18]} />
        <meshStandardMaterial
          map={secretTexture || cardBackTexture}
          roughness={0.48}
        />
      </mesh>

      {/* Back face */}
      <mesh position={[0, 0, -DEPTH / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[cardWidth - 0.14, cardHeight - 0.18]} />
        <meshStandardMaterial map={cardBackTexture} roughness={0.48} />
      </mesh>

      {/* Label — hovers below card */}
      <mesh position={[0, -cardHeight / 2 - 0.28, 0]}>
        <planeGeometry args={[1.6, 0.4]} />
        <meshBasicMaterial map={labelTex.current} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
