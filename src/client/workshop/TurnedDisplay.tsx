/**
 * TurnedDisplay.tsx — Wall-mounted gallery shelf of finished turned woodwork.
 *
 * The kind of "student/instructor work" display that defines a real woodturning
 * classroom: two wooden ledges carrying a varied collection of finished pieces —
 * open bowls, a bulbous hollow-form vase, a wide shallow platter, turned spindles
 * (beads + coves), and a couple of small ovoid eggs/finials. All warm, lightly
 * oiled finished-wood tones.
 *
 * Default placement: the +Z aisle wall, in the clear span between the hand
 * toolbox (X≈-6.6) and the far +X sign wall — roughly X ∈ [-2.8, -1.2], at
 * eye-ledge height. Faces -Z (into the hall), in the player's view as they walk
 * toward the HAMESTER HALL sign.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling 3.6 m, floor Y=0.
 *   +Z wall (≈ +4) = aisle / side wall (this display mounts here, facing -Z).
 *
 * The group is placed flush on the +Z wall; pieces extend toward -Z (into the
 * room) along local +Z. LatheGeometry profiles + every reused geometry are built
 * ONCE at module scope (setup-time, allocation-safe) and shared across meshes.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the no-misused-spread
 * lint rule on class instances. All geometry is static — no per-frame
 * allocation, no animation, no Math.random, no browser APIs (Three.js only).
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** World position of the display group (wall-plane centre of the lower ledge). */
export const TURNED_DISPLAY_POS: [number, number, number] = [-2.0, 0, 3.9];

/** Rotation (radians). Default faces -Z into the hall (local +Z → world -Z). */
export const TURNED_DISPLAY_ROT: [number, number, number] = [0, Math.PI, 0];

// Shelf ledges (two horizontal wood boards with bracket supports).
const SHELF_LEN   = 1.60;   // along-wall length (X)
const SHELF_DEPTH = 0.25;   // depth out from wall (local +Z)
const SHELF_T     = 0.035;  // board thickness
const SHELF_Y_LO  = 1.45;   // lower ledge height
const SHELF_Y_HI  = 1.95;   // upper ledge height
const BRACKET_INSET = 0.55; // bracket offset from shelf centre, each side

// ─── Module-scope materials ───────────────────────────────────────────────────
// Warm finished-wood tones, lightly glossy to read as oiled/finished work.

const _walnutMat = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.40, metalness: 0.04 });
const _cherryMat = new THREE.MeshStandardMaterial({ color: '#8a4a32', roughness: 0.40, metalness: 0.04 });
const _mapleMat  = new THREE.MeshStandardMaterial({ color: '#d8b878', roughness: 0.42, metalness: 0.04 });
const _oakMat    = new THREE.MeshStandardMaterial({ color: '#b89058', roughness: 0.42, metalness: 0.04 });
const _padaukMat = new THREE.MeshStandardMaterial({ color: '#a03828', roughness: 0.40, metalness: 0.04 });

// Shelf boards + brackets — a slightly cooler, less glossy shop-shelf oak.
const _shelfMat   = new THREE.MeshStandardMaterial({ color: '#8c6535', roughness: 0.72, metalness: 0.03 });
const _bracketMat = new THREE.MeshStandardMaterial({ color: '#3a3a3e', roughness: 0.55, metalness: 0.55 });

// ─── Profile-based turned shapes (LatheGeometry) ──────────────────────────────
// Each profile is an array of Vector2(radius, y) revolved about the Y axis.
// Built ONCE here — never per frame.

const V = (r: number, y: number) => new THREE.Vector2(r, y);

// Open bowl: foot ring → flared wall → thin rim. ~0.18 m across the rim.
const _bowlProfile = [
  V(0.000, 0.000),
  V(0.030, 0.000),
  V(0.034, 0.012),
  V(0.030, 0.020),  // small turned foot
  V(0.055, 0.045),
  V(0.080, 0.090),
  V(0.090, 0.130),
  V(0.090, 0.140),  // rim outer
  V(0.083, 0.140),  // rim inner (thin lip)
  V(0.072, 0.110),
  V(0.050, 0.070),
  V(0.026, 0.040),
  V(0.000, 0.034),  // inner bottom
];

// Bulbous hollow-form vase: narrow foot, fat belly, tucked-in narrow neck.
const _vaseProfile = [
  V(0.000, 0.000),
  V(0.026, 0.000),
  V(0.030, 0.010),
  V(0.024, 0.022),  // foot
  V(0.050, 0.055),
  V(0.078, 0.110),
  V(0.085, 0.160),  // belly
  V(0.072, 0.210),
  V(0.040, 0.250),
  V(0.026, 0.270),  // neck
  V(0.030, 0.290),
  V(0.034, 0.300),  // flared rim
  V(0.028, 0.300),  // rim inner
  V(0.022, 0.270),
  V(0.000, 0.260),
];

