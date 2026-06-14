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
 * Max depth of cut per tick in meters (at full pressure, correct angle, dt=0.016 s,
 * neutral cutProfile, ideal RPM).
 *
 * DIRECTOR TUNING: These values control how FAST the tool removes material.
 * Lower = more gradual / more satisfying shaving feel.
 * Higher = faster / more aggressive removal.
 *
 * Target feel (real-world pace): holding the tool on ONE spot of a HARDWOOD blank
 * (e.g. maple, cutRate ≈ 0.65) at pressure ≈ 0.8 and ideal RPM should take ~8-10 s
 * to knock a corner down noticeably. Fully roughing the whole blank takes ~2-3 minutes.
 *
 * Derivation (roughing-gouge, hardwood maple, pressure=0.8, cutRate=0.65, speedFactor=1):
 *   corner_height = radius × (√2 − 1) ≈ 0.05 × 0.414 = 0.021 m
 *   target_frames = 9 s × 60 fps = 540 frames  (hardwood target)
 *   depth_per_frame = 0.021 / 540 ≈ 0.0000389 m
 *   MAX_CUT_DEPTH = depth_per_frame / (pressure × cutRate)
 *                = 0.0000389 / (0.8 × 0.65) ≈ 0.0000748 → 0.000075
 *
 * Hardness contrast at pressure=0.8, speedFactor=1 (cutting-matrix cutRate values):
 *   Softwood (pine,  cutRate=1.55): 0.021/(0.000075×0.8×1.55) ≈ 226 frames ≈  3.8 s
 *   Hardwood (maple, cutRate=0.65): 0.021/(0.000075×0.8×0.65) ≈ 539 frames ≈  9.0 s
 *   → ~2.4× ratio — soft vs hard is clearly perceptible.
 *
 * Full blank roughing estimate (hardwood, ~20 active stations × 9 s avg):
 *   20 × 9 s ≈ 3 minutes — matches real-world pace.
 *
 * Previously: roughing=0.0003 (corners rounded in ~1-2 s — far too fast).
 * This slice reduces the rate ~4× to reach real-world pace.
 *
 * HARDNESS LEVER: the cutRate in SpeciesCutProfile (from content/wood/cutting-matrix.json)
 * is the primary hardness signal. To amplify or dampen the soft/hard contrast further,
 * search for HARDNESS_INFLUENCE_EXPONENT in physics.ts (currently 1.0 = linear).
 */
const MAX_CUT_DEPTH: Record<ToolKind, number> = {
  'roughing-gouge': 0.000075,  // TUNABLE — hardwood corner ~9 s, softwood ~3.8 s at pressure=0.8
  'spindle-gouge':  0.0000375, // TUNABLE — detail tool, half roughing rate
  'parting-tool':   0.0000563, // TUNABLE — narrow kerf, between roughing and spindle
};

/**
 * Exponent applied to cutProfile.cutRate to scale the soft/hard contrast.
 * 1.0 = linear (current matrix range 0.65–1.55 already gives ~2.4× contrast).
 * Raise above 1.0 to make hard woods feel much slower (e.g. 1.5 → ~3.5× contrast).
 * Lower below 1.0 to compress the contrast.
 *
 * DIRECTOR TUNING: set to 1.0 initially; tune from feel after real-world pace lands.
 */
const HARDNESS_INFLUENCE_EXPONENT = 1.0; // TUNABLE — 1.0 = linear cutRate scaling

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
 * Above the ideal surface speed the cut keeps getting FASTER with RPM (director:
 * "the faster the RPM, the faster the gouge cuts the wood round"). speedFactor climbs
 * from 1.0 at ideal up to MAX_SPEED_FACTOR, reaching the cap at
 * (1 + OVERSPEED_SPAN_RATIO)× the ideal surface speed (≈ the lathe's top ~3200 rpm at
 * full 0.05 m radius). As the blank rounds and its radius shrinks, surface speed drops,
 * so the cut naturally slows for smaller diameters — realistic.
 *
 * DIRECTOR TUNING: raise MAX_SPEED_FACTOR for a bigger high-RPM payoff; lower
 * OVERSPEED_SPAN_RATIO to reach max cut speed at a lower RPM.
 */
const MAX_SPEED_FACTOR = 3.0;     // TUNABLE — cut-rate ceiling at high RPM (× the ideal-speed rate)
const OVERSPEED_SPAN_RATIO = 3.0; // TUNABLE — reach MAX_SPEED_FACTOR at (1+this)× ideal surface speed

/**
 * Compute a speed factor that scales cut rate based on surface speed.
 *
 * Model rationale:
 *   - BELOW ideal the factor falls linearly from 1.0 (at ideal) to a floor of 0.1 at
 *     zero speed. Linear is predictable, testable, and matches the practical observation
 *     that halving the surface speed roughly halves the clean chip-formation rate.
 *     Floor of 0.1 (not 0): even near-stopped there is a tiny amount of scraping.
 *     The stopped-blank gate (rpm ≤ 0) is enforced upstream before this is called.
 *   - AT or ABOVE ideal the factor keeps CLIMBING from 1.0 up to MAX_SPEED_FACTOR as
 *     surface speed (hence RPM) rises — faster spin removes material faster — reaching
 *     the cap at (1 + OVERSPEED_SPAN_RATIO)× ideal speed, then holding so it stays bounded.
 *
 * Used to scale the normal-cut depth, and (via CATCH_SPEED_THRESHOLD) to widen the
 * catch window at low speed. Allocation-free: only arithmetic on pre-existing scalars.
 */
function computeSpeedFactor(surfaceSpeed: number, idealSpeed: number): number {
  if (surfaceSpeed < idealSpeed) {
    // Below ideal: linear ramp from 0.1 (surfaceSpeed=0) to 1.0 (surfaceSpeed=ideal).
    return 0.1 + 0.9 * (surfaceSpeed / idealSpeed);
  }
  // At/above ideal: climb from 1.0 toward MAX_SPEED_FACTOR with overspeed, then cap.
  const over = (surfaceSpeed - idealSpeed) / idealSpeed; // 0 at ideal, grows above
  const factor = 1.0 + (over / OVERSPEED_SPAN_RATIO) * (MAX_SPEED_FACTOR - 1.0);
  return factor < MAX_SPEED_FACTOR ? factor : MAX_SPEED_FACTOR;
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
  // cutRate scales the removal via HARDNESS_INFLUENCE_EXPONENT (1.0 = linear).
  // speedFactor applied after cutRate. Cap is applied after all scaling so we
  // never exceed remaining radius.
  const hardnessScale = Math.pow(cutProfile.cutRate, HARDNESS_INFLUENCE_EXPONENT);
  const depth = Math.min(
    MAX_CUT_DEPTH[toolKind] * toolPose.pressure * (dt / 0.016) * hardnessScale * speedFactor,
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
