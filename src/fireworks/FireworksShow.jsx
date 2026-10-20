import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { showStore } from '../state/showStore';
import { FireworksEngine } from './FireworksEngine';

/** Lets other components (the heart) talk to the engine without prop drilling. */
export const fireworks = { engine: null };

export function FireworksShow() {
  const engine = useMemo(() => new FireworksEngine(), []);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    fireworks.engine = engine;
    const ctx = gl.getContext();
    const range = ctx.getParameter(ctx.ALIASED_POINT_SIZE_RANGE);
    engine.setMaxPointSize(Math.min(range?.[1] ?? 64, 192)); // caps streak/smoke sprite size (fill-rate)
    return () => {
      fireworks.engine = null;
      engine.dispose();
    };
  }, [engine, gl]);

  useFrame((state) => {
    const dpr = state.gl.getPixelRatio();
    engine.update(state.clock.elapsedTime, showStore.get(), state.camera, state.size.width * dpr, state.size.height * dpr);
  });

  return (
    <>
      <primitive object={engine.smoke.points} />
      <primitive object={engine.sparks.points} />
    </>
  );
}
