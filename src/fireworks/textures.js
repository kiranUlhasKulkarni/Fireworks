import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat } from 'three';
import { mulberry32 } from '../utils/random';

/** Tileable value-noise fbm in JS (used once at startup). */
function makeFbm(seed, period = 32) {
  const rng = mulberry32(seed);
  const grid = new Float32Array(period * period).map(() => rng());
  const at = (x, y) => grid[(((y % period) + period) % period) * period + (((x % period) + period) % period)];
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  return (x, y, octaves = 5) => {
    let v = 0;
    let amp = 0.5;
    let f = 1;
    for (let i = 0; i < octaves; i++) {
      v += amp * noise(x * f, y * f);
      f *= 2;
      amp *= 0.5;
    }
    return v / (1 - Math.pow(0.5, octaves));
  };
}

/**
 * Soft billowy smoke puff.
 *   R = density, G = high-frequency noise (erosion mask), B = low-frequency shading
 */
export function makePuffTexture(size = 128) {
  const fbmA = makeFbm(11);
  const fbmB = makeFbm(29);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size * 2 - 1;
      const v = (y + 0.5) / size * 2 - 1;
      const r = Math.sqrt(u * u + v * v);
      const n = fbmA(x / size * 6, y / size * 6);
      const radial = Math.pow(Math.max(0, 1 - r * r), 1.6);
      let density = radial * (0.3 + 1.0 * n);
      density = Math.min(1, Math.max(0, density * 1.25 - 0.1));
      const detail = fbmB(x / size * 14, y / size * 14);
      const i = (y * size + x) * 4;
      data[i] = density * 255;
      data[i + 1] = detail * 255;
      data[i + 2] = n * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
