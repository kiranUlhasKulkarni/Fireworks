import { Bloom, EffectComposer, ShockWave, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import { fxBus } from './shared/fxBus';

export const BLOOM_INTENSITY = 2.2;

/**
 * HDR pipeline: the scene renders to a half-float target so firework cores
 * can be 5–15× brighter than white; heavy mip-mapped Bloom (UnrealBloom-style)
 * turns that into vivid glow. The threshold sits above 1.0 so the warm,
 * low-key city stays soft while fireworks (and lanterns) bloom hard.
 * A screen-space ShockWave ripples out from the heart when it's clicked, and
 * the intro briefly surges the bloom (IntroDirector.jsx).
 */
export function Effects() {
  // The composer only resizes on canvas-size changes, so rebuild it when the
  // adaptive pixel ratio changes (otherwise the image renders into a corner).
  const dpr = useThree((s) => s.viewport.dpr);
  return (
    <EffectComposer key={dpr} multisampling={4}>
      <ShockWave ref={(fx) => (fxBus.shockwave = fx)} speed={0.9} maxRadius={0.6} waveSize={0.18} amplitude={0.035} />
      <Bloom
        ref={(fx) => (fxBus.bloom = fx)}
        mipmapBlur
        intensity={BLOOM_INTENSITY}
        luminanceThreshold={1.0}
        luminanceSmoothing={0.25}
        radius={0.8}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.22} darkness={0.72} />
    </EffectComposer>
  );
}
