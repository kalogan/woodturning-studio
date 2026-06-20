/**
 * DemoBench.tsx — Instructor demo STATION, centre-aisle teaching cluster.
 *
 * Reworked to match the director's real photos. It is THREE distinct things
 * clustered together (not one combined stand):
 *
 *   1. A full-size demo LATHE — a weathered mustard-YELLOW Powermatic. Reuses
 *      <PropLathe color="#c9a227" …> (same silhouette as the prop-lathe row).
 *      This is the lathe the class gathers around.
 *
 *   2. A roughly-built wooden A-FRAME TV STAND beside/behind the demo lathe:
 *      plywood/2x4 construction (warm lumber tone), an open shelf holding small
 *      turned demo pieces (cylinders, finials, a small bowl), a maple work
 *      surface with a couple of turning tools lying on it, and a black flat-
 *      screen TV/monitor sitting on TOP, angled slightly toward the class. A
 *      couple of tiny finials + a small framed photo sit beside the TV base.
 *
 *   3. An overhead CAMERA on a tall WOODEN TRIPOD — surveyor-style: three
 *      splayed wooden legs meeting at a head ~1.9 m up, with a dark camera body
 *      and an arm/boom reaching OUT over the demo lathe bed, camera pointing
 *      DOWN at the work (this feeds the TV).
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at player lathe.
 *   Hall extends X ∈ [-2, +16], Z ∈ [-2.5, +4].
 *
 * Group local space (before the group's π Y-rotation):
 *   +X = along the demo-lathe bed.  Local -Z is pushed toward the aisle side.
 *   The TV stand sits at local +Z (behind the lathe, away from the lathe row);
 *   the tripod stands at local -X / -Z and booms over the bed.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No browser APIs, no animation, no Math.random — Three.js only.
 */

import * as THREE from 'three';
import { makeBoardMaterial } from '../wood/woodMaterial.js';
import { PropLathe } from './PropLathe.js';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// Long-hallway layout: hall X ∈ [-2, +16], Z ∈ [-2.5, +4].
// Lathe row is at Z ≈ 0 (against -Z wall). Aisle runs from Z ≈ 0.5 to Z ≈ 4.
// The demo station sits mid-hall in the +Z half of the aisle, facing the row.

/** World position of the demo-station cluster centre (floor level). */
export const DEMO_BENCH_POS: [number, number, number] = [-7.0, 0, 2.5];

/** Rotation (radians). Faces the lathe row (-Z direction, toward Z=0). */
export const DEMO_BENCH_ROT: [number, number, number] = [0, Math.PI, 0];

// ── Demo lathe (yellow Powermatic) ───────────────────────────────────────────
const LATHE_COLOR = '#c9a227';                 // muddy weathered mustard yellow
const LATHE_POS: [number, number, number] = [0, 0, 0];
const LATHE_YAW = 0.10;                          // slight angle off-square

// ── TV stand (A-frame plywood) — sits behind the lathe at local +Z ───────────
const TVS_X      = 0.55;    // shifted toward +X (right of lathe headstock area)
const TVS_Z      = 0.70;    // behind the lathe bed (local +Z)
const TVS_W      = 0.90;    // overall width (X)
const TVS_D      = 0.52;    // overall depth (Z)
const TVS_TOP_Y  = 0.94;    // work-surface height
const TVS_TOP_T  = 0.05;    // top slab thickness
const TVS_LEG_T  = 0.07;    // leg / 2x4 thickness
const TVS_SHELF_Y = 0.42;   // open shelf height
const TVS_SHELF_T = 0.04;

// Flat-screen TV on top of the stand
const TV_W      = 0.92;     // ~0.9 m wide
const TV_H      = 0.54;
const TV_D      = 0.045;
const TV_TILT   = -0.22;    // tilt back slightly so the class sees the screen
const TV_STAND_FOOT_Y = TVS_TOP_Y + TVS_TOP_T / 2;

// ── Wooden tripod (overhead camera, booms over the lathe) ────────────────────
const TRI_X      = -0.55;   // beside the headstock end (local -X)
const TRI_Z      = 0.30;    // slightly toward +Z
const TRI_HEAD_Y = 1.92;    // tripod head height
const TRI_LEG_R  = 0.022;   // wooden leg radius
const TRI_SPLAY  = 0.55;    // horizontal foot spread radius
const TRI_BOOM_L = 0.95;    // boom reaching out over the bed (toward -Z lane / over bed)

// Demo turned pieces on the shelf
const PC_BOWL_R   = 0.07;
const PC_CYL_H    = 0.18;

// ─── Module-scope materials (never re-allocated per render) ───────────────────

