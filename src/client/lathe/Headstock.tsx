/**
 * Headstock — left-end housing of the Jet JWL-1642EVS.
 *
 * Control panel replicates the REAL JWL-1642EVS front face (operator-facing, +Z side).
 * Panel is cream (spec.headstock.color). Two sub-columns:
 *
 *  RIGHT column (operator's right), top → bottom:
 *    1. RPM READOUT    — dark maroon/red bezel; "R.P.M." label; RED seven-segment digits
 *                        (live CanvasTexture driven by useLatheStore.currentRpm; redrawn
 *                         only when the integer RPM changes — no per-frame alloc).
 *    2. POWER BUTTON   — red round button ("PULL ON / PUSH OFF" label above).
 *                        Pulled OUT (+Z by powerPullTravel) when on, flush when off.
 *                        Click toggles power via useLatheStore.getState().setPower().
 *    3. SPEED DIAL     — radial knob + arc-scale decal, DIRECTLY BELOW power button.
 *                        Black round knob with WHITE POINTER line on the face.
 *                        Arc-scale decal (CanvasTexture, drawn ONCE): 270° arc of tick
 *                        marks; "OFF" at bottom-centre; GREEN arc (low RPM) →
 *                        ORANGE/RED arc (high RPM); RPM range labels.
 *                        Pointer at OFF (bottom) = 0 rpm; sweeps clockwise to maxRpm.
 *                        Drag interaction → setTargetRpm (power must be ON).
 *
 *  LEFT column (operator's left), top → bottom:
 *    4. H/L PLACARD    — black rectangle with "H / L" text; static/decorative.
 *    5. FWD/REV KNOB   — small dark knob; moved here from right column; decorative.
 *    6. SPINDLE-LOCK   — small recessed dark rectangle + dark plunger; static/decorative.
 *
 * Director-tunable layout constants (named, commented) live just below the imports.
 * All panel dimensions come from spec.headstock.controlPanel — no hardcoded measurements.
 * No new Vector3() or heap alloc inside the tick loop.
 */
import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { paintedCastIron, bareSteel, darkCastIron } from './materials.js';
import { useLatheStore } from '../../workshop/index.js';
import { formatRpm } from './rpmFormat.js';
import { dialAngleFromT, ARC_SWEEP_RAD } from './dialAngle.js';

interface HeadstockProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const bodyMat  = paintedCastIron(spec.headstock.color);
const steelMat = bareSteel();
const motorMat = darkCastIron('#1f1f1d');  // near-black motor housing

// ── Readout canvas dimensions (pixels) ─────────────────────────────────────────
// Power-of-two improves GPU mip-mapping; LABEL_ROW_H reserves the "R.P.M." strip.
const READOUT_CANVAS_W  = 256;
const READOUT_CANVAS_H  = 80;
const LABEL_ROW_H       = 20; // pixels for the "R.P.M." header label

// ── H/L placard canvas ─────────────────────────────────────────────────────────
const HL_CANVAS_W = 128;
const HL_CANVAS_H = 128;

// ── Arc-scale decal canvas (speed dial face, drawn once) ───────────────────────
// 256×256 power-of-two.  The arc spans ARC_SWEEP_DEG (270°), starting at the
// bottom-centre ("OFF") and sweeping clockwise to max RPM.
const ARC_CANVAS_W     = 256;
const ARC_CANVAS_H     = 256;
//   OFF is at the BOTTOM of the arc (ARC_SWEEP_DEG=270, from dialAngle.ts).
//   Canvas ctx.arc uses standard math angles (0=east, CCW positive), but we want
//   the arc to start at bottom-left (SW, ~225°) and sweep CW to bottom-right (SE).
//   In canvas: CW arc from 135° to 45° going via 270° (bottom).  We draw the arc
//   using explicit angles below.

