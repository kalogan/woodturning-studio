/**
 * Stand — cast-iron arch-leg floor stand for the Jet JWL-1642EVS.
 *
 * Design: two heavy cream cast-iron legs shaped like a tall, near-vertical
 * archway pillar — NOT a wide splayed triangle.  The casting centerline is
 * vertical.  The outer edge bows GENTLY outward (quadratic bezier, only a
 * small convex bulge) while remaining essentially vertical.  The inner edge
 * is also near-vertical.  A tall, narrow rounded-top arch window is punched
 * through the center.  Solid base band at the bottom (accent stripes + feet)
 * and solid top mounting band where the bed fastens.
 *
 * Leg geometry: THREE.Shape in Y-Z plane (height=Y, width=Z) + PATH hole
 * (arch window) → ExtrudeGeometry (extruded along shape-local Z, then
 * the mesh is rotated −90° around Y so that axis maps to world X).
 *
 * Basket: wire tray that hangs on the LEFT leg (−X) via two curved hook
 * rods at its back rim.  Raised to ≈60 % of legHeight, adjacent to the
 * left leg's inner face.
 *
 * Local origin: floor level (Y = 0), centred in X and Z.
 * Bed-mount top surface: Y = legHeight + topPlateThickness  (= machineY in Lathe.tsx)
 *
 * No per-frame allocation — geometry created once in useMemo.
 */

import { useMemo, type ReactElement } from 'react';
import * as THREE from 'three';
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { paintedCastIron, bareSteel } from './materials.js';

interface StandProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const s = spec.stand;

// ── Pre-allocated static material props ──────────────────────────────────────
const castMat      = paintedCastIron(s.color);
const footMat      = { color: s.footColor,                  roughness: 0.7, metalness: 0.1 };
const primaryMat   = { color: s.accentStripe.primaryColor,  roughness: 0.4, metalness: 0.1 };
const secondaryMat = { color: s.accentStripe.secondaryColor,roughness: 0.4, metalness: 0.1 };
const basketMat    = bareSteel(s.toolBasket.color);

// ── Derived constants ────────────────────────────────────────────────────────
const H   = s.legHeight;
const FW  = s.footWidth;         // Z-span at the floor (only modestly wide)
const TW  = s.topWidth;          // Z-span at the top
const LT  = s.legThickness;      // X thickness of the extruded slab
const AIR = s.archInsetRatio;    // arch inset ratio (0..1)

// The bed length determines where each leg sits along X
const bedHalfLen = spec.bed.length / 2;
const LEG_X      = bedHalfLen;   // each leg centred at ±LEG_X

