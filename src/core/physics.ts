import type { WoodState, ToolPose, ToolKind, PhysicsResult, SpeciesCutProfile } from './types.js';

/** Identity profile — multiplies everything by 1, preserving prior behaviour exactly. */
const NEUTRAL_CUT_PROFILE: SpeciesCutProfile = { cutRate: 1, tearout: 1, catch: 1 };

/** Bevel angle (radians) below which bevel-riding contact is achieved, per tool. */
const BEVEL_THRESHOLD: Record<ToolKind, number> = {
  'roughing-gouge': 0.52,   // ~30°
  'spindle-gouge': 0.44,    // ~25°
  'parting-tool': 0.26,     // ~15°
};

/**
 * Max depth of cut per tick in meters (at full pressure, correct angle, dt=0.016 s).
 *
 * DIRECTOR TUNING: These values control how FAST the tool removes material.
 * Lower = more gradual / more satisfying shaving feel.
 * Higher = faster / more aggressive removal.
 *
 * Target feel: at pressure ≈ 0.8 and ideal RPM, the square corner of a fresh
 * blank (corner protrudes ≈ 0.021 m above the final cylinder) rounds over in
 * ≈ 1–2 seconds of held contact.  Derivation:
 *   corner_height = radius × (√2 − 1) ≈ 0.05 × 0.414 = 0.021 m
 *   frames_at_60fps = 1.5 s × 60 = 90 frames
 *   depth_needed_per_frame = 0.021 / 90 ≈ 0.000233 m  (at pressure=0.8)
 *   MAX_CUT_DEPTH = depth_per_frame / pressure = 0.000233 / 0.8 ≈ 0.00029 → 0.0003
 *
 * Previously: roughing=0.004, spindle=0.002, parting=0.003 (≈13× too fast).
 */
const MAX_CUT_DEPTH: Record<ToolKind, number> = {
  'roughing-gouge': 0.0003,   // TUNABLE — was 0.004; rounds a square corner in ~1-2 s
  'spindle-gouge':  0.00015,  // TUNABLE — was 0.002; detail tool, finer removal
  'parting-tool':   0.000225, // TUNABLE — was 0.003; narrow kerf, medium rate
};

/**
 * Ideal surface speed (m/s) per tool — the sweet spot where chip formation is
 * efficient and the bevel rides cleanly.
 *
 * Reasoning (wood-turning practice):
 *   roughing-gouge: used at early stages on a large, unbalanced blank — ideal
 *     surface speed is moderate (~4 m/s). Roughing tolerates a wide band; the
 *     tool is robust and the goal is bulk removal not finish.
 *   spindle-gouge: used for detail cuts on smaller diameters — benefits from a
 *     higher surface speed (~7 m/s) to achieve a clean shear cut and reduce
 *     tearout on end grain.
 *   parting-tool: narrow kerf, works best at a moderate speed (~5 m/s); too
 *     slow increases sidewall burnishing, too fast causes vibration chatter.
 *
 * These are physics-tuning constants, not machine measurements, so they live
 * in core (per the established pattern for BEVEL_THRESHOLD / MAX_CUT_DEPTH).
 */
export const IDEAL_SURFACE_SPEED: Record<ToolKind, number> = {
  'roughing-gouge': 4.0,   // m/s — wide tolerance band, moderate ideal
  'spindle-gouge':  7.0,   // m/s — higher shear speed for clean detail cuts
  'parting-tool':   5.0,   // m/s — moderate; narrow kerf is sensitive to chatter
};

/** 2π pre-computed — avoids per-tick allocation. */
const TWO_PI = 2 * Math.PI;

