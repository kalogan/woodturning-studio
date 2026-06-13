/**
 * FirstPersonHands.tsx — Hand components for first-person lathe work.
 *
 * Exports three components:
 *
 *  1. FirstPersonHands — both hands in a camera-relative relaxed frame
 *     (original framing; used while walking / idle).
 *
 *  2. GrippingHands — two hands placed at explicit parent-local offsets,
 *     intended to be mounted INSIDE a tool group so they inherit the tool's
 *     transform and move with it (TURNING scene).
 *
 *  3. ReachingHand — a single hand placed at an explicit world position,
 *     reaching toward the headstock control panel (AT_LATHE scene).
 *
 * ── FirstPersonHands framing ──────────────────────────────────────────────────
 *   - Each hand is offset laterally (±X) from centre by ~12 cm.
 *   - Hands are placed forward (+Z) relative to the camera.
 *   - A downward offset (-Y) keeps the hands below eye level.
 *
 * USAGE (original):
 *     <PerspectiveCamera makeDefault>
 *       <FirstPersonHands />
 *     </PerspectiveCamera>
 *
 * POSE PROP:
 *   Pass a HandPose to animate both hands simultaneously.
 */

import { Hand } from './Hand.js';
import { RELAXED, GRIP_TOOL, REACH_CONTROL } from './handPose.js';
import type { HandPose } from './handPose.js';

// ── Placement constants ───────────────────────────────────────────────────────
// All values in metres (Three.js world units), camera-relative.

/**
 * How far forward (+Z in camera space) the hand group sits.
 * 0.35 m puts the hands at roughly arm-bend distance — they sit in
 * the lower centre of a 60–75° vertical FoV.
 */
const HAND_FORWARD_Z = 0.35;

/**
 * Downward offset from camera origin: places hands below the horizon line.
 * At 0.28 m below eye level the hands read as resting at tool-rest height.
 */
const HAND_DOWN_Y = -0.28;

/** Lateral offset — each hand spreads ±11 cm from centre. */
const HAND_LATERAL_X = 0.11;

/**
 * Inward yaw rotation (around Y) applied to each hand so the palms face
 * slightly inward toward the work, as in a natural gripping stance.
 * Positive = right hand turned counter-clockwise (palm faces left).
 */
const HAND_INWARD_YAW = 0.25; // radians (~14°)

/**
 * Slight downward tilt (around X) so the backs of the hands face up
 * and the palms face the work surface — relaxed pronated position.
 */
const HAND_PRONATION_X = 0.20; // radians (~11°)

// ── Props ─────────────────────────────────────────────────────────────────────

