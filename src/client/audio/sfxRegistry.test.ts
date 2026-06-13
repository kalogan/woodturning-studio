/**
 * sfxRegistry.test.ts — Tests for the SfxId registry.
 *
 * Verifies:
 * - every SfxId has a registered factory
 * - getFactory() returns callable functions
 * - factories are safe no-ops when ctx is null (jsdom)
 * - ALL_SFX_IDS covers every id
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_SFX_IDS,
  getFactory,
  playSound,
} from './sfxRegistry.js';
import type { SfxId } from './sfxRegistry.js';

describe('sfxRegistry — ALL_SFX_IDS coverage', () => {
  it('ALL_SFX_IDS is non-empty', () => {
    expect(ALL_SFX_IDS.length).toBeGreaterThan(0);
  });

  it('ALL_SFX_IDS contains the expected sound ids', () => {
    const expected: SfxId[] = [
      'tool.grab',
      'tool.select',
      'part.snap',
      'control.tighten',
      'footstep',
      'lathe.motor',
      'cut',
      'catch',
    ];
    for (const id of expected) {
      expect(ALL_SFX_IDS).toContain(id);
    }
  });

  it('has exactly 8 registered sound ids', () => {
    expect(ALL_SFX_IDS.length).toBe(8);
  });
});

describe('sfxRegistry — getFactory()', () => {
  it('every SfxId has a registered factory', () => {
    for (const id of ALL_SFX_IDS) {
      const factory = getFactory(id);
      expect(factory).toBeDefined();
      expect(typeof factory).toBe('function');
    }
  });

  it('factories are callable — no-op with null ctx (jsdom)', () => {
    for (const id of ALL_SFX_IDS) {
      const factory = getFactory(id);
      // Passing null ctx should not throw.
      expect(() => { factory(null, null); }).not.toThrow();
    }
  });
});

describe('sfxRegistry — playSound()', () => {
  it('playSound with null ctx is a safe no-op for all ids', () => {
    for (const id of ALL_SFX_IDS) {
      expect(() => { playSound(id, null, null); }).not.toThrow();
    }
  });
});
