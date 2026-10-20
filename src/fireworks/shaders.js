import { AdditiveBlending, NormalBlending, ShaderMaterial, Vector2, Vector3 } from 'three';
import { sharedUniforms } from '../scene/shared/uniforms';
import { GLSL_COMMON } from '../scene/shared/glsl';
import { WIND } from './physics';

/** Particle kinds (aParams.w) for the spark material. */
export const KIND = { STAR: 0, TAIL: 1, EMBER: 2, STROBE: 3, FLASH: 4, ROCKET: 5 };

const MOTION = /* glsl */ `
  uniform float uTime;
  uniform float uScale;      // pixels per metre at 1 m distance
  uniform float uMaxSize;    // max gl_PointSize supported
  uniform float uDissolve;   // 0 = intact … ~1.15 = fully disintegrated
  uniform float uCutoff;     // particles born before this are hidden
  uniform vec3 uWind;

  attribute float aBirth;
  attribute vec3 aVel;
  attribute vec4 aPhys;   // life, drag, gravity scale, intensity
  attribute vec4 aColor;  // rgb
  attribute vec4 aColor2; // rgb, changeAt
  attribute vec4 aParams;

  // Same closed-form drag + gravity + wind as physics.js
  vec3 trajectory(float age) {
    float k = max(aPhys.y, 0.001);
    vec3 vt = vec3(uWind.x, -9.81 * aPhys.z / k + uWind.y, uWind.z);
    return position + vt * age + (aVel - vt) * (1.0 - exp(-k * age)) / k;
  }
  vec3 velocityAt(float age) {
    float k = max(aPhys.y, 0.001);
    vec3 vt = vec3(uWind.x, -9.81 * aPhys.z / k + uWind.y, uWind.z);
    return vt + (aVel - vt) * exp(-k * age);
  }
`;

/* ───────────────────────────── Sparks (additive) ───────────────────────────── */

