/**
 * FirstPersonHands.tsx — Both hands in a relaxed first-person frame.
 *
 * FRAMING INTENT:
 *   First-person lathe work: arms come up from below the view, hands forward,
 *   palms roughly facing each other / facing the work, at roughly "lower third"
 *   of the viewport (the lathe tool rest height).
 *
 *   - Each hand is offset laterally (±X) from centre by ~12 cm.
 *   - Hands are placed forward (+Z) relative to the camera so the fingers
 *     appear in the lower portion of the view.
 *   - Palms face inward/forward — an overall Y rotation of ~±15° on each arm.
 *   - A downward offset (-Y) keeps the hands below eye level.
 *
 * USAGE:
 *   Mount this component as a child of a group that tracks the camera (e.g. the
 *   camera's forward vector group). The hands will appear in a fixed camera-
 *   relative position. The calling parent (T2b / T4) should attach this via
 *   a <group> parented to the camera's quaternion — example:
 *
 *     <PerspectiveCamera makeDefault>
 *       <FirstPersonHands />
 *     </PerspectiveCamera>
 *
 *   or equivalently via a camera-attached group in the scene state machine.
 *
 * POSE PROP:
 *   Pass a HandPose to animate both hands simultaneously.
 *   Per-hand pose overrides (T4) can be wired by extending this component —
 *   the architecture is left open (leftPose / rightPose props are a natural next
 *   step once the specific interaction poses are designed).
 */

import { Hand } from './Hand.js';
import { RELAXED } from './handPose.js';
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
