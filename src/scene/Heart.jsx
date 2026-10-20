import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { AdditiveBlending, Color, ExtrudeGeometry, Shape, Vector3 } from 'three';
import { TIMING } from '../config';
import { showStore, useShow } from '../state/showStore';
import { canInteract, onHeartClick } from '../state/showController';
import { fireworks } from '../fireworks/FireworksShow';
import { makeRadialTexture } from './characters/textures';
import { sharedUniforms } from './shared/uniforms';
import { fxBus } from './shared/fxBus';

const HEART_POS = [-0.85, 1.95, 0.5]; // beside the couple, on the camera side
const READY_EMISSIVE = new Color('#ff1f5a');
const SPENT_EMISSIVE = new Color('#4a1020');

function createHeartGeometry() {
  const s = new Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const geo = new ExtrudeGeometry(s, {
    depth: 2.6,
    bevelEnabled: true,
    bevelSegments: 8,
    bevelSize: 1.3,
    bevelThickness: 1.5,
    curveSegments: 40,
  });
  geo.center();
  geo.rotateZ(Math.PI); // point downwards
  geo.scale(0.0088, 0.0088, 0.0088); // ≈ 22 cm wide
  return geo;
}

/** Double "lub-dub" pulse, 0..1 */
function heartbeat(t) {
  const p = (t % 1.15) / 1.15;
  return Math.exp(-(((p - 0.06) * 16) ** 2)) + 0.6 * Math.exp(-(((p - 0.25) * 16) ** 2));
}

export function Heart() {
  const group = useRef();
  const mesh = useRef();
  const halo = useRef();
  const ripple = useRef();
  const state = useRef({ hover: false, charge: 1, rippleT: 10 });
  const phase = useShow((s) => s.phase);
  const started = useShow((s) => s.started);

  const geometry = useMemo(createHeartGeometry, []);
  const haloTex = useMemo(() => makeRadialTexture('rgba(255,120,170,1)', 'rgba(255,60,120,0)'), []);

  useEffect(() => () => (document.body.style.cursor = ''), []);

  useFrame(({ clock, camera }, dt) => {
    const t = clock.elapsedTime;
    const s = showStore.get();
    const st = state.current;

    // Charge: 1 = clickable (start in idle, stop in active); dims and refills
    // across the 5 s fade-out, when it can't be clicked.
    let target = 1;
    if (s.phase === 'fading') {
      const elapsed = (performance.now() - s.stoppedAt) / 1000;
      target = Math.min(1, Math.max(0, elapsed / TIMING.fadeOutSeconds)) * 0.85;
      if (elapsed < 0.4) target = 0;
    }
    st.charge += (target - st.charge) * Math.min(1, dt * 3);
    const ready = s.started && (s.phase === 'idle' || s.phase === 'active');

    group.current.position.y = HEART_POS[1] + Math.sin(t * 1.3) * 0.05;
    const toCam = Math.atan2(camera.position.x - HEART_POS[0], camera.position.z - HEART_POS[2]);
    mesh.current.rotation.y = toCam + Math.sin(t * 0.9) * 0.5;
    const beat = ready ? heartbeat(s.phase === 'active' ? t * 1.35 : t) : 0; // races a little during the show
    const hover = ready && st.hover ? 0.12 : 0;
    mesh.current.scale.setScalar(1 + beat * 0.09 + hover);

    const mat = mesh.current.material;
    mat.emissive.copy(SPENT_EMISSIVE).lerp(READY_EMISSIVE, st.charge);
    mat.emissiveIntensity = 0.5 + st.charge * 1.4 + beat * 0.8 + hover * 4;

    halo.current.material.opacity = 0.12 + st.charge * 0.35 + beat * 0.2;
    halo.current.scale.setScalar(0.62 + beat * 0.08 + hover);

    // Expanding ring on click
    st.rippleT += dt;
    const r = ripple.current;
    r.visible = st.rippleT < 1.2;
    if (r.visible) {
      const k = st.rippleT / 1.2;
      r.scale.setScalar(0.15 + k * 1.6);
      r.material.opacity = (1 - k) * 0.9;
    }
  });

  const onClick = (e) => {
    e.stopPropagation();
    if (e.delta > 8) return; // it was a drag (orbiting), not a click
    const action = onHeartClick(); // 'start' | 'stop' | null
    if (!action) return;
    state.current.rippleT = 0;
    if (action === 'stop') return;
    const p = new Vector3();
    mesh.current.getWorldPosition(p);
    fireworks.engine?.sparkle(p.toArray());
    // Shockwave: pushes petals & fireflies outward + a subtle screen ripple
    sharedUniforms.uShockOrigin.value.copy(p);
    sharedUniforms.uShockTime.value = sharedUniforms.uTime.value;
    if (fxBus.shockwave) {
      fxBus.shockwave.position.copy(p);
      fxBus.shockwave.explode();
    }
    document.body.style.cursor = '';
  };

  return (
    <group ref={group} position={HEART_POS}>
      <mesh ref={mesh} geometry={geometry}>
        <meshPhysicalMaterial
          color="#ff3b6b"
          emissive="#ff1f5a"
          emissiveIntensity={1.6}
          roughness={0.18}
          metalness={0.05}
          clearcoat={1}
          clearcoatRoughness={0.08}
        />
      </mesh>
      <sprite ref={halo} scale={0.62} raycast={() => null}>
        <spriteMaterial map={haloTex} transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} />
      </sprite>
      <mesh ref={ripple} visible={false} raycast={() => null}>
        <torusGeometry args={[0.2, 0.006, 8, 64]} />
        <meshBasicMaterial color={[3, 0.9, 1.6]} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {started && phase !== 'fading' && (
        <Sparkles count={22} scale={[0.75, 0.75, 0.75]} size={1.8} speed={0.35} opacity={0.9} color="#ffc2d6" noise={0.6} />
      )}
      {/* Generous invisible hit area so it's easy to tap on phones */}
      <mesh
        onClick={onClick}
        onPointerOver={() => {
          state.current.hover = true;
          if (canInteract()) document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          state.current.hover = false;
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.24, 12, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
