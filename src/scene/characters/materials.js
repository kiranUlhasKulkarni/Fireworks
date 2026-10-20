import { BackSide, Color, DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { makeCapeletTexture, makeCheckerTexture, makeSkirtTexture } from './textures';
import { addWind } from './wind';

let cached = null;
const outlines = new Map();

/**
 * Ink outline for the anime look (inverted hull: the same geometry, slightly
 * inflated, drawn back-faces-only in dark ink). It shares the source
 * material's wind sway so outlines move with the cloth and hair.
 */
export function outlineFor(material) {
  if (!outlines.has(material)) {
    const ink = new MeshBasicMaterial({ color: '#140a12', side: BackSide });
    if (material.onBeforeCompile) {
      ink.onBeforeCompile = material.onBeforeCompile;
      const key = material.customProgramCacheKey?.();
      if (key) ink.customProgramCacheKey = () => `ink:${key}`;
    }
    outlines.set(material, ink);
  }
  return outlines.get(material);
}

/** Shared materials for the placeholder characters (created once). */
export function getCharacterMaterials() {
  if (cached) return cached;
  cached = {
    skin: new MeshPhysicalMaterial({ color: '#f0c6a6', roughness: 0.55, sheen: 0.4, sheenColor: new Color('#ffb4a0') }),
    eye: new MeshBasicMaterial({ color: '#2a1a1a' }),
    white: new MeshStandardMaterial({ color: '#ece8df', roughness: 0.8 }),

    // Him (Tanjiro): dark uniform, green & black checkered haori, hanafuda earrings
    hairGuy: new MeshStandardMaterial({ color: '#0b0b10', roughness: 0.38, metalness: 0.1 }),
    uniform: new MeshStandardMaterial({ color: '#17181f', roughness: 0.8 }),
    haori: new MeshStandardMaterial({ map: makeCheckerTexture([8, 3]), roughness: 0.85, side: DoubleSide }),
    haoriLimb: new MeshStandardMaterial({ map: makeCheckerTexture([3, 2]), roughness: 0.85, side: DoubleSide }),
    straw: new MeshStandardMaterial({ color: '#a8875a', roughness: 0.9 }),
    earring: new MeshStandardMaterial({ color: '#f4efe6', roughness: 0.4, emissive: '#c0392b', emissiveIntensity: 0.15 }),

    // Her (Kanao): white capelet over the dark uniform, pleated skirt, white
    // stockings, black hair in a side ponytail with a glowing butterfly clip
    hairGirl: new MeshStandardMaterial({ color: '#120c18', roughness: 0.34, metalness: 0.12 }),
    uniformGirl: new MeshStandardMaterial({ color: '#15141c', roughness: 0.75 }),
    capelet: new MeshPhysicalMaterial({
      map: makeCapeletTexture(),
      roughness: 0.7,
      sheen: 0.5,
      sheenColor: new Color('#ffd3e6'),
      side: DoubleSide,
    }),
    skirt: new MeshStandardMaterial({ map: makeSkirtTexture([3, 1]), roughness: 0.8, side: DoubleSide }),
    stocking: new MeshStandardMaterial({ color: '#f1eef0', roughness: 0.6 }),
    shoe: new MeshStandardMaterial({ color: '#1a1416', roughness: 0.5 }),
    button: new MeshStandardMaterial({ color: '#d6b25e', roughness: 0.3, metalness: 0.9 }),
    butterfly: new MeshStandardMaterial({
      color: '#f6a8d8',
      emissive: '#d77dff',
      emissiveIntensity: 2.4,
      roughness: 0.4,
      side: DoubleSide,
    }),
    butterflyEdge: new MeshStandardMaterial({ color: '#4b2a5e', roughness: 0.5, side: DoubleSide }),
    blush: new MeshBasicMaterial({ color: '#ff8fb6', transparent: true, opacity: 0.35, depthWrite: false }),
  };
  // Gentle breeze: haori hem & sleeves, capelet & skirt hems, hair tips.
  // Pivots are world heights (the ridge the couple stands on is y = 0).
  addWind(cached.haori, { amp: 0.035, pivotY: 1.35, range: 0.6 });
  addWind(cached.haoriLimb, { amp: 0.022, pivotY: 1.15, range: 0.3 });
  addWind(cached.capelet, { amp: 0.03, pivotY: 1.36, range: 0.35 });
  addWind(cached.skirt, { amp: 0.018, pivotY: 0.8, range: 0.3 });
  addWind(cached.hairGirl, { amp: 0.035, pivotY: 1.48, range: 0.25, freq: 1.2 });
  addWind(cached.hairGuy, { amp: 0.008, pivotY: 1.85, range: 0.2, freq: 1.4 });
  return cached;
}
