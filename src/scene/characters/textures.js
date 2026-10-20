import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { mulberry32 } from '../../utils/random';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeat = [1, 1]) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

function fabricNoise(ctx, size, amount, seed) {
  const rng = mulberry32(seed);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Ichimatsu (green & black checkered) haori pattern. */
export function makeCheckerTexture(repeat = [1, 1]) {
  const size = 256;
  const cells = 8;
  const [c, ctx] = canvas(size);
  const s = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#17805e' : '#0b0c0d';
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  fabricNoise(ctx, size, 14, 3);
  return toTexture(c, repeat);
}

/** Kanao's capelet: white, blushing into soft pink / lilac toward the hem. */
export function makeCapeletTexture() {
  const size = 256;
  const [c, ctx] = canvas(size);
  // CylinderGeometry UVs: v = 0 at the bottom (hem), 1 at the top (shoulders)
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#fbf8f6');
  g.addColorStop(0.55, '#f7eef2');
  g.addColorStop(0.85, '#f3b9d2');
  g.addColorStop(1, '#c99be6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  fabricNoise(ctx, size, 8, 12);
  return toTexture(c);
}

/** Dark uniform skirt with soft pleats. */
export function makeSkirtTexture(repeat = [1, 1]) {
  const size = 256;
  const [c, ctx] = canvas(size);
  ctx.fillStyle = '#16151d';
  ctx.fillRect(0, 0, size, size);
  const pleats = 16;
  for (let i = 0; i < pleats; i++) {
    const g = ctx.createLinearGradient((i * size) / pleats, 0, ((i + 1) * size) / pleats, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.07)');
    g.addColorStop(0.85, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect((i * size) / pleats, 0, size / pleats, size);
  }
  fabricNoise(ctx, size, 8, 14);
  return toTexture(c, repeat);
}

/** Weathered wooden deck planks. */
export function makeWoodTexture(repeat = [1, 1]) {
  const size = 512;
  const [c, ctx] = canvas(size);
  const rng = mulberry32(21);
  const planks = 12;
  const ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const y = p * ph;
    ctx.fillStyle = `hsl(${25 + rng() * 4}, 38%, ${27 + rng() * 4}%)`;
    ctx.fillRect(0, y, size, ph);
    // Staggered butt joints with a subtle tone change per board
    const shift = rng() * size;
    for (let seg = 0; seg < 2; seg++) {
      const x = (shift + seg * size * 0.5) % size;
      ctx.fillStyle = `rgba(${rng() < 0.5 ? '255,220,180' : '40,20,10'},${0.04 + rng() * 0.05})`;
      ctx.fillRect(x, y, size * 0.5, ph);
      ctx.fillRect(x - size, y, size * 0.5, ph);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, y, 2, ph);
    }
    for (let gline = 0; gline < 7; gline++) {
      ctx.strokeStyle = `rgba(30,15,5,${0.12 + rng() * 0.12})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gy = y + 3 + rng() * (ph - 6);
      ctx.moveTo(0, gy);
      for (let x = 0; x <= size; x += 16) ctx.lineTo(x, gy + Math.sin(x * 0.02 + gline) * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, y, size, 2);
  }
  fabricNoise(ctx, size, 10, 9);
  return toTexture(c, repeat);
}

/** Soft radial gradient (for blob shadows and glows). */
export function makeRadialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const size = 128;
  const [c, ctx] = canvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
