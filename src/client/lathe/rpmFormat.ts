/**
 * rpmFormat.ts — pure RPM display helper.
 *
 * Converts a raw rpm number (float) into a display string suitable for the
 * digital readout on the Jet JWL-1642EVS control panel.
 *
 * Rules:
 *  - Round to nearest integer.
 *  - Clamp negatives to 0 (the lathe does not spin backwards in this sim).
 *  - Return a plain decimal string with no padding — the canvas drawing code
 *    handles layout / right-alignment.
 */

/**
 * Format an RPM value for display.
 *
 * @param rpm  Raw spindle speed in revolutions per minute.
 * @returns    Integer string, minimum "0".
 *
 * @example
 *   formatRpm(1199.6)  // "1200"
 *   formatRpm(-5)      // "0"
 *   formatRpm(0)       // "0"
 *   formatRpm(3200)    // "3200"
 */
export function formatRpm(rpm: number): string {
  return String(Math.max(0, Math.round(rpm)));
}