// ── Helper: build the 2-D leg profile shape (Y-Z plane) with arch hole ───────
//
// OUTER SLAB — near-vertical upright pillar:
//   The casting's CENTERLINE is perfectly vertical.
//   Inner edge (toward machine center, negative Z):  nearly vertical
//     from (−TW/2, 0) up to (−TW/2, H) — straight.
//   Outer edge (away from center, positive Z):  gentle CONVEX quadratic bezier
//     from (FW/2, 0) bowing outward slightly to (TW/2, H).
//     Control point sits at Z = FW/2 + (FW-TW)*0.12 at mid-height —
//     a very small outward bow, just enough to suggest the cast-iron bulge.
//   Top: straight from (TW/2, H) to (−TW/2, H).
//   Bottom: straight from (−TW/2, 0) to (FW/2, 0).
//     (The foot is only modestly wider than the top — FW=0.42, TW=0.2.)
//
// ARCH HOLE — tall narrow rounded-top window centred in the slab.
//   BASE_BAND : solid cast iron at foot (accent stripe region)
//   TOP_BAND  : solid cast iron at crown (bed mounting region)
//   Opening half-width sized from topWidth so it fits inside the narrow top.
//   Arch height = 65 % of legHeight → tall, slender window.
//   Crown: full semicircle with radius = holeHalfW.
//
function buildLegShape(): THREE.Shape {
  // ── Outer slab ──
  const shape = new THREE.Shape();

  // Bottom-left (inner, negative Z side)
  shape.moveTo(-TW / 2, 0);

  // Inner edge: straight up (nearly vertical — slight taper from FW to TW but
  // we use TW for both inner edges to keep them truly vertical)
  shape.lineTo(-TW / 2, H);

  // Top edge: straight across to outer top corner
  shape.lineTo( TW / 2, H);

  // Outer edge: GENTLE CONVEX quadratic bezier downward to foot corner.
  // The foot outer corner is at (FW/2, 0) — only modestly wider than top.
  // Control point at mid-height bows outward very slightly:
  //   Z_ctrl = FW/2 + (FW - TW) * 0.10   (10 % extra bow beyond foot width)
  //   Y_ctrl = H * 0.5
  const zOuterFoot = FW / 2;
  const zCtrl = zOuterFoot + (FW - TW) * 0.10;
  const yCtrl = H * 0.5;
  shape.quadraticCurveTo(zCtrl, yCtrl, zOuterFoot, 0);

  // Close: bottom edge back to start
  shape.lineTo(-TW / 2, 0);

  // ── Arch hole dims ──
  const BASE_BAND  = H * 0.16;   // solid base band (accent stripe + feet)
  const TOP_BAND   = H * 0.14;   // solid top band (bed mounting)

  // Opening half-width: sized so arch fits within the topWidth.
  // archInsetRatio=0.5 → opening half-width = 50 % of (TW/2) = TW/4.
  // This gives a TALL NARROW window — correct for a cast pillar.
  const holeHalfW   = (TW / 2) * (1 - AIR);
  const holeBottom  = BASE_BAND;
  const holeTop     = H - TOP_BAND;          // springing line
  const archRadius  = holeHalfW;             // semicircle radius = half opening width
  const archCenterY = holeTop;

  // Hole path: winds CCW (opposite to the CW outer shape → cuts a hole).
  // Bottom-left → bottom-right → up right side → semicircle crown (CCW) → down left side.
  const hole = new THREE.Path();
  hole.moveTo(-holeHalfW, holeBottom);
  hole.lineTo( holeHalfW, holeBottom);
  hole.lineTo( holeHalfW, archCenterY);
  // Semicircle from +Z to −Z (CCW when viewed from front)
  hole.absarc(0, archCenterY, archRadius, 0, Math.PI, false);
  hole.lineTo(-holeHalfW, holeBottom);

  shape.holes.push(hole);
  return shape;
}

// ── Wire basket constants ────────────────────────────────────────────────────
const BW = s.toolBasket.width;
const BD = s.toolBasket.depth;
const BH = s.toolBasket.height;
const WD = s.toolBasket.wireDiameter;

// Basket hangs at ~60 % of leg height (just below bed underside).
const BASKET_Y = H * 0.60;

// Left leg inner face in Z-local coords of the Stand group:
// The left leg is at X = −LEG_X.  Its "inner face" in world X is at
// X = −LEG_X + LT/2.  The basket sits adjacent: its right rim near that face.
const LEFT_LEG_INNER_X = -LEG_X + LT / 2;

// Basket is placed so its right rim is near LEFT_LEG_INNER_X.
// Basket X centre = LEFT_LEG_INNER_X − BW/2 − WD
const BASKET_X = LEFT_LEG_INNER_X - BW / 2 - WD;

