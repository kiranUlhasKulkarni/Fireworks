import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor, Stats } from '@react-three/drei';
import { CAMERA } from '../config';
import { WORLD } from './world';
import { Sky } from './environment/Sky';
import { City } from './environment/City';
import { Rooftop } from './environment/Rooftop';
import { Petals } from './environment/Petals';
import { Fireflies } from './environment/Fireflies';
import { Festival } from './environment/Festival';
import { River } from './environment/River';
import { Bridges } from './environment/Bridges';
import { Train } from './environment/Train';
import { Katana } from './Katana';
import { EasterEgg } from './EasterEgg';
import { Couple } from './characters/Couple';
import { Heart } from './Heart';
import { SceneLights } from './SceneLights';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { IntroDirector } from './IntroDirector';
import { INTRO } from '../config';
import { FireworksShow } from '../fireworks/FireworksShow';

// Add ?stats to the URL to show an FPS meter.
const SHOW_STATS = new URLSearchParams(window.location.search).has('stats');
// Dev: ?nofx renders without post-processing (debugging)
const NO_FX = new URLSearchParams(window.location.search).has('nofx');

export function Experience() {
  // Adaptive resolution: drops the pixel ratio if the frame rate sags.
  const [dpr, setDpr] = useState(Math.min(1.5, window.devicePixelRatio || 1));
  return (
    <Canvas
      className="scene"
      dpr={dpr}
      flat
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: CAMERA.fov, near: 0.1, far: 4000, position: INTRO.skyCamera }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(1.5, window.devicePixelRatio || 1, d + 0.25))}
      />
      <color attach="background" args={['#05040c']} />
      <fogExp2 attach="fog" args={[WORLD.fog.color, WORLD.fog.density]} />
      <SceneLights />
      <Suspense fallback={null}>
        <Sky />
        <City />
        <River />
        <Bridges />
        <Festival />
        <Train />
        <EasterEgg />
        <Rooftop />
        <Katana />
        <Couple />
        <Heart />
        <Petals />
        <Fireflies />
        <FireworksShow />
      </Suspense>
      <IntroDirector />
      <CameraRig />
      {!NO_FX && <Effects />}
      {SHOW_STATS && <Stats />}
    </Canvas>
  );
}
