/**
 * materials.test.ts — Unit tests for the PBR material factory helpers.
 *
 * Checks:
 *  - Every helper returns a MaterialProps with roughness ∈ [0,1], metalness ∈ [0,1],
 *    and a non-empty color string.
 *  - Metal helpers have metalness ≥ 0.5.
 *  - Non-metal helpers have metalness < 0.1 (effectively 0).
 *  - Color overrides are forwarded correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  jetWhiteSteel,
  paintedCastIron,
  darkCastIron,
  bareSteel,
  blackRubber,
  workshopWood,
  concreteFloor,
  paintedDrywall,
  paintedDrywallCeiling,
  cabinetPaint,
  laminateCounter,
  paintedSteelCabinet,
  brushedSteelHandle,
} from './materials.js';
import type { MaterialProps } from './materials.js';

// ── Helper ────────────────────────────────────────────────────────────────────

function assertValidProps(props: MaterialProps, label: string) {
  expect(props.roughness, `${label}: roughness must be ≥ 0`).toBeGreaterThanOrEqual(0);
  expect(props.roughness, `${label}: roughness must be ≤ 1`).toBeLessThanOrEqual(1);
  expect(props.metalness, `${label}: metalness must be ≥ 0`).toBeGreaterThanOrEqual(0);
  expect(props.metalness, `${label}: metalness must be ≤ 1`).toBeLessThanOrEqual(1);
  expect(typeof props.color, `${label}: color must be a string`).toBe('string');
  expect(props.color.length, `${label}: color must be non-empty`).toBeGreaterThan(0);
}

function assertMetal(props: MaterialProps, label: string) {
  expect(props.metalness, `${label}: metal helper must have metalness ≥ 0.5`).toBeGreaterThanOrEqual(0.5);
}

function assertNonMetal(props: MaterialProps, label: string) {
  expect(props.metalness, `${label}: non-metal helper must have metalness < 0.1`).toBeLessThan(0.1);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('material factory — valid props', () => {
  it('jetWhiteSteel returns valid props', () => {
    assertValidProps(jetWhiteSteel(), 'jetWhiteSteel');
  });

  it('paintedCastIron returns valid props', () => {
    assertValidProps(paintedCastIron(), 'paintedCastIron');
  });

  it('darkCastIron returns valid props', () => {
    assertValidProps(darkCastIron(), 'darkCastIron');
  });

  it('bareSteel returns valid props', () => {
    assertValidProps(bareSteel(), 'bareSteel');
  });

  it('blackRubber returns valid props', () => {
    assertValidProps(blackRubber(), 'blackRubber');
  });

  it('workshopWood returns valid props', () => {
    assertValidProps(workshopWood(), 'workshopWood');
  });

  it('concreteFloor returns valid props', () => {
    assertValidProps(concreteFloor(), 'concreteFloor');
  });

  it('paintedDrywall returns valid props', () => {
    assertValidProps(paintedDrywall(), 'paintedDrywall');
  });

  it('paintedDrywallCeiling returns valid props', () => {
    assertValidProps(paintedDrywallCeiling(), 'paintedDrywallCeiling');
  });

  it('cabinetPaint returns valid props', () => {
    assertValidProps(cabinetPaint(), 'cabinetPaint');
  });

  it('laminateCounter returns valid props', () => {
    assertValidProps(laminateCounter(), 'laminateCounter');
  });

  it('paintedSteelCabinet returns valid props', () => {
    assertValidProps(paintedSteelCabinet(), 'paintedSteelCabinet');
  });

  it('brushedSteelHandle returns valid props', () => {
    assertValidProps(brushedSteelHandle(), 'brushedSteelHandle');
  });
});

describe('material factory — metal vs non-metal', () => {
  it('bareSteel is a metal (metalness ≥ 0.5)', () => {
    assertMetal(bareSteel(), 'bareSteel');
  });

  it('brushedSteelHandle is a metal (metalness ≥ 0.5)', () => {
    assertMetal(brushedSteelHandle(), 'brushedSteelHandle');
  });

  it('blackRubber is non-metal (metalness ≈ 0)', () => {
    assertNonMetal(blackRubber(), 'blackRubber');
  });

  it('workshopWood is non-metal (metalness ≈ 0)', () => {
    assertNonMetal(workshopWood(), 'workshopWood');
  });

  it('concreteFloor is non-metal (metalness ≈ 0)', () => {
    assertNonMetal(concreteFloor(), 'concreteFloor');
  });

  it('paintedDrywall is non-metal (metalness ≈ 0)', () => {
    assertNonMetal(paintedDrywall(), 'paintedDrywall');
  });

  it('paintedDrywallCeiling is non-metal (metalness ≈ 0)', () => {
    assertNonMetal(paintedDrywallCeiling(), 'paintedDrywallCeiling');
  });

  it('cabinetPaint is non-metal (metalness ≈ 0)', () => {
    assertNonMetal(cabinetPaint(), 'cabinetPaint');
  });
});

describe('material factory — color override', () => {
  it('jetWhiteSteel forwards color override', () => {
    const props = jetWhiteSteel('#ff0000');
    expect(props.color).toBe('#ff0000');
  });

  it('darkCastIron forwards color override', () => {
    const props = darkCastIron('#abcdef');
    expect(props.color).toBe('#abcdef');
  });

  it('bareSteel forwards color override', () => {
    const props = bareSteel('#123456');
    expect(props.color).toBe('#123456');
  });

  it('workshopWood forwards color override', () => {
    const props = workshopWood('#aabbcc');
    expect(props.color).toBe('#aabbcc');
  });

  it('concreteFloor forwards color override', () => {
    const props = concreteFloor('#554433');
    expect(props.color).toBe('#554433');
  });

  it('paintedDrywall forwards color override', () => {
    const props = paintedDrywall('#ffffff');
    expect(props.color).toBe('#ffffff');
  });

  it('cabinetPaint forwards color override', () => {
    const props = cabinetPaint('#e0e0e0');
    expect(props.color).toBe('#e0e0e0');
  });

  it('laminateCounter forwards color override', () => {
    const props = laminateCounter('#707070');
    expect(props.color).toBe('#707070');
  });

  it('paintedSteelCabinet forwards color override', () => {
    const props = paintedSteelCabinet('#cc2222');
    expect(props.color).toBe('#cc2222');
  });
});

describe('material factory — painted helpers have lower metalness than bare metals', () => {
  it('paintedCastIron metalness < bareSteel metalness', () => {
    expect(paintedCastIron().metalness).toBeLessThan(bareSteel().metalness);
  });

  it('jetWhiteSteel metalness < bareSteel metalness', () => {
    expect(jetWhiteSteel().metalness).toBeLessThan(bareSteel().metalness);
  });

  it('darkCastIron metalness < bareSteel metalness', () => {
    expect(darkCastIron().metalness).toBeLessThan(bareSteel().metalness);
  });
});