interface FirstPersonHandsProps {
  /** Pose applied to both hands. Defaults to RELAXED. */
  pose?: HandPose;
  /** Optional skin color override forwarded to both Hand components. */
  skinColor?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders both first-person bare hands in a relaxed viewing pose.
 * Mount inside the R3F Canvas, ideally as a child of the camera group.
 *
 * NOTE: The exact framing will need to be eyeballed in the browser
 * by the architect/director — no headless browser is available here.
 * The placement constants above are designed to be easy to tweak.
 */
export function FirstPersonHands({
  pose = RELAXED,
  skinColor,
}: FirstPersonHandsProps) {
  // Right hand: offset +X, palm angled inward (negative yaw rotates it left)
  const rightPosition: [number, number, number] = [
    HAND_LATERAL_X,
    HAND_DOWN_Y,
    HAND_FORWARD_Z,
  ];
  // Right hand rotation: slight pronation (X) + inward yaw (Y rotated slightly left)
  const rightRotation: [number, number, number] = [
    HAND_PRONATION_X,
    -HAND_INWARD_YAW,
    0,
  ];

  // Left hand: mirror of right — offset -X, yaw flipped
  const leftPosition: [number, number, number] = [
    -HAND_LATERAL_X,
    HAND_DOWN_Y,
    HAND_FORWARD_Z,
  ];
  const leftRotation: [number, number, number] = [
    HAND_PRONATION_X,
    HAND_INWARD_YAW,
    0,
  ];

  // Spread skinColor only when defined — required by exactOptionalPropertyTypes.
  const skinProps = skinColor !== undefined ? { skinColor } : {};

  return (
    <group>
      <Hand
        side="right"
        pose={pose}
        position={rightPosition}
        rotation={rightRotation}
        {...skinProps}
      />
      <Hand
        side="left"
        pose={pose}
        position={leftPosition}
        rotation={leftRotation}
        {...skinProps}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GrippingHands — two hands mounted inside the tool group (TURNING scene)
// ─────────────────────────────────────────────────────────────────────────────

// ── Director-tunable: GRIP hand offsets (tool-group–local space) ──────────────
//
// The tool handle is a ~0.28 m cylinder along the tool's local Y, handle end
// at -Y.  Both offsets below are in that same local space (Y = along handle).
//
// GRIP_REAR_OFFSET  — dominant/rear hand, near the butt of the handle.
//                     Negative Y = toward the butt; adjust to slide up/down.
//                     X/Z centre the hand on the handle shaft.
//
// GRIP_FRONT_OFFSET — guide/front hand, one hand-width forward of the rear.
//                     Less negative Y = closer to the blade end.
//
// GRIP_REAR_ROTATION  / GRIP_FRONT_ROTATION:
//   Euler [rx, ry, rz] so the palm faces down (pronation around X),
//   wrapping the handle shaft.  Wrist roll is already baked into GRIP_TOOL;
//   these rotate the whole hand group to orient it around the cylinder.
//   rz ≈ ±PI/2 aligns the palm perpendicular to the handle's Y axis.
//
// All six constants are FIRST-PASS DRAFT — tune freely on localhost:5173.
// ─────────────────────────────────────────────────────────────────────────────

/** Rear (dominant) hand — near the butt of the tool handle. Director-tunable. */
const GRIP_REAR_OFFSET: [number, number, number] = [0.0, -0.14, 0.0];

/** Front (guide) hand — further up the handle toward the blade. Director-tunable. */
const GRIP_FRONT_OFFSET: [number, number, number] = [0.0, -0.07, 0.0];

/**
 * Rotation for the rear (right) hand: palm wraps around the handle.
 * rz = -PI/2 orients the palm inward (toward the handle cylinder).
 * Director-tunable.
 */
const GRIP_REAR_ROTATION: [number, number, number] = [0, 0, -Math.PI / 2];

/**
 * Rotation for the front (left) hand: same orientation, mirrored naturally
 * by scale.x = -1 on the Hand component.  Director-tunable.
 */
const GRIP_FRONT_ROTATION: [number, number, number] = [0, 0, -Math.PI / 2];

// ── Props ─────────────────────────────────────────────────────────────────────

interface GrippingHandsProps {
  /** Optional skin color forwarded to both Hand components. */
  skinColor?: string;
  /** Override the grip pose (defaults to GRIP_TOOL). */
  pose?: HandPose;
}

/**
 * GrippingHands — mount INSIDE a tool group so both hands inherit the tool's
 * position + rotation and move with it.  Renders one rear (dominant/right) hand
 * and one front (guide/left) hand in GRIP_TOOL pose.
 *
 * Example:
 *   <group position={TOOL_REST_ANCHOR}>
 *     <ToolMesh ... />
 *     <GrippingHands />
 *   </group>
 */
export function GrippingHands({ skinColor, pose = GRIP_TOOL }: GrippingHandsProps) {
  const skinProps = skinColor !== undefined ? { skinColor } : {};

  return (
    <group>
      {/* Rear / dominant hand — right, near the butt of the handle */}
      <Hand
        side="right"
        pose={pose}
        position={GRIP_REAR_OFFSET}
        rotation={GRIP_REAR_ROTATION}
        {...skinProps}
      />
      {/* Front / guide hand — left, one hand-width toward the blade */}
      <Hand
        side="left"
        pose={pose}
        position={GRIP_FRONT_OFFSET}
        rotation={GRIP_FRONT_ROTATION}
        {...skinProps}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReachingHand — one hand reaching toward the control panel (AT_LATHE scene)
// ─────────────────────────────────────────────────────────────────────────────

// ── Director-tunable: reach hand placement (world space) ─────────────────────
//
// The headstock control panel sits at approximately world [0.15, 1.20, 0.15].
// The hand should hover in front of that panel, slightly below eye level and
// slightly toward the operator (+Z).
//
// REACH_HAND_POSITION: world-space [x, y, z] for the reaching hand.
//   X ≈ 0.15  — centred on the START button / speed dial
//   Y ≈ 1.10  — slightly below the panel centre (forearm naturally droops)
//   Z ≈ 0.35  — between the operator and the panel (~halfway)
//
// REACH_HAND_ROTATION: Euler [rx, ry, rz] orienting the hand toward the panel.
//   rx ≈ -PI/2  — wrist pitched forward so palm faces the panel (+Z direction)
//   ry ≈ 0      — no yaw (hand points straight at the panel face)
//   rz ≈ 0      — no roll
//
// All values are FIRST-PASS DRAFT — tune freely on localhost:5173.
// ─────────────────────────────────────────────────────────────────────────────

/** World-space position of the reaching hand. Director-tunable. */
const REACH_HAND_POSITION: [number, number, number] = [0.15, 1.10, 0.35];

/**
 * World-space Euler rotation of the reaching hand — pitched forward so the
 * palm/index faces the headstock control panel.  Director-tunable.
 */
const REACH_HAND_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReachingHandProps {
  /** Optional skin color forwarded to the Hand component. */
  skinColor?: string;
  /** Override the reach pose (defaults to REACH_CONTROL). */
  pose?: HandPose;
  /** World-space position override (defaults to REACH_HAND_POSITION). */
  position?: [number, number, number];
  /** World-space rotation override (defaults to REACH_HAND_ROTATION). */
  rotation?: [number, number, number];
}

/**
 * ReachingHand — a single right hand reaching toward the headstock control
 * panel (AT_LATHE scene).  Placed at a named world-space constant so the
 * director can nudge it without hunting through JSX.
 *
 * Static this pass — does not track the cursor.
 *
 * Example (inside AtLatheScene):
 *   <ReachingHand />
 */
export function ReachingHand({
  skinColor,
  pose = REACH_CONTROL,
  position = REACH_HAND_POSITION,
  rotation = REACH_HAND_ROTATION,
}: ReachingHandProps) {
  const skinProps = skinColor !== undefined ? { skinColor } : {};
  return (
    <Hand
      side="right"
      pose={pose}
      position={position}
      rotation={rotation}
      {...skinProps}
    />
  );
}
