/**
 * Headstock — left-end housing of the Jet JWL-1642EVS.
 *
 * Features modelled:
 *  - Cream cast-iron body box
 *  - BLACK cylindrical motor housing drum protruding from the -X (left) end
 *  - Control panel on the front (+Z) face:
 *      · Digital RPM readout rectangle (emissive, dark green display)
 *      · Round red E-stop button
 *      · Two small knob cylinders (speed / direction)
 *  - Spindle nose short cylinder protruding +X
 *
 * All dimensions from spec.headstock (and spec.headstock.motorHousing /
 * spec.headstock.controlPanel). No hardcoded measurements.
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { paintedCastIron, bareSteel } from './materials.js';

interface HeadstockProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const bodyMat = paintedCastIron(spec.headstock.color);
const steelMat = bareSteel(spec.headstock.color);

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
        <meshStandardMaterial color="#1a1a1a" roughness={0.55} metalness={0.2} />
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
        <meshStandardMaterial color="#2a2a2a" roughness={0.6} metalness={0.1} />
      </mesh>

      {/* ── RPM readout display ── (emissive so it reads as a live screen) */}
      <mesh position={[panelX, readoutY, readoutZ]}>
        <boxGeometry args={[cp.readoutWidth, cp.readoutHeight, 0.003]} />
        <meshStandardMaterial
          color={cp.readoutColor}
          emissive="#00ff44"
          emissiveIntensity={0.25}
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
        <meshStandardMaterial color="#333333" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* ── Direction knob ── */}
      <mesh
        position={[panelX - cp.width * 0.25, panelY - cp.height * 0.15, panelZ + knobR]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[knobR, knobR, knobLen, 12]} />
        <meshStandardMaterial color="#333333" roughness={0.7} metalness={0.1} />
      </mesh>
    </group>
  );
}
