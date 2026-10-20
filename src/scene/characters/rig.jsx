import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, CapsuleGeometry, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { outlineFor } from './materials';

/**
 * Minimal pose rig for the placeholder characters.
 *
 * A pose is a map of joint name → [x, y, z] (couple space: feet on y = 0,
 * facing +z). `useRig` blends two poses every frame into live Vector3 joints;
 * RigLimb / RigJoint / RigHead follow those joints, so the figure moves as one
 * smooth skeleton. Every part gets an inverted-hull ink outline for the anime look.
 */
const UP = new Vector3(0, 1, 0);
const tmpDir = new Vector3();
const tmpM = new Matrix4();

/** gazeRest / gazeAlt: [x, y, z] points the head looks at in each pose. */
export function useRig(rest, alt, getBlend, gazeRest, gazeAlt) {
  const rig = useMemo(() => {
    const joints = {};
    for (const k of Object.keys(rest)) joints[k] = new Vector3(...rest[k]);
    const a = Object.fromEntries(Object.keys(rest).map((k) => [k, new Vector3(...rest[k])]));
    const b = Object.fromEntries(Object.keys(rest).map((k) => [k, new Vector3(...(alt[k] || rest[k]))]));
    return {
      joints,
      a,
      b,
      gazeA: new Vector3(...gazeRest),
      gazeB: new Vector3(...gazeAlt),
      headQ: new Quaternion(),
      qa: new Quaternion(),
      qb: new Quaternion(),
      w: 0,
    };
  }, [rest, alt, gazeRest, gazeAlt]);

  // Priority −1: runs before the limbs (priority 0) read the joints.
  useFrame(() => {
    const w = getBlend();
    rig.w = w;
    for (const k in rig.joints) rig.joints[k].lerpVectors(rig.a[k], rig.b[k], w);
    lookQ(rig.qa, rig.joints.head, rig.gazeA);
    lookQ(rig.qb, rig.joints.head, rig.gazeB);
    rig.headQ.slerpQuaternions(rig.qa, rig.qb, w);
  }, -1);

  return rig;
}

/** Rotation whose +z axis points from `from` to `to` (both Vector3). */
export function lookQ(out, from, to) {
  tmpM.lookAt(to, from, UP);
  return out.setFromRotationMatrix(tmpM);
}

/** A mesh plus its ink outline (same geometry, slightly inflated, back faces). */
export function Inked({ geometry, material, outline = 1.06, children, ...props }) {
  return (
    <mesh geometry={geometry} material={material} {...props}>
      {outline ? <mesh geometry={geometry} material={outlineFor(material)} scale={outline} /> : null}
      {children}
    </mesh>
  );
}

/**
 * A part stretched between two joints. `shape(len)` returns a y-aligned
 * geometry (its +y end points at `to`); defaults to a capsule.
 */
export function RigLimb({ rig, from, to, radius = 0.05, material, drape, shape, outline = true }) {
  const mesh = useRef();
  const sleeve = useRef();
  const restLen = useMemo(() => rig.joints[from].distanceTo(rig.joints[to]), [rig, from, to]);
  const geometry = useMemo(() => (shape ? shape(restLen) : new CapsuleGeometry(radius, restLen, 6, 14)), [shape, restLen, radius]);
  const sleeveGeo = useMemo(
    () => (drape ? new BoxGeometry(drape.thickness ?? 0.02, drape.height, Math.max(0.05, restLen * 0.95)) : null),
    [drape, restLen],
  );

  useFrame(() => {
    const a = rig.joints[from];
    const b = rig.joints[to];
    tmpDir.subVectors(b, a);
    const len = tmpDir.length() || 1e-4;
    tmpDir.divideScalar(len);
    const m = mesh.current;
    m.position.lerpVectors(a, b, 0.5);
    m.quaternion.setFromUnitVectors(UP, tmpDir);
    m.scale.set(1, len / restLen, 1);
    if (sleeve.current) {
      const s = sleeve.current;
      s.position.set(m.position.x, m.position.y - drape.height / 2 - radius * 0.2, m.position.z);
      s.rotation.set(0, Math.atan2(tmpDir.x, tmpDir.z), 0);
      s.scale.set(1, 1, len / restLen);
    }
  });

  const inflate = outline ? [1 + 0.006 / Math.max(radius, 0.02), 1 + 0.008 / restLen, 1 + 0.006 / Math.max(radius, 0.02)] : null;
  return (
    <>
      <Inked ref={mesh} geometry={geometry} material={material} outline={inflate} />
      {sleeveGeo && <Inked ref={sleeve} geometry={sleeveGeo} material={drape.material ?? material} outline={[1.5, 1.04, 1.03]} />}
    </>
  );
}

const sphereCache = new Map();
export function sphereGeo(r, w = 20, h = 14) {
  const k = `${r}:${w}:${h}`;
  if (!sphereCache.has(k)) sphereCache.set(k, new SphereGeometry(r, w, h));
  return sphereCache.get(k);
}

/** A sphere (or children) that follows one joint, optionally offset. */
export function RigJoint({ rig, at, radius, material, scale, offset = [0, 0, 0], children }) {
  const ref = useRef();
  useFrame(() => {
    ref.current.position.copy(rig.joints[at]);
    ref.current.position.x += offset[0];
    ref.current.position.y += offset[1];
    ref.current.position.z += offset[2];
  });
  return (
    <group ref={ref}>
      {radius ? <Inked geometry={sphereGeo(radius)} material={material} scale={scale} outline={1 + 0.006 / radius} /> : null}
      {children}
    </group>
  );
}

/** Group placed at the head joint and turned by the rig's blended gaze. */
export function RigHead({ rig, children }) {
  const ref = useRef();
  useFrame(() => {
    ref.current.position.copy(rig.joints.head);
    ref.current.quaternion.copy(rig.headQ);
  });
  return <group ref={ref}>{children}</group>;
}

/** Cone/spike placements on a sphere: returns [{ position, quaternion }]. */
export function spikesOnSphere(dirs, radius) {
  return dirs.map(([x, y, z]) => {
    const d = new Vector3(x, y, z).normalize();
    return {
      position: d.clone().multiplyScalar(radius).toArray(),
      quaternion: new Quaternion().setFromUnitVectors(UP, d),
    };
  });
}
