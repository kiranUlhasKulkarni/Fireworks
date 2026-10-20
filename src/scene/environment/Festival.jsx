import { useEffect, useMemo } from 'react';
import { CapsuleGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, ShaderMaterial, SphereGeometry } from 'three';
import { WORLD } from '../world';
import { sharedUniforms } from '../shared/uniforms';
import { GLSL_COMMON } from '../shared/glsl';
import { mulberry32 } from '../../utils/random';
import { BLOCK, BRIDGE, BRIDGES, FESTIVAL_LANES, RIVER_HALF, riverZ } from './cityLayout';

/**
 * Festival crowd in the streets below: thousands of soft silhouettes (couples,
 * families with children) strolling along the lantern-lit street grid — busiest
 * on the festival lanes near the tower, thinning out with distance — some carrying
 * gently bobbing paper lanterns, plus lantern-carrying walkers crossing the
 * arched bridges over the river. Every walker is animated in the vertex
 * shader from a few per-instance numbers — two draw calls in total.
 */

// Per instance:
//   aLane = (kind 0=street along x / 1=street along z / 2=bridge (along z, arched),
//            lane coordinate, lane start, lane length)
//   aWalk = (start offset, signed speed, lateral offset, height scale)
//   aMisc = (phase, tint r, tint g, tint b)
const MOTION = /* glsl */ `
  uniform float uTime;
  attribute vec4 aLane;
  attribute vec4 aWalk;
  attribute vec4 aMisc;

  // Returns the walker's foot position; fade = 0 near lane ends (wrap-around).
  vec3 walkerPos(out float fade, out vec2 dir) {
    float len = aLane.w;
    float s = mod(aWalk.x + uTime * aWalk.y, len);
    fade = smoothstep(0.0, 4.0, s) * smoothstep(0.0, 4.0, len - s);
    float along = aLane.z + s;
    float side = aWalk.z + sin(uTime * 0.13 + aMisc.x * 9.0) * 0.4;
    dir = vec2(sign(aWalk.y), 0.0);
    vec3 p = aLane.x < 0.5
      ? vec3(along, 0.0, aLane.y + side)
      : vec3(aLane.y + side, 0.0, along);
    if (aLane.x > 0.5) dir = dir.yx;
    p.y = ${WORLD.groundY.toFixed(1)};
    // Bridges: follow the arch of the deck (same curve as bridgeDeckY in cityLayout.js)
    if (aLane.x > 1.5) p.y += 1.1 + ${BRIDGE.rise.toFixed(2)} * sin(3.14159265 * s / len);
    return p;
  }
`;

