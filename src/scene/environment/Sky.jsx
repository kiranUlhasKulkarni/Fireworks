import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, ShaderMaterial } from 'three';
import { sharedUniforms } from '../shared/uniforms';
import { GLSL_COMMON, GLSL_NOISE } from '../shared/glsl';
import { mulberry32 } from '../../utils/random';

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  ${GLSL_COMMON}
  ${GLSL_NOISE}
  uniform float uTime;
  uniform vec3 uMoonDir;
  uniform vec3 uFlashSky;
  varying vec3 vDir;

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;

    // Indigo night gradient with a purple/rose city glow on the horizon
    vec3 zenith = vec3(0.004, 0.006, 0.02);
    vec3 mid = vec3(0.016, 0.014, 0.055);
    vec3 horizon = vec3(0.075, 0.032, 0.095);
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
    col = mix(col, zenith, smoothstep(0.25, 0.9, h));
    col += vec3(0.06, 0.02, 0.015) * exp(-max(h, 0.0) * 18.0);
    col = mix(uFogColor, col, smoothstep(-0.04, 0.03, h));

    // Moon: large, pale gold, softly cratered, with a wide halo
    float md = dot(d, uMoonDir);
    float ang = acos(clamp(md, -1.0, 1.0));
    float R = 0.058;
    float disc = 1.0 - smoothstep(R * 0.96, R, ang);
    vec3 right = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, uMoonDir);
    vec2 mc = vec2(dot(d, right), dot(d, up)) / R;
    float maria = fbm(mc * 2.2 + 3.0);
    float limb = 0.8 + 0.2 * sqrt(max(0.0, 1.0 - dot(mc, mc)));
    vec3 moon = vec3(1.0, 0.94, 0.8) * (2.6 - maria * 0.9) * limb;
    float glow = exp(-ang * 14.0) * 0.22 + exp(-ang * 4.0) * 0.05;
    col += glow * vec3(0.7, 0.75, 1.0);
    col = mix(col, moon, disc);

    // Long clouds drifting across, moon-lit edges and city-lit undersides
    float cloud = cloudDensity(d, uTime);
    vec3 cloudCol = vec3(0.025, 0.025, 0.05)
      + vec3(0.5, 0.5, 0.6) * exp(-ang * 3.5) * 0.55
      + vec3(0.1, 0.04, 0.05) * exp(-max(h, 0.0) * 6.0)
      + uFlashSky * 0.03;
    col = mix(col, cloudCol, cloud * 0.88);

    col *= mix(0.45, 1.0, uDim);
    // The whole sky brightens faintly with the fireworks
    col += uFlashSky * 0.012 * smoothstep(-0.1, 0.4, h);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const starVertex = /* glsl */ `
  ${GLSL_COMMON}
  ${GLSL_NOISE}
  uniform float uTime;
  uniform float uPixelRatio;
  attribute vec2 aStar; // size, phase
  varying float vAlpha;
  void main() {
    vec3 d = normalize(position);
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.2 + aStar.y * 2.5) + aStar.y * 40.0);
    float clouds = cloudDensity(d, uTime);
    vAlpha = twinkle * smoothstep(0.02, 0.2, d.y) * (1.0 - clouds * 0.95);
    gl_PointSize = aStar.x * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const starFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d2 = dot(c, c);
    if (d2 > 1.0) discard;
    float a = exp(-d2 * 5.0) * vAlpha;
    gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a * 1.6, 0.0);
  }
`;

export function Sky() {
  const gl = useThree((s) => s.gl);

  const skyMat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: sharedUniforms,
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: BackSide,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );

  const { starGeo, starMat } = useMemo(() => {
    const rng = mulberry32(42);
    const N = 2600;
    const pos = new Float32Array(N * 3);
    const star = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const y = Math.pow(rng(), 0.7);
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 1400, y * 1400, Math.sin(a) * r * 1400], i * 3);
      star.set([1.0 + Math.pow(rng(), 4) * 2.4, rng()], i * 2);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aStar', new BufferAttribute(star, 2));
    const mat = new ShaderMaterial({
      uniforms: { ...sharedUniforms, uPixelRatio: { value: 1 } },
      vertexShader: starVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      premultipliedAlpha: true,
    });
    return { starGeo: geo, starMat: mat };
  }, []);

  useFrame(() => {
    starMat.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  return (
    <group>
      <mesh material={skyMat} renderOrder={-1000} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[1500, 48, 24]} />
      </mesh>
      <points geometry={starGeo} material={starMat} frustumCulled={false} raycast={() => null} />
    </group>
  );
}
