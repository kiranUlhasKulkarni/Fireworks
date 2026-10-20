import { useMemo } from 'react';
import { CanvasTexture, Color, MeshPhysicalMaterial, MeshStandardMaterial, QuadraticBezierCurve3, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three';
import { MODELS } from '../config';
import { ModelSlot } from './characters/ModelSlot';

/**
 * Post-battle lore: a sheathed katana resting on the roof tiles beside the
 * couple, its hilt propped against the ridge. Procedural by default; set MODELS.katana in config.js to use a .glb.
 */
function wrapTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9d2c3'; // same-gawa (ray skin) peeking through
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#0d0d10'; // black tsuka-ito diamond wrap
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(32, 26); ctx.lineTo(64, 0); ctx.lineTo(64, 12); ctx.lineTo(32, 38); ctx.lineTo(0, 12);
  ctx.moveTo(0, 64); ctx.lineTo(32, 38); ctx.lineTo(64, 64); ctx.lineTo(64, 52); ctx.lineTo(32, 26); ctx.lineTo(0, 52);
  ctx.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(2, 9);
  return t;
}

function ProceduralKatana() {
  const parts = useMemo(() => {
    // Gentle sori (curvature) shared by scabbard and hilt
    const saya = new QuadraticBezierCurve3(new Vector3(0, 0, 0), new Vector3(0, 0.36, 0.028), new Vector3(0, 0.72, 0.012));
    const tsuka = new QuadraticBezierCurve3(new Vector3(0, 0.745, 0.01), new Vector3(0, 0.87, 0.004), new Vector3(0, 1.0, -0.006));
    return {
      saya,
      tsuka,
      lacquer: new MeshPhysicalMaterial({ color: '#0b0a0c', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05 }),
      wrap: new MeshStandardMaterial({ map: wrapTexture(), roughness: 0.8 }),
      metal: new MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.35, metalness: 0.9 }),
      gold: new MeshStandardMaterial({ color: '#b08d45', roughness: 0.3, metalness: 0.9 }),
      cord: new MeshStandardMaterial({ color: new Color('#1d6b5a'), roughness: 0.7 }),
    };
  }, []);

  return (
    <group>
      <mesh material={parts.lacquer} scale={[1, 1, 0.78]}>
        <tubeGeometry args={[parts.saya, 32, 0.017, 10, false]} />
      </mesh>
      <mesh position={[0, 0.003, 0.0]} material={parts.metal}>
        <sphereGeometry args={[0.018, 12, 8]} />
      </mesh>
      {/* Sageo cord tied near the mouth of the scabbard */}
      {[0.6, 0.625].map((y) => (
        <mesh key={y} position={[0, y, 0.016]} rotation-x={Math.PI / 2} material={parts.cord}>
          <torusGeometry args={[0.02, 0.004, 6, 16]} />
        </mesh>
      ))}
      <mesh position={[0.012, 0.52, 0.03]} rotation-z={0.15} material={parts.cord}>
        <capsuleGeometry args={[0.004, 0.16, 3, 6]} />
      </mesh>
      {/* Habaki + tsuba */}
      <mesh position={[0, 0.725, 0.012]} material={parts.gold}>
        <boxGeometry args={[0.026, 0.02, 0.034]} />
      </mesh>
      <mesh position={[0, 0.738, 0.011]} material={parts.metal}>
        <cylinderGeometry args={[0.042, 0.042, 0.008, 8]} />
      </mesh>
      {/* Tsuka with diamond wrap and kashira cap */}
      <mesh material={parts.wrap} scale={[1, 1, 0.8]}>
        <tubeGeometry args={[parts.tsuka, 16, 0.016, 10, false]} />
      </mesh>
      <mesh position={[0, 1.0, -0.006]} material={parts.metal}>
        <sphereGeometry args={[0.0175, 12, 8]} />
      </mesh>
    </group>
  );
}

export function Katana() {
  // Lying on the camera-side slope, its hilt resting against the ridge cap.
  return (
    <group position={[-1.25, -1.21, 1.0]} rotation={[-0.553, 0.15, 0]}>
      <ModelSlot config={MODELS.katana} fallback={<ProceduralKatana />} />
    </group>
  );
}