const sparkVertex = /* glsl */ `
  ${MOTION}
  uniform float uFogDensity;
  uniform vec2 uResolution; // drawing-buffer size in px
  uniform float uShutter;   // motion-blur exposure in seconds
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHot;
  varying vec2 vSeg;        // streak vector in point-coord units (tail → head)
  varying float vCore;      // core radius in point-coord units

  void main() {
    float birth = aBirth;
    float life = aPhys.x;
    float age = uTime - birth;
    if (age < 0.0 || age > life || birth < uCutoff) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }

    vec3 pos = trajectory(age);
    float t = age / life;
    float kind = aParams.w;
    float seed = aParams.z;
    float freq = aParams.y;

    vec3 base = mix(aColor.rgb, aColor2.rgb, smoothstep(aColor2.w - 0.06, aColor2.w + 0.06, t));
    float env = 1.0;
    float hot = 0.0;
    float shrink = 1.0;
    vec3 col = base;

    if (kind < 1.5) {
      // Burning star (and its delayed tail copies): white-hot ignition → color → sputtering ember.
      env = smoothstep(0.0, 0.03, age) * pow(1.0 - t, 1.1);
      float sputter = smoothstep(0.7, 1.0, t);
      env *= 1.0 - sputter * 0.8 * step(0.45, fract(age * 23.0 + seed * 17.0));
      hot = 1.0 - smoothstep(0.0, 0.14, t);
      col = mix(base, vec3(1.0, 0.93, 0.82), hot * 0.6);
      col = mix(col, base * vec3(1.0, 0.5, 0.25), smoothstep(0.6, 1.0, t) * 0.55);
      shrink = mix(1.0, 0.55, t);
    } else if (kind < 2.5) {
      // Residue ember left hanging in the air: slow twinkle, long fade.
      env = smoothstep(0.0, 0.1, t) * pow(1.0 - t, 1.6);
      env *= 0.6 + 0.4 * sin(age * freq + seed * 40.0);
      shrink = mix(1.0, 0.6, t);
    } else if (kind < 3.5) {
      // Strobe / crackle glitter that blinks on and off.
      float on = step(0.6, fract(age * freq + seed * 9.0));
      env = on * (1.0 - 0.7 * t) * smoothstep(0.0, 0.04, t);
      hot = 0.6;
    } else if (kind < 4.5) {
      // Burst flash
      env = pow(1.0 - t, 3.0);
      col = mix(base, vec3(1.0), 0.6);
      hot = 1.0;
      shrink = mix(0.6, 1.2, t);
    } else {
      // Rising rocket head
      env = 0.8 + 0.2 * sin(age * 60.0 + seed * 10.0);
      hot = 0.5;
    }

    // Cooldown disintegration: particles drop out one by one (by seed) and dim.
    float keep = smoothstep(uDissolve - 0.12, uDissolve, seed * 0.88 + 0.12);
    float d = clamp(uDissolve, 0.0, 1.0);
    env *= keep * (1.0 - 0.45 * d);

    vec4 mv = viewMatrix * vec4(pos, 1.0);
    float dist = max(-mv.z, 0.1);
    float sizePx = aParams.x * shrink * (1.0 - 0.35 * d) * uScale / dist;
    float alpha = env * aPhys.w;
    // Keep tiny far particles from flickering: never smaller than 1.5 px, dim instead.
    if (sizePx < 1.5) {
      alpha *= sizePx / 1.5;
      sizePx = 1.5;
    }
    sizePx = min(sizePx, uMaxSize * 0.5);

    // Motion blur: stretch the sprite along the projected velocity, like a
    // long-exposure photo of fireworks.
    vec4 clipHead = projectionMatrix * mv;
    float shutter = (kind > 3.5 && kind < 4.5) ? 0.0 : uShutter;
    vec4 clipTail = projectionMatrix * viewMatrix * vec4(pos - velocityAt(age) * shutter, 1.0);
    vec2 halfRes = 0.5 * uResolution;
    vec2 sHead = clipHead.xy / clipHead.w * halfRes;
    vec2 sTail = clipTail.w > 0.01 ? clipTail.xy / clipTail.w * halfRes : sHead;
    vec2 seg = sHead - sTail;
    float segLen = length(seg);
    float maxSeg = max(0.0, uMaxSize - sizePx);
    if (segLen > maxSeg) {
      seg *= maxSeg / segLen;
      segLen = maxSeg;
    }
    float total = sizePx + segLen;
    alpha *= sizePx / (sizePx + segLen * 0.3); // spread energy along the streak

    vec2 sMid = sHead - seg * 0.5;
    gl_Position = vec4(sMid / halfRes * clipHead.w, clipHead.z, clipHead.w);
    gl_PointSize = total;

    float fog = exp(-uFogDensity * uFogDensity * dist * dist * 0.5);
    vColor = col;
    vAlpha = alpha * fog;
    vHot = hot;
    vSeg = vec2(seg.x, -seg.y) / total; // gl_PointCoord's y axis points down
    vCore = 0.5 * sizePx / total;
  }
`;

const sparkFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHot;
  varying vec2 vSeg;
  varying float vCore;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    vec2 a = -0.5 * vSeg; // tail
    float l2 = dot(vSeg, vSeg);
    float t = l2 > 1e-8 ? clamp(dot(c - a, vSeg) / l2, 0.0, 1.0) : 1.0;
    float d = length(c - (a + vSeg * t)) / vCore;
    if (d > 1.0) discard;
    float d2 = d * d;
    float along = mix(0.3, 1.0, t * t); // brightest at the head
    float core = exp(-d2 * 14.0);
    float halo = exp(-d2 * 4.0) * (1.0 - d2) * 0.35;
    // Colored glow with a white-hot centre (HDR → feeds the bloom pass).
    // Saturated colour glow, with a small white-hot pinpoint at the very centre.
    vec3 col = vColor * (core * 1.3 + halo * 1.4) + vec3(1.0, 0.95, 0.9) * core * core * core * (0.2 + 0.5 * vHot);
    gl_FragColor = vec4(col * vAlpha * along, 0.0);
  }