// ── Speed knob drag sensitivity ────────────────────────────────────────────────
// Drag RIGHT this many pixels to sweep the full [0, maxRpm] range.
const DRAG_PIXELS_FOR_FULL_RANGE = 200;

// ── Speed dial rotation limits ─────────────────────────────────────────────────
// ARC_SWEEP_RAD and HALF_SWEEP_RAD are imported from dialAngle.ts.
// dialAngleFromT(t) maps normalised t ∈ [0,1] → knob rotation.z:
//   t=0 (OFF/0 rpm)  → +HALF_SWEEP_RAD (pointer faces bottom of arc)
//   t=1 (max rpm)    → −HALF_SWEEP_RAD (full CW sweep)
// See dialAngle.ts for the full derivation + unit tests.

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTOR-TUNABLE LAYOUT CONSTANTS
// All values in METRES (world units). Positive Y = up. Positive X = right (+X).
// Fine-tune these after eyeballing on localhost:5173.
//
// Panel is split into LEFT and RIGHT halves around panel centre X.
// RIGHT_COL_DX  — how far right the right-column items sit from panel centre X
// LEFT_COL_DX   — how far left the left-column items sit from panel centre X
//
// Y positions are relative to panel centre Y (PANEL_Y derived from body geometry).
// ─────────────────────────────────────────────────────────────────────────────

// Left/right column X offset from panel centre X (metres)
const RIGHT_COL_DX =  0.038; // items on operator's right sit +38 mm from centre
const LEFT_COL_DX  = -0.038; // items on operator's left sit −38 mm from centre

// Right column vertical positions (Y offset from panel centre)
const READOUT_Y_OFFSET    =  0.075; // top-right: readout sits 75 mm ABOVE panel centre
const POWER_BTN_Y_OFFSET  =  0.020; // 20 mm above panel centre
// SPEED DIAL is DIRECTLY BELOW the power button (right column).
// Gap between power button face and speed dial centre: ~22 mm.
const SPEED_DIAL_Y_OFFSET = -0.040; // 40 mm BELOW panel centre (just under power btn)

// Left column vertical positions
const HL_PLACARD_Y_OFFSET  =  0.050; // H/L placard near top of left column
const FWD_REV_Y_OFFSET     = -0.005; // FWD/REV decorative knob mid-left
const SPINDLE_LOCK_Y_OFFSET = -0.062; // spindle lock 62 mm below panel centre

// Depth offsets (Z) from panel face (panelZ = front face of panel box)
const READOUT_Z_PROUD     = 0.002; // readout face 2 mm proud of panel
const BTN_Z_PROUD_FACTOR  = 1.0;   // powerBtnZ = panelZ + btnRadius * FACTOR (flush/off)
const KNOB_Z_PROUD        = 0.010; // knob face 10 mm proud of panel
const ARC_SCALE_Z_PROUD   = 0.001; // arc-scale decal quad 1 mm proud of panel (behind knob)
const DECOR_Z_PROUD       = 0.003; // decorative items 3 mm proud

// ─────────────────────────────────────────────────────────────────────────────

