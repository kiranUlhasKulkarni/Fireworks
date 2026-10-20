import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three';
import { sharedUniforms } from '../shared/uniforms';
import { GLSL_SHOCK } from '../shared/glsl';
import { WORLD } from '../world';
import { mulberry32 } from '../../utils/random';

/**
 * A few soft golden fireflies drifting UP from the roof edge — the
 * counter-motion to the falling petals. Pure GPU animation, additive HDR
 * colour so they pick up a gentle bloom.
 */
const vertex = /* glsl */ `
  ${GLSL_SHOCK}
  uniform float uTime;
  uniform float uScale;
  attribute vec4 aSeed;
  varying float vAlpha;
  const float RISE = 8.5;
  void main() {
    float speed = 0.16 + aSeed.w * 0.16;
    float cycle = RISE / speed;
    float age = mod(uTime + aSeed.x * cycle, cycle);
    float k = age / cycle;
    // Born just past the eaves, all the way round the roof
    float ang = aSeed.y * 6.2832 + sin(uTime * 0.05 + aSeed.z * 6.0) * 0.2;
    float r = ${(WORLD.roof.halfDepth + 0.3).toFixed(2)} + aSeed.z * 1.6 + k * 1.2;
    vec3 p = vec3(cos(ang) * r, ${(-WORLD.roof.drop - 0.6).toFixed(2)} + age * speed, sin(ang) * r);
    p.x += sin(uTime * 0.7 + aSeed.z * 20.0) * 0.35;
    p.z += cos(uTime * 0.6 + aSeed.y * 20.0) * 0.35;
    p += shockOffset(p, uTime);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = max(-mv.z, 0.1);
    gl_PointSize = clamp(0.09 * uScale / dist, 2.0, 40.0);
    float pulse = 0.5 + 0.5 * sin(uTime * (1.2 + aSeed.w) + aSeed.x * 40.0);
    vAlpha = smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.7, 1.0, k)) * (0.35 + 0.65 * pulse * pulse);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d2 = dot(c, c);
    if (d2 > 1.0) discard;
    float g = exp(-d2 * 6.0) + exp(-d2 * 30.0);
    gl_FragColor = vec4(vec3(2.6, 1.7, 0.55) * g * vAlpha, 0.0);
  }
`;

export function Fireflies({ count = 48 }) {
  const { geometry, material } = useMemo(() => {
    const rng = mulberry32(13);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(new Float32Array(count * 4).map(() => rng()), 4));
    const mat = new ShaderMaterial({
      uniforms: {
        uTime: sharedUniforms.uTime,
        uShockOrigin: sharedUniforms.uShockOrigin,
        uShockTime: sharedUniforms.uShockTime,
        uScale: { value: 800 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      premultipliedAlpha: true,
    });
    return { geometry: geo, material: mat };
  }, [count]);

  useFrame(({ size, camera, gl }) => {
    material.uniforms.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  });

  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} renderOrder={6} />;
}
