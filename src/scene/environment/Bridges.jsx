import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { WORLD } from '../world';
import { makeWoodTexture } from '../characters/textures';
import { BRIDGE, BRIDGES, bridgeDeckY, riverZ } from './cityLayout';

/**
 * Traditional arched wooden bridges (taiko-bashi) over the river: a smoothly
 * arched plank deck with fascia beams, posted railings with bronze giboshi
 * finials, wooden piers with cross-bracing standing in the water, stone
 * abutments and stone tōrō lanterns at each end. People with lanterns walk
 * across them (see Festival.jsx).
 */
const SEG = 48;
const W = BRIDGE.width;
const T = BRIDGE.deckThickness;
const G = WORLD.groundY;
const WATER_Y = G + 0.15;

const zAt = (zc, u) => zc - BRIDGE.halfSpan + 2 * BRIDGE.halfSpan * u;

/** Arched deck: plank top, fascia sides and underside, as one geometry. */
function createDeck(zc) {
  const pos = [];
  const uv = [];
  const idx = [];
  const len = 2 * BRIDGE.halfSpan;
  // Cross-section corners: [x offset, y offset, u-coordinate]
  const faces = [
    [[-W / 2, 0], [W / 2, 0]], // top (planks)
    [[W / 2, 0], [W / 2, -T]], // right fascia
    [[W / 2, -T], [-W / 2, -T]], // underside
    [[-W / 2, -T], [-W / 2, 0]], // left fascia
  ];
  for (const [a, b] of faces) {
    const base = pos.length / 3;
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const y = bridgeDeckY(u);
      const z = zAt(zc, u);
      pos.push(a[0], y + a[1], z, b[0], y + b[1], z);
      // v along the span → plank seams run across the deck
      uv.push(0, (u * len) / 2.2, 1, (u * len) / 2.2);
      if (i > 0) {
        const p = base + (i - 1) * 2;
        idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function railCurve(zc, side, height) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    pts.push(new Vector3(side * (W / 2 - 0.1), bridgeDeckY(u) + height, zAt(zc, u)));
  }
  return new CatmullRomCurve3(pts);
}

const UP = new Vector3(0, 1, 0);

/** Places unit boxes/cylinders between two points (instanced). */
function beamMatrix(a, b, thickness, m = new Matrix4()) {
  const dir = new Vector3().subVectors(b, a);
  const len = dir.length();
  const q = new Quaternion().setFromUnitVectors(UP, dir.normalize());
  return m.compose(a.clone().add(b).multiplyScalar(0.5), q, new Vector3(thickness, len, thickness));
}

function buildBridgeParts() {
  const posts = [];
  const beams = [];
  const legs = [];
  const finials = [];
  const lanterns = [];
  for (const bx of BRIDGES) {
    const zc = riverZ(bx);
    // Railing posts
    for (let k = 0; k <= 16; k++) {
      const u = k / 16;
      for (const side of [-1, 1]) {
        const y = bridgeDeckY(u);
        posts.push(beamMatrix(new Vector3(bx + side * (W / 2 - 0.1), y - 0.05, zAt(zc, u)), new Vector3(bx + side * (W / 2 - 0.1), y + 1.12, zAt(zc, u)), 0.13));
        if (k % 4 === 0) finials.push(new Vector3(bx + side * (W / 2 - 0.1), y + 1.17, zAt(zc, u)));
      }
    }
    // Piers standing in the water: pairs of round legs, a cap beam and X-bracing
    for (const u of [0.16, 0.3, 0.43, 0.57, 0.7, 0.84]) {
      const z = zAt(zc, u);
      const top = bridgeDeckY(u) - T;
      const xs = [bx - W / 2 + 0.35, bx + W / 2 - 0.35];
      for (const x of xs) legs.push(beamMatrix(new Vector3(x, WATER_Y - 1, z), new Vector3(x, top, z), 0.3));
      beams.push(beamMatrix(new Vector3(xs[0] - 0.3, top - 0.12, z), new Vector3(xs[1] + 0.3, top - 0.12, z), 0.22));
      const lo = WATER_Y + 0.4;
      const hi = top - 0.35;
      if (hi - lo > 0.6) {
        beams.push(beamMatrix(new Vector3(xs[0], lo, z), new Vector3(xs[1], hi, z), 0.1));
        beams.push(beamMatrix(new Vector3(xs[1], lo, z), new Vector3(xs[0], hi, z), 0.1));
      }
    }
    // Stone tōrō lanterns at both ends
    for (const u of [0, 1]) {
      for (const side of [-1, 1]) {
        lanterns.push(new Vector3(bx + side * (W / 2 + 0.9), G, zAt(zc, u) + (u ? 1.4 : -1.4)));
      }
    }
  }
  return { posts, beams, legs, finials, lanterns };
}

function instancedFrom(geometry, material, matrices) {
  const mesh = new InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.raycast = () => null;
  return mesh;
}

export function Bridges() {
  const parts = useMemo(() => {
    const mats = {
      plank: new MeshStandardMaterial({ map: makeWoodTexture([1, 1]), color: '#b08a6a', roughness: 0.85, side: DoubleSide }),
      wood: new MeshStandardMaterial({ color: '#4a3020', roughness: 0.8 }),
      darkWood: new MeshStandardMaterial({ color: '#2c1c12', roughness: 0.85 }),
      bronze: new MeshStandardMaterial({ color: '#8c6a3a', roughness: 0.35, metalness: 0.85, emissive: '#2a1a08', emissiveIntensity: 0.4 }),
      stone: new MeshStandardMaterial({ color: '#5a5650', roughness: 0.95 }),
      fire: new MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff9a40', emissiveIntensity: 3.2 }),
    };
    return { mats, p: buildBridgeParts() };
  }, []);

  const meshes = useMemo(() => {
    const { mats, p } = parts;
    const decks = BRIDGES.map((bx) => {
      const g = createDeck(riverZ(bx));
      g.translate(bx, 0, 0);
      return g;
    });
    const rails = BRIDGES.flatMap((bx) =>
      [-1, 1].flatMap((side) => [
        { curve: railCurve(riverZ(bx), side, 1.05), r: 0.07 },
        { curve: railCurve(riverZ(bx), side, 0.58), r: 0.04 },
        { curve: railCurve(riverZ(bx), side, 0.14), r: 0.05 },
      ]).map((r) => ({ ...r, bx })),
    );
    return {
      decks,
      rails,
      // Unit-size geometries, scaled per instance by beamMatrix()
      posts: instancedFrom(new BoxGeometry(1, 1, 1), mats.wood, p.posts),
      beams: instancedFrom(new BoxGeometry(1, 1, 1), mats.darkWood, p.beams),
      legs: instancedFrom(new CylinderGeometry(0.5, 0.5, 1, 10), mats.darkWood, p.legs),
    };
  }, [parts]);

  useEffect(
    () => () => {
      meshes.decks.forEach((g) => g.dispose());
      for (const m of [meshes.posts, meshes.beams, meshes.legs]) m.geometry.dispose();
      Object.values(parts.mats).forEach((m) => m.dispose());
    },
    [meshes, parts],
  );

  const { mats, p } = parts;
  return (
    <group>
      {meshes.decks.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.plank} raycast={() => null} />
      ))}
      {meshes.rails.map((r, i) => (
        <mesh key={i} position={[r.bx, 0, 0]} material={mats.wood} raycast={() => null}>
          <tubeGeometry args={[r.curve, 48, r.r, 6, false]} />
        </mesh>
      ))}
      <primitive object={meshes.posts} />
      <primitive object={meshes.beams} />
      <primitive object={meshes.legs} />

      {/* Bronze giboshi (onion-shaped finials) on every fourth post */}
      {p.finials.map((v, i) => (
        <group key={i} position={v}>
          <mesh material={mats.bronze}>
            <sphereGeometry args={[0.11, 12, 10]} />
          </mesh>
          <mesh position={[0, 0.13, 0]} material={mats.bronze}>
            <coneGeometry args={[0.06, 0.16, 10]} />
          </mesh>
        </group>
      ))}

      {/* Stone abutments where the bridge meets each bank */}
      {BRIDGES.flatMap((bx) =>
        [0, 1].map((u) => (
          <mesh key={`${bx}-${u}`} position={[bx, G + 0.45, zAt(riverZ(bx), u) + (u ? -0.6 : 0.6)]} material={mats.stone} raycast={() => null}>
            <boxGeometry args={[W + 0.8, 1.6, 2.4]} />
          </mesh>
        )),
      )}

      {/* Stone tōrō lanterns at each end */}
      {p.lanterns.map((v, i) => (
        <group key={i} position={v}>
          <mesh position={[0, 0.45, 0]} material={mats.stone}>
            <cylinderGeometry args={[0.16, 0.22, 0.9, 8]} />
          </mesh>
          <mesh position={[0, 1.05, 0]} material={mats.fire}>
            <boxGeometry args={[0.42, 0.36, 0.42]} />
          </mesh>
          <mesh position={[0, 1.36, 0]} material={mats.stone}>
            <coneGeometry args={[0.46, 0.32, 4]} />
          </mesh>
        </group>
      ))}

      {/* A warm wash of light over each bridge from its lanterns */}
      {BRIDGES.map((bx) => (
        <pointLight key={bx} position={[bx, bridgeDeckY(0.5) + 2.2, riverZ(bx)]} color="#ff9a52" intensity={14} distance={30} decay={1.6} />
      ))}
    </group>
  );
}
