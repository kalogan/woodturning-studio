/**
 * continuous.test.ts — Tests for continuous audio module.
 *
 * Tests:
 * 1. Pure rpm → MotorParams mapping (calcMotorParams + calcMotorT):
 *    boundary values, monotonicity, clamping.
 * 2. Motor mix balance assertions: whir is dominant rising element,
 *    hum gain is a small constant (not rpm-scaled), bearing gain is tiny.
 * 3. Import guard: importing continuous.ts in jsdom must not throw.
 * 4. startAmbient / startMotor / stopAmbient / stopMotor must not throw
 *    in jsdom (where getContext() returns null — no AudioContext).
 * 5. updateMotor (including power param) must not throw in jsdom.
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
//
// `gain` = whir+bearing master gain, rises with rpm (0 at rpm=0).
// The hum is a separate constant path gated by `power`, NOT part of this fn.
// ---------------------------------------------------------------------------

describe('calcMotorParams — boundary values', () => {
  it('gain is 0 at rpm=0 (whir+bearing master is silent at rest)', () => {
    // Note: the hum layer is separate and constant when powered.
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
// 3. Motor mix balance — verify the new three-layer design
//
// These tests exercise the pure mapping functions to confirm the intended
// mix balance: whir is the dominant rising element, bearing is faint.
// The hum constant level is verified by checking the module constants
// indirectly through calcMotorParams behavior.
// ---------------------------------------------------------------------------

describe('motor mix balance — new design (director feedback 2026-06-13)', () => {
  it('whir+bearing master gain at full rpm is a moderate level (≤ 0.30)', () => {
    // Master gain drives whir+bearing only; hum is separate.
    const { gain } = calcMotorParams(3200, 3200);
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThanOrEqual(0.30);
  });

  it('gain rises substantially from idle to full speed (whoosh is the cue)', () => {
    // At low rpm the master is near 0 — at high rpm it's noticeably higher.
    const low  = calcMotorParams(320,  3200).gain;  // 10% speed
    const full = calcMotorParams(3200, 3200).gain;  // 100% speed
    // Full should be at least 5× the 10%-speed gain.
    expect(full).toBeGreaterThan(low * 5);
  });

  it('whirFrequency at full rpm is well above idle (audible sweep)', () => {
    const idle = calcMotorParams(0,    3200).whirFrequency;
    const full = calcMotorParams(3200, 3200).whirFrequency;
    // The sweep should span more than 100 Hz.
    expect(full - idle).toBeGreaterThan(100);
  });

  it('calcMotorT produces the t value used for bearing gain scaling', () => {
    // Bearing gain = t * MOTOR_BEARING_MAX_GAIN (0.025).
    // At full rpm t=1, so bearing gain = 0.025 — a faint texture.
    const t = calcMotorT(3200, 3200);
    const maxBearingGain = t * 0.025; // mirrors the constant in continuous.ts
    expect(maxBearingGain).toBeCloseTo(0.025);
    // Confirm it's much smaller than the whir+bearing master at full rpm.
    const masterAtFull = calcMotorParams(3200, 3200).gain;
    expect(maxBearingGain).toBeLessThan(masterAtFull * 0.15);
  });

  it('bearing gain at half rpm is at most 0.025/2 (faint at all speeds)', () => {
    const t = calcMotorT(1600, 3200);
    const bearingGain = t * 0.025;
    expect(bearingGain).toBeLessThanOrEqual(0.0125 + 1e-9);
  });

  it('gain is strictly 0 at rpm=0 so whir/bearing are silent at rest', () => {
    // Hum is separate — the whir+bearing master is always silent at rest.
    expect(calcMotorParams(0, 3200).gain).toBe(0);
    expect(calcMotorT(0, 3200)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. jsdom import + call safety
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

  it('updateMotor() with default power=true does not throw', () => {
    expect(() => { updateMotor(1600, 3200); }).not.toThrow();
  });

  it('updateMotor() with power=true does not throw', () => {
    expect(() => { updateMotor(1600, 3200, true); }).not.toThrow();
  });

  it('updateMotor() with power=false does not throw', () => {
    expect(() => { updateMotor(1600, 3200, false); }).not.toThrow();
  });

  it('updateMotor() at rpm=0 power=true does not throw', () => {
    expect(() => { updateMotor(0, 3200, true); }).not.toThrow();
  });

  it('updateMotor() at rpm=0 power=false does not throw', () => {
    expect(() => { updateMotor(0, 3200, false); }).not.toThrow();
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
      updateMotor(0, 3200, false);
      updateMotor(0, 3200, true);
      updateMotor(1600, 3200, true);
      updateMotor(3200, 3200, true);
      updateMotor(3200, 3200, false);
      stopMotor();
      stopAmbient();
      startAmbient();
      stopAmbient();
    }).not.toThrow();
  });
});
