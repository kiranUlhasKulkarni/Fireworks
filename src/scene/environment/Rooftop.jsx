import { useMemo } from 'react';
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  MeshStandardMaterial,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
} from 'three';
import { WORLD } from '../world';

/**
 * The top of the tower: a traditional Japanese gabled (kirizuma) roof with
 * concave kawara-tiled slopes, upturned corners, white gable walls with dark
 * timber, a flat-topped ridge cap (the couple stands on its apex), golden
 * shachihoko ridge ornaments and chōchin lanterns hanging from the eaves.
 */
const R = WORLD.roof;
const RIDGE_Y = -0.24; // where the slopes meet, under the ridge cap
const TILE = 0.32; // kawara tile pitch in metres

const slopeY = (t) => RIDGE_Y - R.drop * (1 - Math.pow(1 - t, 1.6)); // steep at the ridge, flat at the eave
const cornerLift = (u, t) => 0.3 * Math.pow(Math.abs(2 * u - 1), 8) * t * t;

function createSlopes() {
  const segX = 32;
  const segT = 16;
  const slopeLen = Math.hypot(R.halfDepth, R.drop);
  const pos = [];
  const uv = [];
  const idx = [];
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= segT; i++) {
      const t = i / segT;
      for (let j = 0; j <= segX; j++) {
        const u = j / segX;
        pos.push(-R.halfLength + 2 * R.halfLength * u, slopeY(t) + cornerLift(u, t), side * R.halfDepth * t);
        uv.push(((u * 2 * R.halfLength) / TILE), ((t * slopeLen) / TILE));
      }
    }
    for (let i = 0; i < segT; i++) {
      for (let j = 0; j < segX; j++) {
        const a = base + i * (segX + 1) + j;
        const b = a + 1;
        const c = a + segX + 1;
        const d = c + 1;
        if (side > 0) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
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

/** White plaster fascia boards (nokiura) along both eaves. */
function createFascia() {
  const segX = 32;
  const pos = [];
  const idx = [];
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= segX; j++) {
      const u = j / segX;
      const x = -R.halfLength + 2 * R.halfLength * u;
      const y = slopeY(1) + cornerLift(u, 1);
      pos.push(x, y, side * R.halfDepth, x, y - 0.2, side * R.halfDepth);
    }
    for (let j = 0; j < segX; j++) {
      const a = base + j * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Gable end wall, following the roof profile. */
function createGable() {
  const depth = R.halfDepth * 0.8;
  const s = new Shape();
  const n = 12;
  s.moveTo(-depth, -2.4);
  for (let i = 0; i <= n; i++) {
    const z = -depth + (2 * depth * i) / n;
    s.lineTo(z, slopeY(Math.abs(z) / R.halfDepth) - 0.12);
  }
  s.lineTo(depth, -2.4);
  s.closePath();
  const g = new ShapeGeometry(s);
  // ShapeGeometry is in XY; turn it so its plane is YZ (facing ±x)
  g.rotateY(Math.PI / 2);
  // ShapeGeometry has UVs in shape units; fine for the plaster texture.
  return g;
}

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  // One kawara column: rounded convex tile (light) over a concave channel (dark)
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#15161f');
  g.addColorStop(0.18, '#2c3142');
  g.addColorStop(0.42, '#4a5068');
  g.addColorStop(0.62, '#2a2f40');
  g.addColorStop(1, '#101119');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  // Course overlap shadow
  const s = ctx.createLinearGradient(0, 0, 0, 64);
  s.addColorStop(0, 'rgba(0,0,0,0.55)');
  s.addColorStop(0.12, 'rgba(0,0,0,0)');
  s.addColorStop(0.9, 'rgba(255,255,255,0.05)');
  s.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function plasterTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8d2c4';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#1b130e';
  for (let i = 0; i <= 8; i++) ctx.fillRect(i * 32 - 3, 0, 6, 256); // kitsure-goshi lattice
  ctx.fillRect(0, 0, 256, 10);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(0.35, 0.35);
  return t;
}

export function Rooftop() {
  const parts = useMemo(() => {
    const tiles = tileTexture();
    return {
      slopes: createSlopes(),
      fascia: createFascia(),
      gable: createGable(),
      tile: new MeshStandardMaterial({ map: tiles, color: '#c9d0e8', roughness: 0.42, metalness: 0.25, side: DoubleSide }),
      cap: new MeshStandardMaterial({ color: '#2a2e3c', roughness: 0.5, metalness: 0.2 }),
      capEdge: new MeshStandardMaterial({ color: '#5a6178', roughness: 0.45, metalness: 0.2 }),
      white: new MeshStandardMaterial({ color: '#e7e2d6', roughness: 0.8, side: DoubleSide }),
      plaster: new MeshStandardMaterial({ map: plasterTexture(), roughness: 0.85, side: DoubleSide }),
      gold: new MeshStandardMaterial({ color: '#d4a64a', roughness: 0.25, metalness: 0.95, emissive: '#3a2406', emissiveIntensity: 0.4 }),
      dark: new MeshStandardMaterial({ color: '#141015', roughness: 0.6 }),
      paper: new MeshStandardMaterial({ color: '#ff6a3a', emissive: '#ff3a12', emissiveIntensity: 2.6, roughness: 0.8 }),
    };
  }, []);

  const L = R.halfLength;
  const eaveY = slopeY(1);
  const lanterns = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];

  return (
    <group>
      <mesh geometry={parts.slopes} material={parts.tile} />
      <mesh geometry={parts.fascia} material={parts.white} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={parts.gable} material={parts.plaster} position={[s * (L - 0.75), 0, 0]} />
      ))}

      {/* Ridge cap: a flat-topped tiled ridge — its top (y = 0) is where they stand */}
      <mesh position={[0, -R.ridgeDepth * 0.2, 0]} material={parts.cap}>
        <boxGeometry args={[2 * L + 0.1, R.ridgeDepth * 0.4, R.ridgeDepth]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, -0.03, (s * R.ridgeDepth) / 2]} rotation-z={Math.PI / 2} material={parts.capEdge}>
          <cylinderGeometry args={[0.035, 0.035, 2 * L + 0.1, 8]} />
        </mesh>
      ))}

      {/* Onigawara end tiles + golden shachihoko */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (L + 0.05), 0, 0]}>
          <mesh position={[0, 0.05, 0]} material={parts.cap}>
            <boxGeometry args={[0.28, 0.75, 0.95]} />
          </mesh>
          <group position={[0, 0.48, 0]} rotation-y={Math.PI / 2} scale={[s, 1, 1]}>
            <mesh rotation-z={-0.3} material={parts.gold}>
              <torusGeometry args={[0.24, 0.07, 10, 20, Math.PI * 1.1]} />
            </mesh>
            <mesh position={[0.24, -0.08, 0]} scale={[1.3, 1, 0.9]} material={parts.gold}>
              <sphereGeometry args={[0.1, 14, 10]} />
            </mesh>
            <mesh position={[-0.2, 0.28, 0]} rotation-z={0.9} scale={[0.5, 1.2, 0.3]} material={parts.gold}>
              <coneGeometry args={[0.1, 0.22, 10]} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Chōchin lanterns hanging from the four eave corners */}
      {lanterns.map(([sx, sz], i) => {
        const x = sx * (L - 0.45);
        const z = sz * (R.halfDepth - 0.35);
        const y = eaveY + 0.25 - 0.85;
        return (
          <group key={i} position={[x, y, z]}>
            <mesh position={[0, 0.55, 0]} material={parts.dark}>
              <cylinderGeometry args={[0.008, 0.008, 0.6, 4]} />
            </mesh>
            <mesh scale={[1, 1.3, 1]} material={parts.paper}>
              <sphereGeometry args={[0.2, 20, 14]} />
            </mesh>
            <mesh position={[0, 0.26, 0]} material={parts.dark}>
              <cylinderGeometry args={[0.1, 0.1, 0.06, 14]} />
            </mesh>
            <mesh position={[0, -0.26, 0]} material={parts.dark}>
              <cylinderGeometry args={[0.1, 0.1, 0.06, 14]} />
            </mesh>
          </group>
        );
      })}
      {/* Warm lantern light washing over the tiles */}
      <pointLight position={[-(L - 0.45), eaveY - 0.4, R.halfDepth - 0.2]} color="#ff8a45" intensity={7} distance={14} decay={1.5} />
      <pointLight position={[L - 0.45, eaveY - 0.4, -(R.halfDepth - 0.2)]} color="#ff7a3a" intensity={6} distance={14} decay={1.5} />
    </group>
  );
}
