import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Spherical, Vector3 } from 'three';
import { CAMERA, INTRO } from '../config';
import { showStore, useShow } from '../state/showStore';

/**
 * Click-and-drag 360° orbit around the couple. When a show starts, the
 * camera gently eases to a lower angle so the sky is in frame — unless the
 * visitor is already steering.
 */
export function CameraRig() {
  const controls = useRef();
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const cycle = useShow((s) => s.cycle);
  const phase = useShow((s) => s.phase);
  const st = useRef({ dragging: false, lastInteract: performance.now(), assist: false });
  const sph = useRef(new Spherical());
  const offset = useRef(new Vector3());
  const swoop = useRef({ done: false, look: new Vector3() });

  useEffect(() => {
    if (cycle > 0) st.current.assist = true;
  }, [cycle]);

  // Dev-only handle for tuning from the browser console.
  useEffect(() => {
    if (import.meta.env.DEV) window.__rig = { camera, scene, gl, controls: controls.current, state: st.current };
  }, [camera, scene, gl]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const s = st.current;
    if (!swoop.current.done) {
      runSwoop(c, camera, swoop.current, s);
      return;
    }
    const idle = (performance.now() - s.lastInteract) / 1000;
    c.autoRotate = CAMERA.autoRotateAfterIdleSeconds > 0 && idle > CAMERA.autoRotateAfterIdleSeconds;
    c.autoRotateSpeed = phase === 'idle' ? 0.35 : 0.15;

    if (s.assist && !s.dragging && phase !== 'idle') {
      offset.current.subVectors(camera.position, c.target);
      sph.current.setFromVector3(offset.current);
      const k = 1 - Math.exp(-dt * 1.1);
      const goal = CAMERA.showPolarAngle;
      c.target.y += (CAMERA.showTargetY - c.target.y) * k;
      if (sph.current.phi < goal - 0.01 || Math.abs(c.target.y - CAMERA.showTargetY) > 0.02) {
        sph.current.phi += (Math.max(goal, sph.current.phi) - sph.current.phi) * k;
        sph.current.radius += (Math.max(sph.current.radius, 8.5) - sph.current.radius) * k;
        offset.current.setFromSpherical(sph.current);
        camera.position.copy(c.target).add(offset.current);
        camera.lookAt(c.target);
      } else {
        s.assist = false;
      }
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={CAMERA.target}
      enableDamping
      dampingFactor={0.06}
      enablePan={false}
      rotateSpeed={0.55}
      zoomSpeed={0.6}
      minDistance={CAMERA.minDistance}
      maxDistance={CAMERA.maxDistance}
      minPolarAngle={0.2}
      maxPolarAngle={CAMERA.maxPolarAngle}
      onStart={() => {
        st.current.dragging = true;
        st.current.assist = false;
        st.current.lastInteract = performance.now();
      }}
      onEnd={() => {
        st.current.dragging = false;
        st.current.lastInteract = performance.now();
      }}
    />
  );
}

/* ── Intro camera swoop: high "sky view" → resting framing on the couple ── */

const P0 = new Vector3(...INTRO.skyCamera);
const P2 = new Vector3(...CAMERA.position);
// Control point: sweep in from far out and low over the city, then rise to the roof.
const P1 = new Vector3(CAMERA.position[0] * 9, 30, CAMERA.position[2] * 14);
const LOOK0 = new Vector3(0, -55, -40);
const LOOK1 = new Vector3(...CAMERA.target);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function runSwoop(controls, camera, sw, rigState) {
  const s = showStore.get();
  const t = s.started ? (performance.now() - s.introAt) / 1000 - INTRO.swoopDelay : 0;
  const k = easeInOut(Math.min(1, Math.max(0, t / INTRO.swoopSeconds)));
  controls.enabled = false;
  const a = 1 - k;
  camera.position.set(
    a * a * P0.x + 2 * a * k * P1.x + k * k * P2.x,
    a * a * P0.y + 2 * a * k * P1.y + k * k * P2.y,
    a * a * P0.z + 2 * a * k * P1.z + k * k * P2.z,
  );
  sw.look.lerpVectors(LOOK0, LOOK1, easeInOut(Math.min(1, k * 1.15)));
  camera.lookAt(sw.look);
  if (s.started && t >= INTRO.swoopSeconds) {
    sw.done = true;
    controls.target.copy(LOOK1);
    controls.enabled = true;
    controls.update();
    rigState.lastInteract = performance.now();
  }
}
