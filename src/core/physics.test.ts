import { describe, it, expect } from 'vitest';
import { createWoodState, tickPhysics, IDEAL_SURFACE_SPEED } from './physics.js';
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
    // Per tick: depth = min(MAX_CUT_DEPTH * 0.5 * (0.016/0.016) * 0.8, currentRadius)
    //   MAX_CUT_DEPTH['roughing-gouge'] = 0.0003
    //         = min(0.0003 * 0.5 * 1 * 0.8, currentRadius)
    //         = min(0.00012, currentRadius)
    // Starting radius = 0.05; each of 10 ticks removes 0.00012 (well within radius).
    // Final = 0.05 - 10 * 0.00012 = 0.04880
    const profile: SpeciesCutProfile = { cutRate: 0.8, tearout: 1, catch: 1 };
    const state = createWoodState(0.3, 0.05);
    const pose = { position: { x: 0, y: 0, z: 0 }, angleX: 0.3, angleY: 0, pressure: 0.5 };
    for (let i = 0; i < 10; i++) {
      tickPhysics(state, pose, 'roughing-gouge', 0.016, profile);
    }
    expect(Math.abs((state.profile[32] ?? 0) - 0.04880)).toBeLessThan(1e-7);
  });
});

// ---------------------------------------------------------------------------
// T3 — RPM / surface-speed physics tests
// ---------------------------------------------------------------------------

// Shared fixtures for RPM tests
// roughing-gouge ideal surface speed = 4.0 m/s
// bevelThreshold = 0.52; catch requires absAngle > bevelThreshold * 2 = 1.04
const RPM_CLEAN_POSE = { position: { x: 0, y: 0, z: 0 }, angleX: 0.3, angleY: 0, pressure: 0.5 } as const;

// RPM that gives surface speed ≈ 1.2 m/s at radius 0.05 (well below ideal 4.0)
// surfaceSpeed = 2π × 0.05 × (rpm/60) = 1.2  →  rpm = 1.2×60/(2π×0.05) = 72/(0.1π) = 720/π ≈ 229.18
// We use 229 (close enough to be "well below ideal")
const RPM_SLOW = 229;

// RPM at roughly ideal surface speed for roughing-gouge at radius 0.05m
// surfaceSpeed = 4.0 m/s  →  rpm = 4.0×60/(2π×0.05) = 240/π ≈ 763.94 → use 764
const RPM_IDEAL = 764;

// RPM well above ideal (2× ideal) — speedFactor still clamped at 1.0
const RPM_FAST = 1528;

describe('RPM — IDEAL_SURFACE_SPEED constants are exported and sane', () => {
  it('all tools have a positive ideal surface speed', () => {
    expect(IDEAL_SURFACE_SPEED['roughing-gouge']).toBeGreaterThan(0);
    expect(IDEAL_SURFACE_SPEED['spindle-gouge']).toBeGreaterThan(0);
    expect(IDEAL_SURFACE_SPEED['parting-tool']).toBeGreaterThan(0);
  });

  it('spindle-gouge ideal is the highest (detail tool needs faster surface speed)', () => {
    expect(IDEAL_SURFACE_SPEED['spindle-gouge']).toBeGreaterThan(IDEAL_SURFACE_SPEED['roughing-gouge']);
    expect(IDEAL_SURFACE_SPEED['spindle-gouge']).toBeGreaterThan(IDEAL_SURFACE_SPEED['parting-tool']);
  });
});

describe('RPM — backward-compat lock', () => {
  it('5-arg call (no rpm) and 6-arg call (rpm=undefined) produce byte-identical results', () => {
    const s1 = createWoodState(0.3, 0.05);
    const s2 = createWoodState(0.3, 0.05);
    for (let i = 0; i < 5; i++) {
      tickPhysics(s1, RPM_CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL);
      tickPhysics(s2, RPM_CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL, undefined);
    }
    expect(s1.profile).toEqual(s2.profile);
    expect(s1.tearout).toEqual(s2.tearout);
  });

  it('4-arg call (no cutProfile, no rpm) is still valid and removes material', () => {
    const s1 = createWoodState(0.3, 0.05);
    const before = s1.profile[32] ?? 0;
    tickPhysics(s1, RPM_CLEAN_POSE, 'roughing-gouge', 0.016);
    expect(s1.profile[32] ?? 0).toBeLessThan(before);
  });
});

