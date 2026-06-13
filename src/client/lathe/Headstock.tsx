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
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
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

  // Per-frame update — imperative, no React re-render
  useFrame(() => {
    const rpm     = useLatheStore.getState().currentRpm;
    const intRpm  = Math.round(rpm);
    if (intRpm === lastDisplayedRpm.current) return; // nothing changed
    lastDisplayedRpm.current = intRpm;
    drawReadout(intRpm);
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

      {/* ── Speed knob ── */}
      <mesh
        position={[panelX - cp.width * 0.25, panelY + cp.height * 0.15, panelZ + knobR]}
        rotation={[Math.PI / 2, 0, 0]}
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

      {/* ── START / power button — green, adjacent to speed knob (left cluster) ── */}
      <mesh position={[startBtnX, startBtnY, startBtnZ]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[startR, startR, startR * 1.2, 16]} />
        <meshStandardMaterial color={cp.startButtonColor} roughness={0.5} metalness={0.0} />
      </mesh>
    </group>
  );
}
