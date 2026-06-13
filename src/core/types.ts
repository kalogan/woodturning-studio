// Shared pure types — no imports from outside core

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Normalized tool pose emitted by every input adapter. */
export interface ToolPose {
  position: Vec3;
  /** Radians — positive = tip angled up */
  angleX: number;
  /** Radians — yaw left/right */
  angleY: number;
  /** 0–1 normalised contact pressure */
  pressure: number;
}

/** Radial profile of the wood blank — array of radius values at evenly-spaced Z stations. */
export type WoodProfile = Float32Array;

export interface WoodState {
  /** Blank length in meters */
  length: number;
  /** Original (max) radius at each station */
  originalProfile: WoodProfile;
  /** Current radius at each station (mutated by physics) */
  profile: WoodProfile;
  /** Cumulative tearout severity per station (0 = clean, 1 = severe) */
  tearout: Float32Array;
}

export type ToolKind = 'roughing-gouge' | 'spindle-gouge' | 'parting-tool';

export interface PhysicsResult {
  /** Whether a catch occurred this tick */
  catch: boolean;
  /** Estimated material removed this tick (m³) */
  materialRemoved: number;
}

/** Normalized first-person walk input. */
export interface FPSInput {
  forward: number;   // -1 (back) .. 1 (forward)
  strafe: number;    // -1 (left) .. 1 (right)
  yaw: number;       // accumulated horizontal look, radians
  pitch: number;     // accumulated vertical look, radians (clamped ±~1.5)
  interact: boolean; // E key pressed this frame (edge-triggered)
}
