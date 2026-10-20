# ♡ Rooftop Fireworks

An interactive 3D gift: a couple standing on the ridge of a traditional Japanese roof above a lantern-lit Taisho-era city at night.

**How it flows**

1. **Intro (State 0):** a single glowing heart pulses in thick midnight fog. Nothing plays yet.
2. **Tap it (→ State 1):** the heart bursts into a swirl of glowing sakura petals and the fog rolls back. The camera swoops down from the sky as lanterns ignite in a wave spreading out from the centre, with a dreamy bloom surge. The calm BGM swells in. He holds her waist from behind while the breeze moves her hair and his haori.
3. **Click the floating 3D heart (→ State 2):** a shockwave pushes the petals and fireflies away and the scene dims for a split second. Then the sky erupts into a continuous canopy of fireworks, they ease into a kiss, and the music crossfades to the fireworks track at 0:25.
4. **Click the heart again, or let the song end (→ back to State 1):** a 5-second faded stop. Nothing new launches, the remaining fireworks burn out and disintegrate, the kiss eases back to the resting embrace, and the music crossfades back.

Built with React, React Three Fiber, Drei, Three.js and `@react-three/postprocessing`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 and tap the glowing heart. Browsers only allow music after a click, which is why the intro exists.

```bash
npm run build      # production build → dist/
npm run preview    # serve the build locally
```

Add `?stats` to the URL (http://localhost:5173/?stats) to show an FPS meter.

## Where your files go

| What | Where | Then |
|---|---|---|
| Reference image | `public/reference/Screenshot 2026-10-20 at 12.55.29 PM.jpg` | In dev, press **R** to show it in a corner |
| Character models | `public/models/*.glb` | Set `MODELS` in `src/config.js` |
| Katana model (optional) | `public/models/katana.glb` | `MODELS.katana` |
| Local music (fallback) | `public/audio/default.mp3`, `public/audio/fireworks.mp3` | Used automatically when YouTube won't play |

### Swapping in your models

Everything is set in `src/config.js`:

```js
export const MODELS = {
  // EITHER one file with both of them, with a resting and a kissing animation…
  couple: { url: '/models/couple.glb', height: 1.83, clips: { rest: 'Rest', kiss: 'Kiss' } },
  // …OR separate files:
  guy:  { url: '/models/guy.glb',  height: 1.83 },            // 6'0"
  girl: { url: '/models/girl.glb', height: 1.63, position: [0, 0.95, 0.3] }, // 5'4"
  katana: { url: '/models/katana.glb', height: 1.0 },
};
```

* `height` auto-scales the model to that many metres and puts its feet on the rooftop. Use `null` to keep the file's own scale.
* `clips: { rest, kiss }` names two animation clips. Both play, and their weights follow the same eased blend as the placeholders: about 2.2 s into the kiss, held for the whole show, about 4.5 s back to rest. There are no jump cuts. Without `clips`, `animation` picks a single clip, or the first clip plays.
* Rigged/skinned meshes, Draco and Meshopt compression are supported. Loading goes through Drei's `useGLTF` (three's `GLTFLoader`) in `src/scene/characters/ModelSlot.jsx`.
* If a file is missing or broken, the placeholder stays and a warning is logged, so nothing breaks.
* **Wind on your own models:** call `addWind(material, { amp, pivotY, range })` from `src/scene/characters/wind.js` on the hair/cloth materials. Anything below `pivotY` (world metres) sways. The placeholders use this already.

## Music

Set in `src/config.js → MUSIC`. You can paste any YouTube or YouTube Music URL.

* The default track starts on the intro tap, swelling in over about 4 s as the city is revealed, and loops.
* The fireworks track always starts at exactly **0:25** (`startSeconds`). It is pre-buffered at 0:25 while muted, so the switch is instant. It plays until the heart is clicked again or **the song ends on its own**, and either one starts the faded stop.
* **Important:** the default track (`OYflIC24-GM`) returns **YouTube error 150: its owner has disabled embedding**. It can't play inside any website. Put an MP3 you have the rights to at `public/audio/default.mp3` and it is used automatically. The fireworks track (`QK9IzdhYY00`) embeds fine (tested: playback started at 0:24.9).
* `MUSIC.source = 'local'` skips YouTube completely. That's the most reliable option, it works offline, and the visualizer then reacts to the real audio spectrum.
* YouTube limitations: monetized videos can occasionally show an ad first, and iOS ignores volume changes from code, so crossfades become hard cuts on iPhone/iPad.

## What's in the scene

