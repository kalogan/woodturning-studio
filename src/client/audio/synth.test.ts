/**
 * synth.test.ts — Tests for pure parameter math in synth.ts.
 *
 * Only tests the pure functions (calcEnvelope, clampGain, calcOscParams,
 * calcNoiseFilterFreq). The Web Audio node builders (playTone, playNoise)
 * are NOT tested here — they require a real AudioContext.
 */

import { describe, it, expect } from 'vitest';
import {
  calcEnvelope,
  clampGain,
  calcOscParams,
  calcNoiseFilterFreq,
} from './synth.js';

// ---------------------------------------------------------------------------
// clampGain
// ---------------------------------------------------------------------------

describe('clampGain', () => {
  it('passes through values in [0, 1]', () => {
    expect(clampGain(0.5)).toBeCloseTo(0.5);
    expect(clampGain(0)).toBe(0);
    expect(clampGain(1)).toBe(1);
  });

  it('clamps negative values to 0', () => {
    expect(clampGain(-0.5)).toBe(0);
    expect(clampGain(-100)).toBe(0);
  });

  it('clamps values > 1 to 1', () => {
    expect(clampGain(1.5)).toBe(1);
    expect(clampGain(100)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calcNoiseFilterFreq
// ---------------------------------------------------------------------------

describe('calcNoiseFilterFreq', () => {
  it('passes through values in [20, 20000]', () => {
    expect(calcNoiseFilterFreq(1000)).toBe(1000);
    expect(calcNoiseFilterFreq(20)).toBe(20);
    expect(calcNoiseFilterFreq(20000)).toBe(20000);
  });

  it('clamps values below 20 to 20', () => {
    expect(calcNoiseFilterFreq(0)).toBe(20);
    expect(calcNoiseFilterFreq(-500)).toBe(20);
  });

  it('clamps values above 20000 to 20000', () => {
    expect(calcNoiseFilterFreq(30000)).toBe(20000);
  });
});

// ---------------------------------------------------------------------------
// calcOscParams
// ---------------------------------------------------------------------------

describe('calcOscParams', () => {
  const BASE = { freq: 440, type: 'sine' as OscillatorType, duration: 0.5, gain: 0.8 };

  it('passes through valid params unchanged', () => {
    const result = calcOscParams(BASE);
    expect(result.freq).toBe(440);
    expect(result.type).toBe('sine');
    expect(result.duration).toBeCloseTo(0.5);
    expect(result.gain).toBeCloseTo(0.8);
  });

  it('clamps freq < 1 to 1', () => {
    const result = calcOscParams({ ...BASE, freq: 0 });
    expect(result.freq).toBe(1);
  });

  it('clamps negative freq to 1', () => {
    const result = calcOscParams({ ...BASE, freq: -100 });
    expect(result.freq).toBe(1);
  });

  it('clamps gain > 1 to 1', () => {
    const result = calcOscParams({ ...BASE, gain: 2 });
    expect(result.gain).toBe(1);
  });

  it('clamps negative gain to 0', () => {
    const result = calcOscParams({ ...BASE, gain: -0.5 });
    expect(result.gain).toBe(0);
  });

  it('clamps negative duration to 0', () => {
    const result = calcOscParams({ ...BASE, duration: -1 });
    expect(result.duration).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calcEnvelope
// ---------------------------------------------------------------------------

describe('calcEnvelope', () => {
  it('t0 equals the provided start time', () => {
    const s = calcEnvelope(1.0, 0.2);
    expect(s.t0).toBe(1.0);
  });

  it('t1 = t0 + attack', () => {
    const s = calcEnvelope(0, 0.2, { attack: 0.01 });
    expect(s.t1).toBeCloseTo(0.01);
  });

  it('t2 = t1 + decay', () => {
    const s = calcEnvelope(0, 0.2, { attack: 0.01, decay: 0.05 });
    expect(s.t2).toBeCloseTo(0.06);
  });

  it('t3 = t2 + sustainDuration', () => {
    const s = calcEnvelope(0, 0.3, { attack: 0.01, decay: 0.05 });
    expect(s.t3).toBeCloseTo(0.06 + 0.3);
  });

  it('t4 = t3 + release', () => {
    const s = calcEnvelope(0, 0.3, { attack: 0.01, decay: 0.05, release: 0.1 });
    expect(s.t4).toBeCloseTo(0.06 + 0.3 + 0.1);
  });

  it('times are always non-decreasing: t0 <= t1 <= t2 <= t3 <= t4', () => {
    const s = calcEnvelope(0.5, 0.2, { attack: 0.01, decay: 0.05, release: 0.08 });
    expect(s.t0).toBeLessThanOrEqual(s.t1);
    expect(s.t1).toBeLessThanOrEqual(s.t2);
    expect(s.t2).toBeLessThanOrEqual(s.t3);
    expect(s.t3).toBeLessThanOrEqual(s.t4);
  });

  it('peakGain is clamped to [0, 1]', () => {
    const s = calcEnvelope(0, 0.2, { peak: 2 });
    expect(s.peakGain).toBe(1);
  });

  it('sustainGain = peakGain * sustain (both clamped)', () => {
    const s = calcEnvelope(0, 0.2, { peak: 1.0, sustain: 0.5 });
    expect(s.sustainGain).toBeCloseTo(0.5);
  });

  it('sustainGain with peak 0.8 and sustain 0.5 = 0.4', () => {
    const s = calcEnvelope(0, 0.2, { peak: 0.8, sustain: 0.5 });
    expect(s.sustainGain).toBeCloseTo(0.4);
  });

  it('sustain duration of 0 still produces valid non-decreasing times', () => {
    const s = calcEnvelope(0, 0);
    expect(s.t2).toBeLessThanOrEqual(s.t3);
    expect(s.t3).toBeLessThanOrEqual(s.t4);
  });

  it('negative attack/decay/release are floored to 0', () => {
    const s = calcEnvelope(0, 0.2, { attack: -1, decay: -1, release: -1 });
    // All time deltas for negative params should be 0 => t0==t1==t2, t3==t2+sustainDur
    expect(s.t1).toBeCloseTo(s.t0);
    expect(s.t2).toBeCloseTo(s.t1);
    expect(s.t4).toBeCloseTo(s.t3);
  });
});
