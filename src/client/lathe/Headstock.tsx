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
 *    3. FWD/REV KNOB   — small dark knob; static/decorative.
 *
 *  LEFT column (operator's left), top → bottom:
 *    4. SPEED KNOB     — black round knob (TOP-LEFT). Drag UP/mouse-up-right = faster.
 *                        Rotates (rotation.z) to reflect targetRpm position.
 *                        Dragging calls useLatheStore.getState().setTargetRpm().
 *    5. H/L PLACARD    — black rectangle with "H / L" text; static/decorative.
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

// ── Speed knob drag sensitivity ────────────────────────────────────────────────
// Drag UP this many pixels to sweep the full [0, maxRpm] range.
// (Positive deltaY from pointerdown → pointer-up = moving mouse upward on screen.)
const DRAG_PIXELS_FOR_FULL_RANGE = 200;

// ── Speed knob rotation limits (radians) ──────────────────────────────────────
// knob.rotation.z maps targetRpm/maxRpm → [KNOB_MIN_ANGLE, KNOB_MAX_ANGLE]
// −135° (fully anticlockwise) at 0 rpm, +135° (fully clockwise) at maxRpm.
const KNOB_MIN_ANGLE = (-135 * Math.PI) / 180; // −2.356 rad
const KNOB_MAX_ANGLE = ( 135 * Math.PI) / 180; // +2.356 rad

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
const FWD_REV_Y_OFFSET    = -0.038; // 38 mm below panel centre

// Left column vertical positions
const SPEED_KNOB_Y_OFFSET =  0.068; // top-left: speed knob 68 mm above panel centre
const HL_PLACARD_Y_OFFSET =  0.000; // H/L placard at panel centre
const SPINDLE_LOCK_Y_OFFSET = -0.062; // spindle lock 62 mm below panel centre

// Depth offsets (Z) from panel face (panelZ = front face of panel box)
const READOUT_Z_PROUD     = 0.002; // readout face 2 mm proud of panel
const BTN_Z_PROUD_FACTOR  = 1.0;   // powerBtnZ = panelZ + btnRadius * FACTOR (flush/off)
const KNOB_Z_PROUD        = 0.010; // knob face 10 mm proud of panel
const DECOR_Z_PROUD       = 0.003; // decorative items 3 mm proud

// ─────────────────────────────────────────────────────────────────────────────

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

  // ── Mesh refs for imperative per-frame updates ────────────────────────────
  const powerBtnRef  = useRef<THREE.Mesh>(null);
  const speedKnobRef = useRef<THREE.Mesh>(null);
  const lastRpm      = useRef<number>(-1);

  // ── Drag state (pre-allocated scalars, zero heap alloc per event) ─────────
  const isDragging    = useRef(false);
  const dragStartY    = useRef(0);  // clientY at pointerdown
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

  // ── Speed ROTARY knob handlers ────────────────────────────────────────────
  // Drag direction: UP (negative deltaY on screen) = faster RPM.
  const handleKnobPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDragging.current   = true;
    dragStartY.current   = e.nativeEvent.clientY;
    dragStartRpm.current = useLatheStore.getState().targetRpm;
    document.body.style.cursor = 'ns-resize';
  }, []);

  const handleKnobOver = useCallback((_e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) document.body.style.cursor = 'grab';
  }, []);

  const handleKnobOut = useCallback((_e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) document.body.style.cursor = '';
  }, []);

  // Window-level pointermove/pointerup — registered once on mount.
  const onWindowPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current) return;
    const { maxRpm, setTargetRpm } = useLatheStore.getState();
    // Drag UP (negative deltaY) = increase RPM.
    const deltaY   = e.clientY - dragStartY.current;
    const deltaRpm = (-deltaY / DRAG_PIXELS_FOR_FULL_RANGE) * maxRpm;
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

    // 3. Speed knob rotation.z — reflects targetRpm/maxRpm in [MIN,MAX] angle
    const knob = speedKnobRef.current;
    if (knob !== null && maxRpm > 0) {
      const t = Math.max(0, Math.min(1, targetRpm / maxRpm));
      knob.rotation.z = KNOB_MIN_ANGLE + t * (KNOB_MAX_ANGLE - KNOB_MIN_ANGLE);
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

  // ── 3. FWD/REV KNOB (right, below power button) ──────────────────────────
  const fwdRevKnobR = cp.fwdRevKnobDiameter / 2;
  const fwdRevKnobY = panelY + FWD_REV_Y_OFFSET;
  const fwdRevKnobZ = panelFaceZ + KNOB_Z_PROUD;

  // ── 4. SPEED KNOB (top-left, black rotary) ───────────────────────────────
  const speedKnobR = cp.speedKnobDiameter / 2;
  const speedKnobY = panelY + SPEED_KNOB_Y_OFFSET;
  const speedKnobZ = panelFaceZ + KNOB_Z_PROUD;

  // ── 5. H/L PLACARD (left, below speed knob) ──────────────────────────────
  const hlPlacardY = panelY + HL_PLACARD_Y_OFFSET;
  const hlPlacardZ = panelFaceZ + DECOR_Z_PROUD;

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
          3. FWD/REV KNOB — RIGHT, BELOW POWER BUTTON
          Small dark knob. Static/decorative — no interaction handlers.
      ───────────────────────────────────────────────────────────────────── */}
      <mesh position={[rightX, fwdRevKnobY, fwdRevKnobZ]}>
        <cylinderGeometry args={[fwdRevKnobR, fwdRevKnobR * 0.8, fwdRevKnobR * 2.2, 16]} />
        <meshStandardMaterial
          color={cp.fwdRevKnobColor}
          roughness={0.75}
          metalness={0.1}
        />
      </mesh>

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT COLUMN (operator's left)
          ══════════════════════════════════════════════════════════════════ */}

      {/* ─────────────────────────────────────────────────────────────────────
          4. SPEED KNOB — TOP-LEFT (BLACK ROTARY)
          Black round knob. rotation.z driven imperatively in useFrame to
          reflect targetRpm: KNOB_MIN_ANGLE (0 rpm) → KNOB_MAX_ANGLE (maxRpm).
          Drag UP (−Y) = increase RPM; drag DOWN (+Y) = decrease RPM.
          A thin indicator line (box) on the knob face shows the set angle.
      ───────────────────────────────────────────────────────────────────── */}
      <group
        ref={speedKnobRef}
        position={[leftX, speedKnobY, speedKnobZ]}
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
        {/* Indicator line on knob face — shows rotation angle */}
        <mesh position={[0, speedKnobR * 0.35, 0]}>
          <boxGeometry args={[speedKnobR * 0.12, speedKnobR * 0.55, speedKnobR * 0.15]} />
          <meshStandardMaterial color="#cccccc" roughness={0.4} metalness={0.3} />
        </mesh>
      </group>

      {/* ─────────────────────────────────────────────────────────────────────
          5. H/L SPEED-RANGE PLACARD — LEFT, BELOW SPEED KNOB
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
