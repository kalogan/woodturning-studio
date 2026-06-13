/**
 * src/client/hands/index.ts — Public API for the first-person hands module.
 *
 * Exports:
 *  - FirstPersonHands  — R3F component: both hands in camera-relative space
 *  - Hand              — R3F component: a single parametric bare hand
 *  - HandPose          — type describing full hand articulation
 *  - FingerCurls       — type: per-finger curl ratios
 *  - RELAXED           — default pose constant
 *  - GRIP_TOOL         — both hands wrapped around a turning-tool handle
 *  - REACH_CONTROL     — index extended, reaching toward a button / dial
 *  - lerpPose          — pure pose interpolation helper
 *  - clampPoseValue    — pure clamp helper
 *  - clampFingerCurls  — pure finger-curl clamp helper
 *  - GrippingHands     — R3F component: two hands at explicit world offsets (TURNING)
 *  - ReachingHand      — R3F component: one hand at an explicit world position (AT_LATHE)
 */

export { FirstPersonHands } from './FirstPersonHands.js';
export { GrippingHands, ReachingHand } from './FirstPersonHands.js';
export { Hand } from './Hand.js';
export { RELAXED, GRIP_TOOL, REACH_CONTROL, lerpPose, clampPoseValue, clampFingerCurls } from './handPose.js';
export type { HandPose, FingerCurls } from './handPose.js';
