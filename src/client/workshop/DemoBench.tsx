/**
 * DemoBench.tsx — Instructor demo STATION, centre-aisle teaching cluster.
 *
 * Reworked to match the director's real photos. The demo area is a CLUSTER of
 * five distinct pieces (not one combined stand), arranged like the photos:
 *
 *   1. Yellow Powermatic DEMO LATHE (front, operator side) — reuses
 *      <PropLathe color="#c9a227" …>. A small steel faceplate/chuck on the
 *      spindle nose holds a pale turned workpiece. The class gathers around this.
 *
 *   2. Wheeled CAMERA TRIPOD (the signature piece) — three splayed light-wood
 *      legs meeting at an apex ~1.9 m up, each foot on a dark CASTER wheel. A
 *      gray two-stage telescoping metal BOOM reaches UP and OVER the lathe bed;
 *      a dark camera HEAD + down-pointing lens hangs above the work, with a
 *      coiled cable suggested by small torus rings threaded along the boom.
 *
 *   3. Wooden A-FRAME TV STAND (behind the lathe) — roughly-built 2x4 / plywood
 *      construction with a black flat-screen TV tilted back on top, a small
 *      "Class in session" sign on the upright, finials + a framed photo by the
 *      TV base, and two open shelves of varied turned demo pieces (cylinders,
 *      lidded boxes, finials, a vase, eggs).
 *
 *   4. Front maple WORKBENCH (between operator and stand) — a butcher-block
 *      bench with a black toolbox, a white spray bottle, a few cans/cups, and
 *      scattered turned handles + offcut blocks on top.
 *
 *   5. Coiled EXTENSION CORDS on the floor near the stand base — flat ring loops
 *      in red / orange / green.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at player lathe.
 *   Hall extends X ∈ [-2, +16], Z ∈ [-2.5, +4].
 *
 * Group local space (before the group's π Y-rotation; local +Z → world -Z =
 * toward the room centre / class, local -Z → world +Z = toward the pillar):
 *   +X = along the demo-lathe bed. The lathe sits at the local origin and is the
 *   piece CLOSEST to the room centre. The TV stand + shelf sit at local -Z (back
 *   against the SupportColumn pillar at world Z≈5.6) with the TV screen facing
 *   local +Z (toward the class). The maple bench sits at local -Z too (pillar
 *   side, tailstock end). The tripod stands on the class side (local +Z) and
 *   booms up and over the bed so the overhead camera hangs above the work.
 *
 * Materials, lathe-geometries and torus rings are pre-allocated ONCE at module
 * scope and attached via <primitive object={mat} attach="material" /> (avoids the
 * no-misused-spread lint rule on class instances).
 * No browser APIs, no animation, no Math.random, no Date.now — Three.js only.
 */

import * as THREE from 'three';
import { makeBoardMaterial } from '../wood/woodMaterial.js';
import { PropLathe } from './PropLathe.js';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// Long-hallway layout: hall X ∈ [-2, +16], Z ∈ [-2.5, +4].
// The demo station sits mid-hall; the director repositions the whole cluster via
// the Room Editor, so everything is laid out relative to the group origin.

/** World position of the demo-station cluster centre (the demo lathe, floor
 *  level). Pulled toward the room centre so the lathe is the front piece and the
 *  TV/shelf clear behind it: lathe@Z4.0 → instructor@Z4.6 → TV/shelf@Z5.1 →
 *  SupportColumn pillar front@Z≈5.35. */
export const DEMO_BENCH_POS: [number, number, number] = [-7.0, 0, 4.0];

/** Rotation (radians). π so the cluster's local +Z points to world -Z — the
 *  room centre / lathe row. The demo lathe (local origin) ends up closest to the
 *  centre; the TV/shelf (local -Z) end up against the pillar behind it. */
export const DEMO_BENCH_ROT: [number, number, number] = [0, Math.PI, 0];

// ── Demo lathe (yellow Powermatic) ───────────────────────────────────────────
const LATHE_COLOR = '#c9a227';                  // muddy weathered mustard yellow
const LATHE_POS: [number, number, number] = [0, 0, 0];
const LATHE_YAW = 0.08;                          // slight angle off-square
// Spindle nose is at the headstock (-X) end of the bed, ~0.895 m up.
const SPINDLE_X = -0.62;     // approx headstock spindle X (PropLathe HS_LEFT_X area)
const SPINDLE_Y = 0.99;      // bed-top + a bit (spindle centre-line)

