import { useFrame } from '@react-three/fiber';
import { tickPhysics } from '../../core/physics.js';
import type { WoodState, ToolPose, ToolKind, PhysicsResult, SpeciesCutProfile } from '../../core/types.js';
import { setCutIntensity, cutIntensityFromRemoval } from '../audio/cutting.js';
import { emit } from '../audio/events.js';

// ─── Contact gate constants ────────────────────────────────────────────────────
//
// These mirror the rig geometry in TurningScene.tsx so the contact gate can
// determine whether the tool tip has been lowered onto the spinning blank.
//
// TOOL_REST_ANCHOR_Y — Y component of TOOL_REST_ANCHOR in TurningScene.tsx.
//   The tool group is anchored at this Y offset below the spindle centre.
//   Must stay in sync with TOOL_REST_ANCHOR[1] in TurningScene.tsx.
//
// CONTACT_TOLERANCE — extra metres added to the blank radius when testing for
//   contact.  Gives a small "snap" zone at the surface so the cut engages
//   cleanly without pixel-perfect placement.  2 mm is barely perceptible
//   visually but removes flicker at the exact surface boundary.
//
// Contact fires when:
//   tipY  =  TOOL_REST_ANCHOR_Y + toolPose.position.y
//   tipY  <=  profile[station] + CONTACT_TOLERANCE
//
// Examples (fresh blank: profile = 0.05 m):
//   pose.y = 0 (mouse at centre)    → tipY = -0.010 ≤ 0.052 → IN CONTACT ✓
//   pose.y = +0.060                 → tipY = +0.050 ≤ 0.052 → IN CONTACT (surface)
//   pose.y = +0.065                 → tipY = +0.055 > 0.052 → ABOVE WOOD ✓
//   pose.y = +0.130 (mouse at top)  → tipY = +0.120 > 0.052 → ABOVE WOOD ✓
//
// Tune TOOL_REST_ANCHOR_Y here if the tool rest height in TurningScene changes.
// Tune CONTACT_TOLERANCE to widen/narrow the surface snap zone.
//
const TOOL_REST_ANCHOR_Y = -0.01;   // TUNABLE — must match TOOL_REST_ANCHOR[1] in TurningScene.tsx
const CONTACT_TOLERANCE  =  0.002;  // TUNABLE — metres; snap zone at blank surface

interface PhysicsLoopProps {
  woodState: WoodState;
  toolPose: ToolPose;
  toolKind: ToolKind;
  /** Current lathe spindle speed in RPM — passed to tickPhysics for the RPM gate.
   *  When 0 or negative the blank is stopped: tickPhysics returns no-cut, no-catch. */
  rpm: number;
  /** Per-(species,tool) cut-feel multipliers. Pass undefined to use the neutral identity profile. */
  cutProfile: SpeciesCutProfile | undefined;
  onResult: (r: PhysicsResult) => void;
}

export function PhysicsLoop({ woodState, toolPose, toolKind, rpm, cutProfile, onResult }: PhysicsLoopProps) {
  useFrame((_, delta) => {
    // ── Contact gate ─────────────────────────────────────────────────────────
    // Replicate the station-index formula from tickPhysics so we can read the
    // blank's current radius at the active station.  Pure arithmetic — no heap
    // allocation.  If the tool tip is above the blank surface, skip the tick
    // entirely (no cut, no catch, no sound).
    const stations = woodState.profile.length;
    const stationIndex = Math.round(
      ((toolPose.position.z + woodState.length / 2) / woodState.length) * (stations - 1)
    );
    const inBounds = stationIndex >= 0 && stationIndex < stations;

    let inContact = false;
    if (inBounds) {
      const surfaceRadius = woodState.profile[stationIndex] ?? 0;
      const tipY = TOOL_REST_ANCHOR_Y + toolPose.position.y;
      inContact = tipY <= surfaceRadius + CONTACT_TOLERANCE;
    }

    if (!inContact) {
      // Tool is above the wood — drive sound to silence and bail.
      setCutIntensity(0);
      onResult({ catch: false, materialRemoved: 0 });
      return;
    }

    // ── Physics tick (only when in contact) ──────────────────────────────────
    // Pass dt in seconds (R3F delta is already seconds).  rpm gates the tick
    // internally: blank stopped → no-cut, no-catch.
    // catch / tearout / cutProfile / speedFactor all still apply here.
    const result = tickPhysics(woodState, toolPose, toolKind, delta, cutProfile, rpm);
    onResult(result);

    // Drive cutting sound — safe no-op when no AudioContext (jsdom / before unlock).
    setCutIntensity(cutIntensityFromRemoval(result.materialRemoved));

    // Fire catch one-shot on a tool catch event.
    if (result.catch) {
      emit('catch');
    }
  });

  return null;
}