`;

export function createSparkMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: sharedUniforms.uTime,
      uFogDensity: sharedUniforms.uFogDensity,
      uScale: { value: 800 },
      uMaxSize: { value: 256 },
      uDissolve: { value: 0 },
      uCutoff: { value: -1e9 },
      uWind: { value: new Vector3(...WIND) },
      uResolution: { value: new Vector2(1, 1) },
      uShutter: { value: 0.06 },
    },
    vertexShader: sparkVertex,
    fragmentShader: sparkFragment,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    premultipliedAlpha: true, // → blendFunc(ONE, ONE): true HDR additive
  });
}

/* ───────────────────────────── Smoke (alpha blended) ───────────────────────────── */

const smokeVertex = /* glsl */ `
  ${MOTION}
  ${GLSL_COMMON}
  varying vec3 vLight;
  varying float vAlpha;
  varying float vRot;
  varying float vFog;

  void main() {
    float birth = aBirth;
    float life = aPhys.x;
    float age = uTime - birth;
    if (age < 0.0 || age > life || birth < uCutoff) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    vec3 pos = trajectory(age);
    float t = age / life;

    float size = aParams.x * (1.0 + aParams.y * age);
    float alpha = smoothstep(0.0, 0.08, t) * pow(1.0 - t, 1.4) * aPhys.w;
    alpha *= 1.0 - 0.8 * smoothstep(0.0, 1.0, uDissolve);

    // Lighting: night ambient, warm city glow from below, the burst that made it,
    // and every later burst nearby (old smoke lights up when new shells explode).
    vec3 light = vec3(0.03, 0.026, 0.045);
    light += vec3(0.05, 0.022, 0.02) * smoothstep(20.0, -60.0, pos.y);
    light += aColor.rgb * 0.8 * exp(-age * 1.8);
    for (int i = 0; i < 4; i++) {
      vec3 L = uFlashPos[i] - pos;
      float d2 = dot(L, L);
      light += uFlashColor[i] * 0.55 / (1.0 + d2 / (uFlashRadius * uFlashRadius * 0.25));
    }

    vec4 mv = viewMatrix * vec4(pos, 1.0);
    float dist = max(-mv.z, 0.1);
    gl_PointSize = min(size * uScale / dist, uMaxSize);

    vLight = light;
    vAlpha = alpha;
    vRot = aParams.z * 6.2831 + age * aParams.w;
    vFog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    gl_Position = projectionMatrix * mv;
  }
`;

const smokeFragment = /* glsl */ `
  uniform sampler2D uPuff;
  uniform float uDissolve;
  uniform vec3 uFogColor;
  varying vec3 vLight;
  varying float vAlpha;
  varying float vRot;
  varying float vFog;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float s = sin(vRot);
    float co = cos(vRot);
    c = mat2(co, -s, s, co) * c;
    vec4 tex = texture2D(uPuff, c + 0.5);
    // Noise-driven erosion: the puff breaks apart into wisps as it dissolves.
    float erode = smoothstep(uDissolve - 0.3, uDissolve, tex.g);
    float a = tex.r * vAlpha * erode;
    if (a < 0.002) discard;
    vec3 col = vLight * (0.65 + 0.5 * tex.b);
    col = mix(col, uFogColor, vFog);
    gl_FragColor = vec4(col, a);
  }
`;

export function createSmokeMaterial(puffTexture) {
  return new ShaderMaterial({
    uniforms: {
      uTime: sharedUniforms.uTime,
      uFogDensity: sharedUniforms.uFogDensity,
      uFogColor: sharedUniforms.uFogColor,
      uFlashPos: sharedUniforms.uFlashPos,
      uFlashColor: sharedUniforms.uFlashColor,
      uFlashRadius: sharedUniforms.uFlashRadius,
      uScale: { value: 800 },
      uMaxSize: { value: 256 },
      uDissolve: { value: 0 },
      uCutoff: { value: -1e9 },
      uWind: { value: new Vector3(...WIND) },
      uPuff: { value: puffTexture },
    },
    vertexShader: smokeVertex,
    fragmentShader: smokeFragment,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
  });
}
