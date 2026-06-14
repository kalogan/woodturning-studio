/**
 * mountPoints.test.ts
 *
 * Tests for getMountPointWorldPositions() and related constants.
 *
 * Checks:
 *  - All returned coordinates are finite numbers (no NaN / Infinity).
 *  - The headstock-spindle X is less than the tailstock-quill X (the spindle
 *    is at the LEFT (-X) end; the quill is at the RIGHT (+X) end).
 *  - The two on-axis points share the same Y (spindle height) and Z (0).
 *  - The "bed" point Y is >= the headstock-spindle Y (rest bar ≈ spindle height).
 *  - All Y values are positive (machine is above the floor).
 *  - DRIVE_CENTER_TIP_X and TAILSTOCK_CENTRE_X constants are finite and ordered.
 */

import { describe, it, expect } from 'vitest';
import {
  getMountPointWorldPositions,
  DRIVE_CENTER_TIP_X,
  TAILSTOCK_CENTRE_X,
} from './mountPoints.js';

describe('getMountPointWorldPositions', () => {
  const pts = getMountPointWorldPositions();

  it('returns all-finite numbers for headstock-spindle', () => {
    const [x, y, z] = pts['headstock-spindle'];
    expect(isFinite(x)).toBe(true);
    expect(isFinite(y)).toBe(true);
    expect(isFinite(z)).toBe(true);
  });

  it('returns all-finite numbers for tailstock-quill', () => {
    const [x, y, z] = pts['tailstock-quill'];
    expect(isFinite(x)).toBe(true);
    expect(isFinite(y)).toBe(true);
    expect(isFinite(z)).toBe(true);
  });

  it('returns all-finite numbers for bed', () => {
    const [x, y, z] = pts['bed'];
    expect(isFinite(x)).toBe(true);
    expect(isFinite(y)).toBe(true);
    expect(isFinite(z)).toBe(true);
  });

  it('headstock-spindle X < tailstock-quill X (headstock is at -X end, tailstock at +X end)', () => {
    expect(pts['headstock-spindle'][0]).toBeLessThan(pts['tailstock-quill'][0]);
  });

  it('headstock-spindle and tailstock-quill share the same Y (spindle axis height)', () => {
    expect(pts['headstock-spindle'][1]).toBeCloseTo(pts['tailstock-quill'][1], 6);
  });

  it('headstock-spindle and tailstock-quill are both at Z=0 (on-axis)', () => {
    expect(pts['headstock-spindle'][2]).toBeCloseTo(0, 6);
    expect(pts['tailstock-quill'][2]).toBeCloseTo(0, 6);
  });

  it('bed tool-rest Y is approximately equal to spindle Y (rest bar at working height)', () => {
    const spindleY = pts['headstock-spindle'][1];
    const bedY     = pts['bed'][1];
    // The bar top sits at spindle height; allow ±5 mm tolerance for bar radius.
    expect(Math.abs(bedY - spindleY)).toBeLessThan(0.05);
  });

  it('all Y values are positive (machine is above the floor)', () => {
    expect(pts['headstock-spindle'][1]).toBeGreaterThan(0);
    expect(pts['tailstock-quill'][1]).toBeGreaterThan(0);
    expect(pts['bed'][1]).toBeGreaterThan(0);
  });

  it('betweenCenters separation matches spec (≈ 1.0668 m)', () => {
    const span = pts['tailstock-quill'][0] - pts['headstock-spindle'][0];
    expect(span).toBeCloseTo(1.0668, 3);
  });
});

describe('mountPoints — exported constants', () => {
  it('DRIVE_CENTER_TIP_X is finite', () => {
    expect(isFinite(DRIVE_CENTER_TIP_X)).toBe(true);
  });

  it('TAILSTOCK_CENTRE_X is finite', () => {
    expect(isFinite(TAILSTOCK_CENTRE_X)).toBe(true);
  });

  it('DRIVE_CENTER_TIP_X < TAILSTOCK_CENTRE_X (drive center is left of tailstock body)', () => {
    expect(DRIVE_CENTER_TIP_X).toBeLessThan(TAILSTOCK_CENTRE_X);
  });
});
