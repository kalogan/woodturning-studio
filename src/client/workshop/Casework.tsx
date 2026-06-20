/**
 * Casework.tsx — Built-in workshop casework along the back wall (−Z).
 *
 * Layout (left→right along back wall, X from −2.7 to +2.7):
 *   [BaseCabinets + countertop] runs the full 5.4 m width
 *   Upper wall cabinets mounted at Y=1.5, with two glass-front sections
 *   Open shelving unit (centre-left) with wood blanks and rolled sandpaper
 *
 * Back wall sits at Z = −2.5. Cabinets are 0.6 m deep, so front face ≈ Z = −1.87.
 * Upper cabs are 0.3 m deep, front face ≈ Z = −2.05.
 *
 * No per-frame allocations — static scene only.
 */

import {
  cabinetPaint,
  laminateCounter,
  brushedSteelHandle,
  paintedSteelCabinet,
} from '../lathe/materials.js';
import { makeBoardMaterial } from '../wood/woodMaterial.js';

// ── Constants ──────────────────────────────────────────────────────────────────
const WALL_Z = -2.5;       // back wall centre Z
const BASE_H = 0.9;        // base cabinet height (top surface)
const BASE_D = 0.6;        // base cabinet depth
const BASE_TOP_T = 0.04;   // countertop thickness
const UPPER_H = 0.7;       // upper cabinet height
const UPPER_D = 0.3;       // upper cabinet depth
const UPPER_Y = 1.55 + UPPER_H / 2; // centre Y of upper cabs (bottom at ~1.55)
// Front face of base cabinets (cabinet centre Z + half-depth)
const BASE_FRONT_Z = WALL_Z + BASE_D;  // = −1.9

// Material props — pre-allocated at module scope
const cabMat      = cabinetPaint();                     // painted MDF white body
const cabShadowMat = cabinetPaint('#d0cdc6');           // slightly darker inset lines
const handleMat   = brushedSteelHandle('#b0a888');      // warm brushed-steel pulls
const counterMat  = laminateCounter();                  // grey laminate top
// Open-shelving CARCASS: painted-steel (grey/neutral metal, not wood-grain)
const shelfCarcassMat = paintedSteelCabinet('#878d8a'); // neutral grey painted steel

// Glass-front door: kept as literal since it has unique transparent props
const GLASS_COL = '#7090a8';       // bluish-grey for glass-front doors

// ── Lower base cabinet run ─────────────────────────────────────────────────────

export function BaseCabinets() {
  // One long carcass, then door/drawer lines on front face
  const totalW = 5.4;
  const centreX = 0;

  // Door-line X positions (dividers every ~0.6 m, 9 sections)
  const doorDividers: number[] = [];
  for (let i = -4; i <= 4; i++) {
    doorDividers.push(centreX + i * 0.6);
  }

  // Handles: one per door/drawer section
  const handles: number[] = doorDividers.map((x) => x);

  return (
    <group name="base-cabinets">
      {/* Main carcass */}
      <mesh castShadow receiveShadow position={[centreX, BASE_H / 2, WALL_Z + BASE_D / 2]}>
        <boxGeometry args={[totalW, BASE_H, BASE_D]} />
        <meshStandardMaterial {...cabMat} />
      </mesh>

      {/* Countertop */}
      <mesh
        castShadow
        receiveShadow
        position={[centreX, BASE_H + BASE_TOP_T / 2, WALL_Z + BASE_D / 2]}
      >
        <boxGeometry args={[totalW + 0.02, BASE_TOP_T, BASE_D + 0.02]} />
        <meshStandardMaterial {...counterMat} />
      </mesh>

      {/* Vertical door-line dividers (inset strips on front face).
          Placed at BASE_FRONT_Z + epsilon to avoid z-fighting with carcass face. */}
      {doorDividers.map((x, i) => (
        <mesh key={`div-${String(i)}`} position={[x, BASE_H / 2, BASE_FRONT_Z + 0.003]}>
          <boxGeometry args={[0.012, BASE_H - 0.04, 0.008]} />
          <meshStandardMaterial {...cabShadowMat} />
        </mesh>
      ))}

      {/* Horizontal mid-rail (separates upper drawer from lower door).
          Same epsilon offset off the front face. */}
      <mesh position={[centreX, 0.52, BASE_FRONT_Z + 0.003]}>
        <boxGeometry args={[totalW - 0.02, 0.012, 0.008]} />
        <meshStandardMaterial {...cabShadowMat} />
      </mesh>

      {/* Handles — one per section (mounted proud of divider layer) */}
      {handles.map((x, i) => (
        <mesh key={`h-${String(i)}`} position={[x, 0.62, BASE_FRONT_Z + 0.016]}>
          <boxGeometry args={[0.1, 0.018, 0.012]} />
          <meshStandardMaterial {...handleMat} />
        </mesh>
      ))}
    </group>
  );
}

