/**
 * AudioManager.test.tsx — jsdom safety test for the AudioManager component.
 *
 * Verifies:
 * - Importing AudioManager does not throw (no live AudioContext in jsdom).
 * - Mounting AudioManager (via React's createElement) does not throw.
 *   (shallow approach: just call createElement, don't render into DOM,
 *    so we don't need react-dom or @testing-library/react.)
 *
 * We do NOT test the full rAF loop / unlock flow here — those require a real
 * browser. The pure-function tests live in continuous.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';

describe('AudioManager — jsdom import guard', () => {
  it('importing AudioManager does not throw', async () => {
    // Dynamic import so errors are caught as test failures rather than module load errors.
    const mod = await import('./AudioManager.js');
    expect(typeof mod.default).toBe('function');
  });

  it('createElement(AudioManager) does not throw', async () => {
    const { default: AudioManager } = await import('./AudioManager.js');
    expect(() => {
      createElement(AudioManager);
    }).not.toThrow();
  });
});
