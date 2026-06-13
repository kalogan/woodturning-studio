import type { WoodState, ToolPose, ToolKind, PhysicsResult } from './types.js';

/** Bevel angle (radians) below which bevel-riding contact is achieved, per tool. */
const BEVEL_THRESHOLD: Record<ToolKind, number> = {
  'roughing-gouge': 0.52,   // ~30°
  'spindle-gouge': 0.44,    // ~25°
  'parting-tool': 0.26,     // ~15°
};

/** Max depth of cut per tick in meters (at full pressure, correct angle). */
const MAX_CUT_DEPTH: Record<ToolKind, number> = {
  'roughing-gouge': 0.004,
  'spindle-gouge': 0.002,
  'parting-tool': 0.003,
};

/**
 * Advance wood state by one physics tick.
 * Pure function of inputs — no Date.now(), no Math.random().
 * Mutates woodState.profile and woodState.tearout in place.
 */
export function tickPhysics(
  woodState: WoodState,
  toolPose: ToolPose,
  toolKind: ToolKind,
  dt: number,
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

  const bevelThreshold = BEVEL_THRESHOLD[toolKind];
  const absAngle = Math.abs(toolPose.angleX);
  const bevelContact = absAngle <= bevelThreshold;

  // Catch: tool presented at steep angle without bevel support
  const catchOccurred = !bevelContact && absAngle > bevelThreshold * 2 && toolPose.pressure > 0.3;

  if (catchOccurred) {
    // Catches cause a sudden, large, uncontrolled removal + tearout spike
    const currentRadius = woodState.profile[stationIndex] ?? 0;
    const catchDepth = Math.min(currentRadius, 0.01);
    woodState.profile[stationIndex] = Math.max(0, currentRadius - catchDepth);
    woodState.tearout[stationIndex] = Math.min(1, (woodState.tearout[stationIndex] ?? 0) + 0.6);
    return { catch: true, materialRemoved: catchDepth * stationSpacing * Math.PI };
  }

  if (!bevelContact || toolPose.pressure <= 0) {
    return { catch: false, materialRemoved: 0 };
  }

  // Normal cut: depth proportional to pressure × dt, capped by max cut depth
  const depth = Math.min(
    MAX_CUT_DEPTH[toolKind] * toolPose.pressure * (dt / 0.016),
    woodState.profile[stationIndex] ?? 0
  );

  // Grain tearout: cutting against grain direction (simplified: negative angleY = against grain)
  const againstGrain = toolPose.angleY < -0.15;
  const tearoutDelta = againstGrain ? depth * 40 : 0;

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
