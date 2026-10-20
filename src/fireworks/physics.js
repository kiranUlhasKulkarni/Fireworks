/**
 * Closed-form projectile motion with linear air drag, gravity and wind.
 * The GPU vertex shader evaluates the exact same formula, so the CPU can
 * pre-compute where a star will be at any time (for trailing embers / smoke)
 * and everything lines up perfectly without per-frame simulation.
 *
 *   v_terminal = g / k + wind
 *   p(t) = p0 + v_terminal * t + (v0 - v_terminal) * (1 - e^(-k t)) / k
 */
export const GRAVITY = 9.81;
export const WIND = [1.4, 0, 0.45]; // m/s, gentle breeze that carries smoke

export function evalTrajectory(out, p0, v0, k, g, t) {
  const tx = WIND[0];
  const ty = (-GRAVITY * g) / k + WIND[1];
  const tz = WIND[2];
  const f = (1 - Math.exp(-k * t)) / k;
  out[0] = p0[0] + tx * t + (v0[0] - tx) * f;
  out[1] = p0[1] + ty * t + (v0[1] - ty) * f;
  out[2] = p0[2] + tz * t + (v0[2] - tz) * f;
  return out;
}

/** Initial velocity needed to travel from p0 to target in exactly T seconds. */
export function solveLaunchVelocity(out, p0, target, k, g, T) {
  const tx = WIND[0];
  const ty = (-GRAVITY * g) / k + WIND[1];
  const tz = WIND[2];
  const f = (1 - Math.exp(-k * T)) / k;
  out[0] = (target[0] - p0[0] - tx * T) / f + tx;
  out[1] = (target[1] - p0[1] - ty * T) / f + ty;
  out[2] = (target[2] - p0[2] - tz * T) / f + tz;
  return out;
}
