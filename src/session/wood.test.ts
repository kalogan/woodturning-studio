import { describe, it, expect } from 'vitest';
import {
  getWoodSpecies,
  getWoodSpeciesById,
  getCuttingCoefficients,
  normalizedHardness,
} from './wood.js';

const SPECIES_IDS = ['pine', 'maple', 'cherry', 'walnut', 'oak', 'ash'] as const;
const TOOL_IDS = ['roughing-gouge', 'spindle-gouge', 'parting-tool'] as const;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const FIGURE_TYPES = new Set(['none', 'fleck', 'streak']);

// ── Species loading ──────────────────────────────────────────────────────────

describe('getWoodSpecies', () => {
  it('returns exactly 6 species', () => {
    expect(getWoodSpecies()).toHaveLength(6);
  });

  it('all species have required top-level fields', () => {
    for (const s of getWoodSpecies()) {
      expect(typeof s.id).toBe('string');
      expect(s.id.length).toBeGreaterThan(0);
      expect(typeof s.displayName).toBe('string');
      expect(s.displayName.length).toBeGreaterThan(0);
      expect(typeof s.janka).toBe('number');
      expect(typeof s.density).toBe('number');
      expect(s.visual).toBeDefined();
    }
  });

  it('species ids match the expected set', () => {
    const ids = getWoodSpecies().map((s) => s.id);
    for (const id of SPECIES_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('janka and density are positive for all species', () => {
    for (const s of getWoodSpecies()) {
      expect(s.janka).toBeGreaterThan(0);
      expect(s.density).toBeGreaterThan(0);
    }
  });

  it('baseColor and grainColor are valid 6-digit hex strings', () => {
    for (const s of getWoodSpecies()) {
      expect(s.visual.baseColor).toMatch(HEX_RE);
      expect(s.visual.grainColor).toMatch(HEX_RE);
    }
  });

  it('ringFrequency is positive for all species', () => {
    for (const s of getWoodSpecies()) {
      expect(s.visual.ringFrequency).toBeGreaterThan(0);
    }
  });

  it('ringContrast is between 0 and 1 inclusive for all species', () => {
    for (const s of getWoodSpecies()) {
      expect(s.visual.ringContrast).toBeGreaterThanOrEqual(0);
      expect(s.visual.ringContrast).toBeLessThanOrEqual(1);
    }
  });

  it('figure type is one of: none, fleck, streak', () => {
    for (const s of getWoodSpecies()) {
      expect(FIGURE_TYPES.has(s.visual.figure.type)).toBe(true);
    }
  });

  it('figure intensity is between 0 and 1 inclusive', () => {
    for (const s of getWoodSpecies()) {
      expect(s.visual.figure.intensity).toBeGreaterThanOrEqual(0);
      expect(s.visual.figure.intensity).toBeLessThanOrEqual(1);
    }
  });
});

// ── getWoodSpeciesById ───────────────────────────────────────────────────────

describe('getWoodSpeciesById', () => {
  it('returns the correct species for each known id', () => {
    for (const id of SPECIES_IDS) {
      const s = getWoodSpeciesById(id);
      expect(s).toBeDefined();
      expect(s?.id).toBe(id);
    }
  });

  it('returns undefined for an unknown id', () => {
    expect(getWoodSpeciesById('unknown-wood')).toBeUndefined();
    expect(getWoodSpeciesById('')).toBeUndefined();
  });
});

// ── Cutting matrix ───────────────────────────────────────────────────────────

describe('getCuttingCoefficients', () => {
  it('all 18 tool×species cells are present and defined', () => {
    for (const toolId of TOOL_IDS) {
      for (const speciesId of SPECIES_IDS) {
        const coeff = getCuttingCoefficients(speciesId, toolId);
        expect(coeff).toBeDefined();
      }
    }
  });

  it('all coefficients are finite positive numbers', () => {
    for (const toolId of TOOL_IDS) {
      for (const speciesId of SPECIES_IDS) {
        const coeff = getCuttingCoefficients(speciesId, toolId);
        expect(coeff).toBeDefined();
        if (coeff === undefined) continue;
        expect(Number.isFinite(coeff.cutRate)).toBe(true);
        expect(coeff.cutRate).toBeGreaterThan(0);
        expect(Number.isFinite(coeff.tearout)).toBe(true);
        expect(coeff.tearout).toBeGreaterThan(0);
        expect(Number.isFinite(coeff.catch)).toBe(true);
        expect(coeff.catch).toBeGreaterThan(0);
      }
    }
  });

  it('returns the correct cell for a known pair (roughing-gouge × pine)', () => {
    const coeff = getCuttingCoefficients('pine', 'roughing-gouge');
    expect(coeff).toBeDefined();
    expect(coeff?.cutRate).toBeGreaterThan(1); // pine cuts fast
    expect(coeff?.tearout).toBeGreaterThan(1); // pine tears easily
    expect(coeff?.catch).toBeLessThan(1);      // pine forgives catches
  });

  it('returns the correct cell for a known pair (roughing-gouge × maple)', () => {
    const coeff = getCuttingCoefficients('maple', 'roughing-gouge');
    expect(coeff).toBeDefined();
    expect(coeff?.cutRate).toBeLessThan(1);   // maple is hard, cuts slowly
    expect(coeff?.tearout).toBeLessThan(1);   // maple is clean/fine-grained
    expect(coeff?.catch).toBeGreaterThan(1);  // maple bites hard when wrong
  });

  it('returns undefined for an unknown tool id', () => {
    expect(getCuttingCoefficients('pine', 'bowl-gouge')).toBeUndefined();
  });

  it('returns undefined for an unknown species id', () => {
    expect(getCuttingCoefficients('mahogany', 'roughing-gouge')).toBeUndefined();
  });
});

// ── normalizedHardness ───────────────────────────────────────────────────────

describe('normalizedHardness', () => {
  it('returns values in [0, 1] for all species', () => {
    for (const s of getWoodSpecies()) {
      const n = normalizedHardness(s);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it('pine has the lowest normalized hardness (0)', () => {
    const pine = getWoodSpeciesById('pine');
    expect(pine).toBeDefined();
    if (pine === undefined) return;
    expect(normalizedHardness(pine)).toBe(0);
  });

  it('maple has the highest normalized hardness (1)', () => {
    const maple = getWoodSpeciesById('maple');
    expect(maple).toBeDefined();
    if (maple === undefined) return;
    expect(normalizedHardness(maple)).toBe(1);
  });

  it('harder species produce higher normalized hardness values', () => {
    const pine = getWoodSpeciesById('pine');
    const cherry = getWoodSpeciesById('cherry');
    const oak = getWoodSpeciesById('oak');
    const maple = getWoodSpeciesById('maple');
    expect(pine).toBeDefined();
    expect(cherry).toBeDefined();
    expect(oak).toBeDefined();
    expect(maple).toBeDefined();
    if (!pine || !cherry || !oak || !maple) return;
    expect(normalizedHardness(pine)).toBeLessThan(normalizedHardness(cherry));
    expect(normalizedHardness(cherry)).toBeLessThan(normalizedHardness(oak));
    expect(normalizedHardness(oak)).toBeLessThan(normalizedHardness(maple));
  });
});
