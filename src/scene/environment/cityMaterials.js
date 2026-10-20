import { DoubleSide, ShaderMaterial } from 'three';
import { sharedUniforms } from '../shared/uniforms';
import { GLSL_COMMON, GLSL_NOISE } from '../shared/glsl';
import { BLOCK, FESTIVAL_LANES } from './cityLayout';
import { WORLD } from '../world';

/**
 * Custom materials for the instanced city. They share uniform objects with
 * the fireworks so every burst lights up facades, roofs and the river.
 */

const LIGHTING = /* glsl */ `
  uniform vec3 uMoonDir;
  uniform vec3 uMoonColor;
  vec3 nightAmbient(vec3 n) {
    float hemi = n.y * 0.5 + 0.5;
    return mix(vec3(0.07, 0.04, 0.05), vec3(0.05, 0.06, 0.12), hemi);
  }
`;

/* ───────────────────────────── Buildings ───────────────────────────── */

const buildingVertex = /* glsl */ `
  attribute vec4 aInfo; // seed, style, lit probability, unused
  varying vec3 vLocal;
  varying vec3 vObjN;
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec4 vInfo;
  varying vec3 vSize;

  void main() {
    vec3 s = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vLocal = position * s;
    vSize = s;
    vObjN = normal;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * (normal / (s * s)));
    vWorld = wp.xyz;
    vInfo = aInfo;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const buildingFragment = /* glsl */ `
  ${GLSL_COMMON}
  ${LIGHTING}
  varying vec3 vLocal;
  varying vec3 vObjN;
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec4 vInfo;
  varying vec3 vSize;

  vec3 styleAlbedo(float style) {
    if (style < 0.5) return vec3(0.045, 0.03, 0.022);  // dark timber
    if (style < 1.5) return vec3(0.2, 0.175, 0.15);    // cream plaster
    if (style < 2.5) return vec3(0.09, 0.07, 0.065);   // brick / modern
    if (style < 3.5) return vec3(0.42, 0.42, 0.4);     // white castle plaster
    if (style < 4.5) return vec3(0.42, 0.05, 0.025);   // vermilion lacquer
    if (style < 5.5) return vec3(0.02, 0.018, 0.018);  // black lacquer
    if (style < 6.5) return vec3(0.11, 0.1, 0.095);    // stone
    return vec3(0.35, 0.25, 0.08);                     // bronze
  }

  void main() {
    vec3 n = normalize(vN);
    float seed = vInfo.x;
    float style = vInfo.y;
    float litP = vInfo.z;
    vec3 albedo = styleAlbedo(style);
    vec3 emissive = vec3(0.0);
    float h = vLocal.y + vSize.y * 0.5; // height above this box's base

    bool windows = style < 3.5 && abs(vObjN.y) < 0.5;
    if (windows) {
      bool xFace = abs(vObjN.x) > 0.5;
      float faceW = xFace ? vSize.z : vSize.x;
      float u = (xFace ? vLocal.z : vLocal.x) + faceW * 0.5;
      float floorH = 3.2;
      float colW = style > 2.5 ? 3.4 : (style > 1.5 ? 2.4 : 2.0);

      float fy = h / floorH;
      float fl = floor(fy);
      float fv = fract(fy);
      float nCols = max(floor(faceW / colW), 1.0);
      float fx = u / (faceW / nCols);
      float col = floor(fx);
      float fu = fract(fx);
      float faceId = xFace ? (vObjN.x > 0.0 ? 1.0 : 2.0) : (vObjN.z > 0.0 ? 3.0 : 4.0);
      float rnd = hash13(vec3(seed * 91.7 + faceId * 13.1, fl, col));
      float rnd2 = hash13(vec3(col + 7.0, fl * 7.3, seed * 31.1 + faceId));

      float ground = 1.0 - step(1.0, fl);
      float wx = smoothstep(0.16, 0.2, fu) * (1.0 - smoothstep(0.8, 0.84, fu));
      float wy = smoothstep(0.3, 0.34, fv) * (1.0 - smoothstep(0.8, 0.84, fv));
      if (ground > 0.5) {
        // Shop fronts: wide, bright, more often lit
        wx = smoothstep(0.05, 0.09, fu) * (1.0 - smoothstep(0.91, 0.95, fu));
        wy = smoothstep(0.06, 0.1, fv) * (1.0 - smoothstep(0.7, 0.74, fv));
      }
      float win = wx * wy;
      float lit = step(rnd, litP + ground * 0.3);

      // Shoji lattice on traditional buildings
      float lattice = 1.0;
      if (style < 1.5) {
        float lu = step(0.88, fract(fu * 5.0));
        float lv = step(0.85, fract(fv * 3.0));
        lattice = 1.0 - 0.5 * max(lu, lv);
      }
      vec3 warm = mix(vec3(1.0, 0.4, 0.12), vec3(1.0, 0.66, 0.34), rnd2);
      float inten = (0.35 + rnd2 * 0.6) * (1.0 + ground * 0.8);

      // Timber beams between floors
      float beam = (1.0 - smoothstep(0.0, 0.05, fv)) * step(style, 1.5);
      albedo *= 1.0 - 0.5 * beam;
      albedo = mix(albedo, vec3(0.015, 0.016, 0.022), win * (1.0 - lit));

      emissive = warm * inten * lit * lattice * win;
      // Distant buildings: replace the (aliasing) window pattern by its average glow.
      float fw = max(fwidth(fy), fwidth(fx));
      float far = smoothstep(0.25, 0.6, fw);
      emissive = mix(emissive, warm * inten * litP * 0.3, far);
    }
    if (style > 6.5) emissive += vec3(0.12, 0.07, 0.02);

    vec3 light = nightAmbient(n) + uMoonColor * max(dot(n, uMoonDir), 0.0) + flashLight(vWorld, n);
    // Lantern light bouncing up from the street
    light += vec3(0.9, 0.38, 0.15) * exp(-(vWorld.y - (${WORLD.groundY.toFixed(1)})) / 3.5) * 0.9;
    vec3 col = albedo * light * uDim + emissive * mix(0.55, 1.0, uDim) * igniteAt(vWorld.xz);
    col = applyFog(col, length(cameraPosition - vWorld));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createBuildingMaterial() {
  return new ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader: buildingVertex,
    fragmentShader: buildingFragment,
  });
}

