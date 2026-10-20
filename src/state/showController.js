import { TIMING } from '../config';
import { audio } from '../audio/AudioDirector';
import { showStore } from './showStore';

let fadeTimer = null;

/**
 * The floating 3D heart is the only control:
 *   idle   → click starts the continuous fireworks (+ kiss + fireworks BGM)
 *   active → click starts the 5 s faded stop
 *   fading → ignored until the fade completes
 * Must be called from inside the click handler so the browser treats the
 * music switch as user-initiated.
 */
export function onHeartClick() {
  const s = showStore.get();
  if (!s.started) return null;
  if (s.phase === 'idle') return startShow() ? 'start' : null;
  if (s.phase === 'active') return stopShow() ? 'stop' : null;
  return null;
}

export function canInteract() {
  const s = showStore.get();
  return s.started && (s.phase === 'idle' || s.phase === 'active');
}

export function startShow() {
  const s = showStore.get();
  if (!s.started || s.phase !== 'idle') return false;
  clearTimeout(fadeTimer);
  showStore.set({ phase: 'active', cycle: s.cycle + 1, startedAt: performance.now(), stoppedAt: 0 });
  audio.playFireworks();
  return true;
}

/** Faded stop: no new launches, particles burn out, kiss breaks, music crossfades back. */
export function stopShow() {
  if (showStore.get().phase !== 'active') return false;
  showStore.set({ phase: 'fading', stoppedAt: performance.now() });
  audio.playDefault();
  fadeTimer = setTimeout(() => showStore.set({ phase: 'idle' }), TIMING.fadeOutSeconds * 1000);
  return true;
}

// The fireworks song reaching its natural end also triggers the faded stop.
audio.onFireworksEnded = () => stopShow();

/** Intro tap (State 0 → 1): unlocks audio (browsers require a gesture) and starts the reveal. */
export function enterExperience() {
  if (showStore.get().started) return;
  audio.unlock();
  showStore.set({ started: true, introAt: performance.now() });
}

export function toggleMute() {
  const muted = !showStore.get().muted;
  audio.setMuted(muted);
  showStore.set({ muted });
}
