import { Vector3 } from 'three';
import { sharedUniforms } from '../shared/uniforms';
import { WIND } from '../../fireworks/physics';

const WIND_DIR = new Vector3(WIND[0], 0, WIND[2]).normalize();

/**
 * Adds a gentle, continuous breeze to any built-in three.js material (also
 * works on materials from your .glb files). The sway is computed in world
 * space and grows below `pivotY`, so hems, sleeves and hair tips move while
 * shoulders and roots stay put.
 *
 *   addWind(material, { amp: 0.03, pivotY: 1.4, range: 0.5 })
 */
export function addWind(material, { amp = 0.025, pivotY = 1.4, range = 0.6, freq = 1 } = {}) {
  material.userData.wind = { amp, pivotY, range, freq };
  const key = `wind:${amp}:${pivotY}:${range}:${freq}`;
  material.customProgramCacheKey = () => key;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWindDir = { value: WIND_DIR };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform vec3 uWindDir;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 wPos = modelMatrix * vec4(transformed, 1.0);
          float mask = clamp((${pivotY.toFixed(3)} - wPos.y) / ${range.toFixed(3)}, 0.0, 1.0);
          mask *= mask;
          float t = uTime * ${freq.toFixed(3)};
          float gust = 0.65 + 0.35 * sin(t * 0.7) * sin(t * 0.23 + 1.0);
          float w = sin(t * 2.1 + wPos.y * 6.0 + wPos.x * 3.0) * 0.6 + sin(t * 3.7 + wPos.z * 5.0) * 0.4;
          vec3 off = uWindDir * (0.5 + 0.6 * w) * gust * ${amp.toFixed(4)} * mask;
          off.y += sin(t * 2.7 + wPos.x * 4.0) * ${(amp * 0.25).toFixed(4)} * mask;
          transformed += inverse(mat3(modelMatrix)) * off;
        }`,
      );
  };
  material.needsUpdate = true;
  return material;
}
