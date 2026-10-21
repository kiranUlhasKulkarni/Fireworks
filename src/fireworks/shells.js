import { evalTrajectory } from './physics';
import { KIND } from './shaders';
import { COLORS, EMBER_GOLD, STROBE_WHITE, warmOf } from './palette';
import { addFlash } from '../scene/shared/flashLights';

/**
 * Shell recipes. Each burst is fully pre-computed at the moment it explodes:
 * stars, their tail streaks, the embers they leave hanging in the air,
 * crackling strobes, and smoke — all scheduled on the GPU with future birth
 * times, so the CPU does nothing per-frame.
 */

// Reusable spawn spec (avoids allocating per particle).
const P = {
  p: [0, 0, 0],
  v: [0, 0, 0],
  birth: 0,
  life: 1,
  drag: 1,
  grav: 1,
  color: [1, 1, 1],
  intensity: 1,
  color2: [1, 1, 1],
  changeAt: 2,
  size: 0.5,
  freq: 0,
  seed: 0,
  kind: 0,
};
const tmp = [0, 0, 0];
// Global look knobs for every shell.
const SPEED = 1.9; // burst radius (≈ 35–70 m: massive shells canopying over the city)
const SIZE = 2.1; // star sprite size (metres) — they're seen from 100–370 m away
const BRIGHT = 1.25; // star brightness (HDR) — higher washes colours toward white
const COUNT = 1.5; // stars per shell
const TAILS = 0.5; // delayed tail copies (the motion-blur streaks already draw most of the trail)
const ZERO = [0, 0, 0];

const set3 = (a, x, y, z) => ((a[0] = x), (a[1] = y), (a[2] = z), a);
const copy3 = (a, b) => ((a[0] = b[0]), (a[1] = b[1]), (a[2] = b[2]), a);
const color = (name) => COLORS[name] || COLORS.gold;

/* ─────────────────────────────── primitives ─────────────────────────────── */

export function emitStar(ctx, o) {
  const { sparks, rng } = ctx;
  const seed = rng();

  copy3(P.p, o.p);
  copy3(P.v, o.v);
  P.birth = o.birth;
  P.life = o.life;
  P.drag = o.drag;
  P.grav = o.grav;
  copy3(P.color, o.color);
  copy3(P.color2, o.color2 || o.color);
  P.changeAt = o.color2 ? o.changeAt ?? 0.55 : 2;
  P.intensity = o.intensity;
  P.size = o.size;
  P.freq = o.freq ?? 0;
  P.seed = seed;
  P.kind = o.kind ?? KIND.STAR;
  sparks.spawn(P);

  // Tail streak: identical trajectory, slightly delayed → follows the head.
  const tails = Math.round((o.tails ?? 0) * (o.kind === KIND.ROCKET ? 1 : TAILS));
  for (let i = 1; i <= tails; i++) {
    const d = i * (o.tailGap ?? 0.03);
    P.birth = o.birth + d;
    P.life = o.life - d;
    P.intensity = o.intensity * Math.pow(0.66, i);
    P.size = o.size * (1 - i / (tails + 2.5));
    P.kind = KIND.TAIL;
    sparks.spawn(P);
  }

  // Residue embers dropped along the path; they linger and twinkle.
  const embers = o.embers | 0;
  if (embers > 0) {
    const ec = o.emberColor || warmOf(o.color);
    for (let j = 0; j < embers; j++) {
      const tj = ((j + rng()) / embers) * o.life * (o.emberSpan ?? 0.85);
      evalTrajectory(tmp, o.p, o.v, o.drag, o.grav, tj);
      copy3(P.p, tmp);
      set3(P.v, (rng() - 0.5) * 0.6, (rng() - 0.5) * 0.6 - 0.2, (rng() - 0.5) * 0.6);
      P.birth = o.birth + tj;
      P.life = (o.emberLife ?? 1) * (0.55 + rng() * 0.9);
      P.drag = 2.4;
      P.grav = 0.05;
      copy3(P.color, ec);
      copy3(P.color2, ec);
      P.changeAt = 2;
      P.intensity = o.emberIntensity ?? 1.6;
      P.size = o.emberSize ?? 0.28;
      P.freq = 5 + rng() * 12;
      P.seed = seed * 0.5 + rng() * 0.5;
      P.kind = KIND.EMBER;
      sparks.spawn(P);
    }
  }

  // Crackling glitter near the end of the star's life.
  if (o.strobes && rng() < o.strobes) {
    const tj = o.life * (0.55 + rng() * 0.4);
    evalTrajectory(tmp, o.p, o.v, o.drag, o.grav, tj);
    for (let s = 0; s < 2; s++) {
      set3(P.p, tmp[0] + (rng() - 0.5) * 1.6, tmp[1] + (rng() - 0.5) * 1.6, tmp[2] + (rng() - 0.5) * 1.6);
      set3(P.v, (rng() - 0.5) * 1.2, (rng() - 0.5) * 1.2, (rng() - 0.5) * 1.2);
      P.birth = o.birth + tj + rng() * 0.3;
      P.life = 1.2 + rng() * 1.6;
      P.drag = 1.8;
      P.grav = 0.12;
      copy3(P.color, o.strobeColor || STROBE_WHITE);
      copy3(P.color2, P.color);
      P.changeAt = 2;
      P.intensity = 5;
      P.size = 0.34;
      P.freq = 9 + rng() * 9;
      P.seed = rng();
      P.kind = KIND.STROBE;
      sparks.spawn(P);
    }
  }

  // Smoke trailing behind some stars.
  if (o.smoke && rng() < o.smoke) {
    for (const f of [0.25, 0.6]) {
      const tj = o.life * f;
      evalTrajectory(tmp, o.p, o.v, o.drag, o.grav, tj);
      spawnPuff(ctx, tmp, o.birth + tj, {
        size: (2.2 + rng() * 1.8) * 1.5,
        growth: 0.5,
        life: 4.5 + rng() * 2.5,
        tint: o.color,
        glow: 0.35,
        alpha: 0.14,
      });
    }
  }
}

