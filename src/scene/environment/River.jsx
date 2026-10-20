import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { WORLD } from '../world';
import { sharedUniforms } from '../shared/uniforms';
import { GLSL_COMMON, GLSL_NOISE } from '../shared/glsl';
import { riverZ, RIVER_HALF } from './cityLayout';

/**
 * The river: a real planar reflection (three.js Reflector renders the scene
 * mirrored into a half-float target, so lanterns, windows, the moon and the
 * fireworks all reflect in HDR and bloom), shaded by a custom water shader:
 * layered ripples scrolling downstream along the river's curve distort the
 * reflection, Fresnel blends it with deep water, plus moon glints, drifting
 * current streaks and darker water along the stone embankments.
 */
const WATER_Y = WORLD.groundY + 0.15;

const vertex = /* glsl */ `
  uniform mat4 textureMatrix;
  varying vec4 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = textureMatrix * vec4(position, 1.0);
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  ${GLSL_COMMON}
  ${GLSL_NOISE}
  uniform sampler2D tDiffuse;
  uniform float uTime;
  uniform vec3 uMoonDir;
  varying vec4 vUv;
  varying vec3 vWorld;

  // Same curve as riverZ() in cityLayout.js, and its slope dz/dx.
  float riverCenter(float x) { return -(150.0 + 40.0 * sin(x / 120.0) + 14.0 * sin(x / 45.0 + 1.3)); }
  float riverSlope(float x) { return -(40.0 / 120.0 * cos(x / 120.0) + 14.0 / 45.0 * cos(x / 45.0 + 1.3)); }

  // Ripple height field in river space (q.x = downstream, q.y = across), scrolling with the current.
  float waves(vec2 q, float t) {
    float h = vnoise(vec2(q.x * 0.16 - t * 0.5, q.y * 0.4));
    h += 0.5 * vnoise(vec2(q.x * 0.4 - t * 1.05, q.y * 0.85 + 3.1));
    h += 0.25 * vnoise(vec2(q.x * 1.05 - t * 1.9 + q.y * 0.3, q.y * 2.1 + 7.7));
    h += 0.13 * vnoise(vec2(q.x * 2.5 - t * 3.2, q.y * 4.2 - t * 0.4));
    return h;
  }

  void main() {
    vec2 dir = normalize(vec2(1.0, riverSlope(vWorld.x))); // downstream
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 q = vec2(dot(vWorld.xz, dir), dot(vWorld.xz, perp));
    float t = uTime;

    const float e = 0.12;
    float h0 = waves(q, t);
    vec2 g = vec2(waves(q + vec2(e, 0.0), t) - h0, waves(q + vec2(0.0, e), t) - h0) / e;
    vec2 gw = g.x * dir + g.y * perp;
    vec3 N = normalize(vec3(-gw.x * 0.42, 1.0, -gw.y * 0.42));

    vec3 toCam = cameraPosition - vWorld;
    float dist = length(toCam);
    vec3 V = toCam / dist;

    // Reflection of the whole scene, rippled by the waves
    vec4 uv = vUv;
    uv.xy += N.xz * 0.045 * uv.w;
    vec3 refl = texture2DProj(tDiffuse, uv).rgb;

    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 deep = vec3(0.004, 0.008, 0.016) * uDim;
    vec3 col = mix(deep, refl, clamp(0.38 + fres * 0.85, 0.0, 0.96));

    // Moon glints on wave crests
    vec3 R = reflect(-V, N);
    float md = max(dot(R, uMoonDir), 0.0);
    col += vec3(1.0, 0.95, 0.85) * pow(md, 700.0) * 2.4 * uDim;

    // Long current streaks drifting downstream (makes the flow readable from afar)
    float streak = smoothstep(0.7, 0.95, vnoise(vec2(q.x * 0.07 - t * 0.32, q.y * 1.7)));
    col += vec3(0.32, 0.22, 0.17) * streak * 0.05 * (0.4 + fres);

    // Darker, calmer water along the stone embankments
    float across = abs(vWorld.z - riverCenter(vWorld.x));
    float edge = smoothstep(${(RIVER_HALF - 2.5).toFixed(1)}, ${RIVER_HALF.toFixed(1)}, across);
    col *= 1.0 - 0.45 * edge;

    col = applyFog(col, dist);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const WaterShader = {
  name: 'TaishoRiver',
  uniforms: {
    color: { value: new Color(0xffffff) },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
  },
  vertexShader: vertex,
  fragmentShader: fragment,
};

/** River surface ribbon built in the XY plane (Reflector expects a +z-facing plane). */
function createRiverPlane(step = 6) {
  const pos = [];
  const idx = [];
  let n = 0;
  for (let x = -700; x <= 700; x += step) {
    const z = riverZ(x);
    // local (x, y = −z, 0); the mesh is rotated −90° about x so local y → world −z
    pos.push(x, -(z - RIVER_HALF), 0, x, -(z + RIVER_HALF), 0);
    if (n > 0) {
      const a = (n - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // counter-clockwise → faces +z (up after rotation)
    }
    n++;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Stone embankment walls + coping along both banks. */
function createEmbankments(step = 4) {
  const pos = [];
  const idx = [];
  const G = WORLD.groundY;
  for (const side of [-1, 1]) {
    for (const [y0, y1, inset] of [
      [WATER_Y - 0.4, G + 0.9, 0], // wall face
      [G + 0.9, G + 0.9, 0.7], // coping top
    ]) {
      const base = pos.length / 3;
      let n = 0;
      for (let x = -700; x <= 700; x += step) {
        const z = riverZ(x) + side * RIVER_HALF;
        pos.push(x, y0, z, x, y1, z + side * inset);
        if (n > 0) {
          const a = base + (n - 1) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        n++;
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function River() {
  const { water, banks } = useMemo(() => {
    const water = new Reflector(createRiverPlane(), {
      textureWidth: 1024,
      textureHeight: 1024,
      clipBias: 0.003,
      multisample: 0,
      shader: WaterShader,
    });
    // Share the live uniforms (Reflector clones the shader's uniforms).
    for (const k of Object.keys(sharedUniforms)) water.material.uniforms[k] = sharedUniforms[k];
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_Y;
    water.frustumCulled = false;
    water.raycast = () => null;

    const banks = new Mesh(
      createEmbankments(),
      new MeshStandardMaterial({ color: '#2a2724', roughness: 0.9, side: DoubleSide }),
    );
    banks.frustumCulled = false;
    banks.raycast = () => null;
    return { water, banks };
  }, []);

  useEffect(
    () => () => {
      water.dispose();
      banks.geometry.dispose();
      banks.material.dispose();
    },
    [water, banks],
  );

  return (
    <>
      <primitive object={water} />
      <primitive object={banks} />
    </>
  );
}
