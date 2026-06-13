/**
 * Lathe — fully assembled Jet JWL-1642EVS.
 *
 * Layout convention:
 *   +X  = lathe axis, toward tailstock (right)
 *   -X  = toward headstock (left)
 *   +Y  = up
 *   +Z  = toward operator (front of machine)
 *
 * The bed runs the full length along X, centred at X=0.
 * Headstock is fixed at the left (-X) end; tailstock at the right (+X) end.
 * betweenCenters = 1.0668 m — drive-center tip to live-center tip.
 */
import { useMemo } from 'react';
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { Bed } from './Bed.js';
import { Headstock } from './Headstock.js';
import { Tailstock } from './Tailstock.js';
import { Banjo } from './Banjo.js';
import { ToolRest } from './ToolRest.js';
import { DriveCenter } from './DriveCenter.js';
import { LiveCenter } from './LiveCenter.js';
import { Stand } from './Stand.js';

interface LatheProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** 0..1 quill extension for the tailstock */
  quillExtension?: number;
  /**
   * When true, renders a placeholder cylinder blank between the centers so you can
   * verify that the spacing is correct and a blank would sit properly.
   */
  defaultBlankVisible?: boolean;
  /** When false, hides the floor stand (default true). */
  standVisible?: boolean;
}

export function Lathe({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  quillExtension = 0,
  defaultBlankVisible = false,
  standVisible = true,
}: LatheProps) {
  const {
    bed,
    headstock,
    tailstock,
    banjo,
    toolRest,
    driveCenter,
    liveCenter,
    betweenCenters,
    stand,
  } = spec;

  // ── Bed ────────────────────────────────────────────────────────────────────
  // Bed slab is centred at X=0, raised so its bottom sits at Y=0.
  const bedY = bed.thickness / 2;
  // Top surface of bed ways = bottom of slab centre + half slab + way height
  const bedTopY = bed.thickness / 2 + bed.wayHeight;

  // Left extreme of the bed along X
  const bedLeftX = -bed.length / 2;

  // ── Headstock ──────────────────────────────────────────────────────────────
  // The Headstock component's internal origin is at its left face (X=0 in its local space).
  // We place the group so that left face aligns with the left end of the bed.
  const headstockGroupX = bedLeftX;

  // The spindle nose FACE (where drive center emerges) in world X:
  //   bed left + headstock body width + spindle nose protrusion
  const headstockSpindleFaceX = bedLeftX + headstock.width + headstock.spindleNoseLength;

  // Spindle axis height above bed surface (bed Y=0 local → bedTopY in machine local)
  const spindleY = bedTopY + headstock.spindleHeight;

  // ── Drive Center ───────────────────────────────────────────────────────────
  // Drive center body centre sits at spindle face + half body length
  const driveCenterX = headstockSpindleFaceX + driveCenter.length / 2;

  // Drive center tip (spur contact point) = face + body length + center point length
  const driveCenterTipX = headstockSpindleFaceX + driveCenter.length + driveCenter.centerPointLength;

  // ── Tailstock ──────────────────────────────────────────────────────────────
  // betweenCenters is tip-to-tip distance
  const liveCenterTipX = driveCenterTipX + betweenCenters;

  // Live center body centre
  const liveCenterX = liveCenterTipX - liveCenter.length / 2;

  // Tailstock body: its left face coincides with the base of the live center taper
  const tailstockLeftFaceX = liveCenterTipX - liveCenter.length;
  const tailstockCentreX   = tailstockLeftFaceX + tailstock.width / 2;

  // ── Banjo + ToolRest ───────────────────────────────────────────────────────
  // Placed ~40% of the way along the between-centers span for a nice mid-span look
  const banjoCentreX = headstockSpindleFaceX + betweenCenters * 0.4;

  // Banjo straddles the bed ways, centred on the bed's Z axis.
  const banjoCentreZ = 0;

  // Tool rest post base = bed top surface + banjo block height
  const toolRestBaseY = bedTopY + banjo.height;

  // Desired rest bar top = spindle axis height (so tool rests at working height).
  // barTop = toolRestBaseY + postH + barDiameter
  // → postH = spindleY - toolRestBaseY - toolRest.barDiameter
  const toolRestPostH = spindleY - toolRestBaseY - toolRest.barDiameter;

  // ── Blank placeholder ──────────────────────────────────────────────────────
  // Use a practical radius well within swingRadius (0.2032); 0.07 gives visible presence.
  const blankRadius  = 0.07;
  // Blank spans tip-to-tip so both centers visibly engage the wood.
  const blankLength  = betweenCenters;
  const blankCentreX = driveCenterTipX + betweenCenters / 2;

  const blankArgs = useMemo(
    () => [blankRadius, blankRadius, blankLength, 24] as [number, number, number, number],
    [blankRadius, blankLength],
  );

  // ── Stand lift ────────────────────────────────────────────────────────────
  // Bed bottom (Y=0 in machine-local space) sits on top of the stand's top plate.
  const machineY = stand.legHeight + stand.topPlateThickness;

  return (
    <group position={position} rotation={rotation}>
      {/* ── Stand ── floor level, Y=0 at floor */}
      {standVisible && <Stand />}

      {/* ── Machine assembly ── raised so bed bottom sits on stand top plate */}
      <group position={[0, machineY, 0]}>
        {/* ── Bed ── centred at X=0, raised so bottom is at Y=0 */}
        <Bed position={[0, bedY, 0]} />

        {/* ── Headstock ── left end of bed; internal origin = headstock left face */}
        <Headstock position={[headstockGroupX, bedTopY, 0]} />

        {/* ── Drive Center ── in headstock spindle, pointing +X */}
        <DriveCenter position={[driveCenterX, spindleY, 0]} />

        {/* ── Tailstock ── toward right end, rotated 180° so quill faces headstock */}
        <Tailstock
          position={[tailstockCentreX, bedTopY, 0]}
          rotation={[0, Math.PI, 0]}
          quillExtension={quillExtension}
        />

        {/* ── Live Center ── in tailstock quill, pointing -X (toward headstock) */}
        <LiveCenter
          position={[liveCenterX, spindleY, 0]}
          rotation={[0, Math.PI, 0]}
        />

        {/* ── Banjo ── straddles the bed ways, centred on Z=0 */}
        <Banjo position={[banjoCentreX, bedTopY, banjoCentreZ]} />

        {/* ── Tool Rest ── bar top at spindle height, offset toward the operator
            so the post and rail clear the blank surface (blank radius + clearance) */}
        <ToolRest
          position={[
            banjoCentreX,
            toolRestBaseY,
            banjoCentreZ + blankRadius + toolRest.barDiameter,
          ]}
          height={toolRestPostH}
        />

        {/* ── Optional blank placeholder ── for verifying center spacing */}
        {defaultBlankVisible && (
          <mesh position={[blankCentreX, spindleY, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={blankArgs} />
            <meshStandardMaterial color="#c8a96e" roughness={0.8} metalness={0.0} />
          </mesh>
        )}
      </group>
    </group>
  );
}
