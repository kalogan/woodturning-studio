/**
 * handPose.test.ts — Unit tests for the pure handPose module.
 *
 * Tests cover:
 *  - RELAXED pose has the expected shape and sane value ranges.
 *  - clampPoseValue: boundary behaviour and interior clamp.
 *  - lerpPose: determinism, boundary t values, interior interpolation.
 *  - clampFingerCurls: out-of-range values are clamped correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  RELAXED,
  clampPoseValue,
  lerpPose,
  clampFingerCurls,
} from './handPose.js';
import type { HandPose, FingerCurls } from './handPose.js';

// ── RELAXED pose shape ────────────────────────────────────────────────────────

describe('RELAXED pose', () => {
  it('has all five fingers defined', () => {
    const fingers: (keyof FingerCurls)[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    for (const f of fingers) {
      expect(typeof RELAXED.fingerCurls[f]).toBe('number');
    }
  });

  it('all finger curls are in [0, 1]', () => {
    for (const [name, val] of Object.entries(RELAXED.fingerCurls)) {
      expect(val, `${name} curl must be ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(val, `${name} curl must be ≤ 1`).toBeLessThanOrEqual(1);
    }
  });

  it('thumbSplay is in [0, 1]', () => {
    expect(RELAXED.thumbSplay).toBeGreaterThanOrEqual(0);
    expect(RELAXED.thumbSplay).toBeLessThanOrEqual(1);
  });

  it('wrist angles are finite numbers', () => {
    expect(Number.isFinite(RELAXED.wristPitch)).toBe(true);
    expect(Number.isFinite(RELAXED.wristYaw)).toBe(true);
    expect(Number.isFinite(RELAXED.wristRoll)).toBe(true);
  });

  it('position is a 3-tuple of numbers', () => {
    expect(RELAXED.position).toHaveLength(3);
    for (const v of RELAXED.position) {
      expect(typeof v).toBe('number');
    }
  });

  it('rotation is a 3-tuple of numbers', () => {
    expect(RELAXED.rotation).toHaveLength(3);
    for (const v of RELAXED.rotation) {
      expect(typeof v).toBe('number');
    }
  });

  it('finger curls are only slightly open (< 0.5) — relaxed, not fisted', () => {
    for (const [name, val] of Object.entries(RELAXED.fingerCurls)) {
      expect(val, `${name} should be < 0.5 in relaxed pose`).toBeLessThan(0.5);
    }
  });

  it('wrist pitch is a small angle (< 0.3 rad)', () => {
    expect(Math.abs(RELAXED.wristPitch)).toBeLessThan(0.3);
  });
});

// ── clampPoseValue ────────────────────────────────────────────────────────────

describe('clampPoseValue', () => {
  it('returns value unchanged when inside range', () => {
    expect(clampPoseValue(0.5, 0, 1)).toBe(0.5);
    expect(clampPoseValue(0.0, 0, 1)).toBe(0.0);
    expect(clampPoseValue(1.0, 0, 1)).toBe(1.0);
  });

  it('clamps below min to min', () => {
    expect(clampPoseValue(-0.1, 0, 1)).toBe(0);
    expect(clampPoseValue(-100, 0, 1)).toBe(0);
    expect(clampPoseValue(-0.001, 0, 1)).toBe(0);
  });

  it('clamps above max to max', () => {
    expect(clampPoseValue(1.1, 0, 1)).toBe(1);
    expect(clampPoseValue(999, 0, 1)).toBe(1);
    expect(clampPoseValue(1.0001, 0, 1)).toBe(1);
  });

  it('works with ranges other than [0, 1]', () => {
    expect(clampPoseValue(-5, -3, 3)).toBe(-3);
    expect(clampPoseValue(5, -3, 3)).toBe(3);
    expect(clampPoseValue(0, -3, 3)).toBe(0);
  });

  it('min boundary is inclusive', () => {
    expect(clampPoseValue(0, 0, 1)).toBe(0);
  });

  it('max boundary is inclusive', () => {
    expect(clampPoseValue(1, 0, 1)).toBe(1);
  });

  it('is deterministic — same inputs same output', () => {
    const a = clampPoseValue(0.7, 0, 1);
    const b = clampPoseValue(0.7, 0, 1);
    expect(a).toBe(b);
  });
});

// ── lerpPose ──────────────────────────────────────────────────────────────────

const FISTED: HandPose = {
  position: [0.1, -0.2, 0.3],
  rotation: [0.5, -0.3, 0.1],
  fingerCurls: { thumb: 0.8, index: 1.0, middle: 1.0, ring: 1.0, pinky: 1.0 },
  thumbSplay: 0.0,
  wristPitch: 0.2,
  wristYaw: -0.1,
  wristRoll: 0.05,
};

describe('lerpPose', () => {
  it('t=0 returns a value equal to a', () => {
    const result = lerpPose(RELAXED, FISTED, 0);
    expect(result.fingerCurls.index).toBeCloseTo(RELAXED.fingerCurls.index);
    expect(result.fingerCurls.thumb).toBeCloseTo(RELAXED.fingerCurls.thumb);
    expect(result.thumbSplay).toBeCloseTo(RELAXED.thumbSplay);
    expect(result.wristPitch).toBeCloseTo(RELAXED.wristPitch);
    expect(result.position[0]).toBeCloseTo(RELAXED.position[0]);
  });

  it('t=1 returns a value equal to b', () => {
    const result = lerpPose(RELAXED, FISTED, 1);
    expect(result.fingerCurls.index).toBeCloseTo(FISTED.fingerCurls.index);
    expect(result.fingerCurls.thumb).toBeCloseTo(FISTED.fingerCurls.thumb);
    expect(result.thumbSplay).toBeCloseTo(FISTED.thumbSplay);
    expect(result.wristPitch).toBeCloseTo(FISTED.wristPitch);
    expect(result.position[0]).toBeCloseTo(FISTED.position[0]);
  });

  it('t=0.5 produces midpoint values', () => {
    const result = lerpPose(RELAXED, FISTED, 0.5);
    const midIndex = (RELAXED.fingerCurls.index + FISTED.fingerCurls.index) / 2;
    expect(result.fingerCurls.index).toBeCloseTo(midIndex);
    const midSplay = (RELAXED.thumbSplay + FISTED.thumbSplay) / 2;
    expect(result.thumbSplay).toBeCloseTo(midSplay);
    const midPosX = (RELAXED.position[0] + FISTED.position[0]) / 2;
    expect(result.position[0]).toBeCloseTo(midPosX);
  });

  it('t is clamped to [0, 1] — t < 0 yields same as t=0', () => {
    const atZero = lerpPose(RELAXED, FISTED, 0);
    const belowZero = lerpPose(RELAXED, FISTED, -0.5);
    expect(belowZero.fingerCurls.index).toBeCloseTo(atZero.fingerCurls.index);
  });

  it('t is clamped to [0, 1] — t > 1 yields same as t=1', () => {
    const atOne = lerpPose(RELAXED, FISTED, 1);
    const aboveOne = lerpPose(RELAXED, FISTED, 2.5);
    expect(aboveOne.fingerCurls.index).toBeCloseTo(atOne.fingerCurls.index);
  });

  it('does not mutate input poses', () => {
    const aBefore = JSON.stringify(RELAXED);
    const bBefore = JSON.stringify(FISTED);
    lerpPose(RELAXED, FISTED, 0.5);
    expect(JSON.stringify(RELAXED)).toBe(aBefore);
    expect(JSON.stringify(FISTED)).toBe(bBefore);
  });

  it('is deterministic — same t yields same result', () => {
    const r1 = lerpPose(RELAXED, FISTED, 0.3);
    const r2 = lerpPose(RELAXED, FISTED, 0.3);
    expect(r1.fingerCurls.index).toBeCloseTo(r2.fingerCurls.index);
    expect(r1.thumbSplay).toBeCloseTo(r2.thumbSplay);
  });
});

// ── clampFingerCurls ──────────────────────────────────────────────────────────

describe('clampFingerCurls', () => {
  it('passes valid curls through unchanged', () => {
    const input: FingerCurls = { thumb: 0.1, index: 0.2, middle: 0.5, ring: 0.8, pinky: 1.0 };
    const result = clampFingerCurls(input);
    expect(result.thumb).toBe(0.1);
    expect(result.index).toBe(0.2);
    expect(result.middle).toBe(0.5);
    expect(result.ring).toBe(0.8);
    expect(result.pinky).toBe(1.0);
  });

  it('clamps below-zero values to 0', () => {
    const input: FingerCurls = { thumb: -0.5, index: -1, middle: 0.5, ring: 0.5, pinky: 0.5 };
    const result = clampFingerCurls(input);
    expect(result.thumb).toBe(0);
    expect(result.index).toBe(0);
  });

  it('clamps above-one values to 1', () => {
    const input: FingerCurls = { thumb: 1.5, index: 2.0, middle: 0.5, ring: 0.5, pinky: 0.5 };
    const result = clampFingerCurls(input);
    expect(result.thumb).toBe(1);
    expect(result.index).toBe(1);
  });

  it('does not mutate the input object', () => {
    const input: FingerCurls = { thumb: -1, index: 2, middle: 0.5, ring: 0.5, pinky: 0.5 };
    const before = JSON.stringify(input);
    clampFingerCurls(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('RELAXED finger curls pass through clampFingerCurls unchanged', () => {
    const clamped = clampFingerCurls(RELAXED.fingerCurls);
    for (const key of Object.keys(RELAXED.fingerCurls) as (keyof FingerCurls)[]) {
      expect(clamped[key]).toBe(RELAXED.fingerCurls[key]);
    }
  });
});