/** Draw the one-time arc-scale decal onto a 2D canvas context. */
function drawArcScale(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  arcColorLow: string,
  arcColorHigh: string,
  maxRpm: number,
): void {
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const outerR = W * 0.44;
  const innerR = W * 0.28;
  const midR   = (outerR + innerR) / 2;

  // Background circle — very dark grey
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();

  // ── Arc: 270° sweep, starting at bottom-left (SW) going CW to bottom-right (SE).
  // In canvas standard angles (0=east, positive=CW):
  //   SW = 135°, SE = 45°, going CW means crossing through 180° (west), 270° (south).
  //   But we want: OFF at bottom (south=90° in canvas CW from east… wait:
  //   canvas ctx.arc: angles in radians, positive = CLOCKWISE, 0 = right (east).
  //   Bottom = Math.PI/2 (90°).  SW = 135° = 3*PI/4.  SE = 45° = PI/4.
  //   CW from SW (3PI/4) → S (PI/2) → SE (PI/4): but that is only 90°.
  //   We need 270°: SW → NW → N → NE → E → SE.
  //   So: start=3PI/4, end=PI/4, anticlockwise=false (CW).  That goes CW the long way.
  const startAng = (135 * Math.PI) / 180; // SW
  const endAng   = (45  * Math.PI) / 180; // SE

  // Two-tone gradient arc: green (low) → orange-red (high)
  // Draw as two separate arcs for simplicity (avoids conic gradients in older engines).
  // Low half: SW → bottom (90°) = first 135° of the 270° arc
  // High half: bottom → SE = last 135°
  const bottomAng = Math.PI / 2; // due south

  // Green arc (low RPM): SW → bottom
  ctx.beginPath();
  ctx.arc(cx, cy, midR, startAng, bottomAng, false);
  ctx.strokeStyle = arcColorLow;
  ctx.lineWidth = outerR - innerR;
  ctx.stroke();

  // Orange-red arc (high RPM): bottom → SE
  ctx.beginPath();
  ctx.arc(cx, cy, midR, bottomAng, endAng, false);
  ctx.strokeStyle = arcColorHigh;
  ctx.lineWidth = outerR - innerR;
  ctx.stroke();

  // Tick marks
  const TOTAL_TICKS = 27; // 270° / 10° each
  for (let i = 0; i <= TOTAL_TICKS; i++) {
    // Map tick index to canvas angle (CW from SW to SE via N)
    // startAng = 3PI/4, we subtract because going CW means increasing angle in canvas
    // but SW→SE CW = subtract from startAng going through the long 270° path.
    // Angle for tick i: startAng + i*(ARC_SWEEP_RAD/TOTAL_TICKS) going CW
    // In canvas CW coords: angle = startAng + step * i  BUT we also need to not
    // cross the 360 boundary incorrectly.  Use modulo-friendly addition:
    const frac = i / TOTAL_TICKS;
    const ang = startAng + frac * ARC_SWEEP_RAD; // CW from SW

    const isMajor = i % 9 === 0; // major every 90°
    const tickLen = isMajor ? (outerR - innerR) * 0.80 : (outerR - innerR) * 0.45;
    const r0 = outerR - 2;
    const r1 = r0 - tickLen;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = isMajor ? 2.5 : 1.2;
    ctx.stroke();
  }

  // ── "OFF" label at bottom (due south = startAng + 135° = bottom of arc) ────
  const offAng = startAng + (135 * Math.PI) / 180; // = PI/2 = bottom
  const offR   = outerR + 12;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OFF', cx + Math.cos(offAng) * offR, cy + Math.sin(offAng) * offR);

  // ── RPM labels at extremes ───────────────────────────────────────────────────
  const lowLabel  = 'L' + String(Math.round(maxRpm * 0.375)); // ~1200 for 3200 max
  const highLabel = 'H' + String(maxRpm);

  // Low (near SW start)
  const lowAng = startAng + (20 * Math.PI) / 180;
  ctx.fillStyle = arcColorLow;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(lowLabel, cx + Math.cos(lowAng) * (outerR + 8), cy + Math.sin(lowAng) * (outerR + 8));

  // High (near SE end)
  const highAng = startAng + (250 * Math.PI) / 180;
  ctx.fillStyle = arcColorHigh;
  ctx.textAlign = 'right';
  ctx.fillText(highLabel, cx + Math.cos(highAng) * (outerR + 8), cy + Math.sin(highAng) * (outerR + 8));
}

