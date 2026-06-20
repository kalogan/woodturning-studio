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
  // ── Annual rings — visible on the TURNED CURVED SURFACE ────────────────────
  // CRITICAL: growth rings are concentric around the PITH. If we measured distance
  // from the TURNING AXIS, that distance is CONSTANT on the cylinder's surface
  // (= the radius) → the ring function returns the same value everywhere → the
  // blank looks flat/white. Real blanks are NOT cut dead-centre of the log, so the
  // pith sits OFF the turning axis: distance-to-pith then varies around the
  // circumference + along the length, so rings surface as cathedral grain.
  const vec2  PITH_OFFSET = vec2(0.042, 0.022); // m — pith off the turning axis (tunable)
  const float RING_SCALE  = 22.0;               // bring the ~0.05 m radius into a multi-ring range

  // Gentle drift of the ring centre along the length → cathedral arches, not straight bands.
  float lengthWarp = (g_noise2(vec2(localPos.y * 1.5, 7.3)) - 0.5) * 0.020;
  float dist = (length(localPos.xz - PITH_OFFSET) + lengthWarp) * RING_SCALE;

  // Small turbulence so the rings aren't mechanically perfect.
  float turb = g_noise2(vec2(localPos.y * 4.0, dist * 1.5)) * 0.30;

  // Raw ring phase mapped to 0..1 via sine.
  float rawRing = sin((dist + turb) * u_ringFrequency * 6.2832) * 0.5 + 0.5;

  // Sharpen rings into distinct early/latewood bands.
  float ringSharp = smoothstep(0.30, 0.70, rawRing);
  float ringMix = mix(rawRing, ringSharp, clamp(u_ringContrast * 1.5, 0.0, 1.0));

  // Mix base ↔ grain color.  Floor keeps some banding even for low-contrast species.
  float blendT = ringMix * clamp(u_ringContrast + 0.20, 0.0, 1.0);
  vec3 woodCol = mix(u_baseColor, u_grainColor, blendT);

  // ── Longitudinal fibre lines ──────────────────────────────────────────────
  // Run along the length (Y) around the circumference (angle) — the streaky look
  // of wood fibres on a turned surface. Uses the angle so it varies across the surface.
  float ang   = atan(localPos.z, localPos.x);
  float fibre = g_noise2(vec2(ang * 5.0,  localPos.y * 28.0)) * 0.10;
  fibre      += g_noise2(vec2(ang * 13.0, localPos.y * 80.0)) * 0.04;
  woodCol = mix(woodCol, u_grainColor, fibre);

  // ── Figure (fleck or streak) ───────────────────────────────────────────────
  if (u_figureType == 1) {
    // Fleck: small scattered specks — e.g. quartersawn ray fleck (maple/cherry)
    float fleckThresh = 1.0 - u_figureIntensity * 0.65;
    float speckA = g_noise3(localPos * vec3(80.0, 12.0, 80.0));
    float speckB = g_noise3(localPos * vec3(60.0, 8.0, 60.0) + 17.3);
    float fleck = step(fleckThresh, speckA * speckB);
    // Flecks are lighter than the base (ray cells reflect more light)
    woodCol = mix(woodCol, woodCol * 1.45, fleck * u_figureIntensity);
  } else if (u_figureType == 2) {
    // Streak: elongated darker streaks aligned to the long axis (walnut, ash)
    float streakNoise = g_noise2(vec2(localPos.x * 30.0 + localPos.z * 30.0, localPos.y * 2.0));
    float streakFactor = smoothstep(0.45, 0.70, streakNoise) * u_figureIntensity;
    woodCol = mix(woodCol, u_grainColor * 0.7, streakFactor * 0.55);
  }

  // ── Tearout cue ───────────────────────────────────────────────────────────
  // Darken + desaturate proportionally to tearout amount.
  float tearoutAmount = clamp(u_tearout, 0.0, 1.0);
  float luma = dot(woodCol, vec3(0.299, 0.587, 0.114));
  woodCol = mix(woodCol, vec3(luma) * 0.55, tearoutAmount * 0.7);

  return woodCol;
}
