import { useFrame } from '@react-three/fiber';
import { INTRO } from '../config';
import { showStore } from '../state/showStore';
import { WORLD } from './world';
import { sharedUniforms } from './shared/uniforms';
import { fxBus } from './shared/fxBus';
import { BLOOM_INTENSITY } from './Effects';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const THICK_FOG = 0.018;

/**
 * Drives the 3D half of the State 0 → 1 "ethereal shift" (the camera swoop
 * lives in CameraRig.jsx, the petal burst in ui/IntroGate.jsx):
 *   • thick midnight fog rolls back to the normal night haze
 *   • the city starts dark, then lanterns ignite in a wave from the centre
 *   • a soft, temporary bloom surge
 */
export function IntroDirector() {
  useFrame(({ scene }) => {
    const s = showStore.get();
    const t = s.started ? (performance.now() - s.introAt) / 1000 : -1;

    const fogK = t < 0 ? 0 : 1 - Math.pow(1 - clamp01(t / (INTRO.fogSeconds + 1.2)), 3);
    const density = THICK_FOG + (WORLD.fog.density - THICK_FOG) * fogK;
    if (scene.fog) scene.fog.density = density;
    sharedUniforms.uFogDensity.value = density;

    const ig = clamp01((t - INTRO.igniteDelay) / INTRO.igniteSeconds);
    sharedUniforms.uIgnite.value = t < 0 ? 0 : ig >= 1 ? 1e5 : 30 + 760 * ig * ig;

    if (fxBus.bloom) {
      const surge = t < 0 ? 0 : smooth(0, 0.7, t) * (1 - smooth(1.6, 5.2, t));
      fxBus.bloom.intensity = BLOOM_INTENSITY + 3.2 * surge;
    }
  });
  return null;
}