// Wide shallow platter: broad flat field, low wall, small foot. ~0.30 m across.
const _platterProfile = [
  V(0.000, 0.000),
  V(0.040, 0.000),
  V(0.044, 0.010),
  V(0.040, 0.018),  // foot
  V(0.090, 0.026),
  V(0.140, 0.034),
  V(0.150, 0.046),  // outer rim
  V(0.144, 0.046),  // rim inner
  V(0.120, 0.040),
  V(0.070, 0.032),
  V(0.000, 0.030),  // shallow well
];

// Turned spindle (tool handle / table-leg): beads and coves along the length.
const _spindleProfile = [
  V(0.000, 0.000),
  V(0.018, 0.000),
  V(0.024, 0.020),  // end bead
  V(0.014, 0.045),  // cove
  V(0.028, 0.075),  // bead
  V(0.020, 0.110),
  V(0.030, 0.150),  // belly
  V(0.018, 0.200),  // cove
  V(0.026, 0.240),  // bead
  V(0.012, 0.270),  // neck
  V(0.016, 0.290),
  V(0.000, 0.300),
];

// Egg / finial: smooth ovoid, fatter at the base, tapering to a point.
const _eggProfile = [
  V(0.000, 0.000),
  V(0.016, 0.006),
  V(0.030, 0.022),
  V(0.038, 0.045),  // widest point (below centre)
  V(0.036, 0.070),
  V(0.026, 0.092),
  V(0.014, 0.106),
  V(0.000, 0.112),
];

// Build each geometry once (radial segments tuned for size).
const _bowlGeo    = new THREE.LatheGeometry(_bowlProfile, 32);
const _vaseGeo    = new THREE.LatheGeometry(_vaseProfile, 32);
const _platterGeo = new THREE.LatheGeometry(_platterProfile, 40);
const _spindleGeo = new THREE.LatheGeometry(_spindleProfile, 20);
const _eggGeo     = new THREE.LatheGeometry(_eggProfile, 24);

// ─── Material lookup (index-keyed, no per-frame allocation) ────────────────────

