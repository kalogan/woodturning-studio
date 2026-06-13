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

// ── Constants ──────────────────────────────────────────────────────────────────
const WALL_Z = -2.5;       // back wall centre Z
const BASE_H = 0.9;        // base cabinet height (top surface)
const BASE_D = 0.6;        // base cabinet depth
const BASE_TOP_T = 0.04;   // countertop thickness
const UPPER_H = 0.7;       // upper cabinet height
const UPPER_D = 0.3;       // upper cabinet depth
const UPPER_Y = 1.55 + UPPER_H / 2; // centre Y of upper cabs (bottom at ~1.55)

const CAB_WHITE = '#e8e6e0';
const CAB_SHADOW = '#d0cdc6';      // darker inset lines
const HANDLE_COL = '#b0a888';
const COUNTER_COL = '#8a8070';     // grey laminate countertop
const GLASS_COL = '#7090a8';       // bluish-grey for glass-front doors

// ── Lower base cabinet run ─────────────────────────────────────────────────────

export function BaseCabinets() {
  // One long carcass, then door/drawer lines on front face
  const totalW = 5.4;
  const centreX = 0;
  const frontZ = WALL_Z + BASE_D / 2;

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
        <meshStandardMaterial color={CAB_WHITE} roughness={0.75} metalness={0.0} />
      </mesh>

      {/* Countertop */}
      <mesh
        castShadow
        receiveShadow
        position={[centreX, BASE_H + BASE_TOP_T / 2, WALL_Z + BASE_D / 2]}
      >
        <boxGeometry args={[totalW + 0.02, BASE_TOP_T, BASE_D + 0.02]} />
        <meshStandardMaterial color={COUNTER_COL} roughness={0.55} metalness={0.05} />
      </mesh>

      {/* Vertical door-line dividers (inset strips on front face) */}
      {doorDividers.map((x, i) => (
        <mesh key={`div-${String(i)}`} position={[x, BASE_H / 2, frontZ + 0.001]}>
          <boxGeometry args={[0.012, BASE_H - 0.04, 0.008]} />
          <meshStandardMaterial color={CAB_SHADOW} roughness={0.8} metalness={0.0} />
        </mesh>
      ))}

      {/* Horizontal mid-rail (separates upper drawer from lower door) */}
      <mesh position={[centreX, 0.52, frontZ + 0.001]}>
        <boxGeometry args={[totalW - 0.02, 0.012, 0.008]} />
        <meshStandardMaterial color={CAB_SHADOW} roughness={0.8} metalness={0.0} />
      </mesh>

      {/* Handles — one per section */}
      {handles.map((x, i) => (
        <mesh key={`h-${String(i)}`} position={[x, 0.62, frontZ + 0.016]}>
          <boxGeometry args={[0.1, 0.018, 0.012]} />
          <meshStandardMaterial color={HANDLE_COL} roughness={0.4} metalness={0.55} />
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
            <meshStandardMaterial color={CAB_WHITE} roughness={0.75} metalness={0.0} />
          </mesh>

          {/* Door panel — glass or solid */}
          <mesh position={[0, 0, UPPER_D / 2 + 0.002]}>
            <boxGeometry args={[sec.w - 0.04, UPPER_H - 0.04, 0.016]} />
            <meshStandardMaterial
              color={sec.glass ? GLASS_COL : CAB_SHADOW}
              roughness={sec.glass ? 0.05 : 0.75}
              metalness={sec.glass ? 0.1 : 0.0}
              transparent={sec.glass}
              opacity={sec.glass ? 0.3 : 1.0}
            />
          </mesh>

          {/* Door handle */}
          <mesh position={[0, -0.05, UPPER_D / 2 + 0.014]}>
            <boxGeometry args={[0.1, 0.015, 0.01]} />
            <meshStandardMaterial color={HANDLE_COL} roughness={0.4} metalness={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Open shelving unit with blanks + sandpaper ─────────────────────────────────

// Wood blanks on the open shelves
const SHELF_BLANKS: Array<{
  r: number;
  len: number;
  color: string;
  shelf: number; // shelf index 0=bottom
  xOff: number;
  rot: [number, number, number];
}> = [
  { r: 0.055, len: 0.28, color: '#8B5E3C', shelf: 0, xOff: -0.25, rot: [0, 0, Math.PI / 2] },
  { r: 0.048, len: 0.24, color: '#a0703a', shelf: 0, xOff:  0.05, rot: [0, 0, Math.PI / 2] },
  { r: 0.065, len: 0.32, color: '#6b4020', shelf: 0, xOff:  0.32, rot: [0, 0, Math.PI / 2] },
  { r: 0.042, len: 0.20, color: '#c09055', shelf: 1, xOff: -0.2,  rot: [0, 0, Math.PI / 2] },
  { r: 0.058, len: 0.30, color: '#7a4e28', shelf: 1, xOff:  0.12, rot: [0, 0, Math.PI / 2] },
  { r: 0.052, len: 0.26, color: '#9a6535', shelf: 2, xOff: -0.28, rot: [0, 0, Math.PI / 2] },
];

// Rolled sandpaper: short wide cylinders standing upright or lying
const SANDPAPER: Array<{
  r: number;
  h: number;
  shelf: number;
  xOff: number;
  upright: boolean;
}> = [
  { r: 0.04,  h: 0.055, shelf: 1, xOff:  0.32, upright: true },
  { r: 0.038, h: 0.05,  shelf: 1, xOff:  0.38, upright: true },
  { r: 0.042, h: 0.06,  shelf: 2, xOff:  0.1,  upright: true },
  { r: 0.036, h: 0.045, shelf: 2, xOff:  0.16, upright: true },
  { r: 0.04,  h: 0.05,  shelf: 2, xOff:  0.22, upright: false },
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
      {/* Side uprights */}
      {([-unitW / 2, unitW / 2] as const).map((x, i) => (
        <mesh key={i} castShadow position={[x, unitH / 2, 0]}>
          <boxGeometry args={[0.025, unitH, unitD]} />
          <meshStandardMaterial color={CAB_WHITE} roughness={0.75} metalness={0.0} />
        </mesh>
      ))}

      {/* Back panel */}
      <mesh receiveShadow position={[0, unitH / 2, -unitD / 2 + 0.015]}>
        <boxGeometry args={[unitW, unitH, 0.018]} />
        <meshStandardMaterial color={CAB_WHITE} roughness={0.8} metalness={0.0} />
      </mesh>

      {/* Shelves */}
      {shelfYs.map((y, i) => (
        <mesh key={i} receiveShadow position={[0, y, 0]}>
          <boxGeometry args={[unitW - 0.05, 0.025, unitD]} />
          <meshStandardMaterial color={CAB_WHITE} roughness={0.75} metalness={0.0} />
        </mesh>
      ))}

      {/* Countertop cap (flush with base cabs) */}
      <mesh castShadow position={[0, unitH + BASE_TOP_T / 2, 0]}>
        <boxGeometry args={[unitW + 0.02, BASE_TOP_T, unitD + 0.02]} />
        <meshStandardMaterial color={COUNTER_COL} roughness={0.55} metalness={0.05} />
      </mesh>

      {/* Wood blanks */}
      {SHELF_BLANKS.map((b, i) => (
        <mesh
          key={`blank-${String(i)}`}
          castShadow
          position={[b.xOff, (shelfYs[b.shelf] ?? 0) + b.r + 0.013, 0]}
          rotation={b.rot}
        >
          <cylinderGeometry args={[b.r, b.r, b.len, 14]} />
          <meshStandardMaterial color={b.color} roughness={0.82} metalness={0.0} />
        </mesh>
      ))}

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
