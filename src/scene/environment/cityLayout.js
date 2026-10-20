import { WORLD } from '../world';
import { clamp, mulberry32 } from '../../utils/random';

/**
 * Procedural Taisho-era city: dense wooden machiya blocks with tiled hip
 * roofs, a lantern-lit entertainment district, a winding river with
 * vermilion arched bridges, five-storey pagodas with torii, and the
 * castle-like tower whose roof the couple stands on.
 *
 * Output is plain data; City.jsx turns it into a handful of InstancedMeshes.
 */

export const BLOCK = 30; // block pitch (streets are centred on multiples of this)
export const STREET = 6;
export const RIVER_HALF = 15;

export function riverZ(x) {
  return -(150 + 40 * Math.sin(x / 120) + 14 * Math.sin(x / 45 + 1.3));
}

export const TEMPLES = [
  { x: -170, z: 70 },
  { x: 185, z: 35 },
  { x: 60, z: 240 },
  { x: -60, z: -330 },
  { x: 260, z: -250 },
];
// x positions of the arched wooden bridges (two sit in the default view).
export const BRIDGES = [-120, 30, 100];

/** Arched wooden bridge shape, shared by Bridges.jsx and the walkers in Festival.jsx. */
export const BRIDGE = {
  halfSpan: RIVER_HALF + 6, // bank to bank (+ landings), along z
  width: 4.4,
  rise: 4.2, // height of the arch crown above the landings
  deckThickness: 0.45,
};
// Top of the deck at u ∈ [0, 1] across the span (G + landing height + arch).
export const bridgeDeckY = (u) => WORLD.groundY + 1.1 + BRIDGE.rise * Math.sin(Math.PI * u);

/** Brick railway viaduct crossing the mid-ground (the train runs on top). */
export const RAIL_Z = -78;
export const RAIL_DECK_Y = WORLD.groundY + 9;

/** Festival streets below the tower: lantern-lined, full of strolling people. */
export const FESTIVAL_LANES = [
  { axis: 'z', at: -30, from: -70, to: 110 },
  { axis: 'z', at: 30, from: -70, to: 110 },
  { axis: 'x', at: 30, from: -110, to: 110 },
  { axis: 'x', at: -30, from: -110, to: 110 },
];

/** A little teahouse with a glowing rooftop sign (see EasterEgg.jsx). */
export const EASTER_EGG = { x: -40, z: -102, roofTop: WORLD.groundY + 6.6 + 2.6 };

/** Building surface styles (must match the shader). */
export const STYLE = { WOOD: 0, PLASTER: 1, MODERN: 2, CASTLE: 3, VERMILION: 4, LACQUER: 5, STONE: 6, BRONZE: 7 };

const ROOF_TINTS = [
  [0.05, 0.056, 0.078], // slate kawara
  [0.035, 0.038, 0.05], // dark tile
  [0.045, 0.05, 0.07],
  [0.06, 0.045, 0.035], // weathered brown
];
const ROOF_TEMPLE = [0.06, 0.12, 0.1]; // oxidised copper

const LANTERN_COLORS = [
  { c: [3.2, 0.55, 0.22], w: 0.45 }, // red chōchin
  { c: [3.4, 1.3, 0.35], w: 0.3 }, // orange
  { c: [2.6, 1.9, 1.1], w: 0.17 }, // warm paper white
  { c: [2.8, 0.7, 1.1], w: 0.08 }, // pink
];
// Paper-and-wood kanban lit from within by oil lamps: warm tones only, no neon.
const SIGN_COLORS = [
  [1.5, 0.95, 0.45],
  [1.7, 0.6, 0.22],
  [1.3, 0.75, 0.32],
  [1.6, 0.45, 0.18],
];

function weighted(rng, items) {
  let r = rng();
  for (const it of items) {
    if ((r -= it.w) <= 0) return it.c;
  }
  return items[0].c;
}

function splits(a, b, n, rng) {
  const out = [a];
  for (let i = 1; i < n; i++) out.push(a + (b - a) * ((i + (rng() - 0.5) * 0.5) / n));
  out.push(b);
  return out;
}