/* ───────────────────────────── Roofs ───────────────────────────── */

const roofVertex = /* glsl */ `
  attribute vec3 aTint;
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vTint;
  varying float vH;
  void main() {
    vec3 s = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * (normal / (s * s)));
    vWorld = wp.xyz;
    vTint = aTint;
    vH = position.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const roofFragment = /* glsl */ `
  ${GLSL_COMMON}
  ${LIGHTING}
  varying vec3 vN;
  varying vec3 vWorld;
  varying vec3 vTint;
  varying float vH;
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    vec3 V = normalize(cameraPosition - vWorld);

    // Rows of kawara tiles running down the slope
    // Hip-roof faces are axis aligned: run the tile rows along each face's eave.
    float coord = (abs(n.x) > abs(n.z) ? vWorld.z : vWorld.x) * 3.2;
    float fw = fwidth(coord);
    float ridge = smoothstep(0.0, 0.5, abs(fract(coord) - 0.5) * 2.0);
    float stripes = mix(0.65 + 0.35 * ridge, 0.82, smoothstep(0.3, 1.0, fw));
    vec3 albedo = vTint * stripes;
    albedo = mix(albedo * 2.2, albedo, smoothstep(0.0, 0.05, vH)); // pale eave edge

    float diff = max(dot(n, uMoonDir), 0.0);
    vec3 H = normalize(uMoonDir + V);
    float spec = pow(max(dot(n, H), 0.0), 28.0) * 0.45 * mix(ridge, 0.6, smoothstep(0.3, 1.0, fw));
    vec3 col = albedo * ((nightAmbient(n) * 1.3 + uMoonColor * diff * 1.6) * uDim + flashLight(vWorld, n));
    col += uMoonColor * spec * 2.2 * uDim;
    col = applyFog(col, length(cameraPosition - vWorld));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createRoofMaterial() {
  return new ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader: roofVertex,
    fragmentShader: roofFragment,
    side: DoubleSide,
  });
}

