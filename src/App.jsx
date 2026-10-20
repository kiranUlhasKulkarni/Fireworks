import { useEffect } from 'react';
import { Experience } from './scene/Experience';
import { AudioVisualizer } from './ui/AudioVisualizer';
import { IntroGate } from './ui/IntroGate';
import { ReferenceOverlay } from './ui/ReferenceOverlay';
import { audio } from './audio/AudioDirector';
import { enterExperience, startShow, stopShow } from './state/showController';
import { showStore } from './state/showStore';
import { sharedUniforms } from './scene/shared/uniforms';

if (import.meta.env.DEV) window.__show = { enterExperience, startShow, stopShow, showStore, audio, sharedUniforms };

export default function App() {
  useEffect(() => {
    audio.init(); // start loading the music players right away (silently)
  }, []);

  return (
    <>
      <Experience />
      <AudioVisualizer />
      <IntroGate />
      {import.meta.env.DEV && <ReferenceOverlay />}
    </>
  );
}
