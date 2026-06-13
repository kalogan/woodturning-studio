import { describe, it, expect } from 'vitest';
import { createWoodState, tickPhysics } from './physics.js';
import type { SpeciesCutProfile } from './types.js';

describe('createWoodState', () => {
  it('creates a cylindrical blank with uniform profile', () => {
    const state = createWoodState(0.3, 0.05);
    expect(state.profile.every(r => Math.abs(r - 0.05) < 1e-6)).toBe(true);
    expect(state.tearout.every(t => t === 0)).toBe(true);
  });
});

describe('tickPhysics', () => {
  it('removes material on a clean bevel-contact cut', () => {
    const state = createWoodState(0.3, 0.05);
    const before = state.profile[32] ?? 0;
    tickPhysics(state, { position: { x: 0, y: 0, z: 0 }, angleX: 0.3, angleY: 0, pressure: 1 }, 'roughing-gouge', 16);
    expect(state.profile[32] ?? 0).toBeLessThan(before);
  });

  it('triggers a catch on steep angle with high pressure', () => {
    const state = createWoodState(0.3, 0.05);
    const result = tickPhysics(state, { position: { x: 0, y: 0, z: 0 }, angleX: 1.2, angleY: 0, pressure: 0.8 }, 'roughing-gouge', 16);
    expect(result.catch).toBe(true);
  });

  it('records tearout when cutting against grain', () => {
    const state = createWoodState(0.3, 0.05);
    tickPhysics(state, { position: { x: 0, y: 0, z: 0 }, angleX: 0.3, angleY: -0.5, pressure: 1 }, 'spindle-gouge', 16);
    expect(state.tearout[32] ?? 0).toBeGreaterThan(0);
  });

  it('does not mutate outside valid station bounds', () => {
    const state = createWoodState(0.3, 0.05);
    const snapshot = Float32Array.from(state.profile);
    // z far outside blank range
    tickPhysics(state, { position: { x: 0, y: 0, z: 99 }, angleX: 0.3, angleY: 0, pressure: 1 }, 'roughing-gouge', 16);
    expect(state.profile).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// SpeciesCutProfile tests
// ---------------------------------------------------------------------------

const CLEAN_POSE = { position: { x: 0, y: 0, z: 0 }, angleX: 0.3, angleY: 0, pressure: 0.5 } as const;
const AGAINST_GRAIN_POSE = { position: { x: 0, y: 0, z: 0 }, angleX: 0.3, angleY: -0.5, pressure: 0.5 } as const;
// Catch pose: steep angle (> bevelThreshold * 2 for roughing-gouge: 0.52*2 = 1.04) with pressure > 0.3
const CATCH_POSE = { position: { x: 0, y: 0, z: 0 }, angleX: 1.2, angleY: 0, pressure: 0.8 } as const;
const NEUTRAL: SpeciesCutProfile = { cutRate: 1, tearout: 1, catch: 1 };

describe('SpeciesCutProfile — regression lock', () => {
  it('no-profile call and explicit neutral profile produce byte-identical results', () => {
    const s1 = createWoodState(0.3, 0.05);
    const s2 = createWoodState(0.3, 0.05);
    tickPhysics(s1, CLEAN_POSE, 'roughing-gouge', 0.016);
    tickPhysics(s2, CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL);
    expect(s1.profile).toEqual(s2.profile);
    expect(s1.tearout).toEqual(s2.tearout);
  });

  it('4-arg call path is unchanged — removes material identically to neutral-profile call', () => {
    const s1 = createWoodState(0.3, 0.05);
    const s2 = createWoodState(0.3, 0.05);
    // Run multiple ticks to amplify any divergence
    for (let i = 0; i < 5; i++) {
      tickPhysics(s1, CLEAN_POSE, 'spindle-gouge', 0.016);
      tickPhysics(s2, CLEAN_POSE, 'spindle-gouge', 0.016, NEUTRAL);
    }
    expect(s1.profile).toEqual(s2.profile);
    expect(s1.tearout).toEqual(s2.tearout);
  });
});

describe('SpeciesCutProfile — monotonicity (cutRate)', () => {
  it('higher cutRate removes strictly more material than lower cutRate', () => {
    const sHigh = createWoodState(0.3, 0.05);
    const sLow = createWoodState(0.3, 0.05);
    const high: SpeciesCutProfile = { cutRate: 1.5, tearout: 1, catch: 1 };
    const low: SpeciesCutProfile = { cutRate: 0.5, tearout: 1, catch: 1 };
    tickPhysics(sHigh, CLEAN_POSE, 'roughing-gouge', 0.016, high);
    tickPhysics(sLow, CLEAN_POSE, 'roughing-gouge', 0.016, low);
    const radiusHigh = sHigh.profile[32] ?? 0;
    const radiusLow = sLow.profile[32] ?? 0;
    // Higher cutRate → smaller remaining radius (more removed)
    expect(radiusHigh).toBeLessThan(radiusLow);
  });
});

describe('SpeciesCutProfile — tearout scales with coefficient', () => {
  it('higher tearout coefficient → strictly higher accumulated tearout on against-grain cut', () => {
    const sHigh = createWoodState(0.3, 0.05);
    const sLow = createWoodState(0.3, 0.05);
    const high: SpeciesCutProfile = { cutRate: 1, tearout: 2.0, catch: 1 };
    const low: SpeciesCutProfile = { cutRate: 1, tearout: 0.5, catch: 1 };
    tickPhysics(sHigh, AGAINST_GRAIN_POSE, 'spindle-gouge', 0.016, high);
    tickPhysics(sLow, AGAINST_GRAIN_POSE, 'spindle-gouge', 0.016, low);
    expect((sHigh.tearout[32] ?? 0)).toBeGreaterThan(sLow.tearout[32] ?? 0);
  });
});

describe('SpeciesCutProfile — catch severity scales with coefficient', () => {
  it('higher catch coefficient removes more material and spikes tearout more on a catch', () => {
    const sHigh = createWoodState(0.3, 0.05);
    const sLow = createWoodState(0.3, 0.05);
    const high: SpeciesCutProfile = { cutRate: 1, tearout: 1, catch: 1.5 };
    const low: SpeciesCutProfile = { cutRate: 1, tearout: 1, catch: 0.5 };
    const rHigh = tickPhysics(sHigh, CATCH_POSE, 'roughing-gouge', 0.016, high);
    const rLow = tickPhysics(sLow, CATCH_POSE, 'roughing-gouge', 0.016, low);
    expect(rHigh.catch).toBe(true);
    expect(rLow.catch).toBe(true);
    // Higher catch coefficient → smaller remaining radius (more removed)
    expect(sHigh.profile[32] ?? 0).toBeLessThan(sLow.profile[32] ?? 0);
    // Higher catch coefficient → higher tearout spike
    expect(sHigh.tearout[32] ?? 0).toBeGreaterThan(sLow.tearout[32] ?? 0);
  });
});

describe('SpeciesCutProfile — golden scenario', () => {
  it('fixed blank + pose + profile + 10 ticks lands at expected radius (within 1e-7)', () => {
    // Scenario:
    //   blank:       length=0.3m, radius=0.05m, 64 stations
    //   station:     32 (z=0)
    //   tool:        roughing-gouge, angleX=0.3 (bevel contact), angleY=0 (no tearout), pressure=0.5
    //   dt:          0.016 (one 60fps frame)
    //   cutProfile:  { cutRate: 0.8, tearout: 1, catch: 1 }
    //
    // Per tick: depth = min(0.004 * 0.5 * (0.016/0.016) * 0.8, currentRadius)
    //                  = min(0.0016, currentRadius)
    // Starting radius = 0.05; each of 10 ticks removes 0.0016
    // Final = 0.05 - 10 * 0.0016 = 0.034
    const profile: SpeciesCutProfile = { cutRate: 0.8, tearout: 1, catch: 1 };
    const state = createWoodState(0.3, 0.05);
    const pose = { position: { x: 0, y: 0, z: 0 }, angleX: 0.3, angleY: 0, pressure: 0.5 };
    for (let i = 0; i < 10; i++) {
      tickPhysics(state, pose, 'roughing-gouge', 0.016, profile);
    }
    expect(Math.abs((state.profile[32] ?? 0) - 0.034)).toBeLessThan(1e-7);
  });
});
