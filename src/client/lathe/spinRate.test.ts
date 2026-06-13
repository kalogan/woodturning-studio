import { describe, it, expect } from 'vitest';
import { visualSpinRevPerSec, MAX_VISUAL_REV_PER_SEC } from './spinRate.js';

const MAX = 3200;

describe('visualSpinRevPerSec', () => {
  it('is zero at rest', () => {
    expect(visualSpinRevPerSec(0, MAX)).toBe(0);
  });

  it('reaches MAX_VISUAL_REV_PER_SEC at maxRpm', () => {
    expect(visualSpinRevPerSec(MAX, MAX)).toBeCloseTo(MAX_VISUAL_REV_PER_SEC);
  });

  it('is MONOTONIC — 400 < 1000 < 2000 < 3200 spin progressively faster', () => {
    const a = visualSpinRevPerSec(400, MAX);
    const b = visualSpinRevPerSec(1000, MAX);
    const c = visualSpinRevPerSec(2000, MAX);
    const d = visualSpinRevPerSec(3200, MAX);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThan(d);
  });

  it('stays below the wagon-wheel threshold (~7.5 rev/s) across the whole range', () => {
    for (let rpm = 0; rpm <= MAX; rpm += 200) {
      expect(visualSpinRevPerSec(rpm, MAX)).toBeLessThan(7.5);
    }
  });

  it('clamps rpm above maxRpm to the cap', () => {
    expect(visualSpinRevPerSec(MAX * 2, MAX)).toBeCloseTo(MAX_VISUAL_REV_PER_SEC);
  });

  it('clamps negative rpm to 0', () => {
    expect(visualSpinRevPerSec(-500, MAX)).toBe(0);
  });

  it('returns 0 when maxRpm is non-positive (avoids divide-by-zero)', () => {
    expect(visualSpinRevPerSec(1000, 0)).toBe(0);
  });
});