export function spawnPuff(ctx, p, birth, o) {
  const { smoke, rng } = ctx;
  const spread = o.spread ?? 0.8;
  copy3(P.p, p);
  set3(P.v, (rng() - 0.5) * spread, (rng() - 0.5) * spread, (rng() - 0.5) * spread);
  P.birth = birth;
  P.life = o.life;
  P.drag = o.drag ?? 0.9;
  P.grav = o.grav ?? -0.012; // slightly buoyant
  const glow = o.glow ?? 0;
  set3(P.color, o.tint[0] * glow, o.tint[1] * glow, o.tint[2] * glow);
  P.intensity = o.alpha;
  copy3(P.color2, ZERO);
  P.changeAt = 0;
  P.size = o.size;
  P.freq = o.growth; // smoke: aParams.y = growth per second
  P.seed = rng();
  P.kind = (rng() - 0.5) * 0.6; // smoke: aParams.w = spin (rad/s)
  smoke.spawn(P);
}

export function emitFlash(ctx, pos, birth, c, size, intensity = 3, life = 0.22) {
  copy3(P.p, pos);
  copy3(P.v, ZERO);
  P.birth = birth;
  P.life = life;
  P.drag = 1;
  P.grav = 0;
  copy3(P.color, c);
  copy3(P.color2, c);
  P.changeAt = 2;
  P.intensity = intensity;
  P.size = size;
  P.freq = 0;
  P.seed = ctx.rng();
  P.kind = KIND.FLASH;
  ctx.sparks.spawn(P);
}

/* ─────────────────────────────── direction sets ─────────────────────────────── */

function sphereDirs(n, rng, jitter = 0.12) {
  const dirs = [];
  const off = 2 / n;
  const inc = Math.PI * (3 - Math.sqrt(5));
  const rot = rng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const y = i * off - 1 + off / 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * inc + rot;
    let x = Math.cos(phi) * r + (rng() - 0.5) * jitter;
    let yy = y + (rng() - 0.5) * jitter;
    let z = Math.sin(phi) * r + (rng() - 0.5) * jitter;
    const l = Math.hypot(x, yy, z);
    dirs.push([x / l, yy / l, z / l]);
  }
  return dirs;
}

/** Orthonormal basis for a plane facing the viewer (so rings / hearts read correctly). */
function facingBasis(pos, viewer, tilt, rng) {
  let nx = viewer[0] - pos[0];
  let nz = viewer[2] - pos[2];
  const l = Math.hypot(nx, nz) || 1;
  nx /= l;
  nz /= l;
  const n = [nx, 0, nz];
  let right = [nz, 0, -nx]; // up × n
  let up = [0, 1, 0];
  if (tilt) {
    // Pitch the plane toward/away from the viewer, then yaw it a little.
    const a = (rng() - 0.5) * tilt;
    const b = (rng() - 0.5) * tilt;
    up = [n[0] * Math.sin(a), Math.cos(a), n[2] * Math.sin(a)];
    const nPitched = [n[0] * Math.cos(a), -Math.sin(a), n[2] * Math.cos(a)];
    right = [
      right[0] * Math.cos(b) + nPitched[0] * Math.sin(b),
      nPitched[1] * Math.sin(b),
      right[2] * Math.cos(b) + nPitched[2] * Math.sin(b),
    ];
  }
  return { right, up };
}

/* ─────────────────────────────── shells ─────────────────────────────── */