// ── Upper wall cabinets ────────────────────────────────────────────────────────

export function UpperCabinets() {
  // Three sections: solid left, glass-front centre-left, solid right, glass-front right
  // Each section ~1.35 m wide, four total covering ~5.4 m
  type Section = { x: number; w: number; glass: boolean };
  const sections: Section[] = [
    { x: -2.025, w: 1.35, glass: false },
    { x: -0.675, w: 1.35, glass: true },
    { x: 0.675,  w: 1.35, glass: false },
    { x: 2.025,  w: 1.35, glass: true },
  ];

  const centreZ = WALL_Z + UPPER_D / 2;

  return (
    <group name="upper-cabinets">
      {sections.map((sec, i) => (
        <group key={i} position={[sec.x, UPPER_Y, centreZ]}>
          {/* Carcass */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[sec.w, UPPER_H, UPPER_D]} />
            <meshStandardMaterial {...cabMat} />
          </mesh>

          {/* Door panel — glass or solid */}
          <mesh position={[0, 0, UPPER_D / 2 + 0.002]}>
            <boxGeometry args={[sec.w - 0.04, UPPER_H - 0.04, 0.016]} />
            {sec.glass ? (
              <meshStandardMaterial
                color={GLASS_COL}
                roughness={0.05}
                metalness={0.1}
                transparent
                opacity={0.3}
              />
            ) : (
              <meshStandardMaterial {...cabShadowMat} />
            )}
          </mesh>

          {/* Door handle */}
          <mesh position={[0, -0.05, UPPER_D / 2 + 0.014]}>
            <boxGeometry args={[0.1, 0.015, 0.01]} />
            <meshStandardMaterial {...handleMat} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Open shelving unit with blanks + sandpaper ─────────────────────────────────

// Wood blanks STACKED as a tidy lumber pile on the open shelves.
// Each board lays along X (length); squared stock of side BLANK_T; layered in Y
// (sits on the board below) and slotted across the shelf depth in Z. All centred
// in X within the 0.85 m shelf, so nothing overhangs the edges.
const BLANK_T = 0.07;                  // square stock side (thickness)
const BLANK_Z_PITCH = BLANK_T + 0.006; // side-by-side spacing across the shelf depth

const SHELF_BLANKS: Array<{
  len: number;
  color: string;
  shelf: number;   // 0 = bottom
  layer: number;   // stack course (0 = resting on the shelf)
  slot: number;    // index across the shelf depth (Z)
  slots: number;   // boards in this course (to centre them in Z)
  xCenter: number; // small X jitter, kept well inside the shelf
}> = [
  // Shelf 0 — a 3-wide base course + a 2-wide top course
  { len: 0.54, color: '#8B5E3C', shelf: 0, layer: 0, slot: 0, slots: 3, xCenter:  0.00 },
  { len: 0.50, color: '#a0703a', shelf: 0, layer: 0, slot: 1, slots: 3, xCenter:  0.02 },
  { len: 0.52, color: '#6b4020', shelf: 0, layer: 0, slot: 2, slots: 3, xCenter: -0.01 },
  { len: 0.48, color: '#9a6535', shelf: 0, layer: 1, slot: 0, slots: 2, xCenter:  0.01 },
  { len: 0.52, color: '#7a4e28', shelf: 0, layer: 1, slot: 1, slots: 2, xCenter: -0.02 },
  // Shelf 1 — a 2 + 1 stack
  { len: 0.46, color: '#c09055', shelf: 1, layer: 0, slot: 0, slots: 2, xCenter:  0.00 },
  { len: 0.50, color: '#7a4e28', shelf: 1, layer: 0, slot: 1, slots: 2, xCenter:  0.02 },
  { len: 0.44, color: '#6b4020', shelf: 1, layer: 1, slot: 0, slots: 1, xCenter:  0.00 },
  // Shelf 2 — two boards side by side
  { len: 0.42, color: '#9a6535', shelf: 2, layer: 0, slot: 0, slots: 2, xCenter:  0.00 },
  { len: 0.46, color: '#a0703a', shelf: 2, layer: 0, slot: 1, slots: 2, xCenter:  0.02 },
];

// Rolled sandpaper: short wide cylinders standing upright or lying
const SANDPAPER: Array<{
  r: number;
  h: number;
  shelf: number;
  xOff: number;
  upright: boolean;
}> = [
  { r: 0.04,  h: 0.055, shelf: 1, xOff:  0.31, upright: true },
  { r: 0.038, h: 0.05,  shelf: 1, xOff:  0.37, upright: true },
  { r: 0.042, h: 0.06,  shelf: 2, xOff:  0.31, upright: true },
  { r: 0.036, h: 0.045, shelf: 2, xOff:  0.37, upright: true },
];

export function OpenShelving() {
  const unitW = 0.9;
  const unitH = BASE_H; // same height as base cabs so countertop continues
  const unitD = BASE_D;
  const shelfCount = 3;
  const shelfSpacing = (unitH - 0.08) / (shelfCount + 1);

  // X centre of this open-shelving unit (placed left-of-centre on back wall)
  const centreX = -1.2;
  const centreZ = WALL_Z + unitD / 2;

  const shelfYs = Array.from({ length: shelfCount }, (_, i) => (i + 1) * shelfSpacing + 0.04);

  return (
    <group name="open-shelving" position={[centreX, 0, centreZ]}>
      {/* Side uprights — painted steel carcass (not wood-grain) */}
      {([-unitW / 2, unitW / 2] as const).map((x, i) => (
        <mesh key={i} castShadow position={[x, unitH / 2, 0]}>
          <boxGeometry args={[0.025, unitH, unitD]} />
          <meshStandardMaterial {...shelfCarcassMat} />
        </mesh>
      ))}

      {/* Back panel — painted steel carcass */}
      <mesh receiveShadow position={[0, unitH / 2, -unitD / 2 + 0.015]}>
        <boxGeometry args={[unitW, unitH, 0.018]} />
        <meshStandardMaterial {...shelfCarcassMat} />
      </mesh>

      {/* Shelves — painted steel carcass */}
      {shelfYs.map((y, i) => (
        <mesh key={i} receiveShadow position={[0, y, 0]}>
          <boxGeometry args={[unitW - 0.05, 0.025, unitD]} />
          <meshStandardMaterial {...shelfCarcassMat} />
        </mesh>
      ))}

      {/* Countertop cap (flush with base cabs) */}
      <mesh castShadow position={[0, unitH + BASE_TOP_T / 2, 0]}>
        <boxGeometry args={[unitW + 0.02, BASE_TOP_T, unitD + 0.02]} />
        <meshStandardMaterial {...counterMat} />
      </mesh>

      {/* Stacked wood blanks — board grain runs along each board's length. */}
      {SHELF_BLANKS.map((b, i) => {
        const shelfY = shelfYs[b.shelf] ?? 0;
        // Sit on the shelf, then stack each course on top of the one below.
        const y = shelfY + 0.0125 + BLANK_T / 2 + b.layer * BLANK_T;
        // Centre the course across the shelf depth (Z).
        const z = (b.slot - (b.slots - 1) / 2) * BLANK_Z_PITCH;
        return (
          <mesh
            key={`blank-${String(i)}`}
            castShadow
            position={[b.xCenter, y, z]}
            rotation={[0, 0, Math.PI / 2]}
          >
            {/* Square stock laid along X; grain axis 'y' = the box's long (length) axis */}
            <boxGeometry args={[BLANK_T, b.len, BLANK_T]} />
            <primitive object={makeBoardMaterial(b.color, undefined, { grainAxis: 'y' })} attach="material" />
          </mesh>
        );
      })}

      {/* Rolled sandpaper */}
      {SANDPAPER.map((sp, i) => (
        <mesh
          key={`sand-${String(i)}`}
          castShadow
          position={[
            sp.xOff,
            (shelfYs[sp.shelf] ?? 0) + (sp.upright ? sp.h / 2 : sp.r) + 0.013,
            sp.upright ? 0 : 0,
          ]}
          rotation={sp.upright ? [0, 0, 0] : [Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[sp.r, sp.r, sp.h, 12]} />
          <meshStandardMaterial color="#c8a06a" roughness={0.88} metalness={0.0} />
        </mesh>
      ))}
    </group>
  );
}

// ── Combined Casework ──────────────────────────────────────────────────────────

export function Casework() {
  return (
    <group name="casework">
      <BaseCabinets />
      <UpperCabinets />
      <OpenShelving />
    </group>
  );
}
