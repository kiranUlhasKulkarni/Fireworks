import { sharedUniforms } from './uniforms';
import { GLSL_COMMON } from './glsl';

/**
 * Makes a built-in material (e.g. the instanced lanterns) follow the intro's
 * ignition wave: dark until the wave front reaches it, then lit.
 */
export function addIgnite(material) {
  material.customProgramCacheKey = () => 'ignite';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sharedUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\nvarying float vIgnite;`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vec3 igCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 igCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #endif
        vIgnite = igniteAt(igCenter.xz);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vIgnite;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.rgb *= vIgnite;');
  };
  material.needsUpdate = true;
  return material;
}