describe('RPM — stopped blank (rpm = 0)', () => {
  it('rpm=0 → zero material removed regardless of pose', () => {
    const state = createWoodState(0.3, 0.05);
    const snapshot = Float32Array.from(state.profile);
    const result = tickPhysics(state, RPM_CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL, 0);
    expect(result.materialRemoved).toBe(0);
    expect(result.catch).toBe(false);
    expect(state.profile).toEqual(snapshot);
  });

  it('rpm=0 → no catch even on a catch-prone pose', () => {
    const state = createWoodState(0.3, 0.05);
    const result = tickPhysics(state, CATCH_POSE, 'roughing-gouge', 0.016, NEUTRAL, 0);
    expect(result.catch).toBe(false);
    expect(result.materialRemoved).toBe(0);
  });

  it('negative rpm is treated as stopped — zero removal, no catch', () => {
    const state = createWoodState(0.3, 0.05);
    const snapshot = Float32Array.from(state.profile);
    const result = tickPhysics(state, RPM_CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL, -100);
    expect(result.materialRemoved).toBe(0);
    expect(result.catch).toBe(false);
    expect(state.profile).toEqual(snapshot);
  });
});

describe('RPM — slow vs ideal surface speed', () => {
  it('rpm near ideal removes strictly MORE material than rpm well below ideal (fixed pose)', () => {
    // Well-below-ideal rpm gives speedFactor < 1 → less depth per tick.
    const sSlow = createWoodState(0.3, 0.05);
    const sIdeal = createWoodState(0.3, 0.05);
    tickPhysics(sSlow, RPM_CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL, RPM_SLOW);
    tickPhysics(sIdeal, RPM_CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL, RPM_IDEAL);
    const radiusSlow = sSlow.profile[32] ?? 0;
    const radiusIdeal = sIdeal.profile[32] ?? 0;
    // Higher surface speed → more material removed → smaller remaining radius
    expect(radiusIdeal).toBeLessThan(radiusSlow);
  });

  it('catch propensity is higher at low surface speed — catch occurs on borderline angle at slow rpm', () => {
    // Borderline angle: just above bevelThreshold (0.52) but below normal catch threshold (1.04).
    // At ideal speed the catch trigger requires absAngle > bevelThreshold * 2 = 1.04.
    // At low speed the catch window widens (catchMultiplier < 2) so a smaller mis-angle suffices.
    // We pick angleX = 0.65 (above 0.52, clearly below 1.04) and verify:
    //   - slow rpm → catch fires
    //   - no-rpm (speedFactor=1, full window) → no catch (0.65 < 1.04)
    const borderlineAnglePose = {
      position: { x: 0, y: 0, z: 0 },
      angleX: 0.65,  // above bevelThreshold (0.52) but below 1.04
      angleY: 0,
      pressure: 0.8,
    };

    // At slow RPM (~229): surfaceSpeed ≈ 1.2 m/s, speedFactor ≈ 0.1 + 0.9*(1.2/4.0) = 0.37
    // speedFactor < CATCH_SPEED_THRESHOLD (0.4) → catchMultiplier = 2 * speedFactor ≈ 0.74
    // Catch fires when absAngle > bevelThreshold * catchMultiplier = 0.52 * 0.74 ≈ 0.385
    // 0.65 > 0.385 → catch fires at slow rpm
    const stateSlowRpm = createWoodState(0.3, 0.05);
    const resultSlowRpm = tickPhysics(stateSlowRpm, borderlineAnglePose, 'roughing-gouge', 0.016, NEUTRAL, RPM_SLOW);
    expect(resultSlowRpm.catch).toBe(true);

    // At full speed (no rpm arg): catchMultiplier = 2
    // Catch fires when absAngle > 0.52 * 2 = 1.04; 0.65 < 1.04 → no catch
    const stateNoRpm = createWoodState(0.3, 0.05);
    const resultNoRpm = tickPhysics(stateNoRpm, borderlineAnglePose, 'roughing-gouge', 0.016, NEUTRAL);
    expect(resultNoRpm.catch).toBe(false);
  });
});

