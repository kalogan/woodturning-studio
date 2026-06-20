/**
 * woodMaterial.ts — Procedural board-grain material for flat workshop woodwork.
 *
 * SEPARATE from WoodBlank's grain.glsl / grain shader — do NOT import or modify
 * those files.  This is a board/plank grain: long wavy streaks along the grain
 * axis with cathedral-arch figure and growth-ring banding (plain-sawn look).
 *
 * Usage:
 *   const mat = makeBoardMaterial('#9B6B3F');
 *   // or with explicit grain colour and axis:
 *   const mat = makeBoardMaterial('#9B6B3F', '#6b4020', { grainAxis: 'y' });
 *
 * The material is memoised by (baseHex + '|' + grainHex + '|' + axis) so calling
 * with the same arguments twice returns the cached instance — no per-call alloc.
 *
 * Grain axis: which LOCAL mesh axis is the board length / grain direction.
 *   'x' (default) — grain along local X (typical horizontal board, bench top)
 *   'y'           — grain along local Y (upright post, or a box whose height is length)
 *   'z'           — grain along local Z (board laid depth-first)
 *
 * Constraints satisfied:
 *   • No browser API / no DOM import (Three.js only).
 *   • Material built once per unique colour+axis combo; never called per-frame.
 *   • onBeforeCompile injection follows the same pattern as WoodBlank.tsx:
 *       – v_localPos varying declared in vertex pars + assigned in begin_vertex
 *       – board grain GLSL declared in fragment pars
 *       – #include <color_fragment> replaced with grain colour assignment
 *   • customProgramCacheKey set so Three.js doesn't share programs across
 *     materials with different uniforms.
 */

import * as THREE from 'three';

// ── Board-grain GLSL (inlined — no external .glsl file needed) ──────────────
//
// Axis selection: u_grainG and u_grainC are swizzle masks passed as vec3 dot-
// product weights, selecting which component of lp is the "grain" direction and
// which is the "cross-grain" direction.  No GLSL branching needed.
//
//   Grain along X:  u_grainG = (1,0,0), u_grainC = (0,1,0)
//   Grain along Y:  u_grainG = (0,1,0), u_grainC = (1,0,0)
//   Grain along Z:  u_grainG = (0,0,1), u_grainC = (1,0,0)
//
// What this produces:
//   1. Cathedral / plain-sawn arch figure — warp the cross-axis coordinate
//      with low-frequency noise along the grain direction, then use sine for
//      concentric arch-shaped growth rings (plain-sawn board look).
//   2. Fine longitudinal streaks — high-frequency noise elongated along the
//      grain axis for the classic straight-grain medullary texture.
//   3. The two layers mix between baseColor and grainColor.

const BOARD_GRAIN_GLSL = /* glsl */ `
// ── Noise helpers (b_ prefix to avoid collision with WoodBlank shader names) ──

float b_hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float b_noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(b_hash2(i),                   b_hash2(i + vec2(1.0, 0.0)), u.x),
    mix(b_hash2(i + vec2(0.0, 1.0)), b_hash2(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

uniform vec3  u_boardBase;    // base colour (lighter face-wood / earlywood tone)
uniform vec3  u_boardGrain;   // grain / latewood colour (darker)
uniform vec3  u_grainG;       // axis selector: grain (length) direction
uniform vec3  u_grainC;       // axis selector: cross-grain (width/face) direction

// ── Main board colour computation ─────────────────────────────────────────────
vec3 computeBoardColor(vec3 lp) {
  // Project local position onto the chosen grain and cross-grain axes.
  float gDir = dot(lp, u_grainG);   // along board length / grain direction
  float cDir = dot(lp, u_grainC);   // across the board face

  // ── Cathedral arch figure (plain-sawn growth rings) ──────────────────────
  // Warp the cross-grain coordinate with low-frequency noise along the length
  // to produce the characteristic cathedral arches of a plain-sawn board.
  float warp1 = b_noise2(vec2(gDir * 0.8,  cDir * 1.2)) * 0.18;
  float warp2 = b_noise2(vec2(gDir * 2.2 + 5.3, cDir * 3.0)) * 0.06;
  float warpedC = cDir + warp1 + warp2;

  // Growth rings: sine of the warped cross-axis.
  // 40.0 rad/unit ≈ ring every ~0.16 m on a 1-m wide board — visible and tight.
  float ringPhase = sin(warpedC * 40.0) * 0.5 + 0.5;
  // Sharpen to distinct latewood (dark) / earlywood (light) bands.
  float ringSharp = smoothstep(0.3, 0.7, ringPhase);
  float ring = mix(ringPhase, ringSharp, 0.65);

  // ── Fine longitudinal grain streaks ──────────────────────────────────────
  // High-frequency noise, heavily stretched along the grain axis.
  float streak1 = b_noise2(vec2(gDir * 4.0,         cDir * 40.0)) * 0.10;
  float streak2 = b_noise2(vec2(gDir * 8.0 + 3.7,   cDir * 90.0 + 1.2)) * 0.04;
  float streaks = streak1 + streak2;

  // ── Combine layers ────────────────────────────────────────────────────────
  // Ring banding drives the primary base ↔ grain colour blend.
  vec3 col = mix(u_boardBase, u_boardGrain, ring * 0.50);
  // Fine streaks add further depth toward the grain colour.
  col = mix(col, u_boardGrain, streaks);

  return col;
}
`;