// ── Maple workbench — BEHIND the lathe (pillar side: local -Z), tailstock end ─
// Shifted to local -Z so it sits on the pillar side with the TV stand, clearing
// the centre-of-room side for the lathe + instructor. Nudged to +X (tailstock
// end) so it doesn't collide with the instructor standing at the headstock work.
const WB_X      = 1.30;     // out at the tailstock end, clear of the lathe + NPC
const WB_Z      = -0.80;    // behind the lathe (pillar side), beside the TV stand
const WB_W      = 1.30;     // butcher-block top width (X)
const WB_D      = 0.56;     // depth (Z)
const WB_TOP_Y  = 0.90;     // bench-top height
const WB_TOP_T  = 0.06;     // butcher-block slab thickness
const WB_LEG_T  = 0.07;     // 4x4 leg thickness

// ── A-frame TV stand + shelf — AGAINST the pillar (pillar side: local -Z) ─────
// Local -Z maps (under the group's π rotation) to world +Z, i.e. toward the
// SupportColumn at world Z≈5.6. The TV screen still faces local +Z → world -Z
// → toward the class / room centre, over the instructor's head.
const TVS_X      = 0.30;     // shifted toward +X
const TVS_Z      = -1.1;     // back against the pillar front (world Z≈5.1)
const TVS_W      = 1.00;     // overall width (X)
const TVS_D      = 0.50;     // overall depth (Z)
const TVS_TOP_Y  = 1.46;     // top platform height (~1.5 m tall A-frame)
const TVS_TOP_T  = 0.04;
const TVS_LEG_T  = 0.06;     // 2x4 thickness
const TVS_SPLAY  = 0.10;     // A-frame: feet splay this much wider than the top
const TVS_SHELF1_Y = 0.55;   // lower open shelf
const TVS_SHELF2_Y = 0.98;   // upper open shelf
const TVS_SHELF_T  = 0.035;

// Flat-screen TV on top of the stand
const TV_W      = 0.94;
const TV_H      = 0.56;
const TV_D      = 0.045;
const TV_TILT   = -0.20;     // tilt back ~0.2 rad so the class sees the screen
const TV_FOOT_Y = TVS_TOP_Y + TVS_TOP_T / 2;

// ── Wheeled camera tripod (booms over the lathe) ─────────────────────────────
const TRI_X      = -0.78;    // beside the headstock end (local -X)
const TRI_Z      = 0.55;     // slightly toward +Z
const TRI_HEAD_Y = 1.90;     // apex height
const TRI_LEG_R  = 0.026;    // wooden leg radius
const TRI_SPLAY  = 0.62;     // horizontal foot spread radius
const TRI_CASTER_R = 0.045;  // caster wheel radius
// Boom reaches UP and OVER toward the lathe bed (local +X-ish and -Z), ending
// above the spindle work. Two telescoping box stages.
const TRI_BOOM_REACH = 1.15;     // total horizontal reach
const TRI_BOOM_RISE  = 0.18;     // boom end rises this much above the apex

// Demo turned pieces
const PC_BOWL_R   = 0.075;

// ─── Module-scope materials (never re-allocated per render) ───────────────────

// Construction lumber / plywood — warm tone.
const _lumberMat    = makeBoardMaterial('#c7a878');
const _lumberLegMat = makeBoardMaterial('#bda06f', undefined, { grainAxis: 'y' });
const _plyBackMat   = makeBoardMaterial('#b89866');

// Maple workbench butcher-block.
const _mapleTopMat  = makeBoardMaterial('#d8b878');
const _mapleLegMat  = makeBoardMaterial('#c8a868', undefined, { grainAxis: 'y' });

// TV — dark glossy box + screen face + neck.
const _tvBodyMat   = new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.45, metalness: 0.30 });
const _tvScreenMat = new THREE.MeshStandardMaterial({ color: '#0c0c10', roughness: 0.06, metalness: 0.10 });
const _tvStandMat  = new THREE.MeshStandardMaterial({ color: '#202024', roughness: 0.55, metalness: 0.40 });

// Tripod — wooden legs, dark casters, gray aluminium boom, dark camera head.
const _triLegMat   = makeBoardMaterial('#c2a070', undefined, { grainAxis: 'y' });
const _apexMat     = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.55, metalness: 0.35 });
const _casterMat   = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.45, metalness: 0.30 });
const _boomMat     = new THREE.MeshStandardMaterial({ color: '#9a9da2', roughness: 0.35, metalness: 0.75 });
const _boomThinMat = new THREE.MeshStandardMaterial({ color: '#aaadb2', roughness: 0.32, metalness: 0.78 });
const _camBodyMat  = new THREE.MeshStandardMaterial({ color: '#1a1a1e', roughness: 0.50, metalness: 0.30 });
const _camLensMat  = new THREE.MeshStandardMaterial({
  color: '#222230', roughness: 0.08, metalness: 0.10,
  emissive: new THREE.Color('#102030'), emissiveIntensity: 0.20,
});
const _cableMat    = new THREE.MeshStandardMaterial({ color: '#1c1c20', roughness: 0.70, metalness: 0.10 });