// Number of wires per direction
const WIRES_LONG  = 8;
const WIRES_CROSS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// CastLeg — one extruded cast-iron leg with stripes and feet
// ─────────────────────────────────────────────────────────────────────────────
function CastLeg({ x }: { x: number }) {
  const legGeom = useMemo(() => {
    const shape = buildLegShape();
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: LT,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.002,
      bevelSegments: 2,
    });
    // Centre the extrusion along the extrude axis (shape-local Z).
    geom.translate(0, 0, -LT / 2);
    return geom;
  }, []);

  // The shape is in Y-Z; extrude goes along shape-local Z.
  // Rotate the mesh −90° around Y so shape-z → world-X.
  // That maps:  shape-Y → world-Y ✓,  shape-Z (extrude) → world-X ✓,
  //             shape-X (= Z-width) → world-Z ✓.

  const AS = s.accentStripe;
  const stripe1Y = AS.fromFloor + AS.height / 2;
  const stripe2Y = AS.fromFloor + AS.height + AS.height / 2;
  // Stripes span the full footWidth in Z
  const stripeArgs: [number, number, number] = [LT + 0.002, AS.height, FW];

  const AF = s;
  const footArgs: [number, number, number, number] = [
    AF.adjustableFootDiameter / 2,
    AF.adjustableFootDiameter / 2,
    AF.adjustableFootHeight,
    12,
  ];
  const footY = -AF.adjustableFootHeight / 2;

  const padArgs: [number, number, number] = [LT * 1.1, s.topPlateThickness, TW];
  const padY = H + s.topPlateThickness / 2;

  return (
    <group position={[x, 0, 0]}>
      {/* Cast leg slab — shape in Y-Z, extrude-axis → world-X via −90° Y rotation */}
      <mesh rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={legGeom} />
        <meshStandardMaterial {...castMat} />
      </mesh>

      {/* Accent stripe 1 — primary (red) */}
      <mesh position={[0, stripe1Y, 0]}>
        <boxGeometry args={stripeArgs} />
        <meshStandardMaterial {...primaryMat} />
      </mesh>

      {/* Accent stripe 2 — secondary (black) */}
      <mesh position={[0, stripe2Y, 0]}>
        <boxGeometry args={stripeArgs} />
        <meshStandardMaterial {...secondaryMat} />
      </mesh>

      {/* Adjustable feet — front and back corners */}
      <mesh position={[0, footY,  FW / 2]}>
        <cylinderGeometry args={footArgs} />
        <meshStandardMaterial {...footMat} />
      </mesh>
      <mesh position={[0, footY, -FW / 2]}>
        <cylinderGeometry args={footArgs} />
        <meshStandardMaterial {...footMat} />
      </mesh>

      {/* Top mounting pad */}
      <mesh position={[0, padY, 0]}>
        <boxGeometry args={padArgs} />
        <meshStandardMaterial {...castMat} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WireBasket — wire-mesh tray hanging from the LEFT (−X) leg
//
// Sits adjacent to the left leg's inner face, raised to ~60 % of legHeight.
// Two curved hook rods rise from the basket's back (right) rim and curl over
// to hook onto the left leg's inner face — making it visibly HANG from the leg.
// ─────────────────────────────────────────────────────────────────────────────
function WireBasket() {
  const hw = BW / 2;   // half width (X)
  const hd = BD / 2;   // half depth (Z)

  const rimY   = BASKET_Y + BH;  // top rim Y
  const floorY = BASKET_Y;       // basket floor Y

  // Rim segment geometry
  const rimLongArgs:  [number, number, number] = [BW, WD, WD];
  const rimCrossArgs: [number, number, number] = [WD, WD, BD];

  // Longitudinal floor wires (along X)
  const longWires: ReactElement[] = [];
  for (let i = 0; i < WIRES_LONG; i++) {
    const t = i / (WIRES_LONG - 1);
    const z = -hd + t * BD;
    longWires.push(
      <mesh key={`lw-${String(i)}`} position={[BASKET_X, floorY, z]}>
        <boxGeometry args={[BW, WD, WD]} />
        <meshStandardMaterial {...basketMat} />
      </mesh>,
    );
  }

  // Cross floor wires (along Z)
  const crossWires: ReactElement[] = [];
  for (let i = 0; i < WIRES_CROSS; i++) {
    const t = i / (WIRES_CROSS - 1);
    const x = BASKET_X - hw + t * BW;
    crossWires.push(
      <mesh key={`cw-${String(i)}`} position={[x, floorY, 0]}>
        <boxGeometry args={[WD, WD, BD]} />
        <meshStandardMaterial {...basketMat} />
      </mesh>,
    );
  }

  // Corner posts (4 vertical wires connecting floor to rim)
  const postH    = BH;
  const postArgs: [number, number, number] = [WD, postH, WD];
  const postY    = BASKET_Y + BH / 2;
  const corners: [number, number][] = [
    [ hw,  hd],
    [ hw, -hd],
    [-hw,  hd],
    [-hw, -hd],
  ];

  // ── Hook rods ──
  // Two thin cylinder rods (front-Z and back-Z positions) that rise from the
  // basket's right (LEFT_LEG_INNER_X side) top rim and hook over to attach to
  // the left leg's inner face at X = LEFT_LEG_INNER_X.
  //
  // Each hook: a vertical rise segment + a short horizontal reach segment.
  // We approximate the curve with two short cylinders per hook.
  //
  // Hook base X = BASKET_X + hw  (right rim of basket, nearest left leg)
  // Hook tip  X = LEFT_LEG_INNER_X
  // Hook base Y = rimY
  // Hook tip  Y = rimY + 0.05  (rises ~5 cm above rim then bends)
  //
  const hookBaseX  = BASKET_X + hw;         // right edge of basket
  const hookTipX   = LEFT_LEG_INNER_X;      // left leg inner face
  const hookBaseY  = rimY;
  const hookTopY   = rimY + 0.06;           // 6 cm rise
  const hookZFront = hd * 0.5;              // front hook offset in Z
  const hookZBack  = -hd * 0.5;            // back hook offset in Z

  // Vertical rise: from hookBaseY to hookTopY, at hookBaseX
  const riseH    = hookTopY - hookBaseY;
  const riseArgs: [number, number, number, number] = [WD / 2, WD / 2, riseH, 8];
  const riseY    = hookBaseY + riseH / 2;

  // Horizontal reach: from hookBaseX to hookTipX, at hookTopY
  const reachLen  = Math.abs(hookTipX - hookBaseX);
  const reachArgs: [number, number, number, number] = [WD / 2, WD / 2, reachLen, 8];
  const reachX    = (hookBaseX + hookTipX) / 2;

  const hookZs = [hookZFront, hookZBack];

  return (
    <group>
      {/* Top rim — front long bar */}
      <mesh position={[BASKET_X, rimY,  hd]}>
        <boxGeometry args={rimLongArgs} />
        <meshStandardMaterial {...basketMat} />
      </mesh>
      {/* Top rim — back long bar */}
      <mesh position={[BASKET_X, rimY, -hd]}>
        <boxGeometry args={rimLongArgs} />
        <meshStandardMaterial {...basketMat} />
      </mesh>
      {/* Top rim — right cross bar (nearest left leg) */}
      <mesh position={[BASKET_X + hw, rimY, 0]}>
        <boxGeometry args={rimCrossArgs} />
        <meshStandardMaterial {...basketMat} />
      </mesh>
      {/* Top rim — left cross bar */}
      <mesh position={[BASKET_X - hw, rimY, 0]}>
        <boxGeometry args={rimCrossArgs} />
        <meshStandardMaterial {...basketMat} />
      </mesh>

      {/* Floor wires */}
      {longWires}
      {crossWires}

      {/* Corner posts */}
      {corners.map(([cx, cz], i) => (
        <mesh key={`post-${String(i)}`} position={[BASKET_X + cx, postY, cz]}>
          <boxGeometry args={postArgs} />
          <meshStandardMaterial {...basketMat} />
        </mesh>
      ))}

      {/* Hook rods — two hooks (front and back Z) attaching basket to left leg */}
      {hookZs.map((hz, i) => (
        <group key={`hook-${String(i)}`}>
          {/* Vertical rise segment */}
          <mesh position={[hookBaseX, riseY, hz]}>
            <cylinderGeometry args={riseArgs} />
            <meshStandardMaterial {...basketMat} />
          </mesh>
          {/* Horizontal reach segment (rotated 90° around Z to run along X) */}
          <mesh position={[reachX, hookTopY, hz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={reachArgs} />
            <meshStandardMaterial {...basketMat} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stand (exported)
// ─────────────────────────────────────────────────────────────────────────────
export function Stand({ position = [0, 0, 0], rotation = [0, 0, 0] }: StandProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* Headstock-side leg (−X) */}
      <CastLeg x={-LEG_X} />

      {/* Tailstock-side leg (+X) */}
      <CastLeg x={LEG_X} />

      {/* Wire tool basket hanging from the left (−X) leg */}
      <WireBasket />
    </group>
  );
}