// ── Vertex injection snippets (same pattern as WoodBlank.tsx) ────────────────

const VERT_PARS = /* glsl */ `
varying vec3 v_localPos;
`;

const VERT_BEGIN = /* glsl */ `
v_localPos = position;
`;

// ── Fragment colour replacement ───────────────────────────────────────────────

const FRAG_COLOR_REPLACEMENT = /* glsl */ `
diffuseColor = vec4(computeBoardColor(v_localPos), opacity);
`;

// ── Colour helpers ────────────────────────────────────────────────────────────

/**
 * Parse a CSS hex colour into a THREE.Color.
 * Falls back to black on invalid input (safe default).
 */
function hexToThreeColor(hex: string): THREE.Color {
  try {
    return new THREE.Color(hex);
  } catch {
    return new THREE.Color(0, 0, 0);
  }
}

/**
 * Derive a sensible darker grain colour from a base colour.
 * Reduces HSL lightness by 28 % and nudges saturation up by 6 % for a
 * warmer, richer grain line (earlywood vs latewood contrast).
 *
 * Pure function — takes and returns hex strings.
 * Exported so it can be unit-tested without a DOM / WebGL context.
 */
export function deriveGrainColor(baseHex: string): string {
  const c = hexToThreeColor(baseHex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const newL = Math.max(0, hsl.l * 0.72);          // darken ~28 %
  const newS = Math.min(1, hsl.s + 0.06);           // slightly richer
  const derived = new THREE.Color().setHSL(hsl.h, newS, newL);
  return '#' + derived.getHexString();
}

// ── Axis selector helpers ─────────────────────────────────────────────────────

type GrainAxis = 'x' | 'y' | 'z';

/**
 * Returns a pair of THREE.Vector3 [grainDir, crossDir] for the given axis.
 * These are passed as uniform vec3 values to the shader to avoid branching.
 */
function axisVectors(axis: GrainAxis): [THREE.Vector3, THREE.Vector3] {
  switch (axis) {
    case 'x': return [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)];
    case 'y': return [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)];
    case 'z': return [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)];
  }
}

// ── Material cache ────────────────────────────────────────────────────────────

const _cache = new Map<string, THREE.MeshStandardMaterial>();

// ── Public API ────────────────────────────────────────────────────────────────

export interface BoardMaterialOptions {
  /**
   * Which local mesh axis the board length (grain direction) runs along.
   *   'x' (default) — grain along local X (bench top, shelf board laid flat)
   *   'y'           — grain along local Y (upright post; also for rotated boxes
   *                   where Y is the long dimension before any mesh rotation)
   *   'z'           — grain along local Z
   */
  grainAxis?: GrainAxis;
}

/**
 * Returns a THREE.MeshStandardMaterial with a procedural board-grain shader
 * injected via onBeforeCompile.
 *
 * Results are cached by (baseHex + '|' + grainHex + '|' + axis) so repeated
 * calls with the same arguments are allocation-free after the first call.
 *
 * @param baseHex   CSS hex colour for the face-wood base tone (e.g. '#9B6B3F')
 * @param grainHex  Optional CSS hex for the grain / latewood colour.
 *                  If omitted, derived automatically by darkening baseHex ~28 %.
 * @param opts      Optional: grainAxis ('x' | 'y' | 'z', default 'x')
 */
export function makeBoardMaterial(
  baseHex: string,
  grainHex?: string,
  opts: BoardMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const resolvedGrain = grainHex ?? deriveGrainColor(baseHex);
  const axis: GrainAxis = opts.grainAxis ?? 'x';
  const cacheKey = `${baseHex}|${resolvedGrain}|${axis}`;

  const cached = _cache.get(cacheKey);
  if (cached !== undefined) return cached;

  // Pre-allocate all uniform value objects — never allocated again after this.
  const baseColor  = hexToThreeColor(baseHex);
  const grainColor = hexToThreeColor(resolvedGrain);
  const [grainDir, crossDir] = axisVectors(axis);

  const uniforms = {
    u_boardBase:   { value: baseColor },
    u_boardGrain:  { value: grainColor },
    u_grainG:      { value: grainDir },
    u_grainC:      { value: crossDir },
  };

  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,   // fallback colour shown before shader compiles
    roughness: 0.80,
    metalness: 0.0,
  });

  mat.onBeforeCompile = (shader) => {
    // Merge our uniforms into the standard shader's uniform block.
    Object.assign(shader.uniforms, uniforms);

    // Vertex shader: declare the v_localPos varying and assign model-space pos.
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',       '#include <common>\n'       + VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BEGIN);

    // Fragment shader: inject grain function + varying declaration.
    const fragPars = 'varying vec3 v_localPos;\n' + BOARD_GRAIN_GLSL;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',          '#include <common>\n'  + fragPars)
      .replace('#include <color_fragment>',  FRAG_COLOR_REPLACEMENT);
  };

  // Each unique colour+axis combo needs its own WebGL program — prevent sharing.
  mat.customProgramCacheKey = () => `board-grain-v1:${cacheKey}`;

  _cache.set(cacheKey, mat);
  return mat;
}