// Lathe faceplate/chuck + mounted workpiece.
const _chuckMat    = new THREE.MeshStandardMaterial({ color: '#8a8d92', roughness: 0.35, metalness: 0.80 });
const _blankMat    = makeBoardMaterial('#d8c79a');     // pale wood bowl-blank

// Demo turned pieces (warm wood tones).
const _pieceCherryMat = makeBoardMaterial('#7a3820', undefined, { grainAxis: 'y' });
const _pieceMapleMat  = makeBoardMaterial('#c8a05a', undefined, { grainAxis: 'y' });
const _pieceWalnutMat = makeBoardMaterial('#4a3018', undefined, { grainAxis: 'y' });
const _pieceOakMat    = makeBoardMaterial('#b08a4a', undefined, { grainAxis: 'y' });

// Small framed photo by the TV base + "Class in session" sign.
const _frameMat = makeBoardMaterial('#5a3a1c', undefined, { grainAxis: 'y' });
const _photoMat = new THREE.MeshStandardMaterial({ color: '#cdcfc8', roughness: 0.6, metalness: 0.0 });
const _signMat  = new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.7, metalness: 0.0 });
const _signTextMat = new THREE.MeshStandardMaterial({ color: '#888a86', roughness: 0.7, metalness: 0.0 });

// Toolbox + spray bottle + cans on the workbench.
const _toolboxMat   = new THREE.MeshStandardMaterial({ color: '#1a1a1e', roughness: 0.55, metalness: 0.30 });
const _latchMat     = new THREE.MeshStandardMaterial({ color: '#d4b020', roughness: 0.45, metalness: 0.45 });
const _sprayMat     = new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.40, metalness: 0.05 });
const _sprayNeckMat = new THREE.MeshStandardMaterial({ color: '#c8c8cc', roughness: 0.35, metalness: 0.20 });
const _canBlueMat   = new THREE.MeshStandardMaterial({ color: '#46647a', roughness: 0.50, metalness: 0.25 });
const _canRedMat    = new THREE.MeshStandardMaterial({ color: '#9a4438', roughness: 0.55, metalness: 0.15 });
const _canTanMat    = new THREE.MeshStandardMaterial({ color: '#b8a878', roughness: 0.60, metalness: 0.10 });

// Turning-tool handles + offcut blocks on the workbench.
const _toolSteelMat  = new THREE.MeshStandardMaterial({ color: '#8a8a90', roughness: 0.30, metalness: 0.85 });
const _toolHandleMat = makeBoardMaterial('#7a4a22', undefined, { grainAxis: 'y' });
const _offcutMat     = makeBoardMaterial('#a9854c');

// Coiled extension cords on the floor.
const _cordRedMat    = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.65, metalness: 0.05 });
const _cordOrangeMat = new THREE.MeshStandardMaterial({ color: '#d2691e', roughness: 0.65, metalness: 0.05 });
const _cordGreenMat  = new THREE.MeshStandardMaterial({ color: '#3a7a3a', roughness: 0.65, metalness: 0.05 });

// ── Turned-piece geometries (built ONCE at module scope) ─────────────────────

/** A finial silhouette: bead / cove / taper revolved around Y. */
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

/** A small lidded-box silhouette: squat body with a stepped lid + knob. */
const _boxPts: THREE.Vector2[] = [
  new THREE.Vector2(0.000, 0.000),
  new THREE.Vector2(0.050, 0.000),
  new THREE.Vector2(0.052, 0.030),
  new THREE.Vector2(0.050, 0.062),
  new THREE.Vector2(0.044, 0.066),   // lid step in
  new THREE.Vector2(0.045, 0.092),
  new THREE.Vector2(0.030, 0.100),   // shoulder
  new THREE.Vector2(0.012, 0.110),
  new THREE.Vector2(0.012, 0.124),   // knob stem
  new THREE.Vector2(0.020, 0.134),
  new THREE.Vector2(0.000, 0.140),
];
const _boxGeo = new THREE.LatheGeometry(_boxPts, 20);

/** A slender vase silhouette: narrow foot, bulged belly, flared neck. */
const _vasePts: THREE.Vector2[] = [
  new THREE.Vector2(0.000, 0.000),
  new THREE.Vector2(0.030, 0.000),
  new THREE.Vector2(0.026, 0.020),
  new THREE.Vector2(0.048, 0.075),   // belly
  new THREE.Vector2(0.040, 0.130),
  new THREE.Vector2(0.022, 0.175),   // neck
  new THREE.Vector2(0.028, 0.205),   // flared rim
  new THREE.Vector2(0.024, 0.210),
  new THREE.Vector2(0.000, 0.210),
];
const _vaseGeo = new THREE.LatheGeometry(_vasePts, 22);

