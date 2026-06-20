/**
 * TurnedDisplay.tsx — White-framed glass display cabinets of finished turned work.
 *
 * Matches the director's photo: ABOVE the maple cubby run sit built-in
 * WHITE-FRAMED GLASS SLIDING-DOOR DISPLAY CABINETS full of finished turned work
 * (bowls, vases, platters, spindles, eggs) on internal glass-fronted shelves.
 *
 * Two side-by-side display cases sit directly ON TOP of the StockCubbies carcass,
 * flush against the +Z aisle wall, spanning the cubby run width. White aluminium
 * frames (top/bottom/sides/mullions), a back panel, two internal shelves each, and
 * sliding glass front doors (two overlapping transparent panels per case).
 *
 * The cabinets are sized + placed from StockCubbies' geometry so they land exactly
 * on the cubby top. The cubby unit:
 *   CUBBIES_POS = [-13.0, 0, 3.5], ROT = [0, π, 0]
 *   TOTAL_W = 4*0.32 + 5*0.022 = 1.39 m  (along wall, X)
 *   TOTAL_H = 3*0.30 + 4*0.022 + 0.08 = 1.068 m  (cubby top = bottom of cabinets)
 *   TOTAL_D = 0.50 + 2*0.022 = 0.544 m  (depth, Z)
 * So the cabinets sit at X≈-13, bottom Y≈1.07, on the +Z wall, facing -Z.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling 3.6 m, floor Y=0.
 *   +Z wall (≈ +3.9) = aisle wall; cabinets face -Z into the hall.
 *
 * All geometry + materials built ONCE at module scope (setup-time, allocation
 * safe) and shared across meshes. Static — no per-frame allocation, no animation,
 * no Math.random, no browser APIs (Three.js only). Materials attach via
 * <primitive object={mat} attach="material" /> (no-misused-spread safe).
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/**
 * World position of the display group (wall-plane centre, at the cabinet base).
 * Sits atop the StockCubbies unit: same X (−13) + Z wall, base Y at cubby top.
 * Cubby TOTAL_H ≈ 1.068 — we seat the cabinets a hair below to read as built-in.
 */
export const TURNED_DISPLAY_POS: [number, number, number] = [-13.0, 1.05, 3.9];

/** Rotation (radians). Faces -Z into the hall (local +Z → world -Z). */
export const TURNED_DISPLAY_ROT: [number, number, number] = [0, Math.PI, 0];

// ─── Cabinet dimensions ───────────────────────────────────────────────────────
// Two cases side-by-side spanning ~the cubby run (TOTAL_W ≈ 1.39 m). We run a
// touch wider so the cabinet bank visually caps the cubbies.

const CASE_COUNT = 2;          // side-by-side display cases
const BANK_W     = 1.46;       // total bank width along the wall (X)
const CASE_GAP   = 0.0;        // cases butt together (shared centre stile)
const CASE_W     = (BANK_W - CASE_GAP * (CASE_COUNT - 1)) / CASE_COUNT; // 0.73
const CASE_H     = 1.20;       // base (Y≈1.05) → top (Y≈2.25), clears to ~2.3
const CASE_D     = 0.32;       // depth out from wall (local +Z)

const FRAME_T    = 0.028;      // white frame member thickness (square section)
const FRAME_F    = 0.022;      // frame face width (how wide the white shows)
const GLASS_INSET = 0.012;     // glass sits this far inside the front opening
const SHELF_T    = 0.016;      // internal glass shelf thickness

// Internal shelf heights as fractions of the interior — two shelves split the
// interior into thirds.
const N_SHELVES  = 2;

// ─── Module-scope materials ───────────────────────────────────────────────────

// WHITE aluminium frame — matte-ish white, very low metalness so it reads as
// painted/anodised white, not chrome.
const _frameMat = new THREE.MeshStandardMaterial({ color: '#e8e8e2', roughness: 0.45, metalness: 0.10 });

// Back panel — soft off-white interior backing.
const _backMat  = new THREE.MeshStandardMaterial({ color: '#dedcd4', roughness: 0.85, metalness: 0.02 });