* **City (Taisho era):** about 6,000 instanced wooden machiya with tiled hip roofs and shoji windows lit by warm oil-lamp tones. Paper chōchin lanterns line the streets, the shop signs are paper and wood with no neon, and there are five-storey pagodas with torii, a brick railway viaduct, and the castle-style tower the couple stands on.
* **Festival streets:** about 5,300 strolling silhouettes (couples, families with children) spread over most of the lantern-lit street grid out to the edge of the city. The lanes right below the tower are busiest, and the crowd thins with distance; some side streets stay quiet so it feels busy, not packed. About a quarter carry bobbing lanterns. Each walker just slides along its street in the vertex shader, so the whole crowd is two instanced draw calls.
* **River** (`River.jsx`): a real planar reflection (three's `Reflector`, rendered to an HDR target) shaded by a custom water shader. Layered ripples scroll downstream along the river's curve and distort the reflection of the lanterns, windows, moon and fireworks, with Fresnel, moon glints, drifting current streaks and stone embankments.
* **Bridges** (`Bridges.jsx`): three traditional arched wooden bridges (two are in the default view). Each has a plank deck, posted railings with bronze giboshi finials, wooden piers with cross-bracing in the water, stone abutments, stone tōrō lanterns at the ends, and people with lanterns walking across.
* **Train:** a steam train with glowing yellow windows and a steam trail crosses the viaduct in the mid-ground.
* **Mountains:** two misty, craggy horizon ridges whose edges catch the light of each burst.
* **Sky:** a large pale-gold moon with drifting clouds and twinkling stars.
* **Rooftop:** a gabled kawara-tiled roof with concave slopes and upturned corners, white gable walls, golden shachihoko on the ridge and chōchin lanterns at the eaves. The couple stands on the apex of the ridge, and a sheathed katana rests on the tiles beside them.
* **The couple:** he is styled after Tanjiro (checkered haori) and she after Kanao Tsuyuri (white capelet blushing pink at the hem over the dark uniform, pleated skirt, white stockings, side ponytail with a glowing butterfly clip). Both have ink outlines for the anime look. The placeholder rig has two poses, rest (he holds her waist from behind, both looking out) and kiss (she rises onto her toes and turns, one hand on his cheek). Every limb is re-solved each frame from an eased blend between them (`src/scene/characters/poses.js`, `rig.jsx`).
* **Ambient particles:** sakura petals drift down on the breeze while golden fireflies float up from the roof edge. His haori, her capelet, skirt and ponytail sway in the same breeze.
* **Easter egg:** a lantern-lit teahouse sign far below toward the river. Orbit around and look down past the roof edge.

## The fireworks system

* **GPU particles:** a 1.4 M-slot ring buffer (`ParticlePool.js`), packed to 44 bytes per particle with 16-bit floats and 8-bit colours. Each particle is written once with its full physical description (origin, velocity, drag, gravity, birth time, colour). The vertex shader then solves the motion in closed form (drag + gravity + wind), so the CPU does no per-frame simulation. Only newly spawned slices are uploaded.
* **Each burst** schedules its stars, delayed tail copies, embers left hanging along each star's path, crackling strobe glitter, and lit smoke, all with future birth times.
* **Long-exposure streaks:** each spark sprite is stretched along its screen-space velocity, like a camera shutter.
* **Shells:** peony, chrysanthemum (with pistil), willow, golden and white kamuro, ring, palm, glitter, and a heart shape that always faces the camera.
* **Colours:** a neo palette of rich violet, magenta, pink, deep and electric blue, and piercing white. HDR cores feed a heavy mip-mapped Bloom pass (UnrealBloom-style), then ACES tone mapping. The bloom threshold sits above 1.0, so the warm city stays soft and only the fireworks and lanterns bloom hard.
* **Lighting:** every burst lights the facades, roofs, river, lingering smoke, mountain ridges and the couple.
* **Continuous program** (`choreography.js`): a giant heart opens 1.3 s after the click, with the scene dimming just before it, and the sky erupts around it. After that the show repeats ~14 s "movements" until stopped: a dense body of 6–8 shells/s with mirrored pairs and a heart, a crescendo of ~15 shells/s, then a canopy curtain of golden and white kamuro.
* **Canopy placement:** every burst gets a high elevation angle (9°–34° above the horizon), so the upper half of the frame fills up. Distances are layered from just past the roof out over the mountains, shells are bigger the farther away they are.
* **360°:** three independent programs each own a 120° sector of sky at full density, so whichever way you spin the camera, the sky is already full of bursts and lingering embers. The giant opening heart goes in the sector you're facing when you click.
* **Faded stop (5 s):** no new launches (shells already in flight are cancelled too), existing particles burn out naturally, and the leftovers break up one by one. Smoke erodes through a noise mask. The heart dims and becomes clickable again when the fade ends.
* **Click effect:** a screen-space shockwave ripple, a burst of pink glitter, and a physical push that sends nearby petals and fireflies outward before they drift back.

Tuning knobs: `SPEED` / `SIZE` / `BRIGHT` at the top of `src/fireworks/shells.js`, the show script in `src/fireworks/choreography.js`, colours in `src/fireworks/palette.js`, and bloom in `src/scene/Effects.jsx`.

## Project layout

```
src/
  config.js               ← timing, music, models, camera (start here)
  App.jsx, main.jsx, styles.css
  audio/                  AudioDirector (crossfades), YouTubeTrack, Html5Track
  state/                  showStore (phase/cycle), showController (heart toggles the show; 5 s faded stop)
  ui/                     IntroGate, AudioVisualizer (bottom-right bars), ReferenceOverlay
  fireworks/              engine, particle pool, shaders, shells, choreography, physics
  scene/
    Experience.jsx        Canvas + scene graph
    Heart.jsx, Katana.jsx, EasterEgg.jsx, SceneLights.jsx, CameraRig.jsx, Effects.jsx
    characters/           ModelSlot (GLTF), placeholders, wind, textures, pose
    environment/          City, cityLayout, cityMaterials, Sky, Rooftop, Festival,
                          Train, Petals, Fireflies, geometry
    shared/               shared uniforms, GLSL chunks, flash lights, fx bus
```

## Performance notes

* About 15 draw calls for the whole city (instancing), with lighting and fog done in custom shaders. The city has no real point lights: the warm glow is emissive materials plus shader "lantern bounce", which is what keeps it cheap on laptops and phones.
* Adaptive resolution: the pixel ratio starts at 1.5 at most and drops automatically if the frame rate sags (Drei `PerformanceMonitor`).
* The fireworks are dense on purpose. If a phone struggles, lower `COUNT` / `SIZE` in `src/fireworks/shells.js` or `SPARK_CAPACITY` in `FireworksEngine.js`. Sprite size is capped to limit overdraw.
