/**
 * dialAngle.test.ts — unit tests for the radial speed-dial angle helper.
 */

import { describe, it, expect } from 'vitest';
import { dialAngleFromT, ARC_SWEEP_RAD, HALF_SWEEP_RAD } from './dialAngle.js';

const EPS = 1e-9;

describe('dialAngleFromT — OFF position', () => {
  it('returns +HALF_SWEEP_RAD at t=0 (pointer at bottom / OFF)', () => {
    expect(dialAngleFromT(0)).toBeCloseTo(HALF_SWEEP_RAD, 9);
  });
});

describe('dialAngleFromT — max position', () => {
  it('returns −HALF_SWEEP_RAD at t=1 (full clockwise / max RPM)', () => {
    expect(dialAngleFromT(1)).toBeCloseTo(-HALF_SWEEP_RAD, 9);
  });
});

describe('dialAngleFromT — midpoint', () => {
  it('returns 0 at t=0.5 (pointer at top / half speed)', () => {
    expect(Math.abs(dialAngleFromT(0.5))).toBeLessThan(EPS);
  });
});

describe('dialAngleFromT — sweep span', () => {
  it('total span from t=0 to t=1 equals ARC_SWEEP_RAD (270°)', () => {
    const span = dialAngleFromT(0) - dialAngleFromT(1);
    expect(span).toBeCloseTo(ARC_SWEEP_RAD, 9);
  });
});

describe('dialAngleFromT — linearity', () => {
  it('is strictly decreasing (more RPM → more CW → lower rotation.z)', () => {
    const steps: number[] = [0, 0.25, 0.5, 0.75, 1.0];
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1] as number;
      const curr = steps[i] as number;
      expect(dialAngleFromT(curr)).toBeLessThan(dialAngleFromT(prev));
    }
  });

  it('satisfies the linear formula at t=0.25', () => {
    expect(dialAngleFromT(0.25)).toBeCloseTo(HALF_SWEEP_RAD - 0.25 * ARC_SWEEP_RAD, 9);
  });
});
