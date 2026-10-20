import { useMemo } from 'react';
import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { addIgnite } from './shared/ignite';
import { EASTER_EGG } from './environment/cityLayout';

/**
 * Easter egg ♡ — a small lantern-lit wooden sign on a distant teahouse roof
 * (look down past the railing toward the river). Text is brushed in sumi ink
 * on glowing paper, like the shop signs around it.
 */
const WORD = 'Pillu';

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 288;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(384, 144, 20, 384, 144, 400);
  g.addColorStop(0, '#ffe2a8');
  g.addColorStop(0.6, '#f6a65a');
  g.addColorStop(1, '#c2602a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 768, 288);
  ctx.strokeStyle = '#3a1a0c';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, 750, 270);
  ctx.fillStyle = '#2a1208';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 700 170px "Brush Script MT", "Segoe Script", "Snell Roundhand", cursive';
  ctx.fillText(WORD, 384, 150);
  // little red hanko seal
  ctx.fillStyle = '#b3261e';
  ctx.fillRect(668, 196, 52, 52);
  ctx.fillStyle = '#ffd9b0';
  ctx.font = '700 34px serif';
  ctx.fillText('♡', 694, 224);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function EasterEgg() {
  // Dark until the intro's lantern-ignition wave reaches it.
  const { sign, lamp } = useMemo(
    () => ({
      sign: addIgnite(new MeshBasicMaterial({ map: signTexture(), color: [1.6, 1.45, 1.3], toneMapped: false, fog: true })),
      lamp: addIgnite(new MeshBasicMaterial({ color: [3.2, 0.6, 0.25], toneMapped: false, fog: true })),
    }),
    [],
  );
  const { x, z, roofTop } = EASTER_EGG;
  const facing = Math.atan2(-x, -z); // turn toward the tower

  return (
    <group position={[x, roofTop + 0.2, z]} rotation-y={facing}>
      <group rotation-x={-0.42}>
        <mesh position={[0, 1.4, 0]} material={sign}>
          <planeGeometry args={[6, 2.25]} />
        </mesh>
        <mesh position={[0, 1.4, -0.08]}>
          <boxGeometry args={[6.3, 2.5, 0.12]} />
          <meshStandardMaterial color="#1a0e08" roughness={0.8} />
        </mesh>
      </group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 2.6, 0.6, 0.2]}>
            <boxGeometry args={[0.18, 1.6, 0.18]} />
            <meshStandardMaterial color="#1a0e08" roughness={0.8} />
          </mesh>
          <mesh position={[s * 3.5, 1.2, 0.5]} scale={[1, 1.3, 1]} material={lamp}>
            <sphereGeometry args={[0.38, 14, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
