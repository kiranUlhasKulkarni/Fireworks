import { useSyncExternalStore } from 'react';

/**
 * Tiny global store shared by React UI, the 3D scene (read every frame via
 * showStore.get()) and the audio director.
 *
 *   State 0  started=false            intro overlay, fog, no audio
 *   State 1  phase 'idle'             city revealed, default BGM, rest pose
 *   State 2  phase 'active'           continuous fireworks, kiss, fireworks BGM
 *            phase 'fading'           5 s burn-out back to State 1
 */
let state = {
  started: false,
  introAt: 0, // performance.now() of the intro click
  phase: 'idle', // 'idle' | 'active' | 'fading'
  cycle: 0, // increments on every show start
  startedAt: 0, // performance.now() when the current show began
  stoppedAt: 0, // performance.now() when the fade-out began
  muted: false,
};

const listeners = new Set();

export const showStore = {
  get: () => state,
  set(patch) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useShow(selector) {
  return useSyncExternalStore(showStore.subscribe, () => selector(state));
}