describe('RPM — diameter coupling (emergent surface speed)', () => {
  it('at fixed rpm, thick blank cuts more material than thin blank (higher surface speed)', () => {
    // surfaceSpeed = 2π × radius × (rpm/60)
    // Thick blank (radius=0.05) has higher surface speed than thin blank (radius=0.02) at same RPM.
    // Higher surface speed → speedFactor closer to (or at) 1 → more material removed per tick.
    const RPM_MID = 500; // mid-range; gives different speedFactors at different radii

    // Thick blank: surfaceSpeed = 2π * 0.05 * (500/60) ≈ 2.618 m/s → speedFactor = 0.1 + 0.9*(2.618/4.0) ≈ 0.689
    const sThick = createWoodState(0.3, 0.05);
    tickPhysics(sThick, RPM_CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL, RPM_MID);
    const removedThick = 0.05 - (sThick.profile[32] ?? 0);

    // Thin blank: surfaceSpeed = 2π * 0.02 * (500/60) ≈ 1.047 m/s → speedFactor = 0.1 + 0.9*(1.047/4.0) ≈ 0.336
    const sThin = createWoodState(0.3, 0.02);
    tickPhysics(sThin, RPM_CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL, RPM_MID);
    const removedThin = 0.02 - (sThin.profile[32] ?? 0);

    // Thick blank has higher surface speed → higher speedFactor → more material removed
    expect(removedThick).toBeGreaterThan(removedThin);
  });

  it('surface speed is computed from CURRENT radius each tick — shrinking blank means less speed over time', () => {
    // Run many ticks with high rpm starting at a thick blank.
    // As radius shrinks, surface speed drops, so speedFactor should eventually < 1.
    // We verify: late-tick removal rate is lower than early-tick removal rate.
    // Use rpm = RPM_IDEAL so at radius=0.05 speedFactor=1 (full cut), then as radius falls
    // below the "ideal at this rpm" level the rate should drop slightly.
    //
    // Actually at RPM_IDEAL ≈ 764 and radius=0.05:
    //   surfaceSpeed = 2π * 0.05 * (764/60) ≈ 4.007 m/s ≥ 4.0 → factor=1
    // As blank thins to, say, 0.03:
    //   surfaceSpeed = 2π * 0.03 * (764/60) ≈ 2.404 m/s < 4.0 → factor < 1
    // So the first few ticks cut at full rate, later ticks cut slower.
    const state = createWoodState(0.3, 0.05);
    const pose = { position: { x: 0, y: 0, z: 0 }, angleX: 0.3, angleY: 0, pressure: 1.0 };

    // First tick: record how much was removed
    const r0 = state.profile[32] ?? 0;
    tickPhysics(state, pose, 'roughing-gouge', 0.016, NEUTRAL, RPM_IDEAL);
    const removedFirst = r0 - (state.profile[32] ?? 0);

    // Run many more ticks to let the blank thin significantly
    for (let i = 0; i < 20; i++) {
      tickPhysics(state, pose, 'roughing-gouge', 0.016, NEUTRAL, RPM_IDEAL);
    }

    // Record removal rate on a late tick
    const rMid = state.profile[32] ?? 0;
    tickPhysics(state, pose, 'roughing-gouge', 0.016, NEUTRAL, RPM_IDEAL);
    const removedLate = rMid - (state.profile[32] ?? 0);

    // Early removal should be ≥ late removal (surface speed has dropped)
    expect(removedFirst).toBeGreaterThanOrEqual(removedLate);
  });
});

describe('RPM — monotonicity: removal rises with rpm up to ideal, then plateaus', () => {
  it('removal increases as rpm rises from near-zero to ideal band', () => {
    // Pick three rpm values: very slow, medium, ideal-ish.
    // Assert: removal(very_slow) < removal(medium) < removal(ideal).
    const rpmValues = [50, 300, 764] as const;
    const removed: number[] = [];

    for (const rpm of rpmValues) {
      const s = createWoodState(0.3, 0.05);
      tickPhysics(s, RPM_CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL, rpm);
      removed.push(0.05 - (s.profile[32] ?? 0));
    }

    expect(removed[0]).toBeGreaterThan(0);                      // even slow has some removal
    expect(removed[1]).toBeGreaterThan(removed[0] ?? 0); // medium > very slow
    expect(removed[2]).toBeGreaterThan(removed[1] ?? 0); // ideal > medium
  });

  it('removal plateaus: rpm above ideal does not increase removal further', () => {
    // At rpm giving speedFactor = 1.0, further rpm increases should NOT increase removal.
    const sIdeal = createWoodState(0.3, 0.05);
    const sFast  = createWoodState(0.3, 0.05);
    tickPhysics(sIdeal, RPM_CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL, RPM_IDEAL);
    tickPhysics(sFast,  RPM_CLEAN_POSE, 'roughing-gouge', 0.016, NEUTRAL, RPM_FAST);
    // Both should remove the same amount (factor capped at 1.0)
    expect(sIdeal.profile[32]).toBeCloseTo(sFast.profile[32] ?? 0, 10);
  });
});

