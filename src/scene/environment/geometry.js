import { BufferGeometry, Float32BufferAttribute } from 'three';

/**
 * Japanese hip roof (yosemune) with concave slopes and upturned corners.
 * Unit footprint 1×1 centred on the origin; eaves at y = 0, ridge at y = 1.
 * Scale per instance to (width, height, depth).
 * Each side has its own vertices, so hips stay crisp while slopes stay smooth.
 */
export function createRoofGeometry({ rings = 3, perSide = 3, topRatio = 0.16, curl = 0.22, power = 1.7 } = {}) {
  const positions = [];
  const indices = [];
  const corners = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  const cols = perSide + 1;

  for (let side = 0; side < 4; side++) {
    const a = corners[side];
    const b = corners[(side + 1) % 4];
    const base = positions.length / 3;
    for (let s = 0; s <= rings; s++) {
      const f = s / rings;
      const scale = 1 + (topRatio - 1) * f;
      const y = Math.pow(f, power);
      for (let i = 0; i <= perSide; i++) {
        const u = i / perSide;
        const x = (a[0] + (b[0] - a[0]) * u) * scale;
        const z = (a[1] + (b[1] - a[1]) * u) * scale;
        const cornerFactor = Math.pow(Math.abs(2 * u - 1), 6);
        const lift = curl * cornerFactor * (1 - f) * (1 - f);
        positions.push(x, y + lift, z);
      }
    }
    for (let s = 0; s < rings; s++) {
      for (let i = 0; i < perSide; i++) {
        const p0 = base + s * cols + i;
        const p1 = p0 + 1;
        const p2 = p0 + cols;
        const p3 = p2 + 1;
        indices.push(p0, p2, p1, p1, p2, p3);
      }
    }
    // Ridge cap fan
    const top = base + rings * cols;
    const apex = positions.length / 3;
    positions.push(0, 1.04, 0);
    for (let i = 0; i < perSide; i++) indices.push(top + i, apex, top + i + 1);
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Ring of mountain silhouettes on the horizon. */
export function createMountainGeometry({ radius, baseY, minH, maxH, seed = 1, segments = 480 }) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const phases = Array.from({ length: 7 }, () => rand() * Math.PI * 2);
  const positions = [];
  const edges = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    let h = 0;
    let norm = 0;
    for (let k = 0; k < phases.length; k++) {
      const w = 1 / (k + 1);
      h += Math.sin(a * (k * 2 + 2) + phases[k]) * w;
      norm += w;
    }
    h = 0.5 + 0.5 * (h / norm);
    // Craggy ridgeline detail on top of the broad shapes
    h += 0.06 * Math.sin(a * 23 + phases[0] * 3) + 0.035 * Math.sin(a * 41 + phases[1] * 5) + 0.02 * Math.sin(a * 77 + phases[2]);
    h = Math.max(0, h);
    const y = baseY + minH + (maxH - minH) * Math.pow(h, 1.4);
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    positions.push(x, baseY - 20, z, x, y, z);
    edges.push(0, 1);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('aEdge', new Float32BufferAttribute(edges, 1));
  geo.setIndex(indices);
  return geo;
}
