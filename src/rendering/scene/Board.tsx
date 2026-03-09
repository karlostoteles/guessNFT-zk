import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { BOARD } from '@/core/rules/constants';

interface BoardProps {
  /** Dynamic width from the adaptive grid (defaults to BOARD.width) */
  width?: number;
  depth?: number;
}

/** Procedural felt texture — subtle woven grid gives the surface tactile depth. */
function useFeltTexture(): THREE.CanvasTexture | null {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const SIZE = 512;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;

    // Base casino green
    ctx.fillStyle = '#1d3b26';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Diagonal bias-weave lines
    const cell = 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.032)';
    ctx.lineWidth = 0.7;
    for (let i = -SIZE; i < SIZE * 2; i += cell) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + SIZE, SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - SIZE, SIZE); ctx.stroke();
    }
    // Horizontal cross lines
    for (let y = 0; y < SIZE; y += cell) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
    }

    // Sparse fiber glints
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.055})`;
      ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1, 1);
    }

    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 4);
    t.colorSpace = THREE.SRGBColorSpace;

    setTex(t);
    return () => { t.dispose(); };
  }, []);

  return tex;
}

/** Four thin gold inlay strips — one along each edge of the felt surface. */
function GoldInlay({ w, d }: { w: number; d: number }) {
  const fw = w - 0.32;  // felt width
  const fd = d - 0.32;  // felt depth
  const STRIP = 0.045;  // inlay strip width
  const Y = BOARD.height / 2 + 0.003;
  const matProps = {
    color: '#c49230' as const,
    emissive: '#E8A444' as const,
    emissiveIntensity: 0.2,
    roughness: 0.25,
    metalness: 0.88,
  };

  return (
    <>
      {/* Top */}
      <mesh position={[0, Y, -fd / 2 + STRIP / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[fw, STRIP]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, Y, fd / 2 - STRIP / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[fw, STRIP]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Left */}
      <mesh position={[-fw / 2 + STRIP / 2, Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[STRIP, fd]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Right */}
      <mesh position={[fw / 2 - STRIP / 2, Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[STRIP, fd]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
    </>
  );
}

export function Board({ width = BOARD.width, depth = BOARD.depth }: BoardProps) {
  const w = Math.max(BOARD.width, width + 2.0);
  const d = Math.max(BOARD.depth, depth + 2.0);

  const feltTex = useFeltTexture();

  return (
    <group>
      {/* Outer frame — modern black sleek edge */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[w + 0.32, BOARD.height + 0.12, d + 0.32]} />
        <meshStandardMaterial color="#0c0603" roughness={0.72} metalness={0.05} />
      </mesh>

      {/* Main inner board body */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[w, BOARD.height, d]} />
        <meshStandardMaterial color={BOARD.color} roughness={0.82} />
      </mesh>

      {/* Casino felt surface with woven texture */}
      {feltTex && (
        <mesh
          position={[0, BOARD.height / 2 + 0.001, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[w - 0.32, d - 0.32]} />
          <meshStandardMaterial color="#ffffff" map={feltTex} roughness={0.97} />
        </mesh>
      )}

      {/* Gold inlay border around the felt */}
      <GoldInlay w={w} d={d} />
    </group>
  );
}
