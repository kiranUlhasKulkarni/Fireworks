import { useEffect, useRef, useState } from 'react';
import { INTRO } from '../config';
import { enterExperience } from '../state/showController';

/**
 * State 0: a single glowing heart pulsing inside thick midnight-purple fog
 * (the 3D city behind it is fully obscured and silent).
 *
 * On click — "the ethereal shift":
 *   1. the heart bursts into a rush of glowing sakura petals that swirl
 *      outward and toward the camera (2D canvas, below)
 *   2. the fog rolls back (CSS) while the 3D fog thins (IntroDirector)
 *   3. audio unlocks and the default BGM swells; the camera swoops down,
 *      lanterns ignite outward and bloom surges (3D side)
 */
export function IntroGate() {
  const [phase, setPhase] = useState('waiting'); // waiting → leaving → gone
  const canvas = useRef();

  const enter = () => {
    if (phase !== 'waiting') return;
    enterExperience(); // must run synchronously inside the gesture (audio unlock)
    setPhase('leaving');
  };

  useEffect(() => {
    if (phase !== 'leaving') return undefined;
    const stop = burstPetals(canvas.current, INTRO.petals);
    const done = setTimeout(() => setPhase('gone'), 4200);
    return () => {
      stop();
      clearTimeout(done);
    };
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      className={`gate${phase === 'leaving' ? ' gate--leaving' : ''}`}
      style={{ '--fog-seconds': `${INTRO.fogSeconds}s` }}
      onClick={enter}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && enter()}
      role="button"
      tabIndex={0}
      aria-label="Enter"
    >
      <div className="gate__fog" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="gate__heart">
        <span className="gate__ring" />
        <span className="gate__ring gate__ring--late" />
        <svg viewBox="0 0 32 29" aria-hidden="true">
          <path d="M16 28.5S4.7 21.3 2 14.2C.2 8.9 3.6 3 9.1 3c3 0 5.3 1.7 6.9 4 1.6-2.3 3.9-4 6.9-4 5.5 0 8.9 5.9 7.1 11.2C27.3 21.3 16 28.5 16 28.5z" />
        </svg>
      </div>
      <canvas ref={canvas} className="gate__petals" aria-hidden="true" />
    </div>
  );
}

/** Glowing sakura petals exploding from the centre, swirling and rushing past the viewer. */
function burstPetals(canvas, count) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = (canvas.width = window.innerWidth * dpr);
  const h = (canvas.height = window.innerHeight * dpr);
  const ctx = canvas.getContext('2d');
  const cx = w / 2;
  const cy = h / 2;
  const petals = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    return {
      a,
      r: Math.random() * 12 * dpr,
      v: (140 + Math.random() * 520) * dpr, // outward px/s
      spin: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 2.2), // swirl rad/s
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 8,
      flip: Math.random() * Math.PI * 2,
      size: (5 + Math.random() * 7) * dpr,
      grow: 0.55 + Math.random() * 0.6, // approach-the-camera growth rate
      hue: 335 + Math.random() * 20,
      light: 78 + Math.random() * 14,
      delay: Math.random() * 0.18,
    };
  });

  const t0 = performance.now();
  let raf = 0;
  const frame = (now) => {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    // A soft flash where the heart burst
    const flash = Math.max(0, 1 - t / 0.9);
    if (flash > 0) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 260 * dpr * (0.6 + t));
      g.addColorStop(0, `rgba(255,170,205,${0.55 * flash})`);
      g.addColorStop(1, 'rgba(255,120,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    let alive = 0;
    for (const p of petals) {
      const lt = t - p.delay;
      if (lt < 0) {
        alive++;
        continue;
      }
      const ease = 1 - Math.exp(-lt * 1.6); // fast burst, then glide
      const r = p.r + (p.v / 1.6) * ease * (1 + lt * 0.5);
      const ang = p.a + p.spin * (1 - Math.exp(-lt * 1.1));
      const scale = Math.exp(lt * p.grow); // rushing toward the camera
      const x = cx + Math.cos(ang) * r * (0.6 + scale * 0.4);
      const y = cy + Math.sin(ang) * r * (0.6 + scale * 0.4) + lt * lt * 18 * dpr;
      const alpha = Math.min(1, lt * 6) * Math.max(0, 1 - Math.max(0, lt - 1.5) / 1.8);
      if (alpha <= 0) continue;
      alive++;
      drawPetal(ctx, x, y, p.size * scale, p.rot + p.rotV * lt, Math.cos(p.flip + lt * 3), p, alpha);
    }
    if (alive > 0 && t < 4) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

function drawPetal(ctx, x, y, s, rot, flip, p, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(Math.max(0.2, Math.abs(flip)), 1);
  ctx.shadowColor = `hsla(${p.hue}, 100%, 70%, ${alpha})`;
  ctx.shadowBlur = s * 1.4;
  ctx.fillStyle = `hsla(${p.hue}, 100%, ${p.light}%, ${alpha * 0.9})`;
  // Sakura petal: rounded body with the little notch at its tip
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.bezierCurveTo(-s * 0.9, s * 0.4, -s * 0.7, -s * 0.7, -s * 0.18, -s);
  ctx.lineTo(0, -s * 0.72);
  ctx.lineTo(s * 0.18, -s);
  ctx.bezierCurveTo(s * 0.7, -s * 0.7, s * 0.9, s * 0.4, 0, s);
  ctx.fill();
  ctx.restore();
}
