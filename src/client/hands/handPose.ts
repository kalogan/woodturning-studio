/**
 * handPose.ts — Pure pose data and helpers for the first-person hand system.
 *
 * A HandPose describes the articulation of a single hand:
 *  - Per-finger curl (0 = fully open/extended, 1 = fully closed/fisted)
 *  - Thumb splay: extra outward spread of the thumb (0 = tucked, 1 = maximum splay)
 *  - Wrist pitch/yaw/roll in radians (relative to the arm's neutral orientation)
 *  - A 3D position offset and Euler orientation that the hand component reads as
 *    its local-space origin. Later slices can override these per-pose.
 *
 * All values are dimensionless ratios or radians — no Three.js types here.
 * This module must stay pure (no Date.now / Math.random / browser APIs).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Curl of a single finger: 0 = fully extended, 1 = fully curled into fist. */
export type FingerCurl = number;

/** Five-finger articulation. Index 0 = thumb, 1 = index, 2 = middle, 3 = ring, 4 = pinky. */
export interface FingerCurls {
  thumb: FingerCurl;
  index: FingerCurl;
  middle: FingerCurl;
  ring: FingerCurl;
  pinky: FingerCurl;
}

/**
 * Full pose for one hand.
 *
 * position: [x, y, z] local offset from the hand group's parent origin.
 * rotation: [rx, ry, rz] Euler angles (radians, XYZ order) for the whole hand.
 * fingerCurls: per-finger curl ratios.
 * thumbSplay: 0 = thumb tucked alongside index, 1 = thumb fully spread outward.
 * wristPitch: up/down wrist bend in radians (positive = palm faces up/dorsal flex).
 * wristYaw:   side-to-side bend in radians (positive = toward ulnar/pinky side).
 * wristRoll:  forearm rotation in radians (positive = supination, palm turns up).
 */
export interface HandPose {
  position: [number, number, number];
  rotation: [number, number, number];
  fingerCurls: FingerCurls;
  thumbSplay: number;
  wristPitch: number;
  wristYaw: number;
  wristRoll: number;
}

// ── Constants: Poses ──────────────────────────────────────────────────────────

/**
 * RELAXED: both hands hanging loosely forward, fingers slightly open,
 * as if the turner is about to reach for the tool rest. The slight curl
 * (~0.2) gives a natural, non-rigid appearance without looking like a fist.
 *
 * Position and rotation are a neutral origin; FirstPersonHands applies
 * per-hand offsets (left vs right, arm arc) on top of this.
 */
export const RELAXED: HandPose = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  fingerCurls: {
    thumb:  0.15,
    index:  0.20,
    middle: 0.22,
    ring:   0.25,
    pinky:  0.28,
  },
  thumbSplay: 0.35,   // thumb noticeably spread, comfortable resting splay
  wristPitch: 0.08,   // very slight dorsal extension — palms roughly face the work
  wristYaw:   0.0,
  wristRoll:  0.0,
};

/**
 * GRIP_TOOL: both hands wrapped around the turning-tool handle.
 *
 * Intent: the turner's grip on a ~28 mm diameter handle — fingers curl tightly
 * (0.80–0.90) to wrap the cylinder, thumb opposed and pressing in from the
 * radial side.  Wrist is in a neutral/slight pronation (palms roughly facing
 * the floor) as the tool rests on the tool rest bar.
 *
 * The position/rotation fields are zeroed here; TurningScene places each
 * hand at its own offset along the handle (GRIP_REAR / GRIP_FRONT constants).
 */
export const GRIP_TOOL: HandPose = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  fingerCurls: {
    thumb:  0.60, // thumb presses from radial side — less curled than fingers
    index:  0.82, // index wraps tightly
    middle: 0.88, // middle/ring carry most of the grip force
    ring:   0.88,
    pinky:  0.80, // pinky curls in at the butt of the handle
  },
  thumbSplay: 0.10, // thumb drawn in toward the handle, not spread
  wristPitch: 0.05, // nearly neutral — tool rest dictates angle
  wristYaw:   0.0,
  wristRoll:  0.15, // slight pronation — palms angled toward the floor
};

/**
 * REACH_CONTROL: one hand extended toward the headstock control panel —
 * as if the turner is about to press the START button or pinch the speed dial.
 *
 * Intent: index finger extends and points (curl ≈ 0.10) to hover near a button;
 * remaining fingers are softly curled (0.45–0.60) in a relaxed open-pinch shape;
 * thumb is slightly opposed and extended to balance the hand.
 * Wrist angled slightly forward (upward pitch) as the arm reaches out.
 */
export const REACH_CONTROL: HandPose = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  fingerCurls: {
    thumb:  0.20, // thumb out, lightly extended to counter the index
    index:  0.10, // index almost fully extended — pointing/pressing
    middle: 0.50, // middle gently curled — not gripping, not stiff
    ring:   0.55,
    pinky:  0.60,
  },
  thumbSplay: 0.40, // thumb spread outward naturally
  wristPitch: -0.15, // slight dorsal extension — wrist angled as arm reaches forward
  wristYaw:    0.05,
  wristRoll:   0.10, // mild pronation — palm faces slightly down as arm extends
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Clamp a number into [min, max] (inclusive).
 * Deterministic; no side-effects.
 */
export function clampPoseValue(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Linearly interpolate between two HandPose values (for smooth transitions).
 * t = 0 → a, t = 1 → b. t is clamped to [0, 1].
 * Returns a new object; never mutates a or b.
 */
export function lerpPose(a: HandPose, b: HandPose, t: number): HandPose {
  const tc = clampPoseValue(t, 0, 1);
  const lerp = (x: number, y: number) => x + (y - x) * tc;

  return {
    position: [
      lerp(a.position[0], b.position[0]),
      lerp(a.position[1], b.position[1]),
      lerp(a.position[2], b.position[2]),
    ],
    rotation: [
      lerp(a.rotation[0], b.rotation[0]),
      lerp(a.rotation[1], b.rotation[1]),
      lerp(a.rotation[2], b.rotation[2]),
    ],
    fingerCurls: {
      thumb:  lerp(a.fingerCurls.thumb,  b.fingerCurls.thumb),
      index:  lerp(a.fingerCurls.index,  b.fingerCurls.index),
      middle: lerp(a.fingerCurls.middle, b.fingerCurls.middle),
      ring:   lerp(a.fingerCurls.ring,   b.fingerCurls.ring),
      pinky:  lerp(a.fingerCurls.pinky,  b.fingerCurls.pinky),
    },
    thumbSplay:  lerp(a.thumbSplay,  b.thumbSplay),
    wristPitch:  lerp(a.wristPitch,  b.wristPitch),
    wristYaw:    lerp(a.wristYaw,    b.wristYaw),
    wristRoll:   lerp(a.wristRoll,   b.wristRoll),
  };
}

/**
 * Clamp all curl values in a FingerCurls object to [0, 1].
 * Returns a new object.
 */
export function clampFingerCurls(curls: FingerCurls): FingerCurls {
  return {
    thumb:  clampPoseValue(curls.thumb,  0, 1),
    index:  clampPoseValue(curls.index,  0, 1),
    middle: clampPoseValue(curls.middle, 0, 1),
    ring:   clampPoseValue(curls.ring,   0, 1),
    pinky:  clampPoseValue(curls.pinky,  0, 1),
  };
}
