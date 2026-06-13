/**
 * proximity.ts — Pure XZ-plane proximity logic for workshop ↔ lathe transitions.
 *
 * PURE module: no Three.js, no React, no browser APIs.
 * Fully unit-testable in Node.
 */

/** Distance threshold to enter AT_LATHE from WORKSHOP_WALK (meters). */
export const ENTER_LATHE_DISTANCE = 0.8;

/** Distance threshold to leave AT_LATHE back to WORKSHOP_WALK (meters). */
export const LEAVE_LATHE_DISTANCE = 1.2;

/** The two proximity-governed scene states. */
export type ProximityZone = 'WORKSHOP_WALK' | 'AT_LATHE';

/**
 * Euclidean distance on the XZ plane (ignores Y/height).
 */
export function horizontalDistance(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Returns the next proximity zone given the current zone and the player's
 * horizontal distance to the tool rest.
 *
 * Hysteresis dead-band [0.8, 1.2] prevents state flapping:
 *   - WORKSHOP_WALK → AT_LATHE only when distance < ENTER_LATHE_DISTANCE (0.8 m)
 *   - AT_LATHE → WORKSHOP_WALK only when distance > LEAVE_LATHE_DISTANCE (1.2 m)
 *   - In the dead-band (0.8–1.2 m): current zone is preserved regardless of direction.
 */
export function nextProximityZone(
  current: ProximityZone,
  distance: number,
): ProximityZone {
  if (current === 'WORKSHOP_WALK' && distance < ENTER_LATHE_DISTANCE) {
    return 'AT_LATHE';
  }
  if (current === 'AT_LATHE' && distance > LEAVE_LATHE_DISTANCE) {
    return 'WORKSHOP_WALK';
  }
  return current;
}
