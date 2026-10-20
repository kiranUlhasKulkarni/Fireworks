import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { WORLD } from '../world';
import { generateCity } from './cityLayout';
import { createMountainGeometry, createRoofGeometry } from './geometry';
import { createBuildingMaterial, createGroundMaterial, createMountainMaterial, createRoofMaterial } from './cityMaterials';
import { sharedUniforms } from '../shared/uniforms';
import { addIgnite } from '../shared/ignite';

const noRaycast = () => null;

function instanced(geometry, material, items, write) {
  const mesh = new InstancedMesh(geometry, material, items.length);
  const m = new Matrix4();
  const p = new Vector3();
  const q = new Quaternion();
  const s = new Vector3();
  const e = new Euler();
  items.forEach((it, i) => {
    p.set(it.x, it.y, it.z);
    q.setFromEuler(e.set(it.rx || 0, it.ry || 0, 0));
    s.set(it.w, it.h, it.d);
    mesh.setMatrixAt(i, m.compose(p, q, s));
    write?.(mesh, it, i);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.raycast = noRaycast; // never part of pointer picking
  return mesh;
}

function buildCityMeshes() {
  const data = generateCity();

  // Buildings
  const boxGeo = new BoxGeometry(1, 1, 1);
  const info = new Float32Array(data.buildings.length * 4);
  data.buildings.forEach((b, i) => info.set([b.seed, b.style, b.lit, 0], i * 4));
  boxGeo.setAttribute('aInfo', new InstancedBufferAttribute(info, 4));
  const buildings = instanced(boxGeo, createBuildingMaterial(), data.buildings);

  // Roofs
  const roofGeo = createRoofGeometry();
  const tints = new Float32Array(data.roofs.length * 3);
  data.roofs.forEach((r, i) => tints.set(r.tint, i * 3));
  roofGeo.setAttribute('aTint', new InstancedBufferAttribute(tints, 3));
  const roofs = instanced(roofGeo, createRoofMaterial(), data.roofs);

  // Lanterns: HDR instance colours make them glow through the bloom pass.
  const lanternMat = addIgnite(new MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: true }));
  const color = new Color();
  const lanternItems = data.lanterns.map((l) => ({ x: l.x, y: l.y, z: l.z, w: 0.32 * l.s, h: 0.42 * l.s, d: 0.32 * l.s }));
  const lanterns = instanced(new SphereGeometry(1, 10, 8), lanternMat, lanternItems, (mesh, _it, i) =>
    mesh.setColorAt(i, color.setRGB(...data.lanterns[i].c)),
  );

  const signMat = addIgnite(new MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: true }));
  const signs = instanced(new BoxGeometry(1, 1, 1), signMat, data.signs, (mesh, it, i) =>
    mesh.setColorAt(i, color.setRGB(...it.c)),
  );

  // Ground and distant mountains (the river is River.jsx)
  const ground = new Mesh(new PlaneGeometry(2600, 2600).rotateX(-Math.PI / 2), createGroundMaterial());
  ground.position.y = WORLD.groundY;


  // Faded, misty mountains on the far horizon (ridgelines catch firework light)
  const mountainsNear = new Mesh(
    createMountainGeometry({ radius: 980, baseY: WORLD.groundY, minH: 20, maxH: 120, seed: 7 }),
    createMountainMaterial(new Color(0.012, 0.01, 0.028), 0.45),
  );
  const mountainsFar = new Mesh(
    createMountainGeometry({ radius: 1250, baseY: WORLD.groundY, minH: 60, maxH: 230, seed: 3 }),
    createMountainMaterial(new Color(0.02, 0.016, 0.04), 0.7),
  );
  for (const m of [ground, mountainsNear, mountainsFar]) {
    m.frustumCulled = false;
    m.raycast = noRaycast;
  }

  return { buildings, roofs, lanterns, signs, ground, mountainsNear, mountainsFar };
}

function applyDim(meshes) {
  const d = sharedUniforms.uDim.value;
  meshes.lanterns.material.color.setScalar(0.5 + 0.5 * d);
  meshes.signs.material.color.setScalar(0.5 + 0.5 * d);
}

export function City() {
  const meshes = useMemo(buildCityMeshes, []);
  useFrame(() => applyDim(meshes));

  useEffect(
    () => () => {
      Object.values(meshes).forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
      });
    },
    [meshes],
  );

  return (
    <group>
      {Object.entries(meshes).map(([key, mesh]) => (
        <primitive key={key} object={mesh} />
      ))}
    </group>
  );
}
