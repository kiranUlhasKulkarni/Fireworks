import { CylinderGeometry } from 'three';
import { getCharacterMaterials } from './materials';
import { kiss } from './kissState';
import { Limb } from './Limb';
import { RigHead, RigJoint, RigLimb, useRig } from './rig';
import { GIRL_GAZE_KISS, GIRL_GAZE_REST, GIRL_KISS, GIRL_REST } from './poses';

const getBlend = () => kiss.value;
// Pleated skirt: hem (wider) at the bottom → waist at the top
const skirtShape = (len) => new CylinderGeometry(0.115, 0.17, len, 32, 1, true);
// Capelet: flares from the shoulders, open at the front
const capeletShape = (len) => new CylinderGeometry(0.155, 0.255, len, 40, 1, true, 0.5, Math.PI * 2 - 1.0);

/** Kanao's butterfly hair clip: four glowing wings around a tiny body. */
function ButterflyClip(props) {
  const m = getCharacterMaterials();
  const wings = [
    { p: [0.021, 0.012, 0], r: 0.026, s: [1, 0.72, 1], rot: 0.55 },
    { p: [-0.021, 0.012, 0], r: 0.026, s: [1, 0.72, 1], rot: -0.55 },
    { p: [0.016, -0.015, 0], r: 0.017, s: [1, 0.8, 1], rot: -0.5 },
    { p: [-0.016, -0.015, 0], r: 0.017, s: [1, 0.8, 1], rot: 0.5 },
  ];
  return (
    <group {...props}>
      {wings.map((w, i) => (
        <group key={i} position={w.p} rotation-z={w.rot} scale={w.s}>
          <mesh material={m.butterflyEdge}>
            <circleGeometry args={[w.r * 1.12, 20]} />
          </mesh>
          <mesh position={[0, 0, 0.0015]} material={m.butterfly}>
            <circleGeometry args={[w.r, 20]} />
          </mesh>
        </group>
      ))}
      <mesh material={m.butterflyEdge}>
        <capsuleGeometry args={[0.004, 0.03, 3, 6]} />
      </mesh>
    </group>
  );
}

/**
 * Stylized stand-in for "her", styled after Kanao Tsuyuri: 5'4" (1.63 m),
 * standing in front of him — white capelet blushing pink at the hem over the
 * dark corps uniform, pleated skirt, white stockings, black hair tied in a
 * side ponytail with a glowing butterfly clip.
 * Replace with your own model via MODELS.girl (or MODELS.couple) in src/config.js.
 */
export function PlaceholderGirl() {
  const m = getCharacterMaterials();
  const rig = useRig(GIRL_REST, GIRL_KISS, getBlend, GIRL_GAZE_REST, GIRL_GAZE_KISS);

  return (
    <group name="girl-placeholder">
      {/* Uniform: torso with gold buttons, pleated skirt */}
      <RigLimb rig={rig} from="pelvis" to="chest" radius={0.1} material={m.uniformGirl} />
      {[0.05, 0.12, 0.19].map((dy) => (
        <RigJoint key={dy} rig={rig} at="chest" offset={[0, -dy, 0.098]} radius={0.009} material={m.button} />
      ))}
      <RigLimb rig={rig} from="skirtHem" to="pelvis" material={m.skirt} shape={skirtShape} />
      <RigLimb rig={rig} from="chest" to="neck" radius={0.036} material={m.skin} />
      <RigLimb rig={rig} from="shoulderR" to="shoulderL" radius={0.042} material={m.uniformGirl} />

      {/* White capelet over the shoulders */}
      <RigLimb rig={rig} from="capeBottom" to="capeTop" material={m.capelet} shape={capeletShape} />
      <RigJoint rig={rig} at="capeTop" offset={[0, -0.06, 0]}>
        <mesh scale={[1.1, 0.42, 0.85]} material={m.capelet}>
          <sphereGeometry args={[0.165, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </RigJoint>

      {/* Legs: white stockings, dark shoes */}
      {['L', 'R'].map((s) => (
        <group key={s}>
          <RigLimb rig={rig} from={`hip${s}`} to={`knee${s}`} radius={0.056} material={m.stocking} />
          <RigLimb rig={rig} from={`knee${s}`} to={`ankle${s}`} radius={0.044} material={m.stocking} />
          <RigLimb rig={rig} from={`ankle${s}`} to={`toe${s}`} radius={0.034} material={m.shoe} />
          <RigJoint rig={rig} at={`toe${s}`} offset={[0, -0.03, -0.05]}>
            <mesh material={m.shoe}>
              <boxGeometry args={[0.075, 0.018, 0.2]} />
            </mesh>
          </RigJoint>
        </group>
      ))}

      {/* Head: straight bangs, face-framing locks, side ponytail + butterfly clip */}
      <RigHead rig={rig}>
        <mesh material={m.skin} scale={[0.92, 1.05, 1]}>
          <sphereGeometry args={[0.09, 24, 16]} />
        </mesh>
        <mesh rotation-x={-0.12} material={m.hairGirl}>
          <sphereGeometry args={[0.1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        </mesh>
        <mesh position={[0, -0.012, -0.03]} scale={[1.03, 1.06, 0.95]} material={m.hairGirl}>
          <sphereGeometry args={[0.094, 20, 14]} />
        </mesh>
        {[-1, 1].map((side) => (
          <Limb key={side} from={[side * 0.075, 0.03, 0.045]} to={[side * 0.07, -0.085, 0.05]} radius={0.014} material={m.hairGirl} />
        ))}
        {/* Side ponytail on her left, falling forward over the shoulder */}
        <Limb from={[0.09, 0.03, -0.03]} to={[0.15, -0.1, 0.04]} radius={0.03} material={m.hairGirl} />
        <Limb from={[0.15, -0.1, 0.04]} to={[0.2, -0.26, 0.11]} radius={0.021} material={m.hairGirl} />
        <ButterflyClip position={[0.118, 0.045, -0.025]} rotation={[0, Math.PI / 2, 0.15]} scale={1.4} />
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.032, 0.004, 0.084]} rotation-z={Math.PI} material={m.eye}>
              <torusGeometry args={[0.013, 0.0026, 6, 14, Math.PI]} />
            </mesh>
            <mesh position={[side * 0.05, -0.028, 0.079]} material={m.blush}>
              <circleGeometry args={[0.014, 16]} />
            </mesh>
          </group>
        ))}
      </RigHead>

      {/* Arms: resting on his (rest) / one hand to his cheek (kiss) */}
      {['L', 'R'].map((s) => (
        <group key={s}>
          <RigLimb rig={rig} from={`shoulder${s}`} to={`elbow${s}`} radius={0.037} material={m.uniformGirl} />
          <RigLimb rig={rig} from={`elbow${s}`} to={`hand${s}`} radius={0.032} material={m.uniformGirl} />
          <RigJoint rig={rig} at={`hand${s}`} radius={0.03} material={m.skin} />
        </group>
      ))}
    </group>
  );
}
