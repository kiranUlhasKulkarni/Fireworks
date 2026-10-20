/** GLSL snippets shared by the custom materials. */

export const GLSL_COMMON = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uDim;
  uniform float uIgnite;
  uniform vec3 uFlashPos[4];
  uniform vec3 uFlashColor[4];
  uniform float uFlashRadius;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  // 0 → 1 as the intro ignition wave passes this point (with a bright leading edge).
  float igniteAt(vec2 xz) {
    float d = length(xz);
    float lit = 1.0 - smoothstep(uIgnite - 40.0, uIgnite, d);
    float edge = exp(-pow((uIgnite - 18.0 - d) / 16.0, 2.0));
    return lit * (1.0 + 0.9 * edge);
  }
  vec3 applyFog(vec3 c, float dist) {
    float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    return mix(c, uFogColor, f);
  }
  // Diffuse light from the (up to 4) live firework bursts.
  vec3 flashLight(vec3 p, vec3 n) {
    vec3 sum = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      vec3 L = uFlashPos[i] - p;
      float d2 = dot(L, L);
      L *= inversesqrt(max(d2, 1e-4));
      float att = 1.0 / (1.0 + d2 / (uFlashRadius * uFlashRadius));
      sum += uFlashColor[i] * att * (0.25 + 0.75 * max(dot(n, L), 0.0));
    }
    return sum;
  }
`;

export const GLSL_NOISE = /* glsl */ `
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      a *= 0.5;
    }
    return v;
  }
  // Long, horizontally stretched night clouds.
  float cloudDensity(vec3 d, float time) {
    float h = d.y;
    if (h <= 0.0) return 0.0;
    vec2 p = d.xz / (h + 0.18);
    p = p * vec2(0.9, 2.6) + vec2(time * 0.006, 0.0);
    float n = fbm(p * 0.9);
    float bands = smoothstep(0.52, 0.8, n);
    return bands * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.35, 0.75, h));
  }
`;

/**
 * Outward push from the heart-click shockwave. A ring expands at ~14 m/s;
 * particles it passes are shoved away, then drift back over a few seconds.
 */
export const GLSL_SHOCK = /* glsl */ `
  uniform vec3 uShockOrigin;
  uniform float uShockTime;
  vec3 shockOffset(vec3 p, float time) {
    float age = time - uShockTime;
    if (age < 0.0 || age > 6.0) return vec3(0.0);
    vec3 d = p - uShockOrigin;
    float dist = length(d) + 1e-3;
    float reached = smoothstep(dist - 1.5, dist, age * 14.0);
    float env = (1.0 - exp(-max(age - dist / 14.0, 0.0) * 5.0)) * exp(-age * 0.7);
    return d / dist * 2.6 * exp(-dist / 9.0) * reached * env;
  }
`;
