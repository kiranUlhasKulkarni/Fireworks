import { pick } from '../utils/random';
import { VIVID } from './palette';

/** Time of the very first burst after the click (the scene dims just before it). */
export const OPENING_BURST = 1.3;

/**
 * Endless show program. Shells are scheduled by burst time in "movements"
 * of ~14 s that repeat (with fresh randomness) until the show is stopped:
 *
 *   0–9 s    dense body: ~6–8 shells/s, mirrored pairs, a heart each movement
 *   9–12 s   crescendo: ~15 shells/s
 *   12–14 s  canopy curtain: golden & white kamuro spanning the sky + a heart
 *
 * Each program fills ONE sector of the sky (the engine runs three, 120° each,
 * so the whole 360° around the city is always full). Placement is layered:
 * distances from just beyond the roof to far over the mountains, and always
 * HIGH — each burst gets an elevation angle (as seen from the roof) so the
 * upper half of the frame fills up regardless of distance.
 */
const MOVEMENT = 14;
const BODY = ['peony', 'chrysanthemum', 'chrysanthemum', 'ring', 'palm', 'willow', 'glitter', 'peony'];
const CRESCENDO = ['chrysanthemum', 'peony', 'glitter', 'chrysanthemum', 'palm', 'willow'];

export class ShowProgram {
  /** grand: the sector facing the camera at the click gets the giant opening heart. */
  constructor(rng, { grand = true } = {}) {
    this.rng = rng;
    this.queue = []; // sorted by launchAt
    this.plannedUntil = 0; // burst-time horizon already planned
    this.opening(grand);
  }

  shell(burstAt, type, o = {}) {
    const rng = this.rng;
    // Layered depth: near (just past the roof) → far (over the mountains)
    const layer = o.layer ?? rng();
    const dist = o.dist ?? 110 + layer * layer * 260;
    // High altitude: 9°–34° above the horizon as seen from the roof
    const elev = ((o.elev ?? 9 + rng() * 25) * Math.PI) / 180;
    const height = o.height ?? 2 + dist * Math.tan(elev);
    // Bigger when further away so distant shells still read as massive
    const scale = (o.scale ?? 1.0 + rng() * 0.45) * (0.85 + (dist / 370) * 0.6);
    let flight = o.flight ?? 1.9 + rng() * 0.9 + height / 220;
    if (burstAt - flight < 0) flight = Math.max(0.8, burstAt);
    this.queue.push({
      type,
      burstAt,
      flight,
      launchAt: Math.max(0, burstAt - flight),
      az: o.az ?? rng() * 2 - 1, // −1..1 across this program's sector
      dist,
      height,
      scale,
      colorA: o.colorA ?? pick(rng, VIVID),
      colorB: o.colorB !== undefined ? o.colorB : rng() < 0.4 ? pick(rng, VIVID) : null,
      pistil: o.pistil ?? pick(rng, VIVID),
    });
  }

  opening(grand) {
    const t0 = OPENING_BURST;
    // A huge heart right over the city, then the sky erupts around it.
    if (grand) this.shell(t0, 'heart', { az: 0, dist: 150, elev: 17, scale: 1.5, colorA: 'pink', colorB: 'red', flight: 1.25 });
    const ring = [-0.9, -0.55, -0.2, 0.2, 0.55, 0.9];
    ring.forEach((az, i) =>
      this.shell(t0 + 0.45 + i * 0.07, i % 2 ? 'chrysanthemum' : 'peony', {
        az,
        elev: 14 + (i % 3) * 7,
        colorA: pick(this.rng, ['violet', 'magenta', 'electric', 'white', 'pink', 'deepblue']),
        flight: 1.6,
      }),
    );
    this.plannedUntil = t0 + 1.0;
    this.queue.sort((a, b) => a.launchAt - b.launchAt);
  }

  /** Make sure every shell bursting before `horizon` (show seconds) is queued. */
  planUntil(horizon) {
    const rng = this.rng;
    let added = false;
    while (this.plannedUntil < horizon) {
      added = true;
      const t = this.plannedUntil;
      const m = (t - OPENING_BURST - 1.0) % MOVEMENT;
      let dt;
      if (m < 9) {
        if (rng() < 0.2) {
          const type = pick(rng, ['peony', 'chrysanthemum', 'ring', 'glitter']);
          const a = 0.35 + rng() * 0.55;
          const common = { colorA: pick(rng, VIVID), colorB: null, elev: 10 + rng() * 20, layer: rng(), scale: 1.15 };
          this.shell(t, type, { ...common, az: -a });
          this.shell(t + 0.04, type, { ...common, az: a });
        } else {
          this.shell(t, pick(rng, BODY));
        }
        // A second, more distant shell most of the time → layered depth
        if (rng() < 0.55) this.shell(t + rng() * 0.1, pick(rng, BODY), { layer: 0.7 + rng() * 0.3 });
        if (m > 4.6 && m < 4.9) {
          this.shell(t, 'heart', {
            az: (rng() - 0.5) * 0.7,
            colorA: pick(rng, ['pink', 'rose', 'magenta']),
            colorB: 'violet',
            scale: 1.3,
            elev: 16,
          });
        }
        dt = 0.2 + rng() * 0.25;
      } else if (m < 12) {
        this.shell(t, pick(rng, CRESCENDO), { scale: 0.95 + rng() * 0.4 });
        if (rng() < 0.6) this.shell(t + 0.03, pick(rng, CRESCENDO), { layer: rng() });
        dt = 0.08 + rng() * 0.09;
      } else {
        [-0.85, -0.45, 0, 0.45, 0.85].forEach((az, i) =>
          this.shell(t + i * 0.05, 'kamuro', { az, elev: 20 + (i % 2) * 8, colorA: i === 2 ? 'white' : 'gold', scale: 1.2 }),
        );
        this.shell(t + 0.9, 'heart', { az: 0, elev: 13, colorA: 'pink', colorB: 'red', scale: 1.45 });
        dt = MOVEMENT - m + 0.01; // jump to the next movement
      }
      this.plannedUntil = t + dt;
    }
    if (added) this.queue.sort((a, b) => a.launchAt - b.launchAt);
  }
}