const _woodMats = [_walnutMat, _cherryMat, _mapleMat, _oakMat, _padaukMat] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A single wood ledge board with two angled steel bracket supports. */
function Ledge({ y }: { y: number }) {
  const brackets = [-1, 1] as const;
  // Board centre sits half its depth out from the wall plane (local +Z).
  const cz = SHELF_DEPTH / 2;

  return (
    <group name="ledge" position={[0, y, 0]}>
      {/* Board */}
      <mesh castShadow receiveShadow position={[0, 0, cz]}>
        <boxGeometry args={[SHELF_LEN, SHELF_T, SHELF_DEPTH]} />
        <primitive object={_shelfMat} attach="material" />
      </mesh>

      {/* Front edge lip (a slim raised nosing) */}
      <mesh castShadow position={[0, SHELF_T / 2 + 0.006, SHELF_DEPTH - 0.008]}>
        <boxGeometry args={[SHELF_LEN, 0.012, 0.010]} />
        <primitive object={_shelfMat} attach="material" />
      </mesh>

      {/* Bracket supports — vertical wall leg + diagonal brace, each side */}
      {brackets.map((s, i) => (
        <group key={i} position={[s * BRACKET_INSET, 0, 0]}>
          {/* Vertical leg flush to wall */}
          <mesh castShadow position={[0, -0.11, 0.012]}>
            <boxGeometry args={[0.018, 0.22, 0.018]} />
            <primitive object={_bracketMat} attach="material" />
          </mesh>
          {/* Horizontal arm under the board */}
          <mesh castShadow position={[0, -SHELF_T / 2 - 0.009, SHELF_DEPTH / 2 - 0.02]}>
            <boxGeometry args={[0.018, 0.018, SHELF_DEPTH - 0.04]} />
            <primitive object={_bracketMat} attach="material" />
          </mesh>
          {/* Diagonal brace */}
          <mesh castShadow position={[0, -0.14, 0.10]} rotation={[-0.78, 0, 0]}>
            <boxGeometry args={[0.014, 0.014, 0.24]} />
            <primitive object={_bracketMat} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * A finished turned piece placed on a ledge.
 *  - x: along-wall position (local X), relative to group centre.
 *  - y: the ledge's board top (pieces sit on top of it).
 *  - kind: which profile geometry to use.
 *  - matIdx: index into _woodMats.
 *  - scale: uniform size multiplier.
 *  - tip: optional, lay the piece on its side (spindles displayed reclining).
 */
interface PieceProps {
  x: number;
  y: number;
  z?: number;
  kind: 'bowl' | 'vase' | 'platter' | 'spindle' | 'egg';
  matIdx: number;
  scale?: number;
  tip?: boolean;
}

function Piece({ x, y, z = SHELF_DEPTH / 2, kind, matIdx, scale = 1, tip = false }: PieceProps) {
  const geo =
    kind === 'bowl'    ? _bowlGeo :
    kind === 'vase'    ? _vaseGeo :
    kind === 'platter' ? _platterGeo :
    kind === 'spindle' ? _spindleGeo :
    _eggGeo;

  const mat = _woodMats[matIdx % _woodMats.length] ?? _walnutMat;

  // Tipped spindles lie along the wall (rotate so the long Y axis → local X)
  // and rest a touch above the board on their side radius.
  const rot: [number, number, number] = tip ? [0, 0, Math.PI / 2] : [0, 0, 0];
  const yOff = tip ? 0.03 * scale : 0;

  return (
    <mesh
      castShadow
      receiveShadow
      position={[x, y + yOff, z]}
      rotation={rot}
      scale={scale}
      geometry={geo}
    >
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ─── Piece layout ─────────────────────────────────────────────────────────────
// Literal placements per ledge (deterministic — no Math.random). x is local,
// relative to the 1.6 m board centred on the group origin.

const SHELF_TOP_LO = SHELF_Y_LO + SHELF_T / 2;
const SHELF_TOP_HI = SHELF_Y_HI + SHELF_T / 2;

// Lower ledge: the bigger vessels + a reclining spindle.
const LOWER_PIECES: PieceProps[] = [
  { x: -0.66, y: SHELF_TOP_LO, kind: 'bowl',    matIdx: 0, scale: 1.15 },             // walnut bowl (large)
  { x: -0.30, y: SHELF_TOP_LO, kind: 'vase',    matIdx: 4, scale: 0.95 },             // padauk vase
  { x:  0.06, y: SHELF_TOP_LO, kind: 'bowl',    matIdx: 1, scale: 0.85 },             // cherry bowl (small)
  { x:  0.46, y: SHELF_TOP_LO, kind: 'platter', matIdx: 2, scale: 1.0  },             // maple platter (wide, low)
  { x:  0.10, y: SHELF_TOP_LO, kind: 'spindle', matIdx: 3, scale: 0.8, tip: true, z: 0.20 }, // oak spindle, reclining at back
];

// Upper ledge: smaller pieces — a standing spindle, eggs, a maple bowl.
const UPPER_PIECES: PieceProps[] = [
  { x: -0.62, y: SHELF_TOP_HI, kind: 'spindle', matIdx: 1, scale: 0.75 },             // cherry spindle, standing
  { x: -0.34, y: SHELF_TOP_HI, kind: 'egg',     matIdx: 2, scale: 1.1  },             // maple egg
  { x: -0.18, y: SHELF_TOP_HI, kind: 'egg',     matIdx: 0, scale: 0.9  },             // walnut egg
  { x:  0.12, y: SHELF_TOP_HI, kind: 'bowl',    matIdx: 2, scale: 0.7  },             // maple bowl (small)
  { x:  0.50, y: SHELF_TOP_HI, kind: 'spindle', matIdx: 4, scale: 0.7, tip: true, z: 0.16 }, // padauk spindle, reclining
];

/** Renders one ledge's worth of finished pieces. */
function PieceRow({ pieces }: { pieces: PieceProps[] }) {
  return (
    <group name="pieces">
      {pieces.map((p, i) => (
        <Piece key={i} {...p} />
      ))}
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface TurnedDisplayProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * TurnedDisplay — wall gallery of finished turned woodwork.
 *
 * Two wood ledges with steel brackets carrying a varied collection of finished
 * pieces (bowls, a vase, a platter, spindles, eggs) in warm oiled-wood tones.
 *
 * Default position: TURNED_DISPLAY_POS = [-2.0, 0, 3.9]  (+Z aisle wall)
 * Default rotation: TURNED_DISPLAY_ROT = [0, π, 0]       (faces -Z into hall)
 * Both constants are exported for easy director tuning.
 *
 * Footprint: ~1.6 m wide × ledges at Y 1.45 & 1.95 × ~0.25 m deep.
 */
export function TurnedDisplay({
  position = TURNED_DISPLAY_POS,
  rotation = TURNED_DISPLAY_ROT,
}: TurnedDisplayProps = {}) {
  return (
    <group name="turned-display" position={position} rotation={rotation}>
      <Ledge y={SHELF_Y_LO} />
      <Ledge y={SHELF_Y_HI} />
      <PieceRow pieces={LOWER_PIECES} />
      <PieceRow pieces={UPPER_PIECES} />
    </group>
  );
}
