// grain.glsl — procedural wood grain fragment shader snippet.
// Injected into meshStandardMaterial via onBeforeCompile.
// Replaces / extends the #include <color_fragment> chunk so PBR lighting is preserved.
//
// Uniforms provided by WoodBlank (set once per species change, not per frame):
//   u_baseColor      — vec3, linear sRGB [0..1]
//   u_grainColor     — vec3, linear sRGB [0..1]
//   u_ringFrequency  — float, rings per unit (model-space Y axis)
//   u_ringContrast   — float, [0..1]
//   u_figureType     — int, 0=none 1=fleck 2=streak
//   u_tearout        — float, [0..1], coarse tearout factor for desaturation cue
//   u_figureIntensity — float, [0..1]

uniform vec3  u_baseColor;
uniform vec3  u_grainColor;
uniform float u_ringFrequency;
uniform float u_ringContrast;
uniform int   u_figureType;
uniform float u_figureIntensity;
uniform float u_tearout;

// ── Value noise helpers ───────────────────────────────────────────────────────

float g_hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float g_hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float g_noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(g_hash2(i + vec2(0.0, 0.0)), g_hash2(i + vec2(1.0, 0.0)), u.x),
    mix(g_hash2(i + vec2(0.0, 1.0)), g_hash2(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float g_noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = g_hash3(i + vec3(0.0, 0.0, 0.0));
  float n100 = g_hash3(i + vec3(1.0, 0.0, 0.0));
  float n010 = g_hash3(i + vec3(0.0, 1.0, 0.0));
  float n110 = g_hash3(i + vec3(1.0, 1.0, 0.0));
  float n001 = g_hash3(i + vec3(0.0, 0.0, 1.0));
  float n101 = g_hash3(i + vec3(1.0, 0.0, 1.0));
  float n011 = g_hash3(i + vec3(0.0, 1.0, 1.0));
  float n111 = g_hash3(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

// ── Main grain computation ────────────────────────────────────────────────────
//
// vWorldPosition is injected as a varying by the vertex snippet (see WoodBlank.tsx).
// Model-space Y (vLocalY) is the lathe rotation axis.

vec3 computeWoodColor(vec3 localPos) {
  // ── Annual rings ──────────────────────────────────────────────────────────
  // Use distance from the lathe axis (X-Z plane) to form radial rings.
  float dist = length(localPos.xz);

  // Slight turbulence along Y gives an organic non-uniform ring shape.
  float turb = g_noise2(vec2(localPos.y * 6.0, dist * 3.0)) * 0.08;

  // Ring wave: sin maps to 0..1; scale by ringFrequency (rings per unit).
  float ringWave = sin((dist + turb) * u_ringFrequency * 6.2832) * 0.5 + 0.5;

  // Mix base ↔ grain color by ringWave × contrast.
  vec3 woodCol = mix(u_baseColor, u_grainColor, ringWave * u_ringContrast);

  // ── Fine longitudinal grain lines ─────────────────────────────────────────
  float grainNoise = g_noise2(vec2(localPos.y * 40.0, dist * 20.0)) * 0.06;
  woodCol *= (1.0 - grainNoise);

  // ── Figure (fleck or streak) ───────────────────────────────────────────────
  if (u_figureType == 1) {
    // Fleck: small scattered specks — e.g. quartersawn ray fleck (maple/cherry)
    float fleckThresh = 1.0 - u_figureIntensity * 0.6;
    float speckA = g_noise3(localPos * vec3(80.0, 12.0, 80.0));
    float speckB = g_noise3(localPos * vec3(60.0, 8.0, 60.0) + 17.3);
    float fleck = step(fleckThresh, speckA * speckB);
    // Flecks are lighter than the base (ray cells reflect more light)
    woodCol = mix(woodCol, woodCol * 1.35, fleck * u_figureIntensity);
  } else if (u_figureType == 2) {
    // Streak: elongated darker streaks aligned to the long axis (walnut, ash)
    float streakNoise = g_noise2(vec2(localPos.x * 30.0 + localPos.z * 30.0, localPos.y * 2.0));
    float streakFactor = smoothstep(0.55, 0.75, streakNoise) * u_figureIntensity;
    woodCol *= (1.0 - streakFactor * 0.4);
  }

  // ── Tearout cue ───────────────────────────────────────────────────────────
  // Darken + desaturate proportionally to tearout amount.
  float tearoutAmount = clamp(u_tearout, 0.0, 1.0);
  float luma = dot(woodCol, vec3(0.299, 0.587, 0.114));
  woodCol = mix(woodCol, vec3(luma) * 0.55, tearoutAmount * 0.7);

  return woodCol;
}
