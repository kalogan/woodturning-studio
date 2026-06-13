/**
 * Visual spin rate (revolutions / second) for the spinning blank.
 *
 * The LITERAL spindle rate (rpm / 60 rev/s) ALIASES badly on a 60 fps display.
 * A square blank has 90° rotational symmetry, so its apparent motion hits the
 * Nyquist limit at only ~7.5 rev/s (≈ 450 rpm at 60 fps). Above that the spin
 * "wagon-wheels": HIGHER rpm reads SLOWER, the same, or backwards — exactly
 * backwards from what we want.
 *
 * So instead of the literal rate we COMPRESS the full [0, maxRpm] speed range onto
 * a perceptible [0, MAX_VISUAL_REV_PER_SEC] that stays below the aliasing threshold.
 * This trades absolute-speed realism (a real lathe at 2000+ rpm is an indistinct
 * blur anyway) for correct RELATIVE ordering: 400 < 1000 < 2000 always look
 * progressively faster, monotonically.
 *
 * Pure + deterministic — unit-tested in spinRate.test.ts.
 */

/** Max on-screen spin (rev/s) at maxRpm. ~36°/frame @60fps for a square — fast but
 *  below the ~45°/frame wagon-wheel threshold. Director-tunable. */
export const MAX_VISUAL_REV_PER_SEC = 6.0;

/**
 * Map a spindle rpm to the on-screen revolutions-per-second the blank should rotate at.
 * Linear + monotonic over [0, maxRpm]; clamped; 0 at rest.
 */
export function visualSpinRevPerSec(rpm: number, maxRpm: number): number {
  if (maxRpm <= 0) return 0;
  const t = Math.max(0, Math.min(rpm / maxRpm, 1));
  return t * MAX_VISUAL_REV_PER_SEC;
}
