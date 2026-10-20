import { BufferAttribute, BufferGeometry, DataUtils, DynamicDrawUsage, Points, Sphere, Vector3 } from 'three';

const toHalf = DataUtils.toHalfFloat;

/**
 * Fixed-size ring buffer of GPU particles.
 *
 * Particles are written ONCE (at spawn) with their full physical description;
 * the vertex shader computes position, color and fade analytically from time.
 * Per frame, only the newly written slice of each attribute is uploaded.
 *
 * Packed layout (44 bytes per particle, so the 360° show fits in memory):
 *   position  3 × f32   origin p0
 *   aBirth    1 × f32   birth time (needs full precision)
 *   aVel      3 × f16   initial velocity v0
 *   aPhys     4 × f16   life, drag k, gravity scale, intensity (smoke: alpha)
 *   aParams   4 × f16   size (m), freq, seed, kind (smoke: size, growth, seed, spin)
 *   aColor    4 × u8    rgb (0..1), unused
 *   aColor2   4 × u8    rgb (colour change), changeAt (fraction of life, 1 = never)
 */
export class ParticlePool {
  constructor(capacity, material) {
    this.capacity = capacity;
    this.cursor = 0;
    this.pendingStart = 0;
    this.pendingCount = 0;

    const make = (Array, size, normalized = false) => {
      const attr = new BufferAttribute(new Array(capacity * size), size, normalized);
      attr.setUsage(DynamicDrawUsage);
      return attr;
    };
    const half = (size) => {
      const attr = make(Uint16Array, size);
      attr.isFloat16BufferAttribute = true; // tells three to upload as HALF_FLOAT
      return attr;
    };
    this.attrs = {
      position: make(Float32Array, 3),
      aBirth: make(Float32Array, 1),
      aVel: half(3),
      aPhys: half(4),
      aParams: half(4),
      aColor: make(Uint8Array, 4, true),
      aColor2: make(Uint8Array, 4, true),
    };
    // Mark every slot as dead (life = −1).
    const phys = this.attrs.aPhys.array;
    const dead = toHalf(-1);
    for (let i = 0; i < capacity; i++) phys[i * 4] = dead;

    const geometry = new BufferGeometry();
    for (const [name, attr] of Object.entries(this.attrs)) geometry.setAttribute(name, attr);
    geometry.boundingSphere = new Sphere(new Vector3(), 1e5);

    this.geometry = geometry;
    this.points = new Points(geometry, material);
    this.points.frustumCulled = false;
  }

  /** `o` is a reusable spec object (see shells.js) — no allocations per particle. */
  spawn(o) {
    const i = this.cursor;
    this.cursor = i + 1 === this.capacity ? 0 : i + 1;
    const i3 = i * 3;
    const i4 = i * 4;
    const { position, aBirth, aVel, aPhys, aParams, aColor, aColor2 } = this.attrs;

    position.array[i3] = o.p[0];
    position.array[i3 + 1] = o.p[1];
    position.array[i3 + 2] = o.p[2];
    aBirth.array[i] = o.birth;

    const v = aVel.array;
    v[i3] = toHalf(o.v[0]);
    v[i3 + 1] = toHalf(o.v[1]);
    v[i3 + 2] = toHalf(o.v[2]);

    const ph = aPhys.array;
    ph[i4] = toHalf(o.life);
    ph[i4 + 1] = toHalf(o.drag);
    ph[i4 + 2] = toHalf(o.grav);
    ph[i4 + 3] = toHalf(o.intensity);

    const pa = aParams.array;
    pa[i4] = toHalf(o.size);
    pa[i4 + 1] = toHalf(o.freq);
    pa[i4 + 2] = toHalf(o.seed);
    pa[i4 + 3] = toHalf(o.kind);

    const c = aColor.array;
    c[i4] = unit8(o.color[0]);
    c[i4 + 1] = unit8(o.color[1]);
    c[i4 + 2] = unit8(o.color[2]);
    c[i4 + 3] = 255;

    const c2 = aColor2.array;
    c2[i4] = unit8(o.color2[0]);
    c2[i4 + 1] = unit8(o.color2[1]);
    c2[i4 + 2] = unit8(o.color2[2]);
    c2[i4 + 3] = unit8(o.changeAt);

    if (this.pendingCount === 0) this.pendingStart = i;
    if (this.pendingCount < this.capacity) this.pendingCount++;
  }

  /** Upload only what changed since last frame (handles ring wrap-around). */
  flush() {
    if (this.pendingCount === 0) return;
    const start = this.pendingStart;
    const count = this.pendingCount;
    const cap = this.capacity;
    for (const attr of Object.values(this.attrs)) {
      const n = attr.itemSize;
      attr.clearUpdateRanges();
      if (start + count <= cap) {
        attr.addUpdateRange(start * n, count * n);
      } else {
        attr.addUpdateRange(start * n, (cap - start) * n);
        attr.addUpdateRange(0, (start + count - cap) * n);
      }
      attr.needsUpdate = true;
    }
    this.pendingCount = 0;
  }

  dispose() {
    this.geometry.dispose();
  }
}

function unit8(x) {
  return x <= 0 ? 0 : x >= 1 ? 255 : (x * 255 + 0.5) | 0;
}
