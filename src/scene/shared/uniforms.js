import { Color, Vector3 } from 'three';
import { WORLD } from '../world';
import { flashUniforms } from './flashLights';

/**
 * Uniform objects shared (by reference) between every custom shader material,
 * so updating one value updates the whole city.
 */
export const sharedUniforms = {
  uTime: { value: 0 },
  uMoonDir: { value: WORLD.moonDir.clone() },
  uMoonColor: { value: new Color(0.16, 0.19, 0.3) },
  uFogColor: { value: new Color(WORLD.fog.color) },
  uFogDensity: { value: WORLD.fog.density },
  // 1 = normal. Dips briefly right before the first burst to build tension.
  uDim: { value: 1 },
  // Intro "lighting surge": radius (m) of the lantern-ignition wave spreading from the centre.
  uIgnite: { value: 0 },
  // Heart-click shockwave (pushes petals & fireflies outward).
  uShockOrigin: { value: new Vector3(0, -1000, 0) },
  uShockTime: { value: -1000 },
  ...flashUniforms,
};
