/**
 * useScrollZoom.test.ts — unit tests for the pure nextZoomFov helper.
 *
 * The hook itself (useScrollZoom) is event-driven R3F glue and is exercised
 * manually on localhost:5173. The pure math is testable without any browser or
 * R3F context.
 */

import { describe, it, expect } from 'vitest';
import { nextZoomFov, MIN_FOV, FOV_STEP } from './useScrollZoom.js';

const MAX_FOV = 60; // representative "original" FOV (operator preset)

describe('nextZoomFov — zoom in (scroll up, deltaY < 0)', () => {
  it('decreases FOV when scrolling up', () => {
    const result = nextZoomFov(MAX_FOV, -100, MIN_FOV, MAX_FOV, FOV_STEP);
    expect(result).toBeLessThan(MAX_FOV);
  });

  it('decreases FOV by exactly one step for deltaY = -100', () => {
    const result = nextZoomFov(MAX_FOV, -100, MIN_FOV, MAX_FOV, FOV_STEP);
    expect(result).toBeCloseTo(MAX_FOV - FOV_STEP);
  });

  it('clamps at MIN_FOV — cannot zoom in past minimum', () => {
    // Start at MIN_FOV and try to zoom in further
    const result = nextZoomFov(MIN_FOV, -100, MIN_FOV, MAX_FOV, FOV_STEP);
    expect(result).toBe(MIN_FOV);
  });

  it('clamps correctly when FOV would go below MIN_FOV', () => {
    const justAboveMin = MIN_FOV + 1;
    // A large scroll up should not drop below MIN_FOV
    const result = nextZoomFov(justAboveMin, -1000, MIN_FOV, MAX_FOV, FOV_STEP);
    expect(result).toBe(MIN_FOV);
  });

  it('result is never below MIN_FOV regardless of deltaY magnitude', () => {
    const result = nextZoomFov(30, -999999, MIN_FOV, MAX_FOV, FOV_STEP);
    expect(result).toBeGreaterThanOrEqual(MIN_FOV);
  });
});

describe('nextZoomFov — zoom out (scroll down, deltaY > 0)', () => {
  it('increases FOV when scrolling down', () => {
    const startFov = 30; // already zoomed in
    const result = nextZoomFov(startFov, 100, MIN_FOV, MAX_FOV, FOV_STEP);
    expect(result).toBeGreaterThan(startFov);
  });

  it('increases FOV by exactly one step for deltaY = +100', () => {
    const startFov = 30;
    const result = nextZoomFov(startFov, 100, MIN_FOV, MAX_FOV, FOV_STEP);
    expect(result).toBeCloseTo(startFov + FOV_STEP);
  });

  it('clamps at maxFov — cannot zoom out past original FOV', () => {
    // Start at maxFov and try to zoom out further
    const result = nextZoomFov(MAX_FOV, 100, MIN_FOV, MAX_FOV, FOV_STEP);
    expect(result).toBe(MAX_FOV);
  });

  it('clamps correctly when FOV would exceed maxFov', () => {
    const nearMax = MAX_FOV - 1;
    const result = nextZoomFov(nearMax, 1000, MIN_FOV, MAX_FOV, FOV_STEP);
    expect(result).toBe(MAX_FOV);
  });

  it('result never exceeds maxFov regardless of deltaY magnitude', () => {
    const result = nextZoomFov(30, 999999, MIN_FOV, MAX_FOV, FOV_STEP);
    expect(result).toBeLessThanOrEqual(MAX_FOV);
  });
});

describe('nextZoomFov — boundary & identity cases', () => {
  it('returns unchanged FOV when deltaY is 0', () => {
    const fov = 45;
    const result = nextZoomFov(fov, 0, MIN_FOV, MAX_FOV, FOV_STEP);
    expect(result).toBeCloseTo(fov);
  });

  it('works with a different maxFov (overhead preset = 64)', () => {
    const overheadMax = 64;
    // At 64, scroll down should stay at 64
    const result = nextZoomFov(overheadMax, 100, MIN_FOV, overheadMax, FOV_STEP);
    expect(result).toBe(overheadMax);
  });

  it('works with a different maxFov — zoom in from 64', () => {
    const overheadMax = 64;
    const result = nextZoomFov(overheadMax, -100, MIN_FOV, overheadMax, FOV_STEP);
    expect(result).toBeCloseTo(overheadMax - FOV_STEP);
  });

  it('AtLathe fixed preset: maxFov = 50 — scroll out returns to 50, not beyond', () => {
    const atLatheMax = 50;
    const result = nextZoomFov(40, 9999, MIN_FOV, atLatheMax, FOV_STEP);
    expect(result).toBe(atLatheMax);
  });
});
