/**
 * mountPoints.ts — pure (no JSX, no Three.js) helpers that expose the world
 * positions of the three mountable accessories on the Jet JWL-1642EVS.
 *
 * The positions are computed from the SAME layout math used by Lathe.tsx so
 * that a later interaction slice can place proximity targets at exactly the
 * right spot without duplicating the arithmetic.
 *
 * Coordinate convention (matches Lathe.tsx):
 *   +X  = lathe axis, toward tailstock (right)
 *   -X  = toward headstock (left)
 *   +Y  = up
 *   +Z  = toward operator (front of machine)
 *
 * NOTE: These are positions in the machine's LOCAL space (i.e. relative to the
 * Lathe group origin [0,0,0]).  If the Lathe is placed at a non-zero position
 * in the world, callers must add the group translation themselves.
 *
 * No per-call heap allocation beyond the single plain-object return.
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';

const {
  bed,
  headstock,
  tailstock,
  toolRest,
  driveCenter,
  liveCenter,
  betweenCenters,
  stand,
} = spec;

// ── Machine lift (same as in Lathe.tsx) ─────────────────────────────────────
const machineY = stand.legHeight + stand.topPlateThickness;

// ── Bed geometry ─────────────────────────────────────────────────────────────
const bedTopY   = bed.thickness / 2 + bed.wayHeight;
const bedLeftX  = -bed.length / 2;

// ── Headstock / spindle ───────────────────────────────────────────────────────
const headstockSpindleFaceX = bedLeftX + headstock.width + headstock.spindleNoseLength;
const spindleY              = bedTopY + headstock.spindleHeight;

// ── Drive center (spur drive) tip — "headstock-spindle" mount point ───────────
const driveCenterTipX = headstockSpindleFaceX + driveCenter.length + driveCenter.centerPointLength;

// ── Live center tip — "tailstock-quill" mount point ──────────────────────────
const liveCenterTipX = driveCenterTipX + betweenCenters;
// Tailstock left face
const tailstockLeftFaceX = liveCenterTipX - liveCenter.length;
const tailstockCentreX   = tailstockLeftFaceX + tailstock.width / 2;

// ── Banjo / tool-rest — "bed" mount point ─────────────────────────────────────
const banjoCentreX  = headstockSpindleFaceX + betweenCenters * 0.4;
const banjoCentreZ  = 0;
const BLANK_SIDE    = 0.12; // matches Lathe.tsx constant
const blankHalfSide = BLANK_SIDE / 2;
// Bar-top Y = bedTopY + banjoHeight + postH + barDiameter = spindleY (by construction in Lathe.tsx)
const toolRestBarTopY = spindleY;

/**
 * Mount-point key type for the three mountable accessories.
 *  'headstock-spindle' — where the spur / drive centre is inserted.
 *  'tailstock-quill'   — where the live centre sits.
 *  'bed'               — where the banjo + tool-rest assembly sits.
 */
export type MountPointKey = 'headstock-spindle' | 'tailstock-quill' | 'bed';

/**
 * Returns the world-space [x, y, z] positions for the three accessory mount
 * points, expressed in the Lathe group's LOCAL coordinate space (Lathe origin
 * at [0,0,0]).
 *
 * Pure function — no heap allocation beyond the returned object literal.
 */
export function getMountPointWorldPositions(): Record<MountPointKey, [number, number, number]> {
  // All Y values are relative to the machine group, which is lifted by machineY.
  const worldSpindleY        = machineY + spindleY;
  const worldToolRestBarTopY = machineY + toolRestBarTopY;

  return {
    // Drive-center tip: the exact spur contact point in machine local space.
    'headstock-spindle': [driveCenterTipX, worldSpindleY, 0],

    // Live-center tip (quill end): mirror of the drive-center tip across betweenCenters.
    'tailstock-quill': [liveCenterTipX, worldSpindleY, 0],

    // Banjo centre / tool-rest: XZ position of the banjo block, Y = bar top.
    'bed': [
      banjoCentreX,
      worldToolRestBarTopY,
      banjoCentreZ + blankHalfSide + toolRest.barDiameter,
    ],
  };
}

/**
 * Returns the tailstock body centre X position in machine-local space.
 * Exposed so tests can verify the headstock→tailstock ordering along X.
 */
export const TAILSTOCK_CENTRE_X = tailstockCentreX;

/**
 * Returns the drive-center tip X position in machine-local space.
 */
export const DRIVE_CENTER_TIP_X = driveCenterTipX;