function burstSmoke(ctx, b, radius, count, tint) {
  const { rng } = ctx;
  const grow = Math.min(radius / 18, 1.7); // bigger shells → bigger clouds, but capped (fill-rate)
  for (let i = 0; i < count; i++) {
    const d = sphereDirs(1, rng, 2)[0];
    const r = radius * (0.15 + 0.7 * rng());
    set3(tmp, b.pos[0] + d[0] * r, b.pos[1] + d[1] * r * 0.8, b.pos[2] + d[2] * r);
    spawnPuff(ctx, tmp, b.time + 0.05 + rng() * 0.5, {
      size: (7 + rng() * 6) * grow,
      growth: 0.13,
      life: 6 + rng() * 2.5,
      tint,
      glow: 0.6,
      alpha: 0.085,
      spread: 1.2,
    });
  }
}

function sphericalShell(ctx, b, o) {
  const { rng } = ctx;
  const A = color(b.colorA);
  const B = b.colorB ? color(b.colorB) : null;
  const n = Math.round(o.count * COUNT * Math.min(1.4, b.scale));
  const speed = o.speed * b.scale * SPEED;
  for (const d of sphereDirs(n, rng)) {
    const s = speed * (0.93 + rng() * 0.14);
    emitStar(ctx, {
      p: b.pos,
      v: [d[0] * s, d[1] * s, d[2] * s],
      birth: b.time,
      life: o.life[0] + rng() * (o.life[1] - o.life[0]),
      drag: o.drag,
      grav: o.grav,
      color: A,
      color2: B,
      changeAt: 0.5 + rng() * 0.1,
      intensity: o.intensity * BRIGHT,
      size: o.size * SIZE,
      tails: o.tails,
      tailGap: o.tailGap,
      embers: o.embers,
      emberLife: o.emberLife,
      emberColor: o.emberColor,
      emberIntensity: o.emberIntensity,
      emberSpan: o.emberSpan,
      strobes: o.strobes,
      smoke: o.smoke ?? 0.12,
    });
  }
  if (o.pistil) {
    const Pc = color(b.pistil);
    for (const d of sphereDirs(Math.round(o.pistil * COUNT * Math.min(1.4, b.scale)), rng)) {
      const s = speed * 0.4 * (0.9 + rng() * 0.2);
      emitStar(ctx, {
        p: b.pos,
        v: [d[0] * s, d[1] * s, d[2] * s],
        birth: b.time + 0.04,
        life: 1.1 + rng() * 0.4,
        drag: o.drag,
        grav: o.grav,
        color: Pc,
        intensity: o.intensity * 0.9 * BRIGHT,
        size: o.size * 0.8 * SIZE,
        tails: 1,
        tailGap: 0.03,
      });
    }
  }
  return speed / o.drag; // approximate final radius
}

