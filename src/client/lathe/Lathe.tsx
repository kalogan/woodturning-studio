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
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { useLatheStore } from '../../workshop/index.js';
import { visualSpinRevPerSec } from './spinRate.js';
import { Bed } from './Bed.js';
import { Headstock } from './Headstock.js';
import { Tailstock } from './Tailstock.js';
import { Banjo } from './Banjo.js';
import { ToolRest } from './ToolRest.js';
import { DriveCenter } from './DriveCenter.js';
import { LiveCenter } from './LiveCenter.js';
import { Stand } from './Stand.js';

/**
 * Controls which of the three mountable accessories are rendered.
 * Every flag defaults to `true` so that omitting `mounted` entirely keeps the
 * lathe fully assembled (back-compat — no existing caller needs to change).
 *
 * Set a flag to `false` to hide that part, e.g. for Lesson 0 "Set Up Your
 * Lathe" where the player mounts each accessory one by one.
 */
export interface MountedProps {
  /** Drive center (spur drive) in the headstock spindle. Default: true. */
  spurDrive?: boolean;
  /** Live center in the tailstock quill. Default: true. */
  liveCenter?: boolean;
  /** Tool rest (banjo block + post + bar). Default: true. */
  toolRest?: boolean;
}

interface LatheProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** 0..1 quill extension for the tailstock */
  quillExtension?: number;
  /**
   * When true, renders a square un-roughed stock blank between the centers (Lesson 1
   * "From Square to Round").  Sized to fit without clipping the tailstock.
   */
  defaultBlankVisible?: boolean;
  /** When false, hides the floor stand (default true). */
  standVisible?: boolean;
  /**
   * Controls which of the three mountable accessories are rendered.
   * Omitting this prop (or omitting individual flags) renders all parts —
   * existing callers are fully backwards-compatible.
   */
  mounted?: MountedProps;
}

export function Lathe({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  quillExtension = 0,
  defaultBlankVisible = false,
  standVisible = true,
  mounted,
}: LatheProps) {
  // Resolve per-accessory flags; default to true (show) when omitted.
  const showSpurDrive  = mounted?.spurDrive  !== false;
  const showLiveCenter = mounted?.liveCenter !== false;
  const showToolRest   = mounted?.toolRest   !== false;
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
  // Lesson 1 is "From Square to Round" — the starting blank is SQUARE cross-section
  // stock (a long rectangular prism), not a cylinder.  A spinning square reads as
  // obviously un-turned stock; the rotating corners make speed visible without
  // needing grain-streak children.
  //
  // TUNABLE CONSTANTS — adjust these to dial in the visual feel:
  //
  //   BLANK_SIDE       square cross-section side length (m) — chunky 3×3" nominal stock
  const BLANK_SIDE = 0.12;
  //   BLANK_TAILSTOCK_GAP  gap (m) between the blank's right end and the TAILSTOCK
  //                    BODY's left face, so the square stock can't clip into the
  //                    tailstock.  Anchor to the body face (tailstockLeftFaceX, computed
  //                    above) — NOT the live-center tip, which sits close to / inside the
  //                    tailstock in this model.  The drive-center (left) end is a spur
  //                    that penetrates the wood, so no gap is needed there.
  const BLANK_TAILSTOCK_GAP = 0.03; // 30 mm clear of the tailstock body face
  //
  // TODO (future): let the player slide the tailstock in toward the headstock to clamp
  //   shorter blanks; then this gap closes and the live center engages the blank's end.
  const blankRightEndX = tailstockLeftFaceX - BLANK_TAILSTOCK_GAP;
  // Left end flush with the drive-center tip; right end stops clear of the tailstock.
  const blankLength  = blankRightEndX - driveCenterTipX;
  const blankCentreX = (driveCenterTipX + blankRightEndX) / 2;
  // Half-side used for tool-rest Z clearance (conservative — corner reach = BLANK_SIDE*√2/2).
  const blankHalfSide = BLANK_SIDE / 2;

  // ── Blank spin (imperative, no per-frame re-render, no per-frame alloc) ──
  // The group wraps the square blank box; rotation.x drives spin about the spindle
  // (X) axis.  The box mesh has no rotation of its own — the group handles it all.
  // A spinning square makes RPM obviously visible via its sweeping corners.
  const blankGroupRef = useRef<THREE.Group | null>(null);

  useFrame((_, dt) => {
    const group = blankGroupRef.current;
    if (group === null) return;
    const store = useLatheStore.getState();
    // COMPRESSED visual spin rate (not literal rpm/60) so the spinning square doesn't
    // alias/wagon-wheel at 60fps — keeps 400<1000<2000 monotonic. See spinRate.ts.
    group.rotation.x += visualSpinRevPerSec(store.currentRpm, store.maxRpm) * (2 * Math.PI) * dt;
  });

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

        {/* ── Drive Center ── in headstock spindle, pointing +X
            Gated: hidden when mounted.spurDrive === false (bare-lathe state). */}
        {showSpurDrive && <DriveCenter position={[driveCenterX, spindleY, 0]} />}

        {/* ── Tailstock ── toward right end, rotated 180° so quill faces headstock */}
        <Tailstock
          position={[tailstockCentreX, bedTopY, 0]}
          rotation={[0, Math.PI, 0]}
          quillExtension={quillExtension}
        />

        {/* ── Live Center ── in tailstock quill, pointing -X (toward headstock)
            Gated: hidden when mounted.liveCenter === false. */}
        {showLiveCenter && (
          <LiveCenter
            position={[liveCenterX, spindleY, 0]}
            rotation={[0, Math.PI, 0]}
          />
        )}

        {/* ── Banjo + Tool Rest ── toggled together via mounted.toolRest.
            The banjo is the clamping block that sits on the bed; the tool rest
            post+bar slots into it.  They are always co-present in real use, so
            we treat them as a single logical "tool rest" mount point.
            When showToolRest is false, both are hidden. */}
        {showToolRest && (
          <Banjo position={[banjoCentreX, bedTopY, banjoCentreZ]} />
        )}
        {showToolRest && (
          <ToolRest
            position={[
              banjoCentreX,
              toolRestBaseY,
              banjoCentreZ + blankHalfSide + toolRest.barDiameter,
            ]}
            height={toolRestPostH}
          />
        )}

        {/* ── Optional blank placeholder ── square un-roughed stock             */}
        {/* Lesson 1 is "From Square to Round" — mount a SQUARE cross-section    */}
        {/* prism so the player clearly sees un-turned stock before they cut.     */}
        {/* The spinning square corners make RPM visible; no grain streaks needed.*/}
        {/* Wrapped in a ref group; useFrame (above) rotates the group about X   */}
        {/* at (currentRpm/60)*2π rad/s — imperative, no per-frame allocation.  */}
        {defaultBlankVisible && (
          <group ref={blankGroupRef} position={[blankCentreX, spindleY, 0]}>
            {/* Square prism: X = spindle axis (length), Y/Z = square cross-section */}
            <mesh>
              <boxGeometry args={[blankLength, BLANK_SIDE, BLANK_SIDE]} />
              {/* Warm amber-tan: pine-like sapwood tone so the square stock
                  visually reads as wood at AT_LATHE before turning begins.
                  A full grain shader here would require onBeforeCompile on a
                  one-off mesh; pine.json baseColor is the reference hue. */}
              <meshStandardMaterial color="#dfc890" roughness={0.82} metalness={0.0} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}
