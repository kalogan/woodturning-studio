/**
 * dialAngle.ts — pure helper for the radial speed dial angle mapping.
 *
 * The speed dial is a RADIAL DIAL with a 270° arc:
 *   - Pointer points DOWN  (toward bottom of arc) at 0 rpm ("OFF").
 *   - Pointer sweeps CLOCKWISE to max RPM.
 *
 * In Three.js, rotation.z is CCW-positive.  The white pointer is rendered at
 * local +Y on the knob face.  So:
 *   t = 0   → rotation.z = +HALF_SWEEP_RAD  (CCW offset → pointer faces down)
 *   t = 1   → rotation.z = −HALF_SWEEP_RAD  (full CW swing from the offset)
 *
 * ARC_SWEEP_DEG = 270°  → ARC_SWEEP_RAD = 4.712 rad
 * HALF_SWEEP_RAD        = 2.356 rad
 */

const ARC_SWEEP_DEG  = 270;
const ARC_SWEEP_RAD  = (ARC_SWEEP_DEG * Math.PI) / 180; // ~4.712
const HALF_SWEEP_RAD = ARC_SWEEP_RAD / 2;               // ~2.356

/**
 * Map a normalised dial position to Three.js rotation.z.
 *
 * @param t  Normalised position in [0, 1] — 0 = OFF (min rpm), 1 = max rpm.
 * @returns  rotation.z in radians.
 *
 * @example
 *   dialAngleFromT(0)   // +HALF_SWEEP_RAD (~+2.356) — pointer at bottom (OFF)
 *   dialAngleFromT(0.5) // 0                          — pointer at top (mid speed)
 *   dialAngleFromT(1)   // −HALF_SWEEP_RAD (~−2.356)  — pointer at max end
 */
export function dialAngleFromT(t: number): number {
  return HALF_SWEEP_RAD - t * ARC_SWEEP_RAD;
}

export { ARC_SWEEP_RAD, HALF_SWEEP_RAD, ARC_SWEEP_DEG };
