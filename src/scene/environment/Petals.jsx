import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, ShaderMaterial } from 'three';
import { sharedUniforms } from '../shared/uniforms';
import { GLSL_SHOCK } from '../shared/glsl';
import { mulberry32 } from '../../utils/random';

/** Cherry-blossom petals drifting down on the breeze — animated entirely on the GPU. */
const vertex = /* glsl */ `
  ${GLSL_SHOCK}
  uniform float uTime;
  uniform float uScale;
  attribute vec4 aSeed;
  varying float vAlpha;
  varying float vRot;
  varying float vFlip;
  varying vec3 vColor;
  void main() {
    float range = 22.0;
    vec3 p = (aSeed.xyz - 0.5) * vec3(28.0, range, 28.0);
    float fall = 0.35 + aSeed.w * 0.3;
    p.y = mod(p.y - uTime * fall + range * 0.5, range) - range * 0.5 + 4.0;
    // Carried by the same breeze as the smoke (mostly +x, a little +z)
    p.x += sin(uTime * 0.6 + aSeed.y * 20.0) * 1.2 + uTime * 0.55;
    p.z += cos(uTime * 0.5 + aSeed.x * 20.0) * 1.0 + uTime * 0.18;
    p.x = mod(p.x + 14.0, 28.0) - 14.0;
    p.z = mod(p.z + 14.0, 28.0) - 14.0;
    p += shockOffset(p, uTime);

    vRot = uTime * (1.0 + aSeed.z * 2.0) + aSeed.x * 6.28;
    vFlip = abs(cos(uTime * (1.5 + aSeed.w * 2.0) + aSeed.y * 10.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = max(-mv.z, 0.1);
    gl_PointSize = (0.07 + aSeed.w * 0.05) * uScale / dist;
    vAlpha = smoothstep(0.0, 2.0, range * 0.5 - abs(p.y - 4.0)) * smoothstep(0.8, 2.2, dist);
    vColor = mix(vec3(1.0, 0.68, 0.78), vec3(1.0, 0.86, 0.9), aSeed.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform float uDim;
  varying float vAlpha;
  varying float vRot;
  varying float vFlip;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float s = sin(vRot);
    float co = cos(vRot);
    c = mat2(co, -s, s, co) * c;
    c.x /= max(vFlip, 0.25);
    float d = (c.x * c.x) / 0.2 + (c.y * c.y) / 0.06;
    if (d > 1.0) discard;
    gl_FragColor = vec4(vColor * (0.45 + 0.4 * (1.0 - d)) * uDim, vAlpha * 0.85 * (1.0 - d * d));
  }
`;

export function Petals({ count = 420 }) {
  const { geometry, material } = useMemo(() => {
    const rng = mulberry32(5);
    const seeds = new Float32Array(count * 4).map(() => rng());
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    const mat = new ShaderMaterial({
      uniforms: {
        uTime: sharedUniforms.uTime,
        uDim: sharedUniforms.uDim,
        uShockOrigin: sharedUniforms.uShockOrigin,
        uShockTime: sharedUniforms.uShockTime,
        uScale: { value: 800 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
    });
    return { geometry: geo, material: mat };
  }, [count]);

  useFrame(({ size, camera, gl }) => {
    material.uniforms.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  });

  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} renderOrder={5} />;
}
