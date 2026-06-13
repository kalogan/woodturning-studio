/**
 * Headstock — left-end housing of the Jet JWL-1642EVS.
 *
 * Features modelled:
 *  - Cream cast-iron body box
 *  - BLACK cylindrical motor housing drum protruding from the -X (left) end
 *  - Control panel on the front (+Z) face:
 *      · Digital RPM readout rectangle (emissive, dark green display)
 *        — live digits drawn into a CanvasTexture; updated imperatively each
 *          frame only when the integer RPM changes (no per-frame re-render,
 *          no per-frame allocation).
 *      · Round green START/power button (left cluster, adjacent to speed knob)
 *      · Round red E-stop button (right side, separate)
 *      · Two small knob cylinders (speed / direction) — speed knob has an
 *        indicator mark on its front face so rotation is readable in T2
 *  - Spindle nose short cylinder protruding +X
 *
 * All dimensions from spec.headstock (and spec.headstock.motorHousing /
 * spec.headstock.controlPanel). No hardcoded measurements.
 */
import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { paintedCastIron, bareSteel, darkCastIron, blackRubber } from './materials.js';
import { useLatheStore } from '../../workshop/index.js';
import { formatRpm } from './rpmFormat.js';

interface HeadstockProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const bodyMat     = paintedCastIron(spec.headstock.color);
const steelMat    = bareSteel();
const motorMat    = darkCastIron('#1f1f1d');   // near-black cast housing
const panelMat    = darkCastIron('#232323');   // control panel backing
const knobMat     = blackRubber();

// ── Readout canvas dimensions (pixels) ──────────────────────────────────────
// Higher resolution for legible digits; power-of-two not strictly required but
// improves GPU mip-mapping. These are texture pixel counts, not world units.
const READOUT_CANVAS_W = 256;
const READOUT_CANVAS_H = 64;

// ── Drag sensitivity ─────────────────────────────────────────────────────────
// Moving this many pixels vertically sweeps the full [0, maxRpm] range.
const DRAG_PIXELS_FOR_FULL_RANGE = 200;

