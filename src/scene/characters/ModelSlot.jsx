import { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { kiss } from './kissState';
import { Box3, Vector3 } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Drop-in slot for a .glb / .gltf character.
 *
 *   <ModelSlot config={{ url, height, position, rotation, animation }} fallback={<Placeholder />} />
 *
 * - No url → renders the fallback (placeholder).
 * - While loading → shows the fallback.
 * - If the file is missing or broken → logs a warning and keeps the fallback.
 * - Auto-scales to `height` metres and puts the feet on y = 0.
 * - `clips: { rest, kiss }` → both clips play and their weights follow the
 *   eased kiss blend (rest pose ↔ kiss, never a jump cut).
 * - Otherwise plays `animation` (or the first clip) if the file has animations.
 * - Draco / Meshopt-compressed files are supported out of the box (drei's useGLTF).
 */
export function ModelSlot({ config, fallback }) {
  if (!config?.url) return fallback;
  return (
    <ModelErrorBoundary url={config.url} fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfModel {...config} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

class ModelErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn(`[models] Could not load "${this.props.url}" — using the placeholder instead.`, err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function GltfModel({ url, height = null, position = [0, 0, 0], rotation = [0, 0, 0], scale = null, animation = null, animationSpeed = 1, clips = null }) {
  const gltf = useGLTF(url);
  const root = useMemo(() => {
    const c = cloneSkinned(gltf.scene); // safe for skinned/rigged meshes
    c.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false; // skinned bounds are often wrong
        o.raycast = () => null;
      }
    });
    return c;
  }, [gltf.scene]);

  const fit = useMemo(() => {
    if (scale) return { s: scale, offset: [0, 0, 0] };
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const s = height && size.y > 0 ? height / size.y : 1;
    return { s, offset: [-center.x * s, -box.min.y * s, -center.z * s] };
  }, [root, height, scale]);

  const animRoot = useRef();
  const { actions, names } = useAnimations(gltf.animations, animRoot);
  const restAction = clips ? actions[clips.rest] : null;
  const kissAction = clips ? actions[clips.kiss] : null;
  useEffect(() => {
    if (!restAction || !kissAction) return undefined;
    for (const a of [restAction, kissAction]) a.reset().setEffectiveTimeScale(animationSpeed).play();
    return () => [restAction, kissAction].forEach((a) => a.stop());
  }, [restAction, kissAction, animationSpeed]);
  useFrame(() => {
    if (!restAction || !kissAction) return;
    restAction.setEffectiveWeight(1 - kiss.value);
    kissAction.setEffectiveWeight(kiss.value);
  });

  useEffect(() => {
    if (clips && restAction && kissAction) return undefined;
    const name = animation && actions[animation] ? animation : names[0];
    const action = name ? actions[name] : null;
    if (!action) return undefined;
    action.reset().setEffectiveTimeScale(animationSpeed).fadeIn(0.4).play();
    return () => action.fadeOut(0.3);
  }, [actions, names, animation, animationSpeed, clips, restAction, kissAction]);

  return (
    <group position={position} rotation={rotation}>
      <group position={fit.offset} scale={fit.s}>
        <primitive ref={animRoot} object={root} />
      </group>
    </group>
  );
}
