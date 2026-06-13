import { describe, it, expect } from 'vitest';
import {
  horizontalDistance,
  nextProximityZone,
  ENTER_LATHE_DISTANCE,
  LEAVE_LATHE_DISTANCE,
} from './proximity.js';

describe('horizontalDistance', () => {
  it('returns 0 for identical points', () => {
    expect(horizontalDistance(1, 2, 1, 2)).toBe(0);
  });

  it('computes axis-aligned X distance', () => {
    expect(horizontalDistance(0, 0, 3, 0)).toBeCloseTo(3);
  });

  it('computes axis-aligned Z distance', () => {
    expect(horizontalDistance(0, 0, 0, 4)).toBeCloseTo(4);
  });

  it('computes diagonal distance (3-4-5 triangle)', () => {
    expect(horizontalDistance(0, 0, 3, 4)).toBeCloseTo(5);
  });

  it('is symmetric', () => {
    expect(horizontalDistance(1, 2, 4, 6)).toBeCloseTo(horizontalDistance(4, 6, 1, 2));
  });
});

describe('nextProximityZone — WORKSHOP_WALK entry', () => {
  it('stays WORKSHOP_WALK when distance is well above entry threshold', () => {
    expect(nextProximityZone('WORKSHOP_WALK', 2.0)).toBe('WORKSHOP_WALK');
  });

  it('stays WORKSHOP_WALK when distance equals entry threshold (boundary — open interval)', () => {
    expect(nextProximityZone('WORKSHOP_WALK', ENTER_LATHE_DISTANCE)).toBe('WORKSHOP_WALK');
  });

  it('transitions to AT_LATHE when distance is just below entry threshold', () => {
    expect(nextProximityZone('WORKSHOP_WALK', ENTER_LATHE_DISTANCE - 0.001)).toBe('AT_LATHE');
  });

  it('transitions to AT_LATHE when very close', () => {
    expect(nextProximityZone('WORKSHOP_WALK', 0.1)).toBe('AT_LATHE');
  });
});

describe('nextProximityZone — dead-band (0.8–1.2 m) keeps current zone', () => {
  const deadBandValues = [0.8, 0.9, 1.0, 1.1, 1.2];

  for (const d of deadBandValues) {
    const label = String(d);
    it(`distance=${label}: WORKSHOP_WALK stays WORKSHOP_WALK`, () => {
      expect(nextProximityZone('WORKSHOP_WALK', d)).toBe('WORKSHOP_WALK');
    });

    it(`distance=${label}: AT_LATHE stays AT_LATHE`, () => {
      expect(nextProximityZone('AT_LATHE', d)).toBe('AT_LATHE');
    });
  }
});

describe('nextProximityZone — AT_LATHE exit', () => {
  it('stays AT_LATHE when distance is well within leave threshold', () => {
    expect(nextProximityZone('AT_LATHE', 0.5)).toBe('AT_LATHE');
  });

  it('stays AT_LATHE when distance equals leave threshold (boundary — open interval)', () => {
    expect(nextProximityZone('AT_LATHE', LEAVE_LATHE_DISTANCE)).toBe('AT_LATHE');
  });

  it('transitions to WORKSHOP_WALK when distance is just above leave threshold', () => {
    expect(nextProximityZone('AT_LATHE', LEAVE_LATHE_DISTANCE + 0.001)).toBe('WORKSHOP_WALK');
  });

  it('transitions to WORKSHOP_WALK when far away', () => {
    expect(nextProximityZone('AT_LATHE', 3.0)).toBe('WORKSHOP_WALK');
  });
});

describe('threshold constants', () => {
  it('ENTER_LATHE_DISTANCE is 0.8', () => {
    expect(ENTER_LATHE_DISTANCE).toBe(0.8);
  });

  it('LEAVE_LATHE_DISTANCE is 1.2', () => {
    expect(LEAVE_LATHE_DISTANCE).toBe(1.2);
  });

  it('leave threshold is larger than enter threshold (valid hysteresis)', () => {
    expect(LEAVE_LATHE_DISTANCE).toBeGreaterThan(ENTER_LATHE_DISTANCE);
  });
});