// Glass — front sliding doors + internal shelves. Cool, faint tint, very smooth.
const _glassMat = new THREE.MeshStandardMaterial({
  color: '#cfe0e6', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0,
});
// Internal shelves a touch more visible than the doors so pieces read as supported.
const _shelfGlassMat = new THREE.MeshStandardMaterial({
  color: '#cfe0e6', transparent: true, opacity: 0.26, roughness: 0.05, metalness: 0,
});

// Small door pulls (recessed finger grips) — brushed aluminium.
const _pullMat = new THREE.MeshStandardMaterial({ color: '#b8bcc0', roughness: 0.35, metalness: 0.70 });

// Warm finished-wood tones for the turned pieces, lightly glossy (oiled work).
const _walnutMat = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.40, metalness: 0.04 });
const _cherryMat = new THREE.MeshStandardMaterial({ color: '#8a4a32', roughness: 0.40, metalness: 0.04 });
const _mapleMat  = new THREE.MeshStandardMaterial({ color: '#d8b878', roughness: 0.42, metalness: 0.04 });
const _oakMat    = new THREE.MeshStandardMaterial({ color: '#b89058', roughness: 0.42, metalness: 0.04 });
const _padaukMat = new THREE.MeshStandardMaterial({ color: '#a03828', roughness: 0.40, metalness: 0.04 });

const _woodMats = [_walnutMat, _cherryMat, _mapleMat, _oakMat, _padaukMat] as const;

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

// Shared box geometries for frame members (avoid re-declaring inline boxes).
// (R3F args are cheap, but reusing keeps the count down.)

// ─── Turned piece ─────────────────────────────────────────────────────────────

interface PieceProps {
  x: number;
  y: number;
  z?: number;
  kind: 'bowl' | 'vase' | 'platter' | 'spindle' | 'egg';
  matIdx: number;
  scale?: number;
  tip?: boolean;
}

