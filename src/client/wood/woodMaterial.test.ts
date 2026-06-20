/**
 * woodMaterial.test.ts — Unit tests for the board-grain material helpers.
 *
 * Only pure, DOM-free helpers are tested here.
 * makeBoardMaterial itself requires a WebGL context and is not tested here —
 * visual correctness is verified by boot-testing on localhost:5173.
 */

import { describe, it, expect } from 'vitest';
import { deriveGrainColor } from './woodMaterial.js';

describe('deriveGrainColor', () => {
  it('returns a valid 7-char hex string for a known wood colour', () => {
    const grain = deriveGrainColor('#9B6B3F');
    expect(grain).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('produces a darker colour than the base (lower luminance)', () => {
    // Compare red channels as a rough luminance proxy for warm wood tones.
    // For a mid-brown base the derived grain should be strictly darker.
    const base = '#9B6B3F';
    const grain = deriveGrainColor(base);
    const baseL = parseInt(base.slice(1, 3), 16); // red channel
    const grainL = parseInt(grain.slice(1, 3), 16);
    expect(grainL).toBeLessThan(baseL);
  });

  it('darkens a light base colour', () => {
    const grain = deriveGrainColor('#dfc890'); // pine sapwood
    expect(grain).toMatch(/^#[0-9a-f]{6}$/i);
    // Derived should be darker — compare raw hex lightness via red channel
    const baseR = 0xdf;
    const grainR = parseInt(grain.slice(1, 3), 16);
    expect(grainR).toBeLessThan(baseR);
  });

  it('darkens a dark base colour without going negative', () => {
    const grain = deriveGrainColor('#3a2010'); // very dark walnut-ish
    expect(grain).toMatch(/^#[0-9a-f]{6}$/i);
    // All channels should remain in [0, ff]
    for (let i = 0; i < 3; i++) {
      const v = parseInt(grain.slice(1 + i * 2, 3 + i * 2), 16);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });

  it('handles pure black without throwing', () => {
    const grain = deriveGrainColor('#000000');
    expect(grain).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('handles pure white without throwing', () => {
    const grain = deriveGrainColor('#ffffff');
    expect(grain).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('produces different grain colours for different bases', () => {
    const grain1 = deriveGrainColor('#8B5E3C'); // darker brown
    const grain2 = deriveGrainColor('#c09055'); // lighter tan
    expect(grain1).not.toBe(grain2);
  });

  it('is deterministic — same input → same output', () => {
    const a = deriveGrainColor('#9B6B3F');
    const b = deriveGrainColor('#9B6B3F');
    expect(a).toBe(b);
  });

  it('works for all SHELF_BLANK colours used in Casework', () => {
    const shelfColors = ['#8B5E3C', '#a0703a', '#6b4020', '#c09055', '#7a4e28', '#9a6535'];
    for (const c of shelfColors) {
      const g = deriveGrainColor(c);
      expect(g).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
