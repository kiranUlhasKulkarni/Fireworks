import { TIMING } from '../../config';

/**
 * Shared, eased 0..1 blend between the rest pose (0) and the kiss (1).
 * Drives both the placeholder rig and the clip weights of .glb models.
 */
export const kiss = { k: 0, value: 0 };

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // easeInOutCubic

export function updateKiss(dt, phase) {
  const target = phase === 'active' ? 1 : 0;
  const rate = target > kiss.k ? 1 / TIMING.kissInSeconds : 1 / TIMING.kissOutSeconds;
  const step = rate * Math.min(dt, 0.1);
  kiss.k = target > kiss.k ? Math.min(target, kiss.k + step) : Math.max(target, kiss.k - step);
  kiss.value = ease(kiss.k);
  return kiss.value;
}
