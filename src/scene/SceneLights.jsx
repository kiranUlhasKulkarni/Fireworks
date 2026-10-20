import { useRef } from 'react';
import { showStore } from '../state/showStore';
import { OPENING_BURST } from '../fireworks/choreography';
import { useFrame } from '@react-three/fiber';
import { WORLD } from './world';
import { sharedUniforms } from './shared/uniforms';
import { updateFlashes } from './shared/flashLights';

// Key light from the camera side and a rose fill from the city side, around the couple
const KEY = [-1.7, 2.7, 2.3];
const FILL = [0.6, 2.0, -2.4];

/**
 * Real lights for the near scene (deck + couple). The distant city is lit in
 * its own shaders; both are driven by the same firework flash data.
 */
export function SceneLights() {
  const fireworkLight = useRef();
  const hemi = useRef();
  const moonLight = useRef();
  const rim = useRef();
  const key = useRef();
  const moon = WORLD.moonDir.clone().multiplyScalar(60);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    sharedUniforms.uTime.value = t;

    // Tension: the whole scene dims for a split second right before the first burst.
    let dim = 1;
    const s = showStore.get();
    if (s.phase === 'active') {
      const T = (performance.now() - s.startedAt) / 1000;
      const open = OPENING_BURST;
      const smooth = (a, b, x) => {
        const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return k * k * (3 - 2 * k);
      };
      dim = T < open ? 1 - 0.68 * smooth(open - 0.75, open - 0.1, T) : 1 - 0.68 * (1 - smooth(open, open + 0.7, T));
    }
    sharedUniforms.uDim.value = dim;
    hemi.current.intensity = 0.6 * dim;
    moonLight.current.intensity = 0.9 * dim;
    rim.current.intensity = 0.55 * dim;
    key.current.intensity = 3.2 * (0.4 + 0.6 * dim);
    const f = updateFlashes(t);
    const l = fireworkLight.current;
    if (f.level > 0.01) {
      l.position.copy(f.pos).normalize().multiplyScalar(50);
      l.color.copy(f.color);
      l.intensity = f.level * 2.4;
    } else {
      l.intensity = 0;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#3b3f7a', '#4a2418', 0.6]} />
      <directionalLight ref={moonLight} position={moon.toArray()} color="#aebcff" intensity={0.9} />
      <directionalLight ref={rim} position={[-6, 8, -10]} color="#8a6bff" intensity={0.55} />
      <directionalLight ref={fireworkLight} intensity={0} />
      {/* Soft rose fill on their faces from the city side */}
      <pointLight position={FILL} color="#ff9ab8" intensity={1.6} distance={6} decay={1.4} />
      {/* Soft warm key on the couple so they read against the dark deck */}
      <pointLight ref={key} position={KEY} color="#ffc6a8" intensity={3.2} distance={7} decay={1.3} />
    </>
  );
}
