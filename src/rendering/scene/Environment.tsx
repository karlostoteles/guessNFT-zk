export function Environment() {
  return (
    <>
      <color attach="background" args={['#0f0e17']} />
      <fog attach="fog" args={['#0f0e17', 22, 48]} />

      {/* Hemisphere: cool sky / warm ground — base ambient fill with directionality */}
      <hemisphereLight args={['#2a3a7a', '#2a1608', 0.32]} />

      {/* Key light — warm directional with shadow */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />

      {/* Cool blue accent — left rear (mimics screen/monitor glow) */}
      <pointLight position={[-6, 3.5, -6]} intensity={0.75} color="#3a7aff" />

      {/* Warm orange accent — right front (table lamp feel) */}
      <pointLight position={[7, 2.5, 3]} intensity={0.50} color="#ff8833" />

      {/* Bottom bounce — subtle purple uplighting from the table surface */}
      <pointLight position={[0, -1.2, 5]} intensity={0.22} color="#7744bb" />
    </>
  );
}