export function generateCity(seed = 1337) {
  const rng = mulberry32(seed);
  const G = WORLD.groundY;
  const R = WORLD.cityRadius;
  const buildings = [];
  const roofs = [];
  const lanterns = [];
  const signs = [];

  // Boxes are given by their base (y0) and height; rx/ry rotate them (bridges).
  const addBox = (x, y0, z, w, h, d, style, lit = 0, rx = 0, ry = 0) =>
    buildings.push({ x, y: y0 + h / 2, z, w, h, d, style, lit, seed: rng(), rx, ry });
  const addRoof = (x, y0, z, w, h, d, tint) => roofs.push({ x, y: y0, z, w, h, d, tint });
  const addLantern = (x, y, z, c, s = 1) => lanterns.push({ x, y, z, c, s });

  /* ── The tower under the rooftop deck ── */
  const slate = ROOF_TINTS[0];
  addBox(0, G, 0, 14, 12, 14, STYLE.STONE);
  addBox(0, G + 12, 0, 10.5, 15, 10.5, STYLE.CASTLE, 0.25);
  addRoof(0, G + 27, 0, 14.5, 3.2, 14.5, slate);
  addBox(0, G + 27, 0, 9, 15, 9, STYLE.CASTLE, 0.3);
  addRoof(0, G + 42, 0, 13, 2.8, 13, slate);
  addBox(0, G + 42, 0, 7.6, 14.4, 7.6, STYLE.WOOD, 0.75);
  addBox(0, -3.6, 0, 7.0, 1.2, 7.0, STYLE.WOOD, 0.55); // under the pitched roof (Rooftop.jsx)
  for (const [y, half] of [
    [G + 27, 7.0],
    [G + 42, 6.3],
  ]) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) addLantern(sx * half, y - 0.7, sz * half, [3.2, 0.6, 0.25], 1.3);
  }
  // plaza lanterns around the tower base
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    addLantern(Math.cos(a) * 12, G + 1.6, Math.sin(a) * 12, [2.6, 1.6, 0.8], 0.9);
  }

  /* ── Temples: stone platform, five-storey pagoda, torii, stone lanterns ── */
  for (const t of TEMPLES) {
    addBox(t.x, G, t.z, 16, 1.2, 16, STYLE.STONE);
    let y = G + 1.2;
    for (let i = 0; i < 5; i++) {
      const w = 6.4 - i * 0.75;
      const h = i === 0 ? 3.6 : 2.6;
      addBox(t.x, y, t.z, w, h, w, STYLE.VERMILION);
      const rw = w + 3.4 - i * 0.25;
      addRoof(t.x, y + h, t.z, rw, 1.4, rw, ROOF_TEMPLE);
      if (i < 2) for (const sx of [-1, 1]) for (const sz of [-1, 1]) addLantern(t.x + sx * rw * 0.45, y + h - 0.5, t.z + sz * rw * 0.45, [3.0, 1.2, 0.4], 0.9);
      y += h + 0.9;
    }
    addBox(t.x, y, t.z, 0.35, 7, 0.35, STYLE.BRONZE);
    const tz = t.z + 17;
    addBox(t.x - 2.6, G, tz, 0.55, 6.2, 0.55, STYLE.VERMILION);
    addBox(t.x + 2.6, G, tz, 0.55, 6.2, 0.55, STYLE.VERMILION);
    addBox(t.x, G + 6.2, tz, 7.8, 0.45, 0.9, STYLE.LACQUER);
    addBox(t.x, G + 5.0, tz, 6.6, 0.35, 0.45, STYLE.VERMILION);
    for (let k = 0; k < 4; k++) {
      addLantern(t.x - 3.6, G + 1.3, t.z + 7 + k * 3, [2.6, 1.7, 0.9], 0.8);
      addLantern(t.x + 3.6, G + 1.3, t.z + 7 + k * 3, [2.6, 1.7, 0.9], 0.8);
    }
  }

  /* ── Railway viaduct ── */
  for (let x = -R - 40; x <= R + 40; x += 14) {
    addBox(x, G, RAIL_Z, 1.6, 8.2, 4.2, STYLE.STONE);
    addBox(x + 7, G + 8.2, RAIL_Z, 14.05, 0.8, 5, STYLE.STONE);
  }

  /* ── Festival streets: dense paper lanterns on both sides ── */
  for (const lane of FESTIVAL_LANES) {
    for (let s = lane.from; s <= lane.to; s += 2.6) {
      for (const side of [-1, 1]) {
        const c = (Math.round(s / 2.6) + (side > 0 ? 1 : 0)) % 2 ? [3.2, 0.55, 0.22] : [3.4, 1.35, 0.4];
        const y = G + 4.0 + Math.sin(s * 0.7) * 0.15;
        if (lane.axis === 'z') addLantern(lane.at + side * 2.7, y, s, c, 0.85);
        else addLantern(s, y, lane.at + side * 2.7, c, 0.85);
      }
    }
  }

  /* ── Easter egg teahouse ── */
  addBox(EASTER_EGG.x, G, EASTER_EGG.z, 8, 6.6, 7, STYLE.WOOD, 0.8);
  addRoof(EASTER_EGG.x, G + 6.6, EASTER_EGG.z, 9.6, 2.6, 8.6, ROOF_TINTS[1]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) addLantern(EASTER_EGG.x + sx * 4.4, G + 5.9, EASTER_EGG.z + sz * 4, [3.2, 0.6, 0.25], 1);

  /* ── Lantern rows along both river banks ── */
  for (let x = -R; x <= R; x += 5) {
    const zc = riverZ(x);
    if (Math.hypot(x, zc) > R) continue;
    for (const side of [-1, 1]) {
      if (rng() < 0.82) {
        const c = side < 0 ? [3.2, 0.6, 0.25] : weighted(rng, LANTERN_COLORS);
        addLantern(x + (rng() - 0.5), G + 2.8 + rng() * 0.5, zc + side * (RIVER_HALF + 2), c, 1.0);
      }
    }
  }

  /* ── City blocks ── */
  const districtX = -40;
  const districtZ = -60;
  // Start on a multiple of BLOCK so streets are centred on x, z = k·BLOCK — the
  // same lines the ground glow, festival lanes and crowd use.
  const grid0 = -Math.ceil(R / BLOCK) * BLOCK;
  for (let gx = grid0; gx < R; gx += BLOCK) {
    for (let gz = grid0; gz < R; gz += BLOCK) {
      const cx = gx + BLOCK / 2;
      const cz = gz + BLOCK / 2;
      const dc = Math.hypot(cx, cz);
      if (dc > R + 10) continue;

      const ix = Math.round(gx / BLOCK);
      const iz = Math.round(gz / BLOCK);
      const x0 = gx + STREET / 2 + (ix % 4 === 0 ? 3 : 0); // wider avenues every 4 blocks
      const x1 = gx + BLOCK - STREET / 2;
      const z0 = gz + STREET / 2 + (iz % 4 === 0 ? 3 : 0);
      const z1 = gz + BLOCK - STREET / 2;

      const district = Math.exp(-((cx - districtX) ** 2 + (cz - districtZ) ** 2) / (2 * 130 * 130));
      const nearRiver = Math.abs(cz - riverZ(cx)) < 60;
      const blockClear = (x, z, w, d) =>
        Math.hypot(x, z) >= 20 &&
        Math.hypot(x, z) <= R &&
        Math.abs(z - riverZ(x)) >= RIVER_HALF + 5 + Math.max(w, d) / 2 &&
        !TEMPLES.some((t) => Math.hypot(x - t.x, z - t.z) < 27) &&
        Math.abs(z - RAIL_Z) >= 3.5 + d / 2 &&
        Math.hypot(x - EASTER_EGG.x, z - EASTER_EGG.z) >= 7 + Math.max(w, d) / 2 &&
        !BRIDGES.some((bx) => Math.abs(x - bx) < 6 + w / 2 && Math.abs(z - riverZ(bx)) < 36);

      const cols = 2 + Math.floor(rng() * 3);
      const rows = 2 + Math.floor(rng() * 2);
      const xs = splits(x0, x1, cols, rng);
      const zs = splits(z0, z1, rows, rng);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const lx0 = xs[i] + 0.35;
          const lx1 = xs[i + 1] - 0.35;
          const lz0 = zs[j] + 0.35;
          const lz1 = zs[j + 1] - 0.35;
          const w = lx1 - lx0;
          const d = lz1 - lz0;
          if (w < 2.5 || d < 2.5 || rng() < 0.05) continue;
          const x = (lx0 + lx1) / 2;
          const z = (lz0 + lz1) / 2;
          if (!blockClear(x, z, w, d)) continue;
          const dist = Math.hypot(x, z);

          const r = rng();
          let floors = r < 0.25 ? 1 : r < 0.85 ? 2 : r < 0.97 ? 3 : 4;
          const centerBoost = Math.exp(-(dist * dist) / (2 * 170 * 170));
          if (rng() < 0.12 * centerBoost + 0.015) floors += 2 + Math.floor(rng() * 3);
          if (rng() < 0.004) floors = 8 + Math.floor(rng() * 5);
          const h = floors * 3.2 + rng() * 0.5;
          const modern = floors >= 6 || (floors >= 4 && rng() < 0.5);
          const style = modern ? STYLE.MODERN : rng() < 0.62 ? STYLE.WOOD : STYLE.PLASTER;
          const lit = clamp(0.12 + district * 0.35 + rng() * 0.2 + (nearRiver ? 0.08 : 0), 0, 0.75);
          addBox(x, G, z, w, h, d, style, lit);
          if (!modern || rng() < 0.15) {
            const tint = ROOF_TINTS[Math.floor(rng() * ROOF_TINTS.length)];
            addRoof(x, G + h, z, w + 1.3, Math.min(w, d) * 0.34 + 0.5, d + 1.3, tint);
          }

          // Hanging shop signs / glowing kanban on some facades
          if (floors >= 2 && rng() < 0.1 + district * 0.3) {
            const face = Math.floor(rng() * 4);
            const sh = Math.min(h - 2.2, 1.8 + rng() * 1.6);
            const sy = G + 3.0 + sh / 2 + rng() * 0.8;
            const c = SIGN_COLORS[Math.floor(rng() * SIGN_COLORS.length)];
            const along = (rng() - 0.5) * 0.6;
            if (face === 0) signs.push({ x: x + w / 2 + 0.12, y: sy, z: z + along * d, w: 0.12, h: sh, d: 0.75, c });
            if (face === 1) signs.push({ x: x - w / 2 - 0.12, y: sy, z: z + along * d, w: 0.12, h: sh, d: 0.75, c });
            if (face === 2) signs.push({ x: x + along * w, y: sy, z: z + d / 2 + 0.12, w: 0.75, h: sh, d: 0.12, c });
            if (face === 3) signs.push({ x: x + along * w, y: sy, z: z - d / 2 - 0.12, w: 0.75, h: sh, d: 0.12, c });
          }
        }
      }

      // Street lanterns along the block's perimeter
      const density = 0.16 + 0.6 * district + (nearRiver ? 0.12 : 0);
      const edges = [
        [x0, z0 - 1.0, x1, z0 - 1.0],
        [x0, z1 + 1.0, x1, z1 + 1.0],
        [x0 - 1.0, z0, x0 - 1.0, z1],
        [x1 + 1.0, z0, x1 + 1.0, z1],
      ];
      for (const [ax, az, bx2, bz] of edges) {
        const len = Math.hypot(bx2 - ax, bz - az);
        for (let s = 2; s < len - 2; s += 4.2) {
          if (rng() > density) continue;
          const f = s / len;
          const lx = ax + (bx2 - ax) * f;
          const lz = az + (bz - az) * f;
          if (Math.hypot(lx, lz) > R || Math.abs(lz - riverZ(lx)) < RIVER_HALF + 1) continue;
          addLantern(lx, G + 3.2 + rng() * 0.5, lz, weighted(rng, LANTERN_COLORS), 1);
        }
      }
    }
  }

  return { buildings, roofs, lanterns, signs };
}
