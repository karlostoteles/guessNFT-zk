import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { GameScene } from '@/rendering/scene/GameScene';
import { useGameMode } from '@/core/store/selectors';
import { UIOverlay } from '@/ui/UIOverlay';
import { ZKUIOverlay } from '@/zk/ui/ZKUIOverlay';
import { CollectionLoadingOverlay } from '@/ui/overlays/CollectionLoadingOverlay';


function LoadingFallback() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#E8A444" wireframe />
      </mesh>
    </>
  );
}

export default function App() {
  const mode = useGameMode();
  const isZKMode = mode === 'zk-online';

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', isolation: 'isolate' }}>
      <Canvas
        shadows
        gl={{ powerPreference: 'high-performance', antialias: false }}
        dpr={[1, 1.5]}
        camera={{ fov: 45, near: 0.1, far: 100, position: [0, 12, 14] }}
        style={{ background: '#0f0e17', position: 'relative', zIndex: 0 }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <GameScene />
        </Suspense>
      </Canvas>
      {isZKMode ? <ZKUIOverlay /> : <UIOverlay />}
      <CollectionLoadingOverlay />
    </div>
  );
}
