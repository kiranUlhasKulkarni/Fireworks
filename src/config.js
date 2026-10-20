/**
 * ──────────────────────────────────────────────────────────────────────────
 *  Everything you're likely to want to tweak lives in this one file.
 * ──────────────────────────────────────────────────────────────────────────
 */

/**
 * Timing (seconds).
 * Fireworks run continuously from the first heart click until the heart is
 * clicked again or the fireworks song ends; then a fade-out phase follows.
 */
export const TIMING = {
  fadeOutSeconds: 5, // no new launches; particles + smoke burn out, couple breaks the kiss
  crossfadeSeconds: 2.5, // music crossfade length (both directions)
  kissInSeconds: 2.2, // rest pose → kiss (eased, no jump cuts)
  kissOutSeconds: 4.5, // kiss → rest pose (finishes inside the fade-out)
};

/** The State 0 → State 1 entrance ("the ethereal shift"). */
export const INTRO = {
  petals: 170, // glowing sakura petals the intro heart bursts into
  fogSeconds: 2.6, // thick midnight fog rolls back
  swoopDelay: 0.3,
  swoopSeconds: 4.8, // camera glides from the sky down to the couple
  igniteDelay: 0.5,
  igniteSeconds: 3.6, // lanterns ignite in a wave spreading out from the centre
  musicFadeInSeconds: 4.0, // BGM swells as the city is revealed
  skyCamera: [-40, 340, 260], // where the swoop starts
};

/**
 * Background music.
 *
 * source:
 *   'auto'    → YouTube first; if a video can't be embedded, fall back to localSrc
 *   'youtube' → YouTube only
 *   'local'   → only the local files in /public/audio (most reliable, works offline)
 *
 * You can paste any YouTube / YouTube Music URL into `url`; the video id is extracted.
 */
export const MUSIC = {
  source: 'auto',
  default: {
    url: 'https://www.youtube.com/watch?v=vOKgOygf1Rk',
    localSrc: '/audio/default.mp3',
    startSeconds: 0,
    loop: true,
    volume: 0.7, // 0..1
  },
  fireworks: {
    url: 'https://music.youtube.com/watch?v=QK9IzdhYY00&si=cLqNS1GR1xIh2VzQ',
    localSrc: '/audio/fireworks.mp3',
    startSeconds: 25, // ← always starts exactly at 0:25 when the heart is clicked
    loop: false, // when it ends naturally, the fireworks fade out
    volume: 0.9,
    fadeInSeconds: 0.2, // short so the 0:25 entry point is heard crisply
  },
};

/**
 * Character models (.glb / .gltf). Drop files in /public/models and set the url.
 *
 * Use EITHER `couple` (one file containing both characters already posed)
 * OR `guy` + `girl` (separate files). Anything left as null uses the
 * built-in stylized placeholder, so you can swap them one at a time.
 *
 *   url        path relative to /public, e.g. '/models/couple.glb'
 *   height     auto-scales the model so its bounding box is this tall (metres).
 *              6'0" = 1.83, 5'4" = 1.63. Set to null to keep the file's own scale.
 *   position   [x, y, z] offset in metres (feet sit on y = 0 = the rooftop)
 *   rotation   [x, y, z] in radians
 *   animation  clip name to play (null = first clip in the file, if any)
 */
export const MODELS = {
  // For posed/animated models, `clips` names the two animations the scene blends
  // between: rest = he holds her waist from behind, kiss = the kiss. The weights
  // follow the same eased timeline as the placeholders (no jump cuts).
  couple: null,
  // couple: { url: '/models/couple.glb', height: 1.83, clips: { rest: 'Rest', kiss: 'Kiss' } },

  guy: null,
  // guy: { url: '/models/guy.glb', height: 1.83, position: [0, 0, 0], rotation: [0, 0, 0], animation: null },

  girl: null,
  // girl: { url: '/models/girl.glb', height: 1.63, position: [0, 0.95, 0.3], rotation: [0, 0, 0], animation: null },

  // The katana leaning on the railing (procedural if null). height = blade+hilt length.
  katana: null,
  // katana: { url: '/models/katana.glb', height: 1.0, position: [0, 0, 0], rotation: [0, 0, 0] },
};

/**
 * Camera framing: just above the roof ridge, behind and beside the couple,
 * looking slightly UP — the couple sits in the lower third and the sky
 * (where the fireworks canopy opens) fills the rest without tilting.
 */
export const CAMERA = {
  fov: 55,
  position: [-4.3, 2.3, 6.2],
  target: [0, 2.9, 0],
  minDistance: 3.2,
  maxDistance: 26,
  maxPolarAngle: 1.75, // allows looking up from slightly below the target
  autoRotateAfterIdleSeconds: 8, // gentle drift when nobody is touching it (0 = off)
  // If the visitor has tilted far down, the camera eases back to this angle when
  // the show starts (radians from straight-down; matches the default framing).
  showPolarAngle: 1.49,
  showTargetY: 2.9,
};

/** Dev helper: press "R" (dev server only) to toggle the reference image overlay. */
export const REFERENCE_IMAGE = '/reference/Screenshot 2026-10-20 at 12.55.29 PM.jpg';