describe('RPM — golden scenario (T3)', () => {
  it('fixed rpm + radius + 1 tick lands at hard-coded expected radius (within 1e-6)', () => {
    // Scenario:
    //   blank:       length=0.3m, radius=0.05m, 64 stations
    //   station:     32 (z=0)
    //   tool:        roughing-gouge, angleX=0.3 (bevel contact), angleY=0 (no tearout), pressure=0.5
    //   dt:          0.016 (one 60fps frame)
    //   cutProfile:  NEUTRAL (all 1×)
    //   rpm:         300
    //
    // surfaceSpeed = 2π × 0.05 × (300/60)
    //              = 2π × 0.05 × 5
    //              = 0.5π m/s
    //
    // idealSpeed   = 4.0 m/s  (roughing-gouge)
    //
    // speedFactor  = 0.1 + 0.9 × (0.5π / 4.0)
    //              = 0.1 + 0.9 × (π/8)
    //              ≈ 0.1 + 0.9 × 0.392699...
    //              ≈ 0.1 + 0.353430...
    //              ≈ 0.453430...
    //
    // MAX_CUT_DEPTH['roughing-gouge'] = 0.0003  (updated from 0.004 — gradual-cut slice)
    //
    // depth        = 0.0003 × 0.5 × (0.016/0.016) × 1.0 × speedFactor
    //              = 0.00015 × speedFactor
    //              ≈ 0.00015 × 0.453430...
    //              ≈ 0.000068014...
    //
    // finalRadius  = 0.05 - depth ≈ 0.049931985...
    //
    // We compute the expected value analytically to match float64 precision:
    const MAX_CUT_DEPTH_ROUGHING = 0.0003; // must match physics.ts MAX_CUT_DEPTH['roughing-gouge']
    const rpm = 300;
    const radius = 0.05;
    const idealSpeed = IDEAL_SURFACE_SPEED['roughing-gouge']; // 4.0
    const surfaceSpeed = 2 * Math.PI * radius * (rpm / 60);
    const speedFactor = 0.1 + 0.9 * (surfaceSpeed / idealSpeed);
    const expectedDepth = MAX_CUT_DEPTH_ROUGHING * 0.5 * 1.0 * 1.0 * speedFactor;
    const expectedRadius = radius - expectedDepth;

    const state = createWoodState(0.3, radius);
    const pose = { position: { x: 0, y: 0, z: 0 }, angleX: 0.3, angleY: 0, pressure: 0.5 };
    tickPhysics(state, pose, 'roughing-gouge', 0.016, NEUTRAL, rpm);

    expect(Math.abs((state.profile[32] ?? 0) - expectedRadius)).toBeLessThan(1e-6);
  });

  it('low-speed catch is more severe than full-speed catch (larger depth + tearout spike)', () => {
    // At low surface speed the catch severity multiplier > 1, so catches are worse.
    // We use the same catch pose and compare slow vs ideal rpm.
    // CATCH_POSE: angleX=1.2 which is > bevelThreshold*2 = 1.04, so it always catches at ideal speed too.
    const sSlow  = createWoodState(0.3, 0.05);
    const sIdeal = createWoodState(0.3, 0.05);
    const rSlow  = tickPhysics(sSlow,  CATCH_POSE, 'roughing-gouge', 0.016, NEUTRAL, RPM_SLOW);
    const rIdeal = tickPhysics(sIdeal, CATCH_POSE, 'roughing-gouge', 0.016, NEUTRAL, RPM_IDEAL);

    expect(rSlow.catch).toBe(true);
    expect(rIdeal.catch).toBe(true);

    // Slow-speed catch removes more material (lower remaining radius)
    expect(sSlow.profile[32] ?? 0).toBeLessThan(sIdeal.profile[32] ?? 0);
    // Slow-speed catch spikes tearout more
    expect(sSlow.tearout[32] ?? 0).toBeGreaterThan(sIdeal.tearout[32] ?? 0);
  });
});