/** A turned egg silhouette (asymmetric ovoid). */
const _eggPts: THREE.Vector2[] = [
  new THREE.Vector2(0.000, 0.000),
  new THREE.Vector2(0.018, 0.012),
  new THREE.Vector2(0.030, 0.040),
  new THREE.Vector2(0.032, 0.066),
  new THREE.Vector2(0.026, 0.092),
  new THREE.Vector2(0.014, 0.110),
  new THREE.Vector2(0.000, 0.118),
];
const _eggGeo = new THREE.LatheGeometry(_eggPts, 16);

/** Small dark torus ring — reused for the coiled cable AND the floor cords. */
const _ringGeo = new THREE.TorusGeometry(0.10, 0.014, 8, 20);
/** Tiny torus ring threaded along the camera boom (coiled cable). */
const _cableRingGeo = new THREE.TorusGeometry(0.022, 0.006, 6, 12);

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A simple turned demo piece (geometry chosen by caller) sitting on a surface. */
function TurnedPiece({
  geo, pos, scale = 1, rotY = 0, mat,
}: {
  geo: THREE.BufferGeometry;
  pos: [number, number, number];
  scale?: number;
  rotY?: number;
  mat: THREE.Material;
}) {
  return (
    <mesh castShadow position={pos} rotation={[0, rotY, 0]} scale={[scale, scale, scale]}>
      <primitive object={geo} attach="geometry" />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/** Yellow Powermatic demo lathe + a faceplate/chuck holding a pale workpiece. */
function DemoLathe() {
  return (
    <group name="demo-lathe" position={LATHE_POS} rotation={[0, LATHE_YAW, 0]}>
      <PropLathe color={LATHE_COLOR} />

      {/* Faceplate / chuck on the spindle nose (short steel disc) */}
      <mesh castShadow position={[SPINDLE_X, SPINDLE_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.055, 0.045, 18]} />
        <primitive object={_chuckMat} attach="material" />
      </mesh>
      {/* Chuck jaws hub */}
      <mesh castShadow position={[SPINDLE_X - 0.025, SPINDLE_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.038, 0.040, 0.03, 14]} />
        <primitive object={_chuckMat} attach="material" />
      </mesh>
      {/* Pale wood workpiece mounted in the chuck (small bowl-blank cylinder) */}
      <mesh castShadow position={[SPINDLE_X + 0.075, SPINDLE_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.085, 0.072, 0.12, 20]} />
        <primitive object={_blankMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Front maple butcher-block workbench with toolbox, spray bottle, cans, tools. */
function MapleWorkbench() {
  const halfW = WB_W / 2;
  const halfD = WB_D / 2;
  const legH = WB_TOP_Y - WB_TOP_T;
  const legX = halfW - WB_LEG_T / 2 - 0.02;
  const legZ = halfD - WB_LEG_T / 2 - 0.02;
  const topSurfaceY = WB_TOP_Y;

  const legXZ: [number, number][] = [
    [-legX,  legZ], [ legX,  legZ], [-legX, -legZ], [ legX, -legZ],
  ];

  return (
    <group name="maple-workbench" position={[WB_X, 0, WB_Z]}>
      {/* Four maple legs */}
      {legXZ.map(([lx, lz], i) => (
        <mesh key={i} castShadow position={[lx, legH / 2, lz]}>
          <boxGeometry args={[WB_LEG_T, legH, WB_LEG_T]} />
          <primitive object={_mapleLegMat} attach="material" />
        </mesh>
      ))}

      {/* Lower stretcher rails (front + back) */}
      {[halfD - 0.06, -halfD + 0.06].map((rz, i) => (
        <mesh key={i} castShadow position={[0, 0.20, rz]}>
          <boxGeometry args={[WB_W - WB_LEG_T * 2, 0.05, 0.04]} />
          <primitive object={_mapleLegMat} attach="material" />
        </mesh>
      ))}

      {/* Butcher-block top */}
      <mesh castShadow receiveShadow position={[0, WB_TOP_Y - WB_TOP_T / 2, 0]}>
        <boxGeometry args={[WB_W, WB_TOP_T, WB_D]} />
        <primitive object={_mapleTopMat} attach="material" />
      </mesh>

      {/* ── Black toolbox with a yellow latch ── */}
      <group position={[-0.42, topSurfaceY, -0.02]} rotation={[0, 0.12, 0]}>
        <mesh castShadow position={[0, 0.085, 0]}>
          <boxGeometry args={[0.34, 0.17, 0.20]} />
          <primitive object={_toolboxMat} attach="material" />
        </mesh>
        {/* Lid lip */}
        <mesh castShadow position={[0, 0.175, 0]}>
          <boxGeometry args={[0.35, 0.02, 0.21]} />
          <primitive object={_toolboxMat} attach="material" />
        </mesh>
        {/* Yellow latch accent on the front face */}
        <mesh position={[0, 0.10, 0.105]}>
          <boxGeometry args={[0.05, 0.035, 0.012]} />
          <primitive object={_latchMat} attach="material" />
        </mesh>
        {/* Carry handle */}
        <mesh castShadow position={[0, 0.20, 0]}>
          <boxGeometry args={[0.14, 0.018, 0.02]} />
          <primitive object={_toolboxMat} attach="material" />
        </mesh>
      </group>

      {/* ── White spray bottle ── */}
      <group position={[0.10, topSurfaceY, 0.14]}>
        <mesh castShadow position={[0, 0.10, 0]}>
          <cylinderGeometry args={[0.035, 0.040, 0.20, 14]} />
          <primitive object={_sprayMat} attach="material" />
        </mesh>
        {/* Neck */}
        <mesh castShadow position={[0, 0.215, 0]}>
          <cylinderGeometry args={[0.016, 0.020, 0.04, 10]} />
          <primitive object={_sprayNeckMat} attach="material" />
        </mesh>
        {/* Trigger head */}
        <mesh castShadow position={[0.02, 0.245, 0]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.06, 0.04, 0.03]} />
          <primitive object={_sprayNeckMat} attach="material" />
        </mesh>
      </group>

      {/* ── 2–3 small cans / cups (varied muted colours) ── */}
      <mesh castShadow position={[0.32, topSurfaceY + 0.05, 0.10]}>
        <cylinderGeometry args={[0.045, 0.045, 0.10, 14]} />
        <primitive object={_canBlueMat} attach="material" />
      </mesh>
      <mesh castShadow position={[0.44, topSurfaceY + 0.04, -0.02]}>
        <cylinderGeometry args={[0.038, 0.040, 0.08, 14]} />
        <primitive object={_canRedMat} attach="material" />
      </mesh>
      <mesh castShadow position={[0.30, topSurfaceY + 0.035, -0.16]}>
        <cylinderGeometry args={[0.034, 0.034, 0.07, 12]} />
        <primitive object={_canTanMat} attach="material" />
      </mesh>

      {/* ── A few turned tool handles lying on the top ── */}
      <group position={[-0.05, topSurfaceY + 0.014, -0.18]} rotation={[0, 0.22, 0]}>
        <mesh castShadow position={[0.13, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.010, 0.010, 0.24, 10]} />
          <primitive object={_toolSteelMat} attach="material" />
        </mesh>
        <mesh castShadow position={[-0.10, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.022, 0.015, 0.18, 12]} />
          <primitive object={_toolHandleMat} attach="material" />
        </mesh>
      </group>
      <group position={[-0.16, topSurfaceY + 0.012, 0.04]} rotation={[0, -0.35, 0]}>
        <mesh castShadow position={[0.11, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.006, 0.22, 0.020]} />
          <primitive object={_toolSteelMat} attach="material" />
        </mesh>
        <mesh castShadow position={[-0.09, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.020, 0.014, 0.16, 12]} />
          <primitive object={_toolHandleMat} attach="material" />
        </mesh>
      </group>

      {/* ── Small offcut blocks ── */}
      <mesh castShadow position={[0.50, topSurfaceY + 0.03, 0.18]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.08, 0.06, 0.08]} />
        <primitive object={_offcutMat} attach="material" />
      </mesh>
      <mesh castShadow position={[0.18, topSurfaceY + 0.025, -0.04]} rotation={[0, -0.2, 0]}>
        <boxGeometry args={[0.07, 0.05, 0.10]} />
        <primitive object={_offcutMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Roughly-built A-frame plywood / 2x4 TV stand with two shelves + a TV on top. */
function TVStand() {
  const halfW = TVS_W / 2;
  const halfD = TVS_D / 2;
  const legH = TVS_TOP_Y - TVS_TOP_T;
  const topX = halfW - TVS_LEG_T / 2;
  const legZ = halfD - TVS_LEG_T / 2;
  const legTilt = Math.atan2(TVS_SPLAY, legH);     // A-frame outward lean
  const legLen = Math.hypot(legH, TVS_SPLAY);

  // Four splayed A-frame legs (lean outward along X).
  const legs: { sx: number; lz: number }[] = [
    { sx: -1, lz:  legZ },
    { sx:  1, lz:  legZ },
    { sx: -1, lz: -legZ },
    { sx:  1, lz: -legZ },
  ];

  return (
    <group name="tv-stand" position={[TVS_X, 0, TVS_Z]}>
      {/* Four splayed 2x4 legs (A-frame) */}
      {legs.map(({ sx, lz }, i) => (
        <mesh key={i} castShadow
              position={[sx * (topX + TVS_SPLAY / 2), legH / 2, lz]}
              rotation={[0, 0, sx * legTilt]}>
          <boxGeometry args={[TVS_LEG_T, legLen, TVS_LEG_T]} />
          <primitive object={_lumberLegMat} attach="material" />
        </mesh>
      ))}

      {/* Top platform (TV sits here) */}
      <mesh castShadow receiveShadow position={[0, TVS_TOP_Y - TVS_TOP_T / 2, 0]}>
        <boxGeometry args={[TVS_W, TVS_TOP_T, TVS_D]} />
        <primitive object={_lumberMat} attach="material" />
      </mesh>

      {/* Upper open shelf (demo pieces) */}
      <mesh castShadow receiveShadow position={[0, TVS_SHELF2_Y + TVS_SHELF_T / 2, 0.01]}>
        <boxGeometry args={[TVS_W - 0.04, TVS_SHELF_T, TVS_D - 0.05]} />
        <primitive object={_lumberMat} attach="material" />
      </mesh>

      {/* Lower open shelf (more demo pieces) */}
      <mesh castShadow receiveShadow position={[0, TVS_SHELF1_Y + TVS_SHELF_T / 2, 0.04]}>
        <boxGeometry args={[TVS_W + 0.04, TVS_SHELF_T, TVS_D]} />
        <primitive object={_lumberMat} attach="material" />
      </mesh>

      {/* Ply back panel (gives the A-frame rigidity) */}
      <mesh castShadow receiveShadow position={[0, legH * 0.55, -halfD + 0.012]}>
        <boxGeometry args={[TVS_W + TVS_SPLAY, legH * 0.92, 0.016]} />
        <primitive object={_plyBackMat} attach="material" />
      </mesh>

      {/* Low front rail */}
      <mesh castShadow position={[0, 0.16, halfD - 0.05]}>
        <boxGeometry args={[TVS_W, 0.05, 0.04]} />
        <primitive object={_lumberLegMat} attach="material" />
      </mesh>

      {/* "Class in session" sign taped to the front-left upright */}
      <group position={[-topX - 0.02, legH * 0.62, halfD - 0.005]} rotation={[0, 0, 0.04]}>
        <mesh>
          <boxGeometry args={[0.22, 0.15, 0.006]} />
          <primitive object={_signMat} attach="material" />
        </mesh>
        {[0.035, 0.0, -0.035].map((ty, i) => (
          <mesh key={i} position={[0, ty, 0.004]}>
            <boxGeometry args={[0.16, 0.012, 0.003]} />
            <primitive object={_signTextMat} attach="material" />
          </mesh>
        ))}
      </group>

      {/* ── Upper shelf: varied turned pieces ── */}
      <TurnedPiece geo={_vaseGeo}   pos={[-0.34, TVS_SHELF2_Y + TVS_SHELF_T, 0.02]} scale={0.9}  mat={_pieceWalnutMat} />
      <TurnedPiece geo={_boxGeo}    pos={[-0.12, TVS_SHELF2_Y + TVS_SHELF_T, -0.04]} scale={1.0} rotY={0.4} mat={_pieceCherryMat} />
      <TurnedPiece geo={_finialGeo} pos={[ 0.08, TVS_SHELF2_Y + TVS_SHELF_T, 0.05]} scale={0.95} mat={_pieceOakMat} />
      {/* A small bowl (sphere cap) */}
      <mesh castShadow position={[0.30, TVS_SHELF2_Y + TVS_SHELF_T + PC_BOWL_R * 0.4, -0.02]}
            rotation={[0, 0.3, 0]}>
        <sphereGeometry args={[PC_BOWL_R, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <primitive object={_pieceMapleMat} attach="material" />
      </mesh>

      {/* ── Lower shelf: cylinders, eggs, a lidded box ── */}
      <mesh castShadow position={[-0.36, TVS_SHELF1_Y + TVS_SHELF_T + 0.09, 0.02]}>
        <cylinderGeometry args={[0.038, 0.042, 0.18, 14]} />
        <primitive object={_pieceMapleMat} attach="material" />
      </mesh>
      <TurnedPiece geo={_eggGeo} pos={[-0.14, TVS_SHELF1_Y + TVS_SHELF_T, 0.06]} scale={1.0} mat={_pieceCherryMat} />
      <TurnedPiece geo={_eggGeo} pos={[-0.02, TVS_SHELF1_Y + TVS_SHELF_T, -0.04]} scale={0.85} rotY={0.8} mat={_pieceWalnutMat} />
      <TurnedPiece geo={_boxGeo} pos={[0.16, TVS_SHELF1_Y + TVS_SHELF_T, 0.05]} scale={1.1} rotY={-0.3} mat={_pieceOakMat} />
      {/* A cove cylinder lying on its side */}
      <mesh castShadow position={[0.36, TVS_SHELF1_Y + TVS_SHELF_T + 0.035, -0.06]}
            rotation={[Math.PI / 2, 0, 0.15]}>
        <cylinderGeometry args={[0.032, 0.042, 0.20, 12]} />
        <primitive object={_pieceCherryMat} attach="material" />
      </mesh>

      {/* ── Flat-screen TV on top, tilted back toward the class ── */}
      <group name="demo-tv"
             position={[0.0, TV_FOOT_Y + 0.04 + TV_H / 2, 0.0]}
             rotation={[TV_TILT, 0, 0]}>
        {/* Body */}
        <mesh castShadow>
          <boxGeometry args={[TV_W, TV_H, TV_D]} />
          <primitive object={_tvBodyMat} attach="material" />
        </mesh>
        {/* Glossy screen face (toward +Z local → toward the class once group rotated) */}
        <mesh position={[0, 0, TV_D / 2 + 0.001]}>
          <boxGeometry args={[TV_W - 0.05, TV_H - 0.05, 0.004]} />
          <primitive object={_tvScreenMat} attach="material" />
        </mesh>
        {/* Stand neck + foot */}
        <mesh castShadow position={[0, -TV_H / 2 - 0.03, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.04]} />
          <primitive object={_tvStandMat} attach="material" />
        </mesh>
        <mesh castShadow position={[0, -TV_H / 2 - 0.065, 0.0]}>
          <boxGeometry args={[0.24, 0.02, 0.16]} />
          <primitive object={_tvStandMat} attach="material" />
        </mesh>
      </group>

      {/* ── Tiny finials + a small framed photo beside the TV base ── */}
      <TurnedPiece geo={_finialGeo} pos={[-0.36, TV_FOOT_Y, 0.10]} scale={0.50} mat={_pieceMapleMat} />
      <TurnedPiece geo={_finialGeo} pos={[-0.42, TV_FOOT_Y, 0.16]} scale={0.40} mat={_pieceWalnutMat} />
      <group position={[0.38, TV_FOOT_Y + 0.07, 0.10]} rotation={[-0.12, -0.4, 0]}>
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

/** Tall wheeled tripod with a telescoping boom + overhead camera over the bed. */
function CameraTripod() {
  // Three splayed wooden legs, 120° apart, feet on casters, tops at the apex.
  const legAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3] as const;
  const legLen = Math.hypot(TRI_HEAD_Y, TRI_SPLAY);
  const legTilt = Math.atan2(TRI_SPLAY, TRI_HEAD_Y);

  // Boom direction in local XZ: from the apex toward the lathe bed.
  // The lathe spindle (relative to the tripod local origin) is at roughly
  // (SPINDLE_X - TRI_X, -, -TRI_Z). Reach UP and OVER toward it.
  const dirX = SPINDLE_X - TRI_X;       // toward the bed in X
  const dirZ = -TRI_Z;                  // toward the bed in Z
  const dirLen = Math.hypot(dirX, dirZ) || 1;
  const ux = dirX / dirLen;
  const uz = dirZ / dirLen;

  // Two telescoping stages: thicker stage from apex, thinner sliding out.
  const stage1Reach = TRI_BOOM_REACH * 0.55;
  const stage2Reach = TRI_BOOM_REACH * 0.55;   // overlaps the first slightly
  const apexY = TRI_HEAD_Y;

  // Stage 1 midpoint (rises gently as it goes out).
  const s1mx = ux * stage1Reach * 0.5;
  const s1mz = uz * stage1Reach * 0.5;
  const s1my = apexY + TRI_BOOM_RISE * 0.3;
  const s1yaw = Math.atan2(ux, uz);            // rotate boom box to face the bed
  const s1pitch = Math.atan2(TRI_BOOM_RISE * 0.6, stage1Reach);

  // End of stage 1 (start of stage 2).
  const s1ex = ux * stage1Reach;
  const s1ez = uz * stage1Reach;
  const s1ey = apexY + TRI_BOOM_RISE * 0.6;

  // Stage 2 midpoint.
  const s2mx = s1ex + ux * stage2Reach * 0.5 * 0.78;
  const s2mz = s1ez + uz * stage2Reach * 0.5 * 0.78;
  const s2my = s1ey + TRI_BOOM_RISE * 0.2;

  // Boom end (camera hangs here, above the work).
  const endX = s1ex + ux * stage2Reach * 0.78;
  const endZ = s1ez + uz * stage2Reach * 0.78;
  const endY = apexY + TRI_BOOM_RISE * 0.5;

  // Cable ring positions along the boom (a handful, varying by index).
  const cableRings = [0.22, 0.36, 0.50, 0.64, 0.78];

  return (
    <group name="camera-tripod" position={[TRI_X, 0, TRI_Z]}>
      {/* Three wooden legs, each on a caster wheel */}
      {legAngles.map((ang, i) => {
        const dx = Math.cos(ang);
        const dz = Math.sin(ang);
        const footX = dx * TRI_SPLAY;
        const footZ = dz * TRI_SPLAY;
        return (
          <group key={i}>
            {/* Leg from apex down-out to the caster */}
            <mesh castShadow
                  position={[footX / 2, TRI_HEAD_Y / 2 + TRI_CASTER_R / 2, footZ / 2]}
                  rotation={[legTilt * dz, 0, -legTilt * dx]}>
              <cylinderGeometry args={[TRI_LEG_R, TRI_LEG_R * 0.82, legLen, 8]} />
              <primitive object={_triLegMat} attach="material" />
            </mesh>
            {/* Caster yoke */}
            <mesh castShadow position={[footX, TRI_CASTER_R + 0.02, footZ]}>
              <boxGeometry args={[0.04, 0.04, 0.05]} />
              <primitive object={_casterMat} attach="material" />
            </mesh>
            {/* Caster wheel (it rolls) */}
            <mesh castShadow position={[footX, TRI_CASTER_R, footZ]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[TRI_CASTER_R, TRI_CASTER_R, 0.028, 14]} />
              <primitive object={_casterMat} attach="material" />
            </mesh>
          </group>
        );
      })}

      {/* Apex head block */}
      <mesh castShadow position={[0, apexY, 0]}>
        <boxGeometry args={[0.11, 0.10, 0.11]} />
        <primitive object={_apexMat} attach="material" />
      </mesh>

      {/* Telescoping boom — stage 1 (thicker box-section, from the apex) */}
      <mesh castShadow position={[s1mx, s1my, s1mz]} rotation={[s1pitch, s1yaw, 0]}>
        <boxGeometry args={[0.05, 0.05, stage1Reach + 0.04]} />
        <primitive object={_boomMat} attach="material" />
      </mesh>

      {/* Telescoping boom — stage 2 (thinner box, sliding out of stage 1) */}
      <mesh castShadow position={[s2mx, s2my, s2mz]} rotation={[s1pitch * 0.6, s1yaw, 0]}>
        <boxGeometry args={[0.034, 0.034, stage2Reach * 0.78 + 0.04]} />
        <primitive object={_boomThinMat} attach="material" />
      </mesh>

      {/* Coiled cable suggested by small dark rings threaded along the boom */}
      {cableRings.map((t, i) => (
        <mesh key={i}
              position={[ux * TRI_BOOM_REACH * t,
                         apexY + TRI_BOOM_RISE * (0.3 + t * 0.25) - 0.03,
                         uz * TRI_BOOM_REACH * t]}
              rotation={[Math.PI / 2 - s1pitch, s1yaw, 0]}>
          <primitive object={_cableRingGeo} attach="geometry" />
          <primitive object={_cableMat} attach="material" />
        </mesh>
      ))}

      {/* Camera head box at the boom end, lens pointing DOWN at the work */}
      <mesh castShadow position={[endX, endY, endZ]}>
        <boxGeometry args={[0.12, 0.08, 0.14]} />
        <primitive object={_camBodyMat} attach="material" />
      </mesh>
      <mesh castShadow position={[endX, endY - 0.06, endZ]}>
        <cylinderGeometry args={[0.03, 0.03, 0.05, 14]} />
        <primitive object={_camLensMat} attach="material" />
      </mesh>
    </group>
  );
}

/** A flattened coiled extension-cord loop lying on the floor. */
function CordLoop({
  pos, rotY, mat,
}: { pos: [number, number, number]; rotY: number; mat: THREE.Material }) {
  return (
    <mesh castShadow position={pos} rotation={[Math.PI / 2, 0, rotY]} scale={[1, 1, 0.35]}>
      <primitive object={_ringGeo} attach="geometry" />
      <primitive object={mat} attach="material" />
    </mesh>
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
 * Five things clustered around DEMO_BENCH_POS:
 *   • DemoLathe      — yellow Powermatic + chuck/faceplate holding a workpiece
 *   • MapleWorkbench — butcher-block bench w/ toolbox, spray bottle, cans, tools
 *   • TVStand        — A-frame stand w/ two shelves of demo pieces + TV on top
 *   • CameraTripod   — wheeled tripod, telescoping boom + overhead camera
 *   • CordLoop ×3    — coiled extension cords on the floor by the stand base
 *
 * Default position: DEMO_BENCH_POS = [-7, 0, 4.5]
 * Default rotation: DEMO_BENCH_ROT = [0, π, 0]  (faces the class toward -Z)
 * Both constants are exported for easy director tuning.
 */
export function DemoBench({
  position = DEMO_BENCH_POS,
  rotation = DEMO_BENCH_ROT,
}: DemoBenchProps = {}) {
  return (
    <group name="demo-bench" position={position} rotation={rotation}>
      <DemoLathe />
      <MapleWorkbench />
      <TVStand />
      <CameraTripod />

      {/* Coiled extension cords on the floor near the stand base (pillar side) */}
      <CordLoop pos={[-0.55, 0.014, -0.85]} rotY={0.3}  mat={_cordRedMat} />
      <CordLoop pos={[-0.30, 0.014, -1.05]} rotY={-0.6} mat={_cordOrangeMat} />
      <CordLoop pos={[-0.05, 0.014, -0.95]} rotY={1.1}  mat={_cordGreenMat} />
    </group>
  );
}