// Construction lumber / plywood — warm tone, grain along length.
const _lumberMat  = makeBoardMaterial('#c7a878');
const _lumberLegMat = makeBoardMaterial('#bda06f', undefined, { grainAxis: 'y' });
const _mapleTopMat = makeBoardMaterial('#d8b87a');          // maple work surface
const _plyBackMat  = makeBoardMaterial('#b89866');          // ply back panel

// TV — dark glossy box + screen face.
const _tvBodyMat   = new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.45, metalness: 0.30 });
const _tvScreenMat = new THREE.MeshStandardMaterial({ color: '#0c0c10', roughness: 0.06, metalness: 0.10 });
const _tvStandMat  = new THREE.MeshStandardMaterial({ color: '#202024', roughness: 0.55, metalness: 0.40 });

// Tripod — wooden legs + dark camera body.
const _triLegMat   = makeBoardMaterial('#c2a070', undefined, { grainAxis: 'y' });
const _triHeadMat  = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.55, metalness: 0.35 });
const _camBodyMat  = new THREE.MeshStandardMaterial({ color: '#161618', roughness: 0.50, metalness: 0.30 });
const _camLensMat  = new THREE.MeshStandardMaterial({
  color: '#222230', roughness: 0.08, metalness: 0.10,
  emissive: new THREE.Color('#102030'), emissiveIntensity: 0.20,
});
const _casterMat   = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.55, metalness: 0.35 });

// Turning tools on the work surface.
const _toolSteelMat  = new THREE.MeshStandardMaterial({ color: '#8a8a90', roughness: 0.30, metalness: 0.85 });
const _toolHandleMat = makeBoardMaterial('#7a4a22', undefined, { grainAxis: 'y' });

// Demo turned pieces.
const _pieceCherryMat = makeBoardMaterial('#7a3820', undefined, { grainAxis: 'y' });
const _pieceMapleMat  = makeBoardMaterial('#c8a05a', undefined, { grainAxis: 'y' });
const _pieceWalnutMat = makeBoardMaterial('#4a3018', undefined, { grainAxis: 'y' });

// Small framed photo by the TV base.
const _frameMat = makeBoardMaterial('#5a3a1c', undefined, { grainAxis: 'y' });
const _photoMat = new THREE.MeshStandardMaterial({ color: '#cdcfc8', roughness: 0.6, metalness: 0.0 });

// ── Turned-piece profile (built once at module scope) ────────────────────────
// A simple finial silhouette: bead / cove / taper revolved around Y.
const _finialPts: THREE.Vector2[] = [
  new THREE.Vector2(0.000, 0.000),
  new THREE.Vector2(0.024, 0.005),
  new THREE.Vector2(0.030, 0.030),
  new THREE.Vector2(0.018, 0.055),
  new THREE.Vector2(0.026, 0.085),
  new THREE.Vector2(0.014, 0.115),
  new THREE.Vector2(0.018, 0.140),
  new THREE.Vector2(0.006, 0.160),
  new THREE.Vector2(0.000, 0.165),
];
const _finialGeo = new THREE.LatheGeometry(_finialPts, 18);

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Yellow Powermatic demo lathe — the class gathers around this. */
function DemoLathe() {
  return (
    <group name="demo-lathe" position={LATHE_POS} rotation={[0, LATHE_YAW, 0]}>
      <PropLathe color={LATHE_COLOR} />
    </group>
  );
}