function Piece({ x, y, z = 0, kind, matIdx, scale = 1, tip = false }: PieceProps) {
  const geo =
    kind === 'bowl'    ? _bowlGeo :
    kind === 'vase'    ? _vaseGeo :
    kind === 'platter' ? _platterGeo :
    kind === 'spindle' ? _spindleGeo :
    _eggGeo;

  const mat = _woodMats[matIdx % _woodMats.length] ?? _walnutMat;

  // Tipped spindles lie on their side (rotate long Y axis → local X).
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

// ─── One display case ─────────────────────────────────────────────────────────
// Built in local space centred on its own X; base at local Y=0, front at +Z.
// White frame box (open front), back panel, internal glass shelves filled with
// turned work, and two overlapping sliding glass doors on the front.

/** Interior clear dimensions inside the white frame. */
const INT_W = CASE_W - 2 * FRAME_F;
const INT_H = CASE_H - 2 * FRAME_F;
const INT_D = CASE_D - FRAME_F;

// Shelf Y positions (local, measured from case base). Interior runs from FRAME_F
// to FRAME_F + INT_H; place N_SHELVES evenly to split into thirds.
const SHELF_YS: number[] = [];
for (let i = 1; i <= N_SHELVES; i++) {
  SHELF_YS.push(FRAME_F + (INT_H * i) / (N_SHELVES + 1));
}

// Three display levels: base floor + the two shelves. Each gets a piece layout.
// y here = the surface the pieces stand on (local). z is depth out from wall.
const LEVEL_YS = [FRAME_F + SHELF_T / 2, ...SHELF_YS.map((y) => y + SHELF_T / 2)];

/** Piece collection per level, keyed by which case (varied by index, no random). */
function levelPieces(caseIdx: number, level: number, surfaceY: number): PieceProps[] {
  // Depth band where pieces sit (centred in the case depth, local +Z).
  const zMid = INT_D * 0.45;
  const zBack = INT_D * 0.62;

  // Two deterministic arrangements (one per case) per level so the two cabinets
  // don't look cloned.
  if (caseIdx === 0) {
    if (level === 0) {
      return [
        { x: -0.20, y: surfaceY, z: zMid,  kind: 'bowl',    matIdx: 0, scale: 1.05 },
        { x:  0.02, y: surfaceY, z: zMid,  kind: 'vase',    matIdx: 4, scale: 0.85 },
        { x:  0.22, y: surfaceY, z: zMid,  kind: 'bowl',    matIdx: 1, scale: 0.80 },
        { x:  0.00, y: surfaceY, z: zBack, kind: 'spindle', matIdx: 3, scale: 0.75, tip: true },
      ];
    }
    if (level === 1) {
      return [
        { x: -0.22, y: surfaceY, z: zMid,  kind: 'platter', matIdx: 2, scale: 0.85 },
        { x:  0.06, y: surfaceY, z: zMid,  kind: 'vase',    matIdx: 1, scale: 0.78 },
        { x:  0.24, y: surfaceY, z: zMid,  kind: 'egg',     matIdx: 0, scale: 1.0  },
      ];
    }
    return [
      { x: -0.20, y: surfaceY, z: zMid,  kind: 'bowl',    matIdx: 2, scale: 0.70 },
      { x: -0.02, y: surfaceY, z: zMid,  kind: 'egg',     matIdx: 2, scale: 1.05 },
      { x:  0.12, y: surfaceY, z: zMid,  kind: 'egg',     matIdx: 0, scale: 0.85 },
      { x:  0.25, y: surfaceY, z: zMid,  kind: 'spindle', matIdx: 1, scale: 0.65 },
    ];
  }

  // caseIdx === 1
  if (level === 0) {
    return [
      { x: -0.24, y: surfaceY, z: zMid,  kind: 'platter', matIdx: 3, scale: 0.90 },
      { x:  0.04, y: surfaceY, z: zMid,  kind: 'bowl',    matIdx: 2, scale: 1.0  },
      { x:  0.24, y: surfaceY, z: zMid,  kind: 'vase',    matIdx: 0, scale: 0.82 },
    ];
  }
  if (level === 1) {
    return [
      { x: -0.22, y: surfaceY, z: zMid,  kind: 'bowl',    matIdx: 4, scale: 0.85 },
      { x:  0.00, y: surfaceY, z: zMid,  kind: 'vase',    matIdx: 3, scale: 0.80 },
      { x:  0.20, y: surfaceY, z: zMid,  kind: 'bowl',    matIdx: 1, scale: 0.72 },
      { x:  0.02, y: surfaceY, z: zBack, kind: 'spindle', matIdx: 4, scale: 0.70, tip: true },
    ];
  }
  return [
    { x: -0.18, y: surfaceY, z: zMid,  kind: 'egg',     matIdx: 1, scale: 1.0  },
    { x: -0.02, y: surfaceY, z: zMid,  kind: 'egg',     matIdx: 3, scale: 0.85 },
    { x:  0.14, y: surfaceY, z: zMid,  kind: 'bowl',    matIdx: 0, scale: 0.68 },
    { x:  0.26, y: surfaceY, z: zMid,  kind: 'spindle', matIdx: 2, scale: 0.62 },
  ];
}

/** White frame member (a box). */
function FrameBar({
  size, position,
}: { size: [number, number, number]; position: [number, number, number] }) {
  return (
    <mesh castShadow receiveShadow position={position}>
      <boxGeometry args={size} />
      <primitive object={_frameMat} attach="material" />
    </mesh>
  );
}

/**
 * One glass display case. Local space: centred on X, base at Y=0, depth along +Z
 * (front face at +Z = toward the room once the group is rotated π).
 */
function DisplayCase({ caseIdx }: { caseIdx: number }) {
  const halfW = CASE_W / 2;
  const frontZ = CASE_D;                 // front face plane (local +Z)
  const cz = CASE_D / 2;                 // depth centre

  // Glass door panels: two overlapping sliders covering the front opening.
  // Each is slightly wider than half the opening so they overlap in the middle.
  const doorH = INT_H;
  const doorW = INT_W * 0.56;            // >half → overlap
  const doorY = FRAME_F + INT_H / 2;
  const doorZFront = frontZ - GLASS_INSET;            // outer slider track
  const doorZBack  = frontZ - GLASS_INSET - 0.018;    // inner slider track (offset)

  return (
    <group name={`case-${String(caseIdx)}`}>
      {/* ── White frame ── */}
      {/* Top & bottom rails (full width) */}
      <FrameBar size={[CASE_W, FRAME_F, CASE_D]} position={[0, FRAME_F / 2, cz]} />
      <FrameBar size={[CASE_W, FRAME_F, CASE_D]} position={[0, CASE_H - FRAME_F / 2, cz]} />
      {/* Left & right stiles (between rails) */}
      <FrameBar size={[FRAME_F, INT_H, CASE_D]} position={[-halfW + FRAME_F / 2, FRAME_F + INT_H / 2, cz]} />
      <FrameBar size={[FRAME_F, INT_H, CASE_D]} position={[ halfW - FRAME_F / 2, FRAME_F + INT_H / 2, cz]} />

      {/* Back panel (set just inside the rear) */}
      <mesh receiveShadow position={[0, CASE_H / 2, FRAME_F / 2]}>
        <boxGeometry args={[INT_W, INT_H, FRAME_T * 0.5]} />
        <primitive object={_backMat} attach="material" />
      </mesh>

      {/* ── Internal glass shelves ── */}
      {SHELF_YS.map((y, i) => (
        <mesh key={`shelf-${String(i)}`} receiveShadow position={[0, y, FRAME_F + INT_D / 2]}>
          <boxGeometry args={[INT_W, SHELF_T, INT_D]} />
          <primitive object={_shelfGlassMat} attach="material" />
        </mesh>
      ))}

      {/* ── Turned work on each level (base floor + two shelves) ── */}
      {LEVEL_YS.map((surfaceY, level) => (
        <group key={`level-${String(level)}`} position={[0, 0, FRAME_F]}>
          {levelPieces(caseIdx, level, surfaceY).map((p, i) => (
            <Piece key={i} {...p} />
          ))}
        </group>
      ))}

      {/* ── Sliding glass doors (two overlapping panels) ── */}
      {/* Left panel sits on the outer track toward the left */}
      <mesh position={[-INT_W / 2 + doorW / 2, doorY, doorZFront]}>
        <boxGeometry args={[doorW, doorH, 0.006]} />
        <primitive object={_glassMat} attach="material" />
      </mesh>
      {/* Right panel sits on the inner track toward the right (overlaps centre) */}
      <mesh position={[ INT_W / 2 - doorW / 2, doorY, doorZBack]}>
        <boxGeometry args={[doorW, doorH, 0.006]} />
        <primitive object={_glassMat} attach="material" />
      </mesh>

      {/* Door pulls — small finger grips near the meeting stile of each panel */}
      <mesh position={[-0.01, doorY, doorZFront + 0.004]}>
        <boxGeometry args={[0.012, 0.10, 0.006]} />
        <primitive object={_pullMat} attach="material" />
      </mesh>
      <mesh position={[ 0.01, doorY, doorZBack - 0.004]}>
        <boxGeometry args={[0.012, 0.10, 0.006]} />
        <primitive object={_pullMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface TurnedDisplayProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * TurnedDisplay — white-framed glass display cabinets atop the cubby run.
 *
 * Two side-by-side glass display cases with white aluminium frames, back panels,
 * two internal glass shelves each, and overlapping sliding glass doors. Each
 * shelf carries a varied collection of finished turned work (bowls, vases,
 * platters, spindles, eggs) in warm oiled-wood tones.
 *
 * Default position: TURNED_DISPLAY_POS = [-13.0, 1.05, 3.9]  (atop the cubbies,
 *   +Z aisle wall). Default rotation: TURNED_DISPLAY_ROT = [0, π, 0] (faces -Z).
 * Both constants are exported for easy director tuning.
 *
 * Footprint: ~1.46 m wide × 1.20 m tall (Y 1.05 → 2.25) × ~0.32 m deep.
 */
export function TurnedDisplay({
  position = TURNED_DISPLAY_POS,
  rotation = TURNED_DISPLAY_ROT,
}: TurnedDisplayProps = {}) {
  // Lay the cases out left→right, centred on the group origin. Front face (+Z
  // local) points to -Z world after the π rotation = into the hall. We shift
  // each case back so its front sits near the wall plane and the body extends
  // into the room along local +Z.
  const cases = [];
  for (let i = 0; i < CASE_COUNT; i++) {
    const cx = -BANK_W / 2 + CASE_W / 2 + i * (CASE_W + CASE_GAP);
    cases.push(
      <group key={i} position={[cx, 0, 0]}>
        <DisplayCase caseIdx={i} />
      </group>
    );
  }

  return (
    <group name="turned-display" position={position} rotation={rotation}>
      {cases}
    </group>
  );
}
