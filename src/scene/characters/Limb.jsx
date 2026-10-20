import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);

/**
 * A capsule stretched between two points — makes posing the placeholder
 * characters as easy as listing joint positions. Optional `drape` hangs a
 * kimono/haori sleeve panel straight down beneath the limb.
 */
export function Limb({ from, to, radius = 0.05, material, drape }) {
  const key = `${from.join()}|${to.join()}|${radius}|${drape?.height ?? 0}`;
  const t = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const dir = new Vector3().subVectors(b, a);
    const length = dir.length();
    dir.normalize();
    const quaternion = new Quaternion().setFromUnitVectors(UP, dir);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    let sleeve = null;
    if (drape) {
      sleeve = {
        position: [mid.x, mid.y - drape.height / 2 - radius * 0.2, mid.z],
        rotation: [0, Math.atan2(dir.x, dir.z), 0],
        size: [drape.thickness ?? 0.02, drape.height, Math.max(0.05, length * 0.95)],
      };
    }
    return { mid, quaternion, length, sleeve };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <>
      <mesh position={t.mid} quaternion={t.quaternion} material={material}>
        <capsuleGeometry args={[radius, t.length, 6, 14]} />
      </mesh>
      {t.sleeve && (
        <mesh position={t.sleeve.position} rotation={t.sleeve.rotation} material={drape.material ?? material}>
          <boxGeometry args={t.sleeve.size} />
        </mesh>
      )}
    </>
  );
}

export function Joint({ at, radius, material, scale }) {
  return (
    <mesh position={at} material={material} scale={scale}>
      <sphereGeometry args={[radius, 20, 14]} />
    </mesh>
  );
}