export function Headstock({ position = [0, 0, 0], rotation = [0, 0, 0] }: HeadstockProps) {
  const {
    width,
    height,
    depth,
    spindleHeight,
    spindleDiameter,
    spindleNoseDiameter,
    spindleNoseLength,
    motorHousing,
    controlPanel,
  } = spec.headstock;

  const cp = controlPanel;

  // ── Panel cream material (matches headstock body colour) ──────────────────
  // Created inside the component so it closes over the resolved spec colour.
  const panelMat = useMemo(
    () => darkCastIron('#232323'),
    [],
  );
  // Cream surface for sub-panel decal areas (readout bezel, placards etc.)
  const creamMat = useMemo(
    () => paintedCastIron(spec.headstock.color),
    [],
  );
  void creamMat; // referenced in JSX below

  // ── RPM readout canvas + texture (allocated once, reused every frame) ─────
  const { ctx: readoutCtx, texture: readoutTexture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width  = READOUT_CANVAS_W;
    canvas.height = READOUT_CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Headstock: could not get 2D canvas for RPM readout');
    const texture = new THREE.CanvasTexture(canvas);
    return { ctx, texture };
  }, []);

  // ── H/L placard canvas (drawn once, static) ───────────────────────────────
  const hlTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width  = HL_CANVAS_W;
    canvas.height = HL_CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Headstock: could not get 2D canvas for H/L placard');
    // Background
    ctx.fillStyle = cp.hlPlacardColor;
    ctx.fillRect(0, 0, HL_CANVAS_W, HL_CANVAS_H);
    // "H" block (top) — red
    ctx.fillStyle = '#cc2222';
    ctx.fillRect(HL_CANVAS_W * 0.3, HL_CANVAS_H * 0.05, HL_CANVAS_W * 0.4, HL_CANVAS_H * 0.32);
    // "L" block (bottom) — white
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(HL_CANVAS_W * 0.3, HL_CANVAS_H * 0.56, HL_CANVAS_W * 0.4, HL_CANVAS_H * 0.32);
    // Labels
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', HL_CANVAS_W / 2, HL_CANVAS_H * 0.21);
    ctx.fillStyle = '#111111';
    ctx.fillText('L', HL_CANVAS_W / 2, HL_CANVAS_H * 0.72);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '9px sans-serif';
    ctx.fillText('High 0–3200', HL_CANVAS_W / 2, HL_CANVAS_H * 0.42);
    ctx.fillText('Low  0–1200', HL_CANVAS_W / 2, HL_CANVAS_H * 0.90);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, [cp.hlPlacardColor]);

  // ── Arc-scale decal canvas (drawn ONCE; static — no per-frame alloc) ──────
  const arcScaleTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width  = ARC_CANVAS_W;
    canvas.height = ARC_CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Headstock: could not get 2D canvas for arc-scale decal');
    const { maxRpm } = useLatheStore.getState();
    drawArcScale(
      ctx,
      ARC_CANVAS_W,
      ARC_CANVAS_H,
      cp.speedDialArcColorLow,
      cp.speedDialArcColorHigh,
      maxRpm,
    );
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, [cp.speedDialArcColorLow, cp.speedDialArcColorHigh]);

  // ── Mesh refs for imperative per-frame updates ────────────────────────────
  const powerBtnRef  = useRef<THREE.Mesh>(null);
  const speedKnobRef = useRef<THREE.Group>(null);
  const lastRpm      = useRef<number>(-1);

  // ── Drag state (pre-allocated scalars, zero heap alloc per event) ─────────
  const isDragging    = useRef(false);
  const dragStartX    = useRef(0);  // clientX at pointerdown
  const dragStartRpm  = useRef(0);  // targetRpm at pointerdown

  // ── Power button handlers ──────────────────────────────────────────────────
  const handlePowerClick = useCallback((_e: ThreeEvent<MouseEvent>) => {
    const { power, setPower } = useLatheStore.getState();
    setPower(!power);
  }, []);

  const handlePowerOver = useCallback((_e: ThreeEvent<PointerEvent>) => {
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePowerOut = useCallback((_e: ThreeEvent<PointerEvent>) => {
    document.body.style.cursor = '';
  }, []);

  // ── Speed RADIAL DIAL handlers ────────────────────────────────────────────
  // Drag direction: RIGHT (positive deltaX on screen) = faster RPM.
  const handleKnobPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDragging.current   = true;
    dragStartX.current   = e.nativeEvent.clientX;
    dragStartRpm.current = useLatheStore.getState().targetRpm;
    document.body.style.cursor = 'ew-resize';
  }, []);

  const handleKnobOver = useCallback((_e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) document.body.style.cursor = 'ew-resize';
  }, []);

  const handleKnobOut = useCallback((_e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) document.body.style.cursor = '';
  }, []);

  // Window-level pointermove/pointerup — registered once on mount.
  const onWindowPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current) return;
    const { maxRpm, setTargetRpm } = useLatheStore.getState();
    // Drag RIGHT (positive deltaX) = increase RPM.
    const deltaX   = e.clientX - dragStartX.current;
    const deltaRpm = (deltaX / DRAG_PIXELS_FOR_FULL_RANGE) * maxRpm;
    setTargetRpm(dragStartRpm.current + deltaRpm); // store clamps + guards power-off
  }, []);

  const onWindowPointerUp = useCallback((_e: PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup',   onWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup',   onWindowPointerUp);
    };
  }, []);

  // ── drawReadout — reuses existing canvas/ctx, no heap alloc ──────────────
  function drawReadout(intRpm: number) {
    const W = READOUT_CANVAS_W;
    const H = READOUT_CANVAS_H;
    readoutCtx.clearRect(0, 0, W, H);

    // Full background — maroon/dark-red bezel
    readoutCtx.fillStyle = cp.readoutBezelColor;
    readoutCtx.fillRect(0, 0, W, H);

    // "R.P.M." label row — slightly lighter maroon, centred
    readoutCtx.fillStyle = '#6a1818';
    readoutCtx.fillRect(0, 0, W, LABEL_ROW_H);
    readoutCtx.fillStyle = '#ddbbbb';
    readoutCtx.font = `bold ${Math.round(LABEL_ROW_H * 0.70).toString()}px sans-serif`;
    readoutCtx.textAlign = 'center';
    readoutCtx.textBaseline = 'middle';
    readoutCtx.fillText('R.P.M.', W / 2, LABEL_ROW_H / 2);

    // Digit area — deep red-black LCD background
    readoutCtx.fillStyle = '#1a0000';
    readoutCtx.fillRect(4, LABEL_ROW_H + 2, W - 8, H - LABEL_ROW_H - 4);

    // Live RPM digits — bright red, right-aligned
    const digitH = H - LABEL_ROW_H - 8;
    const fontPx = Math.round(digitH * 0.80).toString();
    readoutCtx.fillStyle = cp.readoutDigitColor;
    readoutCtx.font = `bold ${fontPx}px monospace`;
    readoutCtx.textAlign = 'right';
    readoutCtx.textBaseline = 'middle';
    readoutCtx.fillText(
      formatRpm(intRpm),
      W - 8,
      LABEL_ROW_H + (H - LABEL_ROW_H) / 2,
    );

    readoutTexture.needsUpdate = true;
  }

  // Draw "0" before the first frame.
  useMemo(() => { drawReadout(0); }, []);

  // ── Per-frame imperative updates — zero re-renders, zero heap alloc ───────
  useFrame(() => {
    const { currentRpm, targetRpm, maxRpm, power } = useLatheStore.getState();

    // 1. RPM readout — redraw only when integer changes
    const intRpm = Math.round(currentRpm);
    if (intRpm !== lastRpm.current) {
      lastRpm.current = intRpm;
      drawReadout(intRpm);
    }

    // 2. Power button Z — protrudes by powerPullTravel when on
    const btn = powerBtnRef.current;
    if (btn !== null) {
      btn.position.z = powerBtnBaseZ + (power ? cp.powerPullTravel : 0);
    }

    // 3. Speed dial rotation.z — OFF at bottom (pointer down), CW to max.
    //    dialAngleFromT(0) = +HALF_SWEEP (pointer points down = OFF)
    //    dialAngleFromT(1) = −HALF_SWEEP (full CW rotation = max RPM)
    const knob = speedKnobRef.current;
    if (knob !== null && maxRpm > 0) {
      const t = Math.max(0, Math.min(1, targetRpm / maxRpm));
      knob.rotation.z = dialAngleFromT(t);
    }
  });

  // ── Geometry layout (all from spec, no hardcoded measurements) ────────────

  const bodyY = height / 2;

  // Motor housing drum
  const motorDiameter = Math.min(motorHousing.width, motorHousing.height);
  const motorRadius   = motorDiameter / 2;
  const motorLength   = motorHousing.depth;
  const motorX        = -(motorLength / 2);
  const motorY        = bodyY;

  // Spindle nose
  const spindleNoseX = width + spindleNoseLength / 2;

  // Control panel backing plate
  const panelX = width / 2;              // centred on headstock body X
  const panelY = bodyY - height * 0.10; // slightly below body centre
  const panelZ = depth / 2 + cp.depth / 2;

  // Front face Z of the panel (items sit proud of this)
  const panelFaceZ = panelZ + cp.depth / 2;

  // ── Per-column base X ─────────────────────────────────────────────────────
  const rightX = panelX + RIGHT_COL_DX;
  const leftX  = panelX + LEFT_COL_DX;

  // ── 1. RPM READOUT (top-right) ────────────────────────────────────────────
  const readoutY = panelY + READOUT_Y_OFFSET;
  const readoutZ = panelFaceZ + READOUT_Z_PROUD;

  // ── 2. POWER BUTTON (right, below readout) ────────────────────────────────
  const powerBtnR    = cp.powerButtonDiameter / 2;
  const powerBtnY    = panelY + POWER_BTN_Y_OFFSET;
  // powerBtnBaseZ is the OFF (flush) Z; useFrame adds pullTravel when on
  const powerBtnBaseZ = panelFaceZ + powerBtnR * BTN_Z_PROUD_FACTOR;

  // ── 3. SPEED DIAL — RIGHT COLUMN, DIRECTLY BELOW POWER BUTTON ────────────
  const speedKnobR    = cp.speedKnobDiameter / 2;
  const speedDialY    = panelY + SPEED_DIAL_Y_OFFSET;
  const speedKnobZ    = panelFaceZ + KNOB_Z_PROUD;
  const arcScaleZ     = panelFaceZ + ARC_SCALE_Z_PROUD;

  // ── 4. H/L PLACARD (left column, top) ────────────────────────────────────
  const hlPlacardY = panelY + HL_PLACARD_Y_OFFSET;
  const hlPlacardZ = panelFaceZ + DECOR_Z_PROUD;

  // ── 5. FWD/REV KNOB (left column — moved here from right) ────────────────
  const fwdRevKnobR = cp.fwdRevKnobDiameter / 2;
  const fwdRevKnobY = panelY + FWD_REV_Y_OFFSET;
  const fwdRevKnobZ = panelFaceZ + KNOB_Z_PROUD;

  // ── 6. SPINDLE-LOCK RECESS (far-left, lower) ─────────────────────────────
  const spindleLockX  = panelX + LEFT_COL_DX - 0.020; // pushed a bit further left
  const spindleLockY  = panelY + SPINDLE_LOCK_Y_OFFSET;
  const spindleLockZ  = panelFaceZ + DECOR_Z_PROUD;
  const spindleLockKR = cp.spindleLockKnobDiameter / 2;

  return (
    <group position={position} rotation={rotation}>

      {/* ── Main body box ── */}
      <mesh position={[width / 2, bodyY, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* ── Motor housing drum — near-black cylinder along X axis, -X end ── */}
      <mesh position={[motorX, motorY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[motorRadius, motorRadius, motorLength, 20]} />
        <meshStandardMaterial {...motorMat} />
      </mesh>

      {/* ── Spindle nose — short tapered cylinder, +X ── */}
      <mesh
        position={[spindleNoseX, spindleHeight, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[spindleNoseDiameter / 2, spindleDiameter / 2, spindleNoseLength, 16]} />
        <meshStandardMaterial {...steelMat} />
      </mesh>

      {/* ── Control panel backing plate — dark face ── */}
      <mesh position={[panelX, panelY, panelZ]}>
        <boxGeometry args={[cp.width, cp.height, cp.depth]} />
        <meshStandardMaterial {...panelMat} />
      </mesh>

      {/* ══════════════════════════════════════════════════════════════════════
          RIGHT COLUMN (operator's right)
          ══════════════════════════════════════════════════════════════════ */}

      {/* ─────────────────────────────────────────────────────────────────────
          1. RPM READOUT — TOP-RIGHT
          Maroon/dark-red bezel box with "R.P.M." label and RED seven-segment
          style digits. Live CanvasTexture redrawn only when integer RPM changes.
      ───────────────────────────────────────────────────────────────────── */}
      <mesh position={[rightX, readoutY, readoutZ]}>
        <boxGeometry args={[cp.readoutWidth, cp.readoutHeight, 0.004]} />
        <meshStandardMaterial
          map={readoutTexture}
          emissiveMap={readoutTexture}
          emissive="#ffffff"
          emissiveIntensity={0.40}
          roughness={0.4}
          metalness={0.0}
        />
      </mesh>

      {/* ─────────────────────────────────────────────────────────────────────
          2. POWER BUTTON — RIGHT, BELOW READOUT
          Red cylinder. Z driven imperatively in useFrame:
            power ON  → powerBtnBaseZ + powerPullTravel  (PULLED OUT)
            power OFF → powerBtnBaseZ                    (PUSHED IN, flush)
          Click toggles power via setPower().
      ───────────────────────────────────────────────────────────────────── */}
      <mesh
        ref={powerBtnRef}
        position={[rightX, powerBtnY, powerBtnBaseZ]}
        rotation={[Math.PI / 2, 0, 0]}
        onClick={handlePowerClick}
        onPointerOver={handlePowerOver}
        onPointerOut={handlePowerOut}
      >
        <cylinderGeometry args={[powerBtnR, powerBtnR, powerBtnR * 1.6, 20]} />
        <meshStandardMaterial
          color={cp.powerButtonColor}
          roughness={0.40}
          metalness={0.05}
        />
      </mesh>

      {/* ─────────────────────────────────────────────────────────────────────
          3. SPEED DIAL — RIGHT COLUMN, DIRECTLY BELOW POWER BUTTON
          Two parts:
            A) Arc-scale decal quad (static CanvasTexture, drawn once):
               Sits on the panel face behind the knob. 270° arc, OFF at bottom,
               GREEN arc (low) → ORANGE/RED arc (high), tick marks, RPM labels.
            B) Knob group (rotates each frame via useFrame → dialAngleFromT):
               - Flat disc body (black)
               - White pointer line on +Y face (visible from front when rotation
                 maps to the correct angle — OFF = pointer points toward bottom
                 of arc, max = pointer points toward high-RPM end).
          Drag interaction: drag RIGHT (+RPM), drag LEFT (−RPM).
      ───────────────────────────────────────────────────────────────────── */}

      {/* A) Arc-scale decal quad — behind the knob, on panel face */}
      <mesh position={[rightX, speedDialY, arcScaleZ]}>
        <planeGeometry args={[cp.speedDialScaleWidth, cp.speedDialScaleHeight]} />
        <meshStandardMaterial
          map={arcScaleTexture}
          transparent
          roughness={0.6}
          metalness={0.0}
        />
      </mesh>

      {/* B) Knob group — rotation.z set imperatively each frame */}
      <group
        ref={speedKnobRef}
        position={[rightX, speedDialY, speedKnobZ]}
        onPointerDown={handleKnobPointerDown}
        onPointerOver={handleKnobOver}
        onPointerOut={handleKnobOut}
      >
        {/* Knob body — flat disc */}
        <mesh>
          <cylinderGeometry args={[speedKnobR, speedKnobR * 0.85, speedKnobR * 0.9, 24]} />
          <meshStandardMaterial
            color={cp.speedKnobColor}
            roughness={0.70}
            metalness={0.05}
          />
        </mesh>
        {/* White pointer line on top face — at +Y (top of knob in local space).
            When rotation.z = +HALF_SWEEP (0 rpm / OFF) the group is rotated so
            this +Y pointer faces down in world space, matching the "OFF" mark at
            the bottom of the arc scale. */}
        <mesh position={[0, speedKnobR * 0.38, speedKnobR * 0.46]}>
          <boxGeometry args={[speedKnobR * 0.10, speedKnobR * 0.55, speedKnobR * 0.08]} />
          <meshStandardMaterial color="#f0f0f0" roughness={0.2} metalness={0.1} emissive="#ffffff" emissiveIntensity={0.15} />
        </mesh>
      </group>

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT COLUMN (operator's left)
          ══════════════════════════════════════════════════════════════════ */}

      {/* ─────────────────────────────────────────────────────────────────────
          4. H/L SPEED-RANGE PLACARD — LEFT, TOP
          Black rectangle with H/L indicator blocks and speed-range text.
          CanvasTexture drawn ONCE (static — no per-frame redraw).
      ───────────────────────────────────────────────────────────────────── */}
      <mesh position={[leftX, hlPlacardY, hlPlacardZ]}>
        <boxGeometry args={[cp.hlPlacardWidth, cp.hlPlacardHeight, 0.003]} />
        <meshStandardMaterial
          map={hlTexture}
          roughness={0.6}
          metalness={0.0}
        />
      </mesh>

      {/* ─────────────────────────────────────────────────────────────────────
          5. FWD/REV KNOB — LEFT COLUMN (moved from right, decorative)
          Small dark knob. Static/decorative — no interaction handlers.
      ───────────────────────────────────────────────────────────────────── */}
      <mesh position={[leftX, fwdRevKnobY, fwdRevKnobZ]}>
        <cylinderGeometry args={[fwdRevKnobR, fwdRevKnobR * 0.8, fwdRevKnobR * 2.2, 16]} />
        <meshStandardMaterial
          color={cp.fwdRevKnobColor}
          roughness={0.75}
          metalness={0.1}
        />
      </mesh>

      {/* ─────────────────────────────────────────────────────────────────────
          6. SPINDLE-LOCK RECESS — FAR-LEFT, LOWER
          Small recessed dark rectangle + dark plunger knob. Static/decorative.
      ───────────────────────────────────────────────────────────────────── */}
      {/* Recess box */}
      <mesh position={[spindleLockX, spindleLockY, spindleLockZ]}>
        <boxGeometry args={[cp.spindleLockRecessWidth, cp.spindleLockRecessHeight, 0.005]} />
        <meshStandardMaterial
          color={cp.spindleLockRecessColor}
          roughness={0.80}
          metalness={0.10}
        />
      </mesh>
      {/* Plunger knob inside recess */}
      <mesh position={[spindleLockX, spindleLockY, spindleLockZ + 0.005]}>
        <cylinderGeometry args={[spindleLockKR, spindleLockKR, spindleLockKR * 2.0, 12]} />
        <meshStandardMaterial
          color={cp.spindleLockKnobColor}
          roughness={0.80}
          metalness={0.05}
        />
      </mesh>

    </group>
  );
}
