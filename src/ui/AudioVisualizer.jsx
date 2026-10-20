import { useEffect, useRef } from 'react';
import { audio } from '../audio/AudioDirector';
import { toggleMute } from '../state/showController';
import { useShow } from '../state/showStore';

const BARS = 5;

/**
 * Tiny bottom-right music indicator: five softly glowing bars, no text.
 * Uses the real spectrum when a local audio file is playing; for YouTube
 * (cross-origin, can't be analysed) it synthesises organic motion scaled by
 * the actual playback level. Tap to mute / unmute.
 */
export function AudioVisualizer() {
  const bars = useRef([]);
  const started = useShow((s) => s.started);
  const muted = useShow((s) => s.muted);

  useEffect(() => {
    let raf;
    const levels = new Float32Array(BARS);
    const smooth = new Float32Array(BARS).fill(0.1);
    const loop = (now) => {
      const t = now / 1000;
      const real = audio.getLevels(levels);
      const energy = audio.getEnergy();
      for (let i = 0; i < BARS; i++) {
        let v;
        if (real) {
          v = levels[i];
        } else {
          const speed = 1 + energy * 1.4;
          const wobble =
            0.5 +
            0.3 * Math.sin(t * (3.1 + i * 0.9) * speed + i * 1.7) +
            0.2 * Math.sin(t * (7.3 + i * 1.3) * speed + i * 3.1);
          v = energy * (0.25 + 0.75 * wobble);
        }
        smooth[i] += (v - smooth[i]) * 0.25;
        const el = bars.current[i];
        if (el) el.style.transform = `scaleY(${(0.14 + smooth[i] * 0.86).toFixed(3)})`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <button
      type="button"
      className={`viz${started ? ' viz--on' : ''}${muted ? ' viz--muted' : ''}`}
      onClick={toggleMute}
      aria-label={muted ? 'Unmute music' : 'Mute music'}
    >
      {Array.from({ length: BARS }, (_, i) => (
        <span key={i} ref={(el) => (bars.current[i] = el)} />
      ))}
    </button>
  );
}
