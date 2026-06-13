/**
 * src/client/hands/index.ts — Public API for the first-person hands module.
 *
 * Exports:
 *  - FirstPersonHands  — R3F component: both hands in camera-relative space
 *  - Hand              — R3F component: a single parametric bare hand
 *  - HandPose          — type describing full hand articulation
 *  - FingerCurls       — type: per-finger curl ratios
 *  - RELAXED           — default pose constant
 *  - lerpPose          — pure pose interpolation helper
 *  - clampPoseValue    — pure clamp helper
 *  - clampFingerCurls  — pure finger-curl clamp helper
 */

export { FirstPersonHands } from './FirstPersonHands.js';
export { Hand } from './Hand.js';
export { RELAXED, lerpPose, clampPoseValue, clampFingerCurls } from './handPose.js';
export type { HandPose, FingerCurls } from './handPose.js';