/* ───────────────────────────── Ground ───────────────────────────── */

/** GLSL that sets `lane` to 1 inside any festival street (p = world xz). */
function festivalLanesGlsl() {
  const f = (v) => v.toFixed(1);
  return FESTIVAL_LANES.map((l) => {
    const across = l.axis === 'z' ? 'p.x' : 'p.y'; // p.y is world z
    const along = l.axis === 'z' ? 'p.y' : 'p.x';
    return `    lane = max(lane, (1.0 - smoothstep(1.5, 3.6, abs(${across} - (${f(l.at)}))))
      * smoothstep(${f(l.from - 4)}, ${f(l.from)}, ${along}) * (1.0 - smoothstep(${f(l.to)}, ${f(l.to + 4)}, ${along})));`;
  }).join('\n');
}


const worldVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const groundFragment = /* glsl */ `
  ${GLSL_COMMON}
  ${GLSL_NOISE}
  varying vec3 vWorld;
  void main() {
    vec2 p = vWorld.xz;
    vec2 g = abs(fract(p / ${BLOCK.toFixed(1)} + 0.5) - 0.5) * ${BLOCK.toFixed(1)};
    float dStreet = min(g.x, g.y);
    float street = (1.0 - smoothstep(1.0, 4.5, dStreet)) * (1.0 - smoothstep(380.0, 470.0, length(p)));
    float pools = 0.55 + 0.45 * vnoise(p * 0.25);
    vec3 col = vec3(0.012, 0.011, 0.016);
    float festival = 1.0 + 1.4 * (1.0 - smoothstep(90.0, 150.0, length(p)));
    float ign = igniteAt(p);
    col += vec3(0.11, 0.042, 0.014) * street * pools * festival * uDim * ign;
    // Festival lanes: a warm pool of lantern light so the crowd reads in silhouette
    float lane = 0.0;
${festivalLanesGlsl()}
    col += vec3(0.42, 0.16, 0.05) * lane * (0.7 + 0.3 * vnoise(p * 0.6)) * uDim * ign;
    col += flashLight(vWorld, vec3(0.0, 1.0, 0.0)) * 0.03;
    col = applyFog(col, length(cameraPosition - vWorld));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createGroundMaterial() {
  return new ShaderMaterial({
    uniforms: sharedUniforms,
    vertexShader: worldVertex,
    fragmentShader: groundFragment,
  });
}

/* ───────────────────────────── Mountains ───────────────────────────── */

const mountainVertex = /* glsl */ `
  attribute float aEdge; // 0 at the base, 1 on the ridgeline
  varying float vEdge;
  varying vec3 vWorld;
  void main() {
    vEdge = aEdge;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const mountainFragment = /* glsl */ `
  ${GLSL_COMMON}
  uniform vec3 uBase;
  uniform float uMist;
  varying float vEdge;
  varying vec3 vWorld;
  void main() {
    vec3 col = mix(uBase, uFogColor * 1.35, uMist);
    // Mist pooling in the valleys
    col = mix(uFogColor * 1.6, col, smoothstep(0.0, 0.55, vEdge));
    // Ridgelines catch the light of every burst
    vec3 flash = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      vec3 L = uFlashPos[i] - vWorld;
      float d = length(L);
      flash += uFlashColor[i] * (600.0 / (d + 200.0));
    }
    float rim = pow(vEdge, 7.0);
    col += flash * (0.025 + 0.1 * rim);
    col *= mix(0.6, 1.0, uDim);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createMountainMaterial(base, mist) {
  return new ShaderMaterial({
    uniforms: { ...sharedUniforms, uBase: { value: base }, uMist: { value: mist } },
    vertexShader: mountainVertex,
    fragmentShader: mountainFragment,
    side: DoubleSide,
  });
}
