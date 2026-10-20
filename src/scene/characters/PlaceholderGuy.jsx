import { useMemo } from 'react';
import { CylinderGeometry } from 'three';
import { getCharacterMaterials } from './materials';
import { kiss } from './kissState';
import { RigHead, RigJoint, RigLimb, spikesOnSphere, useRig } from './rig';
import { GUY_GAZE_KISS, GUY_GAZE_REST, GUY_KISS, GUY_REST } from './poses';

const getBlend = () => kiss.value;
const haoriShape = (len) => new CylinderGeometry(0.165, 0.25, len, 40, 1, true, 0.32, Math.PI * 2 - 0.64);

/**
 * Stylized stand-in for "him": 6'0" (1.83 m), slim, spiky black hair,
 * green & black checkered haori over a dark uniform, white leg wraps.
 * Replace with your own model via MODELS.guy (or MODELS.couple) in src/config.js.
 */
export function PlaceholderGuy() {
  const m = getCharacterMaterials();
  const rig = useRig(GUY_REST, GUY_KISS, getBlend, GUY_GAZE_REST, GUY_GAZE_KISS);

  const spikes = useMemo(() => {
    const dirs = [];
    for (let i = 0; i < 13; i++) {
      const phi = Math.PI * (0.55 + (i / 12) * 0.9); // around the back of the head
      const el = (i % 3) * 0.38 - 0.1;
      dirs.push([Math.sin(phi) * Math.cos(el), Math.sin(el) + 0.25, Math.cos(phi) * Math.cos(el)]);
    }
    dirs.push([0.3, 1, -0.2], [-0.3, 1, -0.2], [0, 1, 0.15], [0.55, 0.6, 0.1], [-0.55, 0.6, 0.1]);
    return spikesOnSphere(dirs, 0.095);
  }, []);
  const bangs = useMemo(
    () =>
      [
        { position: [0.045, 0.075, 0.075], dir: [0.15, -0.7, 0.7] },
        { position: [-0.04, 0.078, 0.078], dir: [-0.2, -0.7, 0.7] },
        { position: [0.0, 0.085, 0.08], dir: [0, -0.75, 0.66] },
      ].map((b) => ({ ...b, quaternion: spikesOnSphere([b.dir], 0)[0].quaternion })),
    [],
  );

  return (
    <group name="guy-placeholder">
      {/* Legs: uniform trousers, white kyahan wraps, straw zori */}
      {['L', 'R'].map((s) => (
        <group key={s}>
          <RigLimb rig={rig} from={`hip${s}`} to={`knee${s}`} radius={0.075} material={m.uniform} />
          <RigLimb rig={rig} from={`knee${s}`} to={`ankle${s}`} radius={0.058} material={m.uniform} />
          <RigJoint rig={rig} at={`ankle${s}`} offset={[0, 0.13, 0.012]}>
            <mesh material={m.white}>
              <cylinderGeometry args={[0.066, 0.06, 0.26, 14]} />
            </mesh>
          </RigJoint>
          <RigLimb rig={rig} from={`ankle${s}`} to={`toe${s}`} radius={0.04} material={m.uniform} />
          <RigJoint rig={rig} at={`toe${s}`} offset={[0, -0.04, -0.06]}>
            <mesh material={m.straw}>
              <boxGeometry args={[0.1, 0.022, 0.27]} />
            </mesh>
          </RigJoint>
        </group>
      ))}
      <RigJoint rig={rig} at="pelvis" radius={0.14} scale={[1.15, 0.75, 0.9]} material={m.uniform} />

      {/* Torso + haori (open at the front) */}
      <RigLimb rig={rig} from="pelvis" to="chest" radius={0.125} material={m.uniform} />
      <RigLimb rig={rig} from="haoriBottom" to="haoriTop" material={m.haori} shape={haoriShape} />
      <RigJoint rig={rig} at="haoriTop" offset={[0, -0.02, 0]}>
        <mesh scale={[1.2, 0.42, 0.9]} material={m.haoriLimb}>
          <sphereGeometry args={[0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </RigJoint>
      <RigLimb rig={rig} from="shoulderR" to="shoulderL" radius={0.055} material={m.haoriLimb} />

      {/* Neck + head */}
      <RigLimb rig={rig} from="chest" to="neck" radius={0.042} material={m.skin} />
      <RigHead rig={rig}>
        <mesh material={m.skin} scale={[0.92, 1.05, 1]}>
          <sphereGeometry args={[0.1, 24, 16]} />
        </mesh>
        <mesh rotation-x={-0.45} material={m.hairGuy}>
          <sphereGeometry args={[0.112, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        </mesh>
        <mesh position={[0, -0.015, -0.03]} scale={[1, 1, 0.92]} material={m.hairGuy}>
          <sphereGeometry args={[0.102, 20, 14]} />
        </mesh>
        {spikes.map((s, i) => (
          <mesh key={i} position={s.position} quaternion={s.quaternion} material={m.hairGuy}>
            <coneGeometry args={[0.03, 0.09, 8]} />
          </mesh>
        ))}
        {bangs.map((b, i) => (
          <mesh key={i} position={b.position} quaternion={b.quaternion} material={m.hairGuy}>
            <coneGeometry args={[0.022, 0.07, 8]} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.036, 0.004, 0.093]} rotation-z={Math.PI} material={m.eye}>
            <torusGeometry args={[0.014, 0.0028, 6, 14, Math.PI]} />
          </mesh>
        ))}
        {/* Hanafuda earrings */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.094, -0.06, 0.0]} material={m.earring}>
            <boxGeometry args={[0.006, 0.045, 0.028]} />
          </mesh>
        ))}
      </RigHead>

      {/* Arms wrapped around her waist from behind */}
      {['L', 'R'].map((s) => (
        <group key={s}>
          <RigLimb rig={rig} from={`shoulder${s}`} to={`elbow${s}`} radius={0.055} material={m.haoriLimb} />
          <RigLimb rig={rig} from={`elbow${s}`} to={`hand${s}`} radius={0.05} material={m.haoriLimb} drape={{ height: 0.18 }} />
          <RigJoint rig={rig} at={`hand${s}`} radius={0.042} material={m.skin} />
        </group>
      ))}
    </group>
  );
}