/**
 * Compute a [0..1] speed factor that scales cut efficiency based on surface speed.
 *
 * Model rationale:
 *   - At or above the ideal surface speed the tool cuts at full efficiency (factor = 1.0).
 *     We don't punish running slightly fast — the lathe operator would simply take a
 *     lighter pass. Very high overspeed could cause minor tearout in reality, but the
 *     effect is secondary; we keep the model simple and cap factor at 1.0 to avoid
 *     rewarding arbitrarily high RPM.
 *   - Below ideal the factor falls linearly from 1.0 to a floor of 0.1 at zero speed.
 *     Linear is predictable, testable, and matches the practical observation that halving
 *     the surface speed roughly halves the clean chip formation rate.
 *   - Floor of 0.1 (not 0): even at near-zero speed there is a tiny amount of scraping.
 *     The stopped-blank gate (rpm ≤ 0) is enforced upstream before this is called.
 *
 * Catch widening at low speed:
 *   Returns speedFactor directly; the caller uses it to widen the effective catch
 *   threshold when speedFactor < CATCH_SPEED_THRESHOLD (see usage below).
 *
 * Allocation-free: only arithmetic on pre-existing scalars.
 */
function computeSpeedFactor(surfaceSpeed: number, idealSpeed: number): number {
  if (surfaceSpeed >= idealSpeed) {
    return 1.0;
  }
  // Linear ramp from 0.1 (at surfaceSpeed=0) to 1.0 (at surfaceSpeed=idealSpeed)
  return 0.1 + 0.9 * (surfaceSpeed / idealSpeed);
}

/**
 * Below this speedFactor the catch window widens. At ideal speed (factor=1) the
 * catch condition is unchanged. Below this threshold the bevelThreshold multiplier
 * used in the catch test is reduced — meaning a shallower mis-angle can trigger a
 * catch, modelling the loss of bevel support when chips form poorly.
 *
 * Value chosen so that "well below ideal" (surfaceSpeed < ~30% of ideal, factor < ~0.37)
 * represents a meaningfully dangerous operating zone.
 */
const CATCH_SPEED_THRESHOLD = 0.4; // speedFactor below which catch window starts widening

/**
 * Advance wood state by one physics tick.
 * Pure function of inputs — no Date.now(), no Math.random().
 * Mutates woodState.profile and woodState.tearout in place.
 *
 * @param woodState   Mutable wood blank state (profile + tearout mutated in place)
 * @param toolPose    Normalised tool position + angles + pressure
 * @param toolKind    Which tool is engaged
 * @param dt          Frame delta-time in seconds
 * @param cutProfile  Per-(tool,species) cut multipliers (default: neutral 1×1×1)
 * @param rpm         Lathe spindle speed in RPM. When undefined, the existing
 *                    (pre-T3) code path runs unchanged — backward-compatible.
 *                    When 0 or negative, blank is stopped: no cut, no catch.
 */
