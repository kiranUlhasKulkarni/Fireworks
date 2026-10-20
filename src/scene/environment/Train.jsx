import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  ShaderMaterial,
} from 'three';
import { sharedUniforms } from '../shared/uniforms';
import { GLSL_COMMON } from '../shared/glsl';
import { makeRadialTexture } from '../characters/textures';
import { RAIL_DECK_Y, RAIL_Z } from './cityLayout';

/**
 * A steam train gliding along the brick viaduct in the mid-ground:
 * dark carriages with warm glowing windows and a trail of steam.
 * Its position is a pure function of time, so the GPU steam trail and the
 * carriages always agree.
 */
const SPEED = 15; // m/s
const LOOP = 1120; // metres of track before it wraps (wrap happens far outside the fog)
const START = -560;
const CARS = 7;
const CAR_LEN = 12;
const CHIMNEY = 4.6; // chimney offset ahead of the train group origin

const headX = (t) => START + (((t * SPEED) % LOOP) + LOOP) % LOOP;

const carVertex = /* glsl */ `
  attribute float aSeed;
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vSeed;
  void main() {
    vP = position;
    vN = normal;
    vSeed = aSeed;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const carFragment = /* glsl */ `
  ${GLSL_COMMON}
  uniform float uTime;
  uniform vec3 uMoonDir;
  uniform vec3 uMoonColor;
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vSeed;
  void main() {
    vec3 n = normalize(vN);
    vec3 col = vec3(0.03, 0.013, 0.011) * (0.6 + 0.6 * max(dot(n, uMoonDir), 0.0)) * uDim;
    col += vec3(0.03, 0.013, 0.011) * flashLight(vWorld, n) * 4.0;
    if (abs(n.z) > 0.5) {
      float u = (vP.x + 0.5) * ${CAR_LEN.toFixed(1)};
      float cell = floor(u / 1.4);
      float fu = fract(u / 1.4);
      float h = vP.y + 0.5;
      float win = step(0.18, fu) * step(fu, 0.82) * step(0.46, h) * step(h, 0.8) * step(abs(vP.x), 0.45);
      float flicker = 0.85 + 0.15 * sin(uTime * (3.0 + vSeed * 4.0) + cell * 1.7);
      float on = step(0.12, fract(sin(cell * 12.9898 + vSeed * 78.233) * 43758.5453));
      col = mix(col, vec3(1.7, 1.1, 0.42) * flicker * on, win);
    }
    col = applyFog(col, length(cameraPosition - vWorld));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const steamVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform vec3 uWind;
  attribute float aIndex;
  varying float vAlpha;
  varying float vSeed;
  const float N = ${(90).toFixed(1)};
  const float LIFE = 6.0;
  float headX(float t) { return ${START.toFixed(1)} + mod(t * ${SPEED.toFixed(1)}, ${LOOP.toFixed(1)}); }
  void main() {
    float age = mod(uTime + aIndex * (LIFE / N), LIFE);
    float te = uTime - age;
    float x0 = headX(te);
    float wrapped = step(headX(uTime) + 1.0, x0); // emitted before the train wrapped
    vec3 p = vec3(x0 + ${CHIMNEY.toFixed(1)}, ${(RAIL_DECK_Y + 5.2).toFixed(2)}, ${RAIL_Z.toFixed(1)});
    p += vec3(uWind.x, 2.2, uWind.z) * age + vec3(sin(aIndex * 7.0), 0.0, cos(aIndex * 3.0)) * age * 0.35;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = 1.4 + age * 1.6;
    gl_PointSize = size * uScale / max(-mv.z, 1.0);
    vAlpha = pow(1.0 - age / LIFE, 1.5) * smoothstep(0.0, 0.3, age) * 0.4 * (1.0 - wrapped);
    vSeed = aIndex;
    gl_Position = projectionMatrix * mv;
  }
`;

const steamFragment = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uDim;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float d = dot(c, c);
    if (d > 1.0) discard;
    float a = (1.0 - d) * (1.0 - d) * vAlpha;
    vec3 col = mix(vec3(0.09, 0.085, 0.11), uFogColor, 0.4) * mix(0.5, 1.0, uDim);
    gl_FragColor = vec4(col, a);
  }
`;

export function Train() {
  const group = useRef();

  const parts = useMemo(() => {
    // Carriages
    const carGeo = new BoxGeometry(1, 1, 1);
    const seeds = new Float32Array(CARS).map((_, i) => i * 0.37 + 0.11);
    carGeo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    const cars = new InstancedMesh(carGeo, new ShaderMaterial({ uniforms: sharedUniforms, vertexShader: carVertex, fragmentShader: carFragment }), CARS);
    for (let i = 0; i < CARS; i++) {
      const m = new Matrix4().makeScale(CAR_LEN, 3.0, 2.8);
      m.setPosition(-(i + 1) * (CAR_LEN + 1) + 2, 1.5 + 0.35, 0);
      cars.setMatrixAt(i, m);
    }
    cars.frustumCulled = false;
    cars.raycast = () => null;

    // Steam trail
    const N = 90;
    const steamGeo = new BufferGeometry();
    steamGeo.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3));
    steamGeo.setAttribute('aIndex', new BufferAttribute(new Float32Array(N).map((_, i) => i), 1));
    const steamMat = new ShaderMaterial({
      uniforms: {
        uTime: sharedUniforms.uTime,
        uFogColor: sharedUniforms.uFogColor,
        uDim: sharedUniforms.uDim,
        uScale: { value: 800 },
        uWind: { value: { x: 1.4, y: 0, z: 0.45 } },
      },
      vertexShader: steamVertex,
      fragmentShader: steamFragment,
      transparent: true,
      depthWrite: false,
    });

    const metal = new MeshStandardMaterial({ color: '#141216', roughness: 0.45, metalness: 0.6 });
    const red = new MeshStandardMaterial({ color: '#5a1410', roughness: 0.6 });
    const lamp = new MeshStandardMaterial({ color: '#fff2c0', emissive: '#ffd27a', emissiveIntensity: 5 });
    const fire = new MeshStandardMaterial({ color: '#ff5a1a', emissive: '#ff4a10', emissiveIntensity: 3 });
    const glow = makeRadialTexture('rgba(255,220,140,1)', 'rgba(255,200,120,0)');
    return { cars, steamGeo, steamMat, metal, red, lamp, fire, glow };
  }, []);

  useFrame(({ clock, size, camera, gl }) => {
    const t = clock.elapsedTime;
    group.current.position.set(headX(t), RAIL_DECK_Y, RAIL_Z);
    parts.steamMat.uniforms.uScale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  });

  return (
    <>
      <group ref={group}>
        <primitive object={parts.cars} />
        {/* Locomotive */}
        <mesh position={[3.2, 2.0, 0]} rotation-z={Math.PI / 2} material={parts.metal}>
          <cylinderGeometry args={[1.15, 1.15, 7.5, 20]} />
        </mesh>
        <mesh position={[-1.6, 2.1, 0]} material={parts.metal}>
          <boxGeometry args={[3.4, 3.6, 2.9]} />
        </mesh>
        <mesh position={[-1.6, 3.98, 0]} material={parts.red}>
          <boxGeometry args={[3.8, 0.18, 3.2]} />
        </mesh>
        <mesh position={[CHIMNEY, 3.8, 0]} material={parts.metal}>
          <cylinderGeometry args={[0.38, 0.28, 1.4, 12]} />
        </mesh>
        <mesh position={[1.9, 3.35, 0]} material={parts.metal}>
          <sphereGeometry args={[0.45, 12, 8]} />
        </mesh>
        <mesh position={[3.2, 0.55, 0]} material={parts.red}>
          <boxGeometry args={[8.5, 0.5, 2.6]} />
        </mesh>
        <mesh position={[-1.6, 0.75, 0]} material={parts.fire}>
          <boxGeometry args={[1.2, 0.35, 2.7]} />
        </mesh>
        <mesh position={[7.05, 2.4, 0]} material={parts.lamp}>
          <sphereGeometry args={[0.3, 12, 10]} />
        </mesh>
        <sprite position={[7.6, 2.4, 0]} scale={5} raycast={() => null}>
          <spriteMaterial map={parts.glow} transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} />
        </sprite>
      </group>
      <points geometry={parts.steamGeo} material={parts.steamMat} frustumCulled={false} raycast={() => null} renderOrder={4} />
    </>
  );
}