const SHELLS = {
  peony: (ctx, b) =>
    sphericalShell(ctx, b, {
      count: 130, speed: 25, drag: 1.75, grav: 0.32, life: [1.5, 2.0],
      intensity: 7, size: 1.0, tails: 2, tailGap: 0.035, embers: 3, emberLife: 0.8,
    }),

  chrysanthemum: (ctx, b) =>
    sphericalShell(ctx, b, {
      count: 165, speed: 30, drag: 1.5, grav: 0.35, life: [1.9, 2.5],
      intensity: 7.5, size: 1.05, tails: 4, tailGap: 0.03, embers: 9, emberLife: 1.0,
      pistil: 45,
    }),

  willow: (ctx, b) =>
    sphericalShell(ctx, { ...b, colorA: 'gold', colorB: null }, {
      count: 110, speed: 21, drag: 1.05, grav: 0.6, life: [3.6, 4.6],
      intensity: 4.5, size: 0.85, tails: 3, tailGap: 0.05, embers: 22, emberLife: 2.4,
      emberColor: EMBER_GOLD, emberIntensity: 1.3, emberSpan: 0.95, strobes: 0.2, smoke: 0.08,
    }),

  // Big golden "kamuro" curtain: the slowest, longest-lingering effect (finale closer).
  kamuro: (ctx, b) =>
    sphericalShell(ctx, { ...b, colorA: b.colorA === 'white' ? 'white' : 'gold', colorB: null }, {
      count: 150, speed: 26, drag: 1.0, grav: 0.55, life: [4.4, 5.2],
      intensity: 5.5, size: 0.95, tails: 3, tailGap: 0.05, embers: 26, emberLife: 2.8,
      emberColor: EMBER_GOLD, emberIntensity: 1.4, emberSpan: 0.95, strobes: 0.5, smoke: 0.08,
    }),

  glitter: (ctx, b) =>
    sphericalShell(ctx, { ...b, colorB: null }, {
      count: 140, speed: 26, drag: 1.6, grav: 0.3, life: [1.6, 2.0],
      intensity: 6, size: 0.9, tails: 2, tailGap: 0.035, embers: 6, emberLife: 1.2,
      strobes: 0.9,
    }),

  ring(ctx, b) {
    const { rng } = ctx;
    const A = color(b.colorA);
    const { right, up } = facingBasis(b.pos, ctx.viewer, 1.2, rng);
    const n = Math.round(90 * COUNT * Math.min(1.4, b.scale));
    const speed = 26 * b.scale * SPEED;
    const rot = rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rot;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const s = speed * (0.97 + rng() * 0.06);
      emitStar(ctx, {
        p: b.pos,
        v: [(right[0] * ca + up[0] * sa) * s, (right[1] * ca + up[1] * sa) * s, (right[2] * ca + up[2] * sa) * s],
        birth: b.time,
        life: 1.8 + rng() * 0.4,
        drag: 1.6,
        grav: 0.25,
        color: A,
        color2: b.colorB ? color(b.colorB) : null,
        intensity: 7.5 * BRIGHT,
        size: 1.0 * SIZE,
        tails: 3,
        tailGap: 0.03,
        embers: 4,
        emberLife: 0.9,
        smoke: 0.1,
      });
    }
    sphericalShell(ctx, { ...b, colorA: b.pistil, colorB: null, scale: b.scale * 0.45 }, {
      count: 60, speed: 22, drag: 1.8, grav: 0.3, life: [1.0, 1.4],
      intensity: 6, size: 0.8, tails: 1, tailGap: 0.03, embers: 0, smoke: 0,
    });
    return speed / 1.6;
  },

  // ♡ — classic heart curve in a plane that faces the camera.
  heart(ctx, b) {
    const { rng } = ctx;
    const A = color(b.colorA || 'pink');
    const B = b.colorB ? color(b.colorB) : null;
    const { right, up } = facingBasis(b.pos, ctx.viewer, 0, rng);
    const n = Math.round(130 * COUNT * Math.min(1.4, b.scale));
    const speed = 23 * b.scale * SPEED;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const hx = (16 * Math.pow(Math.sin(t), 3)) / 17;
      const hy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 + 0.12;
      const s = speed * (0.985 + rng() * 0.03);
      const depth = (rng() - 0.5) * 0.06;
      emitStar(ctx, {
        p: b.pos,
        v: [
          (right[0] * hx + up[0] * hy) * s + depth,
          (right[1] * hx + up[1] * hy) * s,
          (right[2] * hx + up[2] * hy) * s + depth,
        ],
        birth: b.time,
        life: 2.3 + rng() * 0.4,
        drag: 1.6,
        grav: 0.12,
        color: A,
        color2: B,
        changeAt: 0.6,
        intensity: 8 * BRIGHT,
        size: 1.05 * SIZE,
        tails: 3,
        tailGap: 0.03,
        embers: 5,
        emberLife: 1.1,
        emberColor: [1.0, 0.5, 0.6],
        strobes: 0.25,
        strobeColor: [1.0, 0.8, 0.9],
        smoke: 0.08,
      });
    }
    return speed / 1.6;
  },

  // Palm: a few thick golden comets with long sparkling trails.
  palm(ctx, b) {
    const { rng } = ctx;
    const A = color(b.colorA);
    const n = 10 + Math.floor(rng() * 4);
    const speed = 34 * b.scale * SPEED;
    const rot = rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const az = rot + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.3;
      const el = 0.55 + rng() * 0.5; // from vertical
      const d = [Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az)];
      emitStar(ctx, {
        p: b.pos,
        v: [d[0] * speed, d[1] * speed, d[2] * speed],
        birth: b.time,
        life: 2.4 + rng() * 0.5,
        drag: 1.15,
        grav: 0.55,
        color: COLORS.gold,
        color2: A,
        changeAt: 0.7,
        intensity: 8 * BRIGHT,
        size: 1.5 * SIZE,
        tails: 8,
        tailGap: 0.025,
        embers: 40,
        emberLife: 1.4,
        emberColor: EMBER_GOLD,
        strobes: 0.5,
        smoke: 0.5,
      });
    }
    return speed / 1.15;
  },
};

export const SHELL_TYPES = Object.keys(SHELLS);

/** Explode shell `b` = { type, pos, time, scale, colorA, colorB, pistil }. */
export function burstShell(ctx, b) {
  const recipe = SHELLS[b.type] || SHELLS.peony;
  const radius = recipe(ctx, b) || 16;
  const A = color(b.type === 'willow' || (b.type === 'kamuro' && b.colorA !== 'white') ? 'gold' : b.colorA);
  emitFlash(ctx, b.pos, b.time, A, radius * 0.1, 1.0, 0.16);
  burstSmoke(ctx, b, radius, Math.round(8 * Math.min(1.4, b.scale)), A);
  addFlash(b.pos, A, Math.min(1.6, 0.7 * b.scale + 0.35), b.time);
}