export function tickPhysics(
  woodState: WoodState,
  toolPose: ToolPose,
  toolKind: ToolKind,
  dt: number,
  cutProfile: SpeciesCutProfile = NEUTRAL_CUT_PROFILE,
  rpm?: number,
): PhysicsResult {
  const stations = woodState.profile.length;
  const stationSpacing = woodState.length / stations;

  // Map tool Z position to nearest station index
  const stationIndex = Math.round(
    ((toolPose.position.z + woodState.length / 2) / woodState.length) * (stations - 1)
  );

  if (stationIndex < 0 || stationIndex >= stations) {
    return { catch: false, materialRemoved: 0 };
  }

  // ── RPM gate ────────────────────────────────────────────────────────────────
  // When rpm is provided and the blank is stopped (rpm ≤ 0), no physics occur.
  // No cut and no catch — the tool may be resting on a stationary blank.
  if (rpm !== undefined && rpm <= 0) {
    return { catch: false, materialRemoved: 0 };
  }

  // ── Speed factor ─────────────────────────────────────────────────────────────
  // Compute once per tick; reuse scalars — no heap allocation.
  // When rpm is undefined the legacy path runs with speedFactor = 1 (no change).
  let speedFactor = 1.0;
  if (rpm !== undefined) {
    const currentRadius = woodState.profile[stationIndex] ?? 0;
    // surfaceSpeed (m/s) = 2π × radius × (rpm / 60)
    const surfaceSpeed = TWO_PI * currentRadius * (rpm / 60);
    speedFactor = computeSpeedFactor(surfaceSpeed, IDEAL_SURFACE_SPEED[toolKind]);
  }

  const bevelThreshold = BEVEL_THRESHOLD[toolKind];
  const absAngle = Math.abs(toolPose.angleX);
  const bevelContact = absAngle <= bevelThreshold;

  // ── Catch detection ─────────────────────────────────────────────────────────
  // At low surface speed (speedFactor < CATCH_SPEED_THRESHOLD) the catch window
  // widens: bevelThreshold * 2 is multiplied by speedFactor so a shallower mis-
  // angle suffices to trigger a catch. At full speed the multiplier is 2× as before.
  //
  // Formula: catchMultiplier = 2 × speedFactor when below threshold, else 2.
  // This means:
  //   - speedFactor = 1.0 (ideal speed): catchAngle threshold = bevelThreshold × 2 (unchanged)
  //   - speedFactor = 0.4 (30% of ideal): catchAngle threshold = bevelThreshold × 0.8 (much easier to catch)
  //   - speedFactor = 0.1 (stopped, shouldn't reach here): would be extremely narrow
  //
  // The severity of a catch (catchDepth, tearout spike) is also amplified by (2 - speedFactor),
  // so low-speed catches are more damaging. Factor capped at 2 for predictability.
  const catchMultiplier = speedFactor < CATCH_SPEED_THRESHOLD
    ? 2 * speedFactor
    : 2;
  const catchOccurred = !bevelContact && absAngle > bevelThreshold * catchMultiplier && toolPose.pressure > 0.3;

  if (catchOccurred) {
    // Catches cause a sudden, large, uncontrolled removal + tearout spike.
    // Both depth and tearout spike are scaled by the catch coefficient.
    // Low surface speed amplifies severity: catchSeverity = max(1, 2 - speedFactor).
    // At ideal speed: severity = 1 (unchanged). At half ideal: severity ≈ 1.5.
    const catchSeverity = Math.max(1.0, 2.0 - speedFactor);
    const currentRadius = woodState.profile[stationIndex] ?? 0;
    const catchDepth = Math.min(currentRadius, 0.01 * cutProfile.catch * catchSeverity);
    woodState.profile[stationIndex] = Math.max(0, currentRadius - catchDepth);
    woodState.tearout[stationIndex] = Math.min(1, (woodState.tearout[stationIndex] ?? 0) + 0.6 * cutProfile.catch * catchSeverity);
    return { catch: true, materialRemoved: catchDepth * stationSpacing * Math.PI };
  }

  if (!bevelContact || toolPose.pressure <= 0) {
    return { catch: false, materialRemoved: 0 };
  }

  // ── Normal cut ──────────────────────────────────────────────────────────────
  // depth proportional to pressure × dt, capped by max cut depth.
  // cutRate scales the removal; speedFactor applied after cutRate.
  // Cap is applied after all scaling so we never exceed remaining radius.
  const depth = Math.min(
    MAX_CUT_DEPTH[toolKind] * toolPose.pressure * (dt / 0.016) * cutProfile.cutRate * speedFactor,
    woodState.profile[stationIndex] ?? 0
  );

  // Grain tearout: cutting against grain direction (simplified: negative angleY = against grain).
  // tearout coefficient scales accumulation rate.
  const againstGrain = toolPose.angleY < -0.15;
  const tearoutDelta = againstGrain ? depth * 40 * cutProfile.tearout : 0;

  woodState.profile[stationIndex] = Math.max(0, (woodState.profile[stationIndex] ?? 0) - depth);
  woodState.tearout[stationIndex] = Math.min(1, (woodState.tearout[stationIndex] ?? 0) + tearoutDelta);

  return { catch: false, materialRemoved: depth * stationSpacing * Math.PI };
}

/** Create a fresh cylindrical blank. */
export function createWoodState(length: number, radius: number, stations = 64): WoodState {
  const profile = new Float32Array(stations).fill(radius);
  return {
    length,
    originalProfile: new Float32Array(profile),
    profile,
    tearout: new Float32Array(stations),
  };
}