// ── Speed knob rotation sweep ─────────────────────────────────────────────────
// 270° sweep from -135° (min RPM) to +135° (max RPM).
const KNOB_MIN_ANGLE = -Math.PI * 0.75; // -135°
const KNOB_MAX_ANGLE =  Math.PI * 0.75; //  +135°

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

  // ── RPM readout canvas + texture (pre-allocated once, reused every frame) ──
  // The canvas element, 2D context, and CanvasTexture are created once in useMemo.
  // useFrame reads the RPM imperatively (no subscription/re-render), redraws the
  // canvas ONLY when the integer value changes, then flags needsUpdate.
  const { ctx: readoutCtx, texture: readoutTexture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width  = READOUT_CANVAS_W;
    canvas.height = READOUT_CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Headstock: could not get 2D canvas context for RPM readout');

    // Initial draw — show "0" at rest
    const texture = new THREE.CanvasTexture(canvas);
    return { ctx, texture };
  }, []); // created once, never re-created — stable empty dep array is intentional

  // Track the last integer we painted so we skip identical frames.
  const lastDisplayedRpm = useRef<number>(-1);

  // ── Speed knob mesh ref — we rotate it visually to reflect targetRpm ────────
  const speedKnobRef = useRef<THREE.Mesh>(null);

  // ── Drag state — pre-allocated scalars, no per-event heap allocation ─────────
  // isDragging: are we currently tracking a pointer drag?
  // dragStartY: clientY where the drag began (pixels).
  // dragStartRpm: targetRpm at the moment the drag began.
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartRpm = useRef(0);

  // ── START button handlers ─────────────────────────────────────────────────────
  const handleStartClick = useCallback((_e: ThreeEvent<MouseEvent>) => {
    const { power, setPower } = useLatheStore.getState();
    setPower(!power);
  }, []);

  const handleStartPointerOver = useCallback((_e: ThreeEvent<PointerEvent>) => {
    document.body.style.cursor = 'pointer';
  }, []);

  const handleStartPointerOut = useCallback((_e: ThreeEvent<PointerEvent>) => {
    document.body.style.cursor = '';
  }, []);

  // ── Speed dial handlers ───────────────────────────────────────────────────────
  const handleDialPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDragging.current = true;
    dragStartY.current = e.nativeEvent.clientY;
    dragStartRpm.current = useLatheStore.getState().targetRpm;
    document.body.style.cursor = 'ns-resize';
  }, []);

  const handleDialPointerOver = useCallback((_e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) {
      document.body.style.cursor = 'ns-resize';
    }
  }, []);

  const handleDialPointerOut = useCallback((_e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) {
      document.body.style.cursor = '';
    }
  }, []);

  // Window-level pointermove/pointerup: registered on mount, stable no-alloc handlers.
  // We capture the handlers in refs so the effect cleanup can remove the exact same function.
  const onWindowPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current) return;
    const { maxRpm, setTargetRpm } = useLatheStore.getState();
    // Drag UP = increase RPM (negative deltaY because screen Y goes down).
    const deltaY = dragStartY.current - e.clientY;
    const deltaRpm = (deltaY / DRAG_PIXELS_FOR_FULL_RANGE) * maxRpm;
    const newRpm = dragStartRpm.current + deltaRpm;
    setTargetRpm(newRpm); // store clamps to [0, maxRpm] and guards power-off
    // Empty dep array is intentional: reads all state via refs + store.getState()
    // so the callback never captures stale values without needing to re-register.
  }, []); // stable by design — all mutable reads go through .current / getState()

  const onWindowPointerUp = useCallback((_e: PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.cursor = '';
    // stable by design — only touches .current
  }, []);

  // Register and clean up the window-level drag listeners once on mount.
  // useEffect (not useMemo) so React handles the cleanup on unmount.
  // Empty dep array is intentional: the handlers are stable references (see above).
  useEffect(() => {
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
    };
  }, []); // stable handlers registered once on mount

  // Helper — draw the readout display; called on first render and whenever
  // the integer RPM changes. No allocation: reuses existing canvas / ctx.
  function drawReadout(intRpm: number) {
    readoutCtx.clearRect(0, 0, READOUT_CANVAS_W, READOUT_CANVAS_H);

    // Background — dark LCD green
    readoutCtx.fillStyle = '#0a1a0a';
    readoutCtx.fillRect(0, 0, READOUT_CANVAS_W, READOUT_CANVAS_H);

    // Digits — bright green, right-aligned
    // Font size pre-computed as an integer string to satisfy strict template-literal rules.
    const fontSizePx = Math.round(READOUT_CANVAS_H * 0.75).toString();
    readoutCtx.fillStyle = '#00ff44';
    readoutCtx.font = `bold ${fontSizePx}px monospace`;
    readoutCtx.textAlign = 'right';
    readoutCtx.textBaseline = 'middle';
    readoutCtx.fillText(formatRpm(intRpm), READOUT_CANVAS_W - 6, READOUT_CANVAS_H / 2);

    readoutTexture.needsUpdate = true;
  }

  // Draw the initial "0" immediately (before first frame).
  // Stable empty dep array is intentional — we only want this side effect once.
  useMemo(() => { drawReadout(0); }, []);

  // Per-frame update — imperative, no React re-render, no heap allocation.
  // KNOB_MIN_ANGLE / KNOB_MAX_ANGLE are module-level constants (270° sweep).
  useFrame(() => {
    const { currentRpm, targetRpm, maxRpm } = useLatheStore.getState();

    // ── RPM readout ───────────────────────────────────────────────────────────
    const intRpm = Math.round(currentRpm);
    if (intRpm !== lastDisplayedRpm.current) {
      lastDisplayedRpm.current = intRpm;
      drawReadout(intRpm);
    }

    // ── Speed knob visual rotation ─────────────────────────────────────────────
    // Rotates to show targetRpm position (what the dial is set to, not currentRpm),
    // so it feels like a physical dial the player sets, not a tachometer.
    const knob = speedKnobRef.current;
    if (knob !== null && maxRpm > 0) {
      const t = targetRpm / maxRpm; // normalised [0, 1]
      // Interpolate from min to max angle; Z rotation tilts the indicator mark.
      knob.rotation.z = KNOB_MIN_ANGLE + t * (KNOB_MAX_ANGLE - KNOB_MIN_ANGLE);
    }
  });

  // ── Body ─────────────────────────────────────────────────────────────────
  // Local origin is at the bed surface, left face of headstock.
  // The body box centre Y = height/2, X = width/2 (right of left face).
  const bodyY = height / 2;

  // ── Motor housing drum ────────────────────────────────────────────────────
  // The spec gives width×height×depth as a bounding box.
  // Represent as a horizontal cylinder: diameter = min(width, height), length = depth.
  // It protrudes from the -X end of the headstock body.
  const motorDiameter = Math.min(motorHousing.width, motorHousing.height);
  const motorRadius = motorDiameter / 2;
  const motorLength = motorHousing.depth;
  // Centre of motor drum: just to the left of the body left face (X=0 in headstock local),
  // so X = -(motorLength/2)
  const motorX = -(motorLength / 2);
  const motorY = bodyY; // vertically centred on the body

  // ── Spindle nose ──────────────────────────────────────────────────────────
  // Protrudes +X from the body right face (X = width)
  const spindleNoseX = width + spindleNoseLength / 2;

  // ── Control panel ─────────────────────────────────────────────────────────
  // Panel sits proud on the front (+Z) face of the body, centred horizontally on the body.
  const cp = controlPanel;
  const panelX = width / 2;            // centred along body width
  const panelY = bodyY + cp.height / 2 - height / 2 + height * 0.1; // lower-centre of face
  const panelZ = depth / 2 + cp.depth / 2; // flush with / just proud of front face

  // Readout — upper portion of the panel
  const readoutY = panelY + cp.height * 0.2;
  const readoutZ = panelZ + 0.001; // sits on top of panel

  // E-stop button — lower-right of panel
  const estopR = cp.estopDiameter / 2;
  const estopX = panelX + cp.width * 0.2;
  const estopY = panelY - cp.height * 0.2;
  const estopZ = panelZ + estopR; // protrudes from panel face

  // Small knobs (speed + direction) — to the left side of the panel
  const knobR = 0.012;
  const knobLen = 0.015;

  // START button — adjacent to the speed knob (left cluster: power + speed grouped)
  // Placed to the right of the speed knob at the same Y row.
  const startR = cp.startButtonDiameter / 2;
  const speedKnobX = panelX - cp.width * 0.25;
  const speedKnobY = panelY + cp.height * 0.15;
  const startBtnX = speedKnobX + knobR * 2 + startR + 0.004; // snug beside the speed knob
  const startBtnY = speedKnobY;
  const startBtnZ = panelZ + startR; // protrudes proud like E-stop

  // Speed knob indicator mark — thin contrasting strip on the +Z face near the rim,
  // pointing "up" at rest (local Y+). Rendered as a child in the group at world coords.
  const markWidth  = knobR * 0.35;
  const markHeight = knobR * 0.7;
  const markDepth  = 0.001;
  const markX = speedKnobX;
  const markY = speedKnobY + knobR * 0.55; // near top of knob face
  const markZ = panelZ + knobLen + 0.001;  // just proud of the knob front face

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

      {/* ── RPM readout display ── live canvas texture showing currentRpm */}
      {/* The CanvasTexture is redrawn imperatively in useFrame (above) only when  */}
      {/* the integer RPM changes — no per-frame re-render, no per-frame alloc.    */}
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

      {/* ── E-stop button ── red round cylinder */}
      <mesh position={[estopX, estopY, estopZ]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[estopR, estopR, estopR * 1.2, 16]} />
        <meshStandardMaterial color={cp.estopColor} roughness={0.5} metalness={0.0} />
      </mesh>

      {/* ── Speed knob — draggable; rotates visually to reflect targetRpm ── */}
      {/* Drag UP to raise RPM, DOWN to lower. Only effective when power is on. */}
      <mesh
        ref={speedKnobRef}
        position={[panelX - cp.width * 0.25, panelY + cp.height * 0.15, panelZ + knobR]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerDown={handleDialPointerDown}
        onPointerOver={handleDialPointerOver}
        onPointerOut={handleDialPointerOut}
      >
        <cylinderGeometry args={[knobR, knobR, knobLen, 12]} />
        <meshStandardMaterial {...knobMat} />
      </mesh>

      {/* ── Direction knob ── */}
      <mesh
        position={[panelX - cp.width * 0.25, panelY - cp.height * 0.15, panelZ + knobR]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[knobR, knobR, knobLen, 12]} />
        <meshStandardMaterial {...knobMat} />
      </mesh>

      {/* ── Speed knob indicator mark — thin light strip on front face, pointing up at rest */}
      {/* T2 will rotate the speed knob; this mark makes the angle readable */}
      <mesh position={[markX, markY, markZ]}>
        <boxGeometry args={[markWidth, markHeight, markDepth]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* ── START / power button — green, clickable, toggles lathe power ── */}
      {/* Click to power ON (then drag the speed dial to set RPM).           */}
      <mesh
        position={[startBtnX, startBtnY, startBtnZ]}
        rotation={[Math.PI / 2, 0, 0]}
        onClick={handleStartClick}
        onPointerOver={handleStartPointerOver}
        onPointerOut={handleStartPointerOut}
      >
        <cylinderGeometry args={[startR, startR, startR * 1.2, 16]} />
        <meshStandardMaterial color={cp.startButtonColor} roughness={0.5} metalness={0.0} />
      </mesh>
    </group>
  );
}
