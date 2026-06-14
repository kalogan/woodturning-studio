import { describe, it, expect } from 'vitest';
import { nearestTarget, dist2XZ } from './setupProximity.js';
import type { ProximityTarget } from './setupProximity.js';

describe('dist2XZ', () => {
  it('returns 0 for the same point', () => {
    expect(dist2XZ(1, 2, 1, 2)).toBe(0);
  });

  it('returns squared distance (Pythagorean)', () => {
    // 3-4-5 triangle
    expect(dist2XZ(0, 0, 3, 4)).toBe(25);
  });
});

describe('nearestTarget', () => {
  const targets: ProximityTarget[] = [
    { kind: 'bench', accessoryId: 'spur-drive-center', x: 0, z: 2 },
    { kind: 'bench', accessoryId: 'live-center', x: 1, z: 2 },
    { kind: 'mount', mountPoint: 'headstock-spindle', mountedStepId: null, x: 0, z: 0 },
  ];

  it('returns null when all targets are beyond maxRadius', () => {
    const result = nearestTarget(10, 10, targets, 0.5);
    expect(result).toBeNull();
  });

  it('returns the closest target within maxRadius', () => {
    // Player at (0.1, 1.9) — closest is bench slot at (0, 2), dist ≈ 0.1
    const result = nearestTarget(0.1, 1.9, targets, 1.5);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('bench');
    if (result?.kind === 'bench') {
      expect(result.accessoryId).toBe('spur-drive-center');
    }
  });

  it('returns null for an empty target list', () => {
    expect(nearestTarget(0, 0, [], 999)).toBeNull();
  });

  it('picks mount point when player is closest to it', () => {
    // Player at (0, 0.1) — closest to mount at (0, 0)
    const result = nearestTarget(0, 0.1, targets, 1.5);
    expect(result?.kind).toBe('mount');
  });

  it('exact boundary: target at exactly maxRadius is excluded', () => {
    const t: ProximityTarget[] = [
      { kind: 'bench', accessoryId: 'a', x: 0, z: 1.0 },
    ];
    // dist = 1.0, maxRadius = 1.0 → dist2 = 1.0 NOT < bestDist2=1.0 → null
    expect(nearestTarget(0, 0, t, 1.0)).toBeNull();
  });
});