const walkerVertex = /* glsl */ `
  ${MOTION}
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vTint;
  varying float vFade;
  varying float vH;
  void main() {
    float fade; vec2 dir;
    vec3 foot = walkerPos(fade, dir);
    float h = aWalk.w;
    float stride = abs(sin(uTime * abs(aWalk.y) * 3.2 + aMisc.x * 6.0));
    vec3 local = position * vec3(1.0, h, 1.0);
    local.y += 0.75 * h + stride * 0.04;      // capsule centre → feet on the ground
    local.x += sin(uTime * abs(aWalk.y) * 1.6 + aMisc.x * 6.0) * 0.02 * (local.y / h);
    vec3 wp = foot + local * fade;
    vN = normal;
    vWorld = wp;
    vTint = aMisc.yzw;
    vFade = fade;
    vH = position.y / 0.75;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const walkerFragment = /* glsl */ `
  ${GLSL_COMMON}
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vTint;
  varying float vFade;
  varying float vH;
  void main() {
    vec3 n = normalize(vN);
    // Dark kimono silhouettes, warmly rim-lit by the lanterns around them
    vec3 col = vTint * 0.02;
    col += vec3(1.0, 0.45, 0.16) * 0.05 * (0.3 + 0.7 * abs(n.x + n.z)) * (0.5 + 0.5 * vH);
    col += flashLight(vWorld, n) * vTint * 0.05;
    col *= uDim;
    col = applyFog(col, length(cameraPosition - vWorld));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const lanternVertex = /* glsl */ `
  ${MOTION}
  varying float vGlow;
  varying vec3 vWorld;
  void main() {
    float fade; vec2 dir;
    vec3 foot = walkerPos(fade, dir);
    float h = aWalk.w;
    float t = uTime * abs(aWalk.y) * 3.2 + aMisc.x * 6.0;
    // Held out in front on a short pole, bobbing and swinging with each step
    vec3 hand = vec3(dir.x, 0.0, dir.y) * 0.35 + vec3(dir.y, 0.0, -dir.x) * 0.18;
    vec3 c = foot + hand + vec3(sin(t * 0.5) * 0.05, 1.05 * h + abs(sin(t)) * 0.06, cos(t * 0.5) * 0.05);
    vec3 wp = c + position * fade;
    vGlow = (0.8 + 0.2 * sin(uTime * 7.0 + aMisc.x * 30.0)) * fade;
    vWorld = wp;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;

const lanternFragment = /* glsl */ `
  ${GLSL_COMMON}
  varying float vGlow;
  varying vec3 vWorld;
  void main() {
    vec3 col = vec3(3.2, 1.15, 0.38) * vGlow * mix(0.5, 1.0, uDim) * igniteAt(vWorld.xz);
    col = applyFog(col, length(cameraPosition - vWorld));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const KIMONO_TINTS = [
  [0.9, 0.5, 0.6],
  [0.5, 0.55, 0.9],
  [0.9, 0.75, 0.5],
  [0.6, 0.85, 0.7],
  [0.8, 0.6, 0.95],
  [0.7, 0.7, 0.7],
];

/** Festival lanes right below the tower: the busiest streets. */
function buildCrowd(count = 1400) {
  const rng = mulberry32(77);
  const walkers = [];
  while (walkers.length < count) {
    const lane = FESTIVAL_LANES[Math.floor(rng() * FESTIVAL_LANES.length)];
    const len = lane.to - lane.from;
    const start = rng() * len;
    const speed = (0.55 + rng() * 0.6) * (rng() < 0.5 ? -1 : 1);
    const lateral = (rng() - 0.5) * 3.6;
    // Group of 1–4: a couple, a family with a child, friends…
    const r = rng();
    const size = r < 0.35 ? 1 : r < 0.75 ? 2 : r < 0.92 ? 3 : 4;
    for (let k = 0; k < size; k++) {
      const child = size >= 3 && k === size - 1;
      walkers.push({
        lane: [lane.axis === 'x' ? 0 : 1, lane.at, lane.from, len],
        walk: [start + k * 0.55 * Math.sign(speed) * -0.3 + (rng() - 0.5) * 0.2, speed, lateral + (k % 2 ? 0.55 : 0), child ? 0.55 : 0.9 + rng() * 0.18],
        misc: [rng(), ...KIMONO_TINTS[Math.floor(rng() * KIMONO_TINTS.length)]],
        lantern: !child && rng() < 0.3,
      });
    }
  }
  return walkers;
}

/**
 * Every lit street of the 30 m grid (the glowing pathways), cut where it would
 * cross the river or the tower base, out to where the street glow fades.
 */
function streetSegments(radius = 400) {
  const segs = [];
  const max = Math.floor(radius / BLOCK);
  const step = 2;
  for (const axis of ['x', 'z']) {
    for (let k = -max; k <= max; k++) {
      const at = k * BLOCK;
      const half = Math.sqrt(Math.max(0, radius * radius - at * at));
      let start = null;
      for (let s = -half; s <= half + 1e-6; s += step) {
        const x = axis === 'x' ? s : at;
        const z = axis === 'x' ? at : s;
        const ok = Math.abs(z - riverZ(x)) > RIVER_HALF + 2.5 && Math.hypot(x, z) > 11;
        const last = s + step > half;
        if (ok && start === null) start = s;
        if (start !== null && (!ok || last)) {
          const end = ok ? s : s - step;
          if (end - start > 14) segs.push({ axis, at, from: start, to: end, avenue: k % 4 === 0 });
          start = null;
        }
      }
    }
  }
  return segs;
}

/**
 * A steady, not-overwhelming stream of people over most of the lit grid:
 * roughly one group every ~9 m near the centre, thinning toward the edge of
 * the city; about a fifth of the streets stay quiet.
 */
function buildGridCrowd() {
  const rng = mulberry32(53);
  const walkers = [];
  for (const seg of streetSegments()) {
    if (rng() < 0.2) continue; // some quiet side streets
    const len = seg.to - seg.from;
    const mid = seg.from + len / 2;
    const d = seg.axis === 'x' ? Math.hypot(mid, seg.at) : Math.hypot(seg.at, mid);
    const busy = 0.45 + 0.75 * Math.exp(-(d * d) / (2 * 170 * 170));
    const groups = Math.round((len / 9) * busy);
    // Avenues are wider and their centre line sits 1.5 m off the grid line
    const width = seg.avenue ? 6.6 : 4.4;
    const centre = seg.avenue ? 1.5 : 0;
    for (let g = 0; g < groups; g++) {
      const start = rng() * len;
      const speed = (0.5 + rng() * 0.6) * (rng() < 0.5 ? -1 : 1);
      const lateral = centre + (rng() - 0.5) * width;
      const r = rng();
      const size = r < 0.4 ? 1 : r < 0.8 ? 2 : r < 0.94 ? 3 : 4;
      for (let k = 0; k < size; k++) {
        const child = size >= 3 && k === size - 1;
        walkers.push({
          lane: [seg.axis === 'x' ? 0 : 1, seg.at, seg.from, len],
          walk: [start - k * 0.5 * Math.sign(speed) + (rng() - 0.5) * 0.2, speed, lateral + (k % 2 ? 0.5 : 0), child ? 0.55 : 0.9 + rng() * 0.18],
          misc: [rng(), ...KIMONO_TINTS[Math.floor(rng() * KIMONO_TINTS.length)]],
          lantern: !child && rng() < 0.25,
        });
      }
    }
  }
  return walkers;
}

/** People strolling across each bridge, most of them carrying a lantern. */
function buildBridgeWalkers(perBridge = 26) {
  const rng = mulberry32(91);
  const walkers = [];
  const len = 2 * BRIDGE.halfSpan;
  for (const bx of BRIDGES) {
    const z0 = riverZ(bx) - BRIDGE.halfSpan;
    let n = 0;
    while (n < perBridge) {
      const start = rng() * len;
      const speed = (0.45 + rng() * 0.45) * (rng() < 0.5 ? -1 : 1);
      const lateral = (rng() - 0.5) * (BRIDGE.width - 1.4);
      const size = rng() < 0.45 ? 2 : 1; // many couples
      for (let k = 0; k < size && n < perBridge; k++, n++) {
        walkers.push({
          lane: [2, bx, z0, len],
          walk: [start - k * 0.4 * Math.sign(speed), speed, lateral + (k ? 0.5 : 0), 0.9 + rng() * 0.15],
          misc: [rng(), ...KIMONO_TINTS[Math.floor(rng() * KIMONO_TINTS.length)]],
          lantern: rng() < 0.65,
        });
      }
    }
  }
  return walkers;
}

function makeMesh(geometry, material, list) {
  const lane = new Float32Array(list.length * 4);
  const walk = new Float32Array(list.length * 4);
  const misc = new Float32Array(list.length * 4);
  list.forEach((w, i) => {
    lane.set(w.lane, i * 4);
    walk.set(w.walk, i * 4);
    misc.set(w.misc, i * 4);
  });
  geometry.setAttribute('aLane', new InstancedBufferAttribute(lane, 4));
  geometry.setAttribute('aWalk', new InstancedBufferAttribute(walk, 4));
  geometry.setAttribute('aMisc', new InstancedBufferAttribute(misc, 4));
  const mesh = new InstancedMesh(geometry, material, list.length);
  const id = new Matrix4();
  for (let i = 0; i < list.length; i++) mesh.setMatrixAt(i, id);
  mesh.frustumCulled = false;
  mesh.raycast = () => null;
  return mesh;
}

export function Festival() {
  const { people, lanterns } = useMemo(() => {
    const crowd = [...buildCrowd(), ...buildGridCrowd(), ...buildBridgeWalkers()];
    const people = makeMesh(
      new CapsuleGeometry(0.2, 1.1, 1, 5), // low-poly: seen from 60 m+ above
      new ShaderMaterial({ uniforms: sharedUniforms, vertexShader: walkerVertex, fragmentShader: walkerFragment }),
      crowd,
    );
    const lanterns = makeMesh(
      new SphereGeometry(0.17, 6, 4).scale(1, 1.25, 1),
      new ShaderMaterial({ uniforms: sharedUniforms, vertexShader: lanternVertex, fragmentShader: lanternFragment }),
      crowd.filter((w) => w.lantern),
    );
    return { people, lanterns };
  }, []);

  useEffect(
    () => () => {
      for (const m of [people, lanterns]) {
        m.geometry.dispose();
        m.material.dispose();
      }
    },
    [people, lanterns],
  );

  return (
    <>
      <primitive object={people} />
      <primitive object={lanterns} />
    </>
  );
}
