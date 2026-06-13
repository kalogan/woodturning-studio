/**
 * woodVisual.ts — PURE helper: WoodVisualParams → shader uniform values.
 *
 * NO imports from three, glsl, or any browser API.
 * This file is unit-tested in node (vitest) without a DOM/WebGL context.
 */

import type { WoodVisualParams } from '../../session/wood.js';

// Figure type → integer code for the GLSL uniform (u_figureType)
export const FIGURE_TYPE_NONE = 0;
export const FIGURE_TYPE_FLECK = 1;
export const FIGURE_TYPE_STREAK = 2;

export interface WoodUniforms {
  /** Linear sRGB [r, g, b] each in 0..1 */
  baseColor: [number, number, number];
  /** Linear sRGB [r, g, b] each in 0..1 */
  grainColor: [number, number, number];
  /** Ring frequency — how many rings per unit length */
  ringFrequency: number;
  /** Ring contrast clamped to 0..1 */
  ringContrast: number;
  /** 0=none, 1=fleck, 2=streak */
  figureType: number;
  /** Figure intensity clamped to 0..1 */
  figureIntensity: number;
}

/**
 * Parses a CSS 6-digit hex color string (e.g. '#c07850') into
 * linear-sRGB [r, g, b] components in the range [0, 1].
 * Returns [0, 0, 0] for any unparseable input.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const stripped = hex.startsWith('#') ? hex.slice(1) : hex;
  if (stripped.length !== 6) return [0, 0, 0];
  const r = parseInt(stripped.slice(0, 2), 16);
  const g = parseInt(stripped.slice(2, 4), 16);
  const b = parseInt(stripped.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return [0, 0, 0];
  return [r / 255, g / 255, b / 255];
}

/**
 * Maps a WoodFigure.type string to the integer code used in the GLSL shader.
 * Unknown strings fall back to FIGURE_TYPE_NONE (0).
 */
export function figureTypeToCode(type: string): number {
  if (type === 'fleck') return FIGURE_TYPE_FLECK;
  if (type === 'streak') return FIGURE_TYPE_STREAK;
  return FIGURE_TYPE_NONE;
}

/** Clamps a value to the inclusive range [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Converts WoodVisualParams (as authored in content/wood/*.json) into the
 * flat uniform values expected by WoodBlank's grain shader.
 *
 * Safe to call on every re-render; no allocations beyond the return object.
 */
export function visualToUniforms(visual: WoodVisualParams): WoodUniforms {
  return {
    baseColor: hexToRgb(visual.baseColor),
    grainColor: hexToRgb(visual.grainColor),
    ringFrequency: visual.ringFrequency,
    ringContrast: clamp(visual.ringContrast, 0, 1),
    figureType: figureTypeToCode(visual.figure.type),
    figureIntensity: clamp(visual.figure.intensity, 0, 1),
  };
}
