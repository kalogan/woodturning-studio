/**
 * continuous.test.ts — Tests for continuous audio module.
 *
 * Tests:
 * 1. Pure rpm → MotorParams mapping (calcMotorParams + calcMotorT):
 *    boundary values, monotonicity, clamping.
 * 2. Import guard: importing continuous.ts in jsdom must not throw.
 * 3. startAmbient / startMotor / stopAmbient / stopMotor must not throw
 *    in jsdom (where getContext() returns null — no AudioContext).
 * 4. updateMotor must not throw in jsdom.
 */

import { describe, it, expect } from 'vitest';
import {
  calcMotorParams,
  calcMotorT,
  startAmbient,
  startMotor,
  stopAmbient,
  stopMotor,
  updateMotor,
  _resetContinuous,
} from './continuous.js';

// ---------------------------------------------------------------------------
// 1. calcMotorT — normalised speed helper
// ---------------------------------------------------------------------------

describe('calcMotorT — normalised rpm', () => {
  it('returns 0 when currentRpm is 0', () => {
    expect(calcMotorT(0, 3200)).toBe(0);
  });

  it('returns 1 when currentRpm equals maxRpm', () => {
    expect(calcMotorT(3200, 3200)).toBe(1);
  });

  it('returns 0.5 at half maxRpm', () => {
    expect(calcMotorT(1600, 3200)).toBeCloseTo(0.5);
  });

  it('clamps negative rpm to 0', () => {
    expect(calcMotorT(-100, 3200)).toBe(0);
  });

  it('clamps rpm above maxRpm to 1', () => {
    expect(calcMotorT(4000, 3200)).toBe(1);
  });

  it('returns 0 when maxRpm is 0 (division guard)', () => {
    expect(calcMotorT(0, 0)).toBe(0);
    expect(calcMotorT(100, 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. calcMotorParams — { whirFrequency, gain } mapping
// ---------------------------------------------------------------------------

describe('calcMotorParams — boundary values', () => {
  it('gain is 0 at rpm=0 (motor is silent at rest)', () => {
    const p = calcMotorParams(0, 3200);
    expect(p.gain).toBe(0);
  });

  it('gain is > 0 at maxRpm', () => {
    const p = calcMotorParams(3200, 3200);
    expect(p.gain).toBeGreaterThan(0);
  });

  it('whirFrequency is at its minimum at rpm=0', () => {
    const p0 = calcMotorParams(0, 3200);
    const pFull = calcMotorParams(3200, 3200);
    expect(p0.whirFrequency).toBeLessThan(pFull.whirFrequency);
  });

  it('whirFrequency is at its maximum at maxRpm', () => {
    const pFull = calcMotorParams(3200, 3200);
    const pHalf = calcMotorParams(1600, 3200);
    expect(pFull.whirFrequency).toBeGreaterThan(pHalf.whirFrequency);
  });
});

describe('calcMotorParams — monotonicity', () => {
  it('gain is monotonically non-decreasing as rpm rises', () => {
    const steps = [0, 400, 800, 1200, 1600, 2000, 2400, 2800, 3200];
    const gains = steps.map((rpm) => calcMotorParams(rpm, 3200).gain);
    // Compare each adjacent pair directly to avoid array index typing issues.
    for (let i = 0; i < steps.length - 1; i++) {
      const prev = gains[i] ?? 0;
      const next = gains[i + 1] ?? 0;
      expect(next).toBeGreaterThanOrEqual(prev);
    }
  });

  it('whirFrequency is monotonically non-decreasing as rpm rises', () => {
    const steps = [0, 400, 800, 1200, 1600, 2000, 2400, 2800, 3200];
    const freqs = steps.map((rpm) => calcMotorParams(rpm, 3200).whirFrequency);
    for (let i = 0; i < steps.length - 1; i++) {
      const prev = freqs[i] ?? 0;
      const next = freqs[i + 1] ?? 0;
      expect(next).toBeGreaterThanOrEqual(prev);
    }
  });
});

describe('calcMotorParams — clamping', () => {
  it('clamps negative rpm to rpm=0 result', () => {
    const p0 = calcMotorParams(0, 3200);
    const pNeg = calcMotorParams(-500, 3200);
    expect(pNeg.gain).toBe(p0.gain);
    expect(pNeg.whirFrequency).toBeCloseTo(p0.whirFrequency);
  });

  it('clamps rpm > maxRpm to maxRpm result', () => {
    const pMax = calcMotorParams(3200, 3200);
    const pOver = calcMotorParams(9999, 3200);
    expect(pOver.gain).toBeCloseTo(pMax.gain);
    expect(pOver.whirFrequency).toBeCloseTo(pMax.whirFrequency);
  });

  it('whirFrequency is always a positive number', () => {
    for (const rpm of [-100, 0, 1, 1600, 3200, 5000]) {
      const { whirFrequency } = calcMotorParams(rpm, 3200);
      expect(whirFrequency).toBeGreaterThan(0);
    }
  });
});

describe('calcMotorParams — gain range', () => {
  it('gain at maxRpm is between 0 and 1 (sane audio level)', () => {
    const { gain } = calcMotorParams(3200, 3200);
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThanOrEqual(1);
  });

  it('gain at midpoint is between 0 and maxRpm gain', () => {
    const full = calcMotorParams(3200, 3200).gain;
    const half = calcMotorParams(1600, 3200).gain;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(full);
  });
});

// ---------------------------------------------------------------------------
// 3. jsdom import + call safety
// (In jsdom, getContext() returns null — all graph calls must be no-ops)
// ---------------------------------------------------------------------------

describe('continuous — jsdom import guard', () => {
  it('importing continuous.ts does not throw', () => {
    // If we reached here, import succeeded.
    expect(true).toBe(true);
  });
});

describe('continuous — graph functions are safe no-ops in jsdom', () => {
  it('startAmbient() does not throw', () => {
    expect(() => { startAmbient(); }).not.toThrow();
  });

  it('startMotor() does not throw', () => {
    expect(() => { startMotor(); }).not.toThrow();
  });

  it('updateMotor() does not throw', () => {
    expect(() => { updateMotor(1600, 3200); }).not.toThrow();
  });

  it('stopMotor() does not throw', () => {
    expect(() => { stopMotor(); }).not.toThrow();
  });

  it('stopAmbient() does not throw', () => {
    expect(() => { stopAmbient(); }).not.toThrow();
  });

  it('_resetContinuous() does not throw', () => {
    expect(() => { _resetContinuous(); }).not.toThrow();
  });

  it('calling start then stop then start again does not throw', () => {
    expect(() => {
      startAmbient();
      startMotor();
      updateMotor(0, 3200);
      updateMotor(1600, 3200);
      stopMotor();
      stopAmbient();
      startAmbient();
      stopAmbient();
    }).not.toThrow();
  });
});
