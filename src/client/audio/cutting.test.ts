/**
 * cutting.test.ts — Tests for the cutting sound module.
 *
 * Tests:
 * 1. cutIntensityFromRemoval — pure mapping:
 *    - 0 removal → 0 intensity
 *    - negative removal → 0 intensity
 *    - monotonically non-decreasing with more material removed
 *    - clamps to 1 at very high removal values
 * 2. jsdom import guard — importing cutting.ts must not throw.
 * 3. jsdom call safety — startCutting / stopCutting / setCutIntensity
 *    must all be safe no-ops in jsdom (no AudioContext).
 */

import { describe, it, expect } from 'vitest';
import {
  cutIntensityFromRemoval,
  startCutting,
  stopCutting,
  setCutIntensity,
  _resetCutting,
} from './cutting.js';

// ---------------------------------------------------------------------------
// 1. cutIntensityFromRemoval — pure mapping
// ---------------------------------------------------------------------------

describe('cutIntensityFromRemoval — zero removal', () => {
  it('returns 0 for zero material removed', () => {
    expect(cutIntensityFromRemoval(0)).toBe(0);
  });

  it('returns 0 for negative material removed', () => {
    expect(cutIntensityFromRemoval(-1e-6)).toBe(0);
    expect(cutIntensityFromRemoval(-999)).toBe(0);
  });
});

describe('cutIntensityFromRemoval — monotonicity', () => {
  it('is monotonically non-decreasing as removal increases', () => {
    const samples = [0, 1e-7, 5e-7, 1e-6, 2e-6, 3e-6, 5e-6, 1e-5];
    const intensities = samples.map(cutIntensityFromRemoval);
    for (let i = 0; i < intensities.length - 1; i++) {
      const a = intensities[i] ?? 0;
      const b = intensities[i + 1] ?? 0;
      expect(b).toBeGreaterThanOrEqual(a);
    }
  });

  it('produces positive intensity for a small but non-zero removal', () => {
    const intensity = cutIntensityFromRemoval(1e-7);
    expect(intensity).toBeGreaterThan(0);
  });
});

describe('cutIntensityFromRemoval — clamping', () => {
  it('clamps to 1 at very high removal values', () => {
    expect(cutIntensityFromRemoval(1)).toBe(1);
    expect(cutIntensityFromRemoval(999)).toBe(1);
    expect(cutIntensityFromRemoval(Infinity)).toBe(1);
  });

  it('returns at most 1 for any positive input', () => {
    for (const v of [1e-6, 3e-6, 1e-5, 1e-3, 1]) {
      expect(cutIntensityFromRemoval(v)).toBeLessThanOrEqual(1);
    }
  });

  it('returns at least 0 for any input', () => {
    for (const v of [-999, -1, 0, 1e-9, 3e-6]) {
      expect(cutIntensityFromRemoval(v)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('cutIntensityFromRemoval — typical removal produces mid-range intensity', () => {
  it('3e-6 m³/tick (the scale constant) maps to exactly 1', () => {
    // By definition of the normalisation constant — this is the "full cut" value.
    expect(cutIntensityFromRemoval(3e-6)).toBeCloseTo(1.0);
  });

  it('half-scale removal maps to about 0.5', () => {
    expect(cutIntensityFromRemoval(1.5e-6)).toBeCloseTo(0.5, 3);
  });

  it('quarter-scale removal maps to about 0.25', () => {
    expect(cutIntensityFromRemoval(0.75e-6)).toBeCloseTo(0.25, 3);
  });
});

// ---------------------------------------------------------------------------
// 2. jsdom import guard
// ---------------------------------------------------------------------------

describe('cutting — jsdom import guard', () => {
  it('importing cutting.ts does not throw', () => {
    // Reaching this point means the module imported successfully.
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. jsdom call safety
// (In jsdom, getContext() returns null — all graph calls must be safe no-ops)
// ---------------------------------------------------------------------------

describe('cutting — graph functions are safe no-ops in jsdom', () => {
  it('startCutting() does not throw', () => {
    expect(() => { startCutting(); }).not.toThrow();
  });

  it('setCutIntensity(0) does not throw', () => {
    expect(() => { setCutIntensity(0); }).not.toThrow();
  });

  it('setCutIntensity(0.5) does not throw', () => {
    expect(() => { setCutIntensity(0.5); }).not.toThrow();
  });

  it('setCutIntensity(1) does not throw', () => {
    expect(() => { setCutIntensity(1); }).not.toThrow();
  });

  it('setCutIntensity with out-of-range values does not throw', () => {
    expect(() => { setCutIntensity(-1); }).not.toThrow();
    expect(() => { setCutIntensity(999); }).not.toThrow();
  });

  it('stopCutting() does not throw', () => {
    expect(() => { stopCutting(); }).not.toThrow();
  });

  it('_resetCutting() does not throw', () => {
    expect(() => { _resetCutting(); }).not.toThrow();
  });

  it('calling start → setCutIntensity → stop in sequence does not throw', () => {
    expect(() => {
      startCutting();
      setCutIntensity(0);
      setCutIntensity(0.3);
      setCutIntensity(1.0);
      setCutIntensity(0);
      stopCutting();
    }).not.toThrow();
  });

  it('calling startCutting twice is a safe no-op', () => {
    expect(() => {
      startCutting();
      startCutting(); // idempotent
      stopCutting();
    }).not.toThrow();
  });

  it('calling stopCutting when not started is a safe no-op', () => {
    expect(() => {
      stopCutting();
      stopCutting();
    }).not.toThrow();
  });
});