/** A simple turned demo piece sitting upright on a surface. */
function FinialPiece({
  pos, scale = 1, mat,
}: { pos: [number, number, number]; scale?: number; mat: THREE.Material }) {
  return (
    <mesh castShadow position={pos} scale={[scale, scale, scale]}>
      <primitive object={_finialGeo} attach="geometry" />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/** Roughly-built A-frame plywood / 2x4 TV stand with shelf + demo pieces. */
function TVStand() {
  const halfW = TVS_W / 2;
  const halfD = TVS_D / 2;
  const legH = TVS_TOP_Y - TVS_TOP_T;
  const legX = halfW - TVS_LEG_T / 2;
  const legZ = halfD - TVS_LEG_T / 2;

  const legXZ: [number, number][] = [
    [-legX,  legZ],
    [ legX,  legZ],
    [-legX, -legZ],
    [ legX, -legZ],
  ];

  const shelfSurfaceY = TVS_SHELF_Y + TVS_SHELF_T;

  return (
    <group name="tv-stand" position={[TVS_X, 0, TVS_Z]}>
      {/* Four 2x4 legs */}
      {legXZ.map(([lx, lz], i) => (
        <mesh key={i} castShadow position={[lx, legH / 2, lz]}>
          <boxGeometry args={[TVS_LEG_T, legH, TVS_LEG_T]} />
          <primitive object={_lumberLegMat} attach="material" />
        </mesh>
      ))}

      {/* Maple-ish work surface (top slab) */}
      <mesh castShadow receiveShadow position={[0, TVS_TOP_Y - TVS_TOP_T / 2, 0]}>
        <boxGeometry args={[TVS_W, TVS_TOP_T, TVS_D]} />
        <primitive object={_mapleTopMat} attach="material" />
      </mesh>

      {/* Open lower shelf */}
      <mesh castShadow receiveShadow position={[0, TVS_SHELF_Y + TVS_SHELF_T / 2, 0]}>
        <boxGeometry args={[TVS_W - 0.06, TVS_SHELF_T, TVS_D - 0.06]} />
        <primitive object={_lumberMat} attach="material" />
      </mesh>

      {/* Ply back panel (the "A-frame" gives it rigidity) */}
      <mesh castShadow receiveShadow position={[0, legH * 0.55, -halfD + 0.012]}>
        <boxGeometry args={[TVS_W - 0.04, legH * 0.9, 0.018]} />
        <primitive object={_plyBackMat} attach="material" />
      </mesh>

      {/* Side cross-braces (2x4 stretchers, front + back low rail) */}
      {[halfD - 0.05, -halfD + 0.05].map((rz, i) => (
        <mesh key={i} castShadow position={[0, 0.14, rz]}>
          <boxGeometry args={[TVS_W - TVS_LEG_T * 2, 0.05, 0.04]} />
          <primitive object={_lumberLegMat} attach="material" />
        </mesh>
      ))}

      {/* ── Demo pieces on the open shelf ── */}
      {/* Small turned bowl (cherry) */}
      <mesh castShadow position={[-0.30, shelfSurfaceY + PC_BOWL_R * 0.45, 0.05]}
            rotation={[0, 0.3, 0]}>
        <sphereGeometry args={[PC_BOWL_R, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <primitive object={_pieceCherryMat} attach="material" />
      </mesh>

      {/* Upright cylinder blank (maple) */}
      <mesh castShadow position={[-0.05, shelfSurfaceY + PC_CYL_H / 2, -0.02]}>
        <cylinderGeometry args={[0.035, 0.038, PC_CYL_H, 14]} />
        <primitive object={_pieceMapleMat} attach="material" />
      </mesh>

      {/* A turned finial standing on the shelf (walnut) */}
      <FinialPiece pos={[0.22, shelfSurfaceY, 0.06]} scale={0.9} mat={_pieceWalnutMat} />

      {/* A cove cylinder lying on its side (cherry) */}
      <mesh castShadow position={[0.32, shelfSurfaceY + 0.03, -0.10]}
            rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.030, 0.040, 0.20, 12]} />
        <primitive object={_pieceCherryMat} attach="material" />
      </mesh>

      {/* ── Turning tools lying on the maple work surface ── */}
      {/* Gouge — steel shaft + wooden handle, lying flat */}
      <group position={[0.12, TVS_TOP_Y + 0.012, 0.16]} rotation={[0, 0.18, 0]}>
        <mesh castShadow position={[0.13, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.010, 0.010, 0.26, 10]} />
          <primitive object={_toolSteelMat} attach="material" />
        </mesh>
        <mesh castShadow position={[-0.10, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.022, 0.016, 0.18, 12]} />
          <primitive object={_toolHandleMat} attach="material" />
        </mesh>
      </group>

      {/* Skew chisel — flat steel + handle */}
      <group position={[-0.18, TVS_TOP_Y + 0.010, -0.14]} rotation={[0, -0.30, 0]}>
        <mesh castShadow position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.006, 0.24, 0.022]} />
          <primitive object={_toolSteelMat} attach="material" />
        </mesh>
        <mesh castShadow position={[-0.10, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.020, 0.014, 0.16, 12]} />
          <primitive object={_toolHandleMat} attach="material" />
        </mesh>
      </group>

      {/* ── Flat-screen TV on top, angled toward the class ── */}
      <group name="demo-tv"
             position={[0.0, TV_STAND_FOOT_Y + 0.04 + TV_H / 2, 0.02]}
             rotation={[TV_TILT, 0, 0]}>
        {/* Body */}
        <mesh castShadow>
          <boxGeometry args={[TV_W, TV_H, TV_D]} />
          <primitive object={_tvBodyMat} attach="material" />
        </mesh>
        {/* Screen face (toward -Z local = toward the class once group is rotated) */}
        <mesh position={[0, 0, TV_D / 2 + 0.001]}>
          <boxGeometry args={[TV_W - 0.04, TV_H - 0.04, 0.004]} />
          <primitive object={_tvScreenMat} attach="material" />
        </mesh>
        {/* Little stand neck + foot */}
        <mesh castShadow position={[0, -TV_H / 2 - 0.03, 0]}>
          <boxGeometry args={[0.05, 0.06, 0.04]} />
          <primitive object={_tvStandMat} attach="material" />
        </mesh>
        <mesh castShadow position={[0, -TV_H / 2 - 0.06, 0.03]}>
          <boxGeometry args={[0.20, 0.02, 0.14]} />
          <primitive object={_tvStandMat} attach="material" />
        </mesh>
      </group>

      {/* ── A couple of tiny finials + a small framed photo by the TV base ── */}
      <FinialPiece pos={[-0.34, TV_STAND_FOOT_Y, 0.10]} scale={0.55} mat={_pieceMapleMat} />
      <FinialPiece pos={[-0.40, TV_STAND_FOOT_Y, 0.16]} scale={0.42} mat={_pieceWalnutMat} />

      {/* Small framed photo, leaning slightly */}
      <group position={[0.36, TV_STAND_FOOT_Y + 0.07, 0.12]} rotation={[-0.12, -0.4, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.13, 0.16, 0.012]} />
          <primitive object={_frameMat} attach="material" />
        </mesh>
        <mesh position={[0, 0, 0.008]}>
          <boxGeometry args={[0.10, 0.13, 0.003]} />
          <primitive object={_photoMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

/** Tall wooden surveyor-style tripod with overhead camera booming over the bed. */
function CameraTripod() {
  // Three splayed legs, 120° apart, feet on the floor, tops meeting at the head.
  const legAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3] as const;
  const legLen = Math.hypot(TRI_HEAD_Y, TRI_SPLAY);          // splayed leg length
  const legTilt = Math.atan2(TRI_SPLAY, TRI_HEAD_Y);          // tilt off vertical

  // Boom reaches out over the lathe bed: from head toward the lathe (local -Z,
  // toward the row) and slightly down so the camera hangs over the work.
  const boomMidZ = TRI_Z - TRI_BOOM_L / 2;
  const boomEndZ = TRI_Z - TRI_BOOM_L;
  const camY = TRI_HEAD_Y - 0.10;

  return (
    <group name="camera-tripod" position={[TRI_X, 0, TRI_Z]}>
      {/* Three wooden legs */}
      {legAngles.map((ang, i) => {
        const dx = Math.cos(ang);
        const dz = Math.sin(ang);
        const footX = dx * TRI_SPLAY;
        const footZ = dz * TRI_SPLAY;
        return (
          <group key={i}>
            {/* Leg: from head (0, TRI_HEAD_Y, 0) down-out to foot. Place at midpoint. */}
            <mesh castShadow
                  position={[footX / 2, TRI_HEAD_Y / 2, footZ / 2]}
                  rotation={[legTilt * dz, 0, -legTilt * dx]}>
              <cylinderGeometry args={[TRI_LEG_R, TRI_LEG_R * 0.85, legLen, 8]} />
              <primitive object={_triLegMat} attach="material" />
            </mesh>
            {/* Caster foot (it rolls) */}
            <mesh castShadow position={[footX, 0.03, footZ]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <primitive object={_casterMat} attach="material" />
            </mesh>
          </group>
        );
      })}

      {/* Tripod head block */}
      <mesh castShadow position={[0, TRI_HEAD_Y, 0]}>
        <boxGeometry args={[0.10, 0.08, 0.10]} />
        <primitive object={_triHeadMat} attach="material" />
      </mesh>

      {/* Boom arm reaching out over the lathe bed (along -Z) */}
      <mesh castShadow position={[0, TRI_HEAD_Y - 0.02, boomMidZ]}>
        <boxGeometry args={[0.04, 0.04, TRI_BOOM_L]} />
        <primitive object={_triHeadMat} attach="material" />
      </mesh>

      {/* Camera body hanging at the boom end, pointing DOWN at the work */}
      <mesh castShadow position={[0, camY, boomEndZ]}>
        <boxGeometry args={[0.10, 0.07, 0.13]} />
        <primitive object={_camBodyMat} attach="material" />
      </mesh>
      {/* Lens looking straight down */}
      <mesh castShadow position={[0, camY - 0.05, boomEndZ]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.04, 14]} />
        <primitive object={_camLensMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface DemoBenchProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * DemoBench — instructor demo STATION cluster, centre-aisle.
 *
 * Three things clustered around DEMO_BENCH_POS:
 *   • DemoLathe   — yellow Powermatic, the lathe the class gathers around
 *   • TVStand     — A-frame plywood stand with demo pieces, tools, + TV on top
 *   • CameraTripod— wooden tripod with an overhead camera booming over the bed
 *
 * Default position: DEMO_BENCH_POS = [-7, 0, 2.5]
 * Default rotation: DEMO_BENCH_ROT = [0, π, 0]  (faces class toward -Z)
 * Both constants are exported for easy director tuning.
 */
export function DemoBench({
  position = DEMO_BENCH_POS,
  rotation = DEMO_BENCH_ROT,
}: DemoBenchProps = {}) {
  return (
    <group name="demo-bench" position={position} rotation={rotation}>
      <DemoLathe />
      <TVStand />
      <CameraTripod />
    </group>
  );
}
