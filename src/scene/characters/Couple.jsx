import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { MODELS } from '../../config';
import { showStore } from '../../state/showStore';
import { makeRadialTexture } from './textures';
import { ModelSlot } from './ModelSlot';
import { PlaceholderGuy } from './PlaceholderGuy';
import { PlaceholderGirl } from './PlaceholderGirl';
import { updateKiss } from './kissState';

// Start downloading any configured models immediately.
for (const cfg of [MODELS.couple, MODELS.guy, MODELS.girl]) if (cfg?.url) useGLTF.preload(cfg.url);

/**
 * The centrepiece, standing on the apex of the roof ridge, looking out over
 * the city (world −z, toward the moon and the river).
 * Uses MODELS.couple if set (one posed file with both), otherwise
 * MODELS.guy / MODELS.girl individually, falling back to the stylized
 * placeholders for anything not provided.
 */
export function Couple() {
  const sway = useRef();
  const shadowTex = useMemo(() => makeRadialTexture('rgba(0,0,0,0.7)', 'rgba(0,0,0,0)'), []);

  // Priority −2: the kiss blend is updated before the rigs (−1) and limbs (0) read it.
  useFrame((_, dt) => updateKiss(dt, showStore.get().phase), -2);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    sway.current.rotation.y = Math.sin(t * 0.35) * 0.012;
    sway.current.rotation.z = Math.sin(t * 0.5) * 0.003;
  });

  const placeholders = (
    <>
      <PlaceholderGuy />
      <PlaceholderGirl />
    </>
  );

  return (
    // Facing out over the city (toward the moon), turned 3/4 to the default
    // camera so her turn into the kiss reads in profile.
    <group position={[0, 0, 0]} rotation-y={-2.585}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, -0.02]} renderOrder={1}>
        <planeGeometry args={[0.75, 0.7]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
      <group ref={sway}>
        {MODELS.couple?.url ? (
          <ModelSlot config={MODELS.couple} fallback={placeholders} />
        ) : (
          <>
            <ModelSlot config={MODELS.guy} fallback={<PlaceholderGuy />} />
            <ModelSlot config={MODELS.girl} fallback={<PlaceholderGirl />} />
          </>
        )}
      </group>
    </group>
  );
}
