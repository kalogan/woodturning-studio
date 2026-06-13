import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  figureTypeToCode,
  visualToUniforms,
  FIGURE_TYPE_NONE,
  FIGURE_TYPE_FLECK,
  FIGURE_TYPE_STREAK,
} from './woodVisual.js';
import { getWoodSpeciesById, getWoodSpecies } from '../../session/wood.js';

// ── hexToRgb ─────────────────────────────────────────────────────────────────

describe('hexToRgb', () => {
  it('converts #ffffff to [1, 1, 1]', () => {
    const [r, g, b] = hexToRgb('#ffffff');
    expect(r).toBeCloseTo(1);
    expect(g).toBeCloseTo(1);
    expect(b).toBeCloseTo(1);
  });

  it('converts #000000 to [0, 0, 0]', () => {
    const [r, g, b] = hexToRgb('#000000');
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('converts #ff0000 to [1, 0, 0]', () => {
    const [r, g, b] = hexToRgb('#ff0000');
    expect(r).toBeCloseTo(1);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('converts #0000ff to [0, 0, 1]', () => {
    const [r, g, b] = hexToRgb('#0000ff');
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBeCloseTo(1);
  });

  it('converts a mid-value hex correctly — #804020', () => {
    const [r, g, b] = hexToRgb('#804020');
    expect(r).toBeCloseTo(0x80 / 255);
    expect(g).toBeCloseTo(0x40 / 255);
    expect(b).toBeCloseTo(0x20 / 255);
  });

  it('converts cherry baseColor #c07850 correctly', () => {
    const [r, g, b] = hexToRgb('#c07850');
    expect(r).toBeCloseTo(0xc0 / 255);
    expect(g).toBeCloseTo(0x78 / 255);
    expect(b).toBeCloseTo(0x50 / 255);
  });

  it('all components are in [0, 1] for known species colors', () => {
    for (const s of getWoodSpecies()) {
      for (const hex of [s.visual.baseColor, s.visual.grainColor]) {
        const [r, g, b] = hexToRgb(hex);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
      }
    }
  });

  it('returns [0, 0, 0] for empty string', () => {
    expect(hexToRgb('')).toEqual([0, 0, 0]);
  });

  it('returns [0, 0, 0] for invalid hex (too short)', () => {
    expect(hexToRgb('#fff')).toEqual([0, 0, 0]);
  });

  it('works without leading # (bare 6-char hex)', () => {
    const [r, g, b] = hexToRgb('ffffff');
    expect(r).toBeCloseTo(1);
    expect(g).toBeCloseTo(1);
    expect(b).toBeCloseTo(1);
  });
});

// ── figureTypeToCode ──────────────────────────────────────────────────────────

describe('figureTypeToCode', () => {
  it("maps 'none' to FIGURE_TYPE_NONE (0)", () => {
    expect(figureTypeToCode('none')).toBe(FIGURE_TYPE_NONE);
    expect(figureTypeToCode('none')).toBe(0);
  });

  it("maps 'fleck' to FIGURE_TYPE_FLECK (1)", () => {
    expect(figureTypeToCode('fleck')).toBe(FIGURE_TYPE_FLECK);
    expect(figureTypeToCode('fleck')).toBe(1);
  });

  it("maps 'streak' to FIGURE_TYPE_STREAK (2)", () => {
    expect(figureTypeToCode('streak')).toBe(FIGURE_TYPE_STREAK);
    expect(figureTypeToCode('streak')).toBe(2);
  });

  it('maps unknown strings to FIGURE_TYPE_NONE (0)', () => {
    expect(figureTypeToCode('bird')).toBe(0);
    expect(figureTypeToCode('')).toBe(0);
    expect(figureTypeToCode('FLECK')).toBe(0); // case-sensitive
    expect(figureTypeToCode('curl')).toBe(0);
  });
});

// ── visualToUniforms — clamping ───────────────────────────────────────────────

describe('visualToUniforms clamping', () => {
  const baseVisual = {
    baseColor: '#ffffff',
    grainColor: '#000000',
    ringFrequency: 8,
    ringContrast: 0.5,
    figure: { type: 'none' as const, intensity: 0.5 },
  };

  it('clamps ringContrast above 1 down to 1', () => {
    const u = visualToUniforms({ ...baseVisual, ringContrast: 1.5 });
    expect(u.ringContrast).toBe(1);
  });

  it('clamps ringContrast below 0 up to 0', () => {
    const u = visualToUniforms({ ...baseVisual, ringContrast: -0.3 });
    expect(u.ringContrast).toBe(0);
  });

  it('keeps ringContrast within [0,1] when already valid', () => {
    const u = visualToUniforms({ ...baseVisual, ringContrast: 0.28 });
    expect(u.ringContrast).toBe(0.28);
  });

  it('clamps figureIntensity above 1 down to 1', () => {
    const u = visualToUniforms({
      ...baseVisual,
      figure: { type: 'fleck', intensity: 2.0 },
    });
    expect(u.figureIntensity).toBe(1);
  });

  it('clamps figureIntensity below 0 up to 0', () => {
    const u = visualToUniforms({
      ...baseVisual,
      figure: { type: 'fleck', intensity: -0.5 },
    });
    expect(u.figureIntensity).toBe(0);
  });
});

// ── visualToUniforms — all 6 species produce finite uniforms ──────────────────

describe('visualToUniforms — all 6 species', () => {
  const SPECIES_IDS = ['pine', 'maple', 'cherry', 'walnut', 'oak', 'ash'] as const;

  for (const id of SPECIES_IDS) {
    it(`produces finite uniforms for species '${id}'`, () => {
      const species = getWoodSpeciesById(id);
      expect(species).toBeDefined();
      if (!species) return;

      const u = visualToUniforms(species.visual);

      // baseColor
      for (const ch of u.baseColor) {
        expect(Number.isFinite(ch)).toBe(true);
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(1);
      }
      // grainColor
      for (const ch of u.grainColor) {
        expect(Number.isFinite(ch)).toBe(true);
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(1);
      }
      // scalars
      expect(Number.isFinite(u.ringFrequency)).toBe(true);
      expect(u.ringFrequency).toBeGreaterThan(0);
      expect(Number.isFinite(u.ringContrast)).toBe(true);
      expect(u.ringContrast).toBeGreaterThanOrEqual(0);
      expect(u.ringContrast).toBeLessThanOrEqual(1);
      expect(Number.isFinite(u.figureType)).toBe(true);
      expect([0, 1, 2]).toContain(u.figureType);
      expect(Number.isFinite(u.figureIntensity)).toBe(true);
      expect(u.figureIntensity).toBeGreaterThanOrEqual(0);
      expect(u.figureIntensity).toBeLessThanOrEqual(1);
    });
  }

  it('cherry has figureType=1 (fleck)', () => {
    const cherry = getWoodSpeciesById('cherry');
    expect(cherry).toBeDefined();
    if (!cherry) return;
    const u = visualToUniforms(cherry.visual);
    expect(u.figureType).toBe(FIGURE_TYPE_FLECK);
  });

  it('walnut has figureType=2 (streak)', () => {
    const walnut = getWoodSpeciesById('walnut');
    expect(walnut).toBeDefined();
    if (!walnut) return;
    const u = visualToUniforms(walnut.visual);
    expect(u.figureType).toBe(FIGURE_TYPE_STREAK);
  });
});
