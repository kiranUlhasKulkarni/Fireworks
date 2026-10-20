import { Color, Vector3 } from 'three';

/**
 * Every burst registers a short-lived "flash". The four strongest flashes are
 * fed to the city/roof/water/smoke shaders as uniforms, and the strongest one
 * also drives a real directional light so the couple gets colored rim light.
 */
export const MAX_FLASHES = 4;
const FLASH_GAIN = 2.6;
const DECAY = 3.2;

const slots = Array.from({ length: MAX_FLASHES }, () => ({
  pos: new Vector3(),
  color: new Color(),
  t0: -1e9,
  power: 0,
}));

export const flashUniforms = {
  uFlashPos: { value: Array.from({ length: MAX_FLASHES }, () => new Vector3(0, -1e4, 0)) },
  uFlashColor: { value: Array.from({ length: MAX_FLASHES }, () => new Vector3()) },
  uFlashRadius: { value: 170 },
  uFlashSky: { value: new Vector3() },
};

function levelOf(slot, time) {
  const age = time - slot.t0;
  if (age < 0) return 0;
  const attack = Math.min(1, age / 0.05);
  return slot.power * attack * Math.exp(-age * DECAY);
}

export function addFlash(pos, rgb, power, time) {
  let best = slots[0];
  let bestLevel = Infinity;
  for (const s of slots) {
    const l = levelOf(s, time);
    if (l < bestLevel) {
      bestLevel = l;
      best = s;
    }
  }
  best.pos.set(pos[0], pos[1], pos[2]);
  best.color.setRGB(rgb[0], rgb[1], rgb[2]);
  best.t0 = time;
  best.power = power;
}

const strongest = { pos: new Vector3(), color: new Color(), level: 0 };

/** Updates the shader uniforms; returns the strongest flash this frame. */
export function updateFlashes(time) {
  strongest.level = 0;
  const sky = flashUniforms.uFlashSky.value.set(0, 0, 0);
  slots.forEach((s, i) => {
    const level = levelOf(s, time);
    flashUniforms.uFlashPos.value[i].copy(s.pos);
    flashUniforms.uFlashColor.value[i].set(s.color.r, s.color.g, s.color.b).multiplyScalar(level * FLASH_GAIN);
    sky.x += s.color.r * level;
    sky.y += s.color.g * level;
    sky.z += s.color.b * level;
    if (level > strongest.level) {
      strongest.level = level;
      strongest.pos.copy(s.pos);
      strongest.color.copy(s.color);
    }
  });
  return strongest;
}
