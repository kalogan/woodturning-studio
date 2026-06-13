/**
 * Headstock — left-end housing of the Jet JWL-1642EVS.
 *
 * Features modelled:
 *  - Cream cast-iron body box
 *  - BLACK cylindrical motor housing drum protruding from the -X (left) end
 *  - Control panel on the front (+Z) face — REAL JWL-1642EVS layout (top→bottom):
 *      1. Digital RPM readout rectangle at TOP (red LCD; live CanvasTexture driven
 *         by useLatheStore.currentRpm — updated imperatively each frame when the
 *         integer RPM changes; no per-frame allocation).
 *      2. Red round POWER button in the MIDDLE — PULL-ON / PUSH-OFF:
 *         pulled OUT (+Z by powerPullTravel) when powered on, flush when off.
 *         Click toggles power.
 *      3. Shiny SILVER speed knob at the BOTTOM — HORIZONTAL SLIDER:
 *         drag LEFT↔RIGHT to set RPM across [0, maxRpm] over a short track.
 *         Knob X position reflects targetRpm imperatively each frame.
 *  - Spindle nose short cylinder protruding +X
 *
 * Director-tunable layout constants (named, with comments) live just below the
 * imports — fine-tune READOUT_Y, POWER_BTN_Y, SPEED_TRACK_Y to taste after
 * eyeballing on localhost:5173.
 *
 * All dimensions come from spec.headstock.controlPanel (content/lathe/jet-jwl-1642.json).
 * No hardcoded measurements.
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

const bodyMat   = paintedCastIron(spec.headstock.color);
const steelMat  = bareSteel();
const motorMat  = darkCastIron('#1f1f1d');   // near-black cast housing
const panelMat  = darkCastIron('#232323');   // control panel backing

// ── Readout canvas dimensions (pixels) ──────────────────────────────────────
// Higher resolution for legible digits; power-of-two not strictly required but
// improves GPU mip-mapping. These are texture pixel counts, not world units.
const READOUT_CANVAS_W = 256;
const READOUT_CANVAS_H = 64;

// ── Speed slider drag sensitivity ────────────────────────────────────────────
// Dragging this many pixels horizontally sweeps the full [0, maxRpm] range.
const DRAG_PIXELS_FOR_FULL_RANGE = 200;

// ── Panel layout Y offsets (relative to panel centre) ────────────────────────
// Director: fine-tune these to match the screenshot from localhost:5173.
// All values are in METRES (world units).
//
//  READOUT_Y    — readout display sits at the TOP of the panel
//  POWER_BTN_Y  — red pull-button in the MIDDLE (below readout)
//  SPEED_TRACK_Y— silver knob + track at the BOTTOM (below red button)
//
// The panel height is spec.headstock.controlPanel.height (0.20 m).
// Positive Y = up; typical range here is ±(panelHeight/2 * 0.8).
const READOUT_Y_OFFSET     =  0.06;  // 60 mm above panel centre → top zone
const POWER_BTN_Y_OFFSET   =  0.01;  // 10 mm above centre → middle zone
const SPEED_TRACK_Y_OFFSET = -0.06;  // 60 mm below centre → bottom zone

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

  // ── RPM readout canvas + texture (pre-allocated once, reused every frame) ──
  const { ctx: readoutCtx, texture: readoutTexture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width  = READOUT_CANVAS_W;
    canvas.height = READOUT_CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Headstock: could not get 2D canvas context for RPM readout');
    const texture = new THREE.CanvasTexture(canvas);
    return { ctx, texture };
  }, []); // created once — stable empty dep array is intentional

  // Track the last integer we painted so we skip identical frames.
  const lastDisplayedRpm = useRef<number>(-1);

  // ── Mesh refs for imperative per-frame updates ────────────────────────────
  // powerBtnRef: Z position driven by power state (no re-render, no allocation)
  // speedKnobRef: X position driven by targetRpm (no re-render, no allocation)
  const powerBtnRef  = useRef<THREE.Mesh>(null);
  const speedKnobRef = useRef<THREE.Mesh>(null);

  // ── Drag state — pre-allocated scalars, zero heap alloc per event ─────────
  const isDragging    = useRef(false);
  const dragStartX    = useRef(0);
  const dragStartRpm  = useRef(0);

  // ── Power button handlers ──────────────────────────────────────────────────
  const handlePowerClick = useCallback((_e: ThreeEvent<MouseEvent>) => {
    const { power, setPower } = useLatheStore.getState();
    setPower(!power);
  }, []);

  const handlePowerPointerOver = useCallback((_e: ThreeEvent<PointerEvent>) => {
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePowerPointerOut = useCallback((_e: ThreeEvent<PointerEvent>) => {
    document.body.style.cursor = '';
  }, []);

  // ── Speed knob (horizontal slider) handlers ───────────────────────────────
  const handleKnobPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDragging.current   = true;
    dragStartX.current   = e.nativeEvent.clientX;
    dragStartRpm.current = useLatheStore.getState().targetRpm;
    document.body.style.cursor = 'ew-resize';
  }, []);

  const handleKnobPointerOver = useCallback((_e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) document.body.style.cursor = 'grab';
  }, []);

  const handleKnobPointerOut = useCallback((_e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) document.body.style.cursor = '';
  }, []);

  // Window-level pointermove/pointerup: registered once on mount.
  // All reads go through refs / store.getState() — no stale captures.
  const onWindowPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current) return;
    const { maxRpm, setTargetRpm } = useLatheStore.getState();
    // Drag RIGHT = increase RPM (positive deltaX).
    const deltaX   = e.clientX - dragStartX.current;
    const deltaRpm = (deltaX / DRAG_PIXELS_FOR_FULL_RANGE) * maxRpm;
    setTargetRpm(dragStartRpm.current + deltaRpm); // store clamps + guards power-off
  }, []); // stable — reads only through .current / getState()

  const onWindowPointerUp = useCallback((_e: PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = '';
  }, []); // stable

  useEffect(() => {
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup',   onWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup',   onWindowPointerUp);
    };
  }, []); // stable handlers registered once on mount

  // ── drawReadout — called on mount + whenever integer RPM changes ──────────
  // Reuses existing canvas/ctx; no heap allocation.
  function drawReadout(intRpm: number) {
    readoutCtx.clearRect(0, 0, READOUT_CANVAS_W, READOUT_CANVAS_H);
    // Background — deep red-black LCD
    readoutCtx.fillStyle = '#1a0000';
    readoutCtx.fillRect(0, 0, READOUT_CANVAS_W, READOUT_CANVAS_H);
    // Digits — bright red, right-aligned
    const fontSizePx = Math.round(READOUT_CANVAS_H * 0.75).toString();
    readoutCtx.fillStyle = '#ff2200';
    readoutCtx.font = `bold ${fontSizePx}px monospace`;
    readoutCtx.textAlign = 'right';
    readoutCtx.textBaseline = 'middle';
    readoutCtx.fillText(formatRpm(intRpm), READOUT_CANVAS_W - 6, READOUT_CANVAS_H / 2);
    readoutTexture.needsUpdate = true;
  }

  // Draw initial "0" immediately (before first frame).
  useMemo(() => { drawReadout(0); }, []); // stable empty dep intentional

  // ── Per-frame imperative update — zero re-renders, zero heap alloc ────────
  useFrame(() => {
    const { currentRpm, targetRpm, maxRpm, power } = useLatheStore.getState();

    // 1. RPM readout
    const intRpm = Math.round(currentRpm);
    if (intRpm !== lastDisplayedRpm.current) {
      lastDisplayedRpm.current = intRpm;
      drawReadout(intRpm);
    }

    // 2. Power button Z — protrudes by powerPullTravel when on, flush when off
    const btn = powerBtnRef.current;
    if (btn !== null) {
      btn.position.z = powerBtnZ + (power ? cp.powerPullTravel : 0);
    }

    // 3. Speed knob X — slides along track proportional to targetRpm/maxRpm
    const knob = speedKnobRef.current;
    if (knob !== null && maxRpm > 0) {
      const t = targetRpm / maxRpm; // [0, 1]
      // Track spans ±(trackLength/2) around the track centre X
      knob.position.x = speedTrackCentreX + (t - 0.5) * cp.speedTrackLength;
    }
  });

  // ── Layout geometry (all read from spec, no hardcoded measurements) ───────

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
  const panelX = width / 2;            // centred along body width
  const panelY = bodyY - height * 0.1; // slightly below body centre
  const panelZ = depth / 2 + cp.depth / 2; // flush with / just proud of front face

  // ── Control panel element positions ──────────────────────────────────────
  // Each item is positioned relative to the panel centre (panelX, panelY, panelZ).

  // 1. RPM readout — TOP
  const readoutY = panelY + READOUT_Y_OFFSET;
  const readoutZ = panelZ + 0.002; // just proud of panel face

  // 2. Red power button — MIDDLE
  const powerBtnR = cp.powerButtonDiameter / 2;
  const powerBtnX = panelX;
  const powerBtnY = panelY + POWER_BTN_Y_OFFSET;
  // powerBtnZ is the FLUSH (off) Z; useFrame adds pullTravel when on
  const powerBtnZ = panelZ + powerBtnR; // button face proud of panel by one radius

  // 3. Silver speed knob + track — BOTTOM
  const speedKnobR           = cp.speedKnobDiameter / 2;
  const speedTrackY          = panelY + SPEED_TRACK_Y_OFFSET;
  const speedTrackZ          = panelZ + 0.005; // track sits on panel face
  const speedTrackCentreX    = panelX;         // track centred on panel X

  // Track rail: thin box showing the groove the knob slides in
  const trackRailH = 0.004; // 4 mm tall — thin groove indicator
  const trackRailD = 0.006; // 6 mm deep

  return (
    <group position={position} rotation={rotation}>

      {/* ── Main body box ── */}
      <mesh position={[width / 2, bodyY, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* ── Motor housing drum — black cylinder along X axis, -X end ── */}
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

      {/* ── Control panel backing plate ── */}
      <mesh position={[panelX, panelY, panelZ]}>
        <boxGeometry args={[cp.width, cp.height, cp.depth]} />
        <meshStandardMaterial {...panelMat} />
      </mesh>

      {/* ─────────────────────────────────────────────────────────────────────
          1. RPM READOUT — TOP of panel
          Live CanvasTexture showing currentRpm; redrawn imperatively in
          useFrame only when the integer value changes (no per-frame alloc).
          Red LCD display matching the real JWL-1642EVS.
      ───────────────────────────────────────────────────────────────────── */}
      <mesh position={[panelX, readoutY, readoutZ]}>
        <boxGeometry args={[cp.readoutWidth, cp.readoutHeight, 0.003]} />
        <meshStandardMaterial
          map={readoutTexture}
          emissiveMap={readoutTexture}
          emissive="#ffffff"
          emissiveIntensity={0.35}
          roughness={0.4}
          metalness={0.0}
        />
      </mesh>

      {/* ─────────────────────────────────────────────────────────────────────
          2. RED POWER BUTTON — MIDDLE of panel (PULL-ON / PUSH-OFF)
          Z position driven imperatively in useFrame:
            power ON  → powerBtnZ + powerPullTravel  (pulled OUT toward operator)
            power OFF → powerBtnZ                    (pushed IN, flush)
          Click toggles power via useLatheStore.getState().setPower().
      ───────────────────────────────────────────────────────────────────── */}
      <mesh
        ref={powerBtnRef}
        position={[powerBtnX, powerBtnY, powerBtnZ]}
        rotation={[Math.PI / 2, 0, 0]}
        onClick={handlePowerClick}
        onPointerOver={handlePowerPointerOver}
        onPointerOut={handlePowerPointerOut}
      >
        <cylinderGeometry args={[powerBtnR, powerBtnR, powerBtnR * 1.6, 20]} />
        <meshStandardMaterial
          color={cp.powerButtonColor}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      {/* ─────────────────────────────────────────────────────────────────────
          3a. SPEED TRACK RAIL — thin groove at BOTTOM of panel
          Visual indicator of the slider path; static decorative element.
      ───────────────────────────────────────────────────────────────────── */}
      <mesh position={[speedTrackCentreX, speedTrackY, speedTrackZ]}>
        <boxGeometry args={[cp.speedTrackLength + speedKnobR * 2, trackRailH, trackRailD]} />
        <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* ─────────────────────────────────────────────────────────────────────
          3b. SILVER SPEED KNOB — rides the horizontal track
          X position driven imperatively in useFrame:
            t = targetRpm / maxRpm  →  knob.x = centreX + (t-0.5)*trackLength
          Drag LEFT↔RIGHT to set RPM. Only effective when power is on
          (store enforces: setTargetRpm no-ops when power==false).
          Metallic silver material matches the real machine.
      ───────────────────────────────────────────────────────────────────── */}
      <mesh
        ref={speedKnobRef}
        position={[speedTrackCentreX, speedTrackY, speedTrackZ + speedKnobR]}
        onPointerDown={handleKnobPointerDown}
        onPointerOver={handleKnobPointerOver}
        onPointerOut={handleKnobPointerOut}
      >
        <sphereGeometry args={[speedKnobR, 16, 12]} />
        <meshStandardMaterial
          color={cp.speedKnobColor}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

    </group>
  );
}
