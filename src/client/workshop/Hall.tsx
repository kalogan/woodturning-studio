/**
 * Hall.tsx — Hamester Hall industrial shell.
 *
 * A large brick-walled warehouse bay:
 *   • Concrete floor — mid-grey, slightly mottled
 *   • Brick side walls and back wall — warm grey-white painted brick with
 *     horizontal course banding (procedural colour variation, no textures)
 *   • Black exposed/ducted ceiling — flat dark panels + duct box runs
 *   • Windows on the right (+X) wall
 *   • "HAMESTER HALL" sign on the back wall (canvas-texture panel)
 *
 * COORDINATE CONVENTION
 *   World origin [0,0,0] is the player's interactive lathe — back-left region
 *   of the hall.  The hall extends:
 *     X : HALL_X_MIN (left/back)  →  HALL_X_MAX (right/front)
 *     Z : HALL_Z_MIN (back wall)  →  HALL_Z_MAX (front/entrance)
 *     Y : 0 (floor)               →  HALL_H (ceiling)
 *
 * All dimensions are NAMED CONSTANTS — director tunes without hunting code.
 *
 * No per-frame allocations — purely static geometry.  Materials are
 * pre-allocated at module scope (one object per material type).
 */

import type { ReactNode } from 'react';
import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────
//
// LONG HALLWAY layout — X is the long axis of the hall.
//   X ∈ [-16, +2]  — player lathe at origin is the FAR/right (+X) end of the
//                    lathe row; the -X end is the entrance.
//   Z ∈ [-2.5, +4] — lathe row hugs the BACK (-Z) wall; aisle toward +Z.
//   Ceiling 3.6 m.
//
// HAMESTER HALL sign lives on the SHORT +X END wall (no lathes there).
// Windows on the +Z (aisle/front) long wall.
export const HALL_X_MIN = -16.0;  // entrance end (short wall, open or future door)
export const HALL_X_MAX =   2.0;  // short end wall (sign wall, no lathes)
export const HALL_Z_MIN = -2.5;   // back long wall (lathe row)
export const HALL_Z_MAX =  7.25;  // front long wall (aisle side, windows) — widened +3.25 m
export const HALL_H     =  3.6;   // ceiling height

// Derived dimensions (read-only — do not edit directly)
const HALL_W = HALL_X_MAX - HALL_X_MIN;   // total width  X
const HALL_D = HALL_Z_MAX - HALL_Z_MIN;   // total depth  Z
const HALL_CX = (HALL_X_MIN + HALL_X_MAX) / 2;  // centre X
const HALL_CZ = (HALL_Z_MIN + HALL_Z_MAX) / 2;  // centre Z

// ─── Entry vestibule (narrow corridor off the -X entrance end) ─────────────────
// The real space has a SHORT HALLWAY the player walks through from the entry door
// before the room opens up. It extends in -X off the main hall, offset to the
// +Z/centre side of the entrance wall. The player spawns IN this corridor and
// walks +X through the corridor mouth into the main hall.
//
//   Footprint:  X ∈ [VEST_X_MIN, HALL_X_MIN]  (= [-19.5, -16], ≈3.5 m long)
//               Z ∈ [VEST_Z_MIN, VEST_Z_MAX]  (= [0.0, 2.5],   2.5 m wide)
//               Y ∈ [0, HALL_H]  (same ceiling height as the hall)
//
// The corridor mouth (the gap in the hall's -X end wall) spans Z ∈ [0, 2.5];
// the entrance door lives on the corridor's OUTER end wall at X = VEST_X_MIN.
export const VEST_X_MIN = -19.5;        // outer end wall (entrance door)
export const VEST_Z_MIN =   0.0;        // -Z side wall of the corridor
export const VEST_Z_MAX =   2.5;        // +Z side wall of the corridor
const VEST_LEN   = HALL_X_MIN - VEST_X_MIN;      // corridor length along X (3.5 m)
const VEST_W     = VEST_Z_MAX - VEST_Z_MIN;      // corridor width along Z (2.5 m)
const VEST_CX    = (VEST_X_MIN + HALL_X_MIN) / 2; // corridor centre X
const VEST_CZ    = (VEST_Z_MIN + VEST_Z_MAX) / 2; // corridor centre Z

// The -X end wall of the main hall is rendered as TWO segments leaving a gap at
// Z ∈ [VEST_Z_MIN, VEST_Z_MAX] (the corridor mouth). Segments span the rest of
// the hall depth: [-Z back wall → corridor mouth] and [corridor mouth → +Z].
const ENT_SEG_BACK_W = VEST_Z_MIN - HALL_Z_MIN;  // back segment width (Z_MIN→0)
const ENT_SEG_FRONT_W = HALL_Z_MAX - VEST_Z_MAX; // front segment width (2.5→Z_MAX)
const ENT_SEG_BACK_CZ  = (HALL_Z_MIN + VEST_Z_MIN) / 2; // back segment centre Z
const ENT_SEG_FRONT_CZ = (VEST_Z_MAX + HALL_Z_MAX) / 2; // front segment centre Z

// ─── Brick wall parameters ────────────────────────────────────────────────────
// Procedural brick: alternating mortar-joint colour bands every BRICK_COURSE_H
// plus a base and top band in slightly different tone.
const BRICK_COURSE_H  = 0.08;   // height of one brick course (metres)
const BRICK_COURSES   = Math.ceil(HALL_H / BRICK_COURSE_H);

// Painted-brick palette — warm grey-white as in the reference photos
const BRICK_BASE_COLOR   = '#c8c4bc';   // main painted face
const MORTAR_COLOR       = '#b8b4ac';   // recessed mortar band (subtle contrast)
const BRICK_ACCENT_COLOR = '#bab6ae';   // slight variation every 4th course

// ─── White-painted-brick surface texture (subtle, canvas-generated) ────────────
// Painted brick reads as mostly-uniform white with faint running-bond joints up
// close. Built ONCE at module scope (see makeBrickTexture / getBrickTexture).
const BRICK_TEX_FACE   = '#e6e4dd';   // faint off-white brick face
const BRICK_TEX_MORTAR = '#cfccc2';   // slightly-darker mortar line (low contrast)
const BRICK_TEX_HEIGHT = 0.2;         // world height (m) of one brick row → repeat
const BRICK_TEX_BRICKS_PER_ROW = 4;   // bricks across one texture tile (sets aspect)

// ─── Ceiling / duct parameters ────────────────────────────────────────────────
const DUCT_COLOR   = '#111112';   // near-black duct boxes
const CEILING_COLOR = '#0e0e0f';  // very dark flat ceiling

// Duct runs: [centreX, centreZ, lengthAlongX, lengthAlongZ, duct_W, duct_H]
// Two main runs; long-axis hall → spine runs along X, branch along Z.
type DuctRun = { cx: number; cz: number; lx: number; lz: number; w: number; h: number };
const DUCT_RUNS: DuctRun[] = [
  // Main spine along X direction (down the hall length), over the aisle centre
  { cx: HALL_CX, cz: HALL_CZ, lx: HALL_W * 0.85, lz: 0.45, w: 0.45, h: 0.20 },
  // Branch run along Z direction (wall-to-wall), at X ≈ -7 m (mid-hall)
  { cx: -7.0, cz: HALL_CZ, lx: 0.40, lz: HALL_D * 0.80, w: 0.38, h: 0.18 },
];

// ─── Window parameters (front / +Z long wall) ─────────────────────────────────
// The hall is LONG along X; windows are on the +Z long wall (aisle side).
const WIN_W = 1.2;   // window width (metres)
const WIN_H = 0.9;   // window height
const WIN_Y = 2.1;   // sill height
// X positions for windows along the +Z front long wall
const WIN_POSITIONS_X: number[] = [-2.0, -5.5, -9.0, -12.5];

// Daylight look for the glass panes — a cool-white emissive so the windows
// glow like lit daylight from inside the room (tunable).
const WIN_DAYLIGHT_COLOR     = '#dfeaf2';  // cool-white daylight tint
const WIN_EMISSIVE_INTENSITY = 1.0;        // 0.8–1.2 range

// ─── Sign parameters ─────────────────────────────────────────────────────────
// Sign is on the SHORT +X END WALL (the wall the player walks toward; no lathes).
// It faces -X (into the hall) — players approaching from -X see it straight ahead.
const SIGN_W   = 2.4;    // sign panel width
const SIGN_H   = 0.45;   // sign panel height
const SIGN_Y   = HALL_H - 0.55;   // near top of the end wall
const SIGN_Z   = 0.75;            // pinned literal (former HALL_CZ value) so widening doesn't drift the sign
const SIGN_X   = HALL_X_MAX - 0.025;  // just proud of the +X end wall

// ─────────────────────────────────────────────────────────────────────────────
// Module-scope materials — allocated once, never inside tick

const floorMat = new THREE.MeshStandardMaterial({
  color: '#7a7872',    // mid-grey concrete, slightly warm
  roughness: 0.95,
  metalness: 0.0,
  // Subtle mottling via a small roughness variation map is not possible without
  // textures; we accept flat concrete and tune color only.
});

const ceilingMat = new THREE.MeshStandardMaterial({
  color: CEILING_COLOR,
  roughness: 0.92,
  metalness: 0.05,
  side: THREE.FrontSide,
});

// Brick face — base coat. Semi-transparent so the textured base plane (running
// bond) reads through the course bands, while the bands still tint the courses.
const brickFaceMat = new THREE.MeshStandardMaterial({
  color: BRICK_BASE_COLOR,
  roughness: 0.88,
  metalness: 0.0,
  transparent: true,
  opacity: 0.55,
});

// Mortar band (slightly darker/cooler)
const mortarMat = new THREE.MeshStandardMaterial({
  color: MORTAR_COLOR,
  roughness: 0.90,
  metalness: 0.0,
  transparent: true,
  opacity: 0.55,
});

// Accent band (every 4th course, very subtle)
const brickAccentMat = new THREE.MeshStandardMaterial({
  color: BRICK_ACCENT_COLOR,
  roughness: 0.86,
  metalness: 0.0,
  transparent: true,
  opacity: 0.55,
});

// Duct / structural steel
const ductMat = new THREE.MeshStandardMaterial({
  color: DUCT_COLOR,
  roughness: 0.60,
  metalness: 0.35,
});

// Window glass — bright daylit panes (cool-white emissive glow)
const glassMat = new THREE.MeshStandardMaterial({
  color: '#8ab0cc',
  roughness: 0.05,
  metalness: 0.0,
  transparent: true,
  opacity: 0.30,
  side: THREE.DoubleSide,
  emissive: new THREE.Color(WIN_DAYLIGHT_COLOR),
  emissiveIntensity: WIN_EMISSIVE_INTENSITY,
});

// Window frame (white-painted steel)
const frameMat = new THREE.MeshStandardMaterial({
  color: '#ddd8d0',
  roughness: 0.60,
  metalness: 0.10,
});

// Sign panel backing (dark painted board)
const signPanelMat = new THREE.MeshStandardMaterial({
  color: '#1a2020',
  roughness: 0.75,
  metalness: 0.05,
});

// ─── Sign canvas texture (procedural, no external assets) ────────────────────
function makeSignTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 96;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return new THREE.CanvasTexture(canvas);

  // Background — match panel colour
  ctx.fillStyle = '#1a2020';
  ctx.fillRect(0, 0, W, H);

  // Text
  ctx.fillStyle = '#e8d8a0';
  ctx.font = `bold ${String(Math.round(H * 0.58))}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HAMESTER HALL', W / 2, H / 2);

  // Thin gold border
  ctx.strokeStyle = '#c0a040';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  return new THREE.CanvasTexture(canvas);
}

// Lazily created once — the canvas must be created in a browser context.
let _signTex: THREE.CanvasTexture | null = null;
function getSignTexture(): THREE.CanvasTexture {
  if (_signTex === null) {
    _signTex = makeSignTexture();
  }
  return _signTex;
}

// ─── Brick canvas texture (procedural, low-contrast running bond) ──────────────
// One tile = one full course-row of BRICK_TEX_BRICKS_PER_ROW bricks. Rows
// alternate a half-brick offset (running bond). Mostly white painted brick with
// faint mortar lines — kept low-contrast so the wall still reads as painted.
function makeBrickTexture(): THREE.CanvasTexture {
  const BRICKS = BRICK_TEX_BRICKS_PER_ROW;
  const ROWS = 2;                       // two rows so the half-offset tiles cleanly
  const BRICK_PX_W = 128;
  const BRICK_PX_H = 64;
  const W = BRICK_PX_W * BRICKS;
  const H = BRICK_PX_H * ROWS;
  const mortarPx = 4;                   // mortar joint thickness (px)

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (ctx === null) return tex;

  // Mortar background fills the whole tile; bricks drawn on top leave joints.
  ctx.fillStyle = BRICK_TEX_MORTAR;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = BRICK_TEX_FACE;
  for (let row = 0; row < ROWS; row++) {
    const y = row * BRICK_PX_H;
    // Alternate rows shift by half a brick for running bond.
    const offset = row % 2 === 0 ? 0 : -BRICK_PX_W / 2;
    // Draw one extra brick so the wrapped half-offset row stays seamless.
    for (let b = -1; b <= BRICKS; b++) {
      const x = b * BRICK_PX_W + offset;
      ctx.fillRect(
        x + mortarPx / 2,
        y + mortarPx / 2,
        BRICK_PX_W - mortarPx,
        BRICK_PX_H - mortarPx,
      );
    }
  }

  tex.needsUpdate = true;
  return tex;
}

// Build a base-wall material whose brick map repeats correctly for a wall of the
// given world width × height. The texture's *image* is shared (cloned textures
// reference the same canvas bitmap); only the per-axis repeat differs. Created
// at module scope per distinct wall size — no per-render allocation.
function makeBrickWallMaterial(wallW: number, wallH: number): THREE.MeshStandardMaterial {
  const tex = makeBrickTexture();
  // One texture-tile spans BRICK_TEX_BRICKS_PER_ROW bricks wide and one row
  // (BRICK_TEX_HEIGHT m) tall. Repeat = world size / tile size.
  const tileW = BRICK_TEX_HEIGHT * (BRICK_TEX_BRICKS_PER_ROW / 2); // tile ~ as wide as it is tall × bricks
  const repeatX = Math.max(1, Math.round(wallW / tileW));
  const repeatY = Math.max(1, Math.round(wallH / BRICK_TEX_HEIGHT));
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    color: BRICK_BASE_COLOR,
    roughness: 0.88,
    metalness: 0.0,
    map: tex,
  });
}

// Two distinct wall widths in the hall: long walls (HALL_W) and end walls
// (HALL_D). Pre-build one mapped base material for each, once.
const longWallBrickMat = makeBrickWallMaterial(HALL_W, HALL_H);
const endWallBrickMat  = makeBrickWallMaterial(HALL_D, HALL_H);

// Vestibule wall sizes — pre-built once. Side walls run along X (VEST_LEN);
// the outer end wall + the two split entrance-wall segments run along Z.
const vestSideBrickMat     = makeBrickWallMaterial(VEST_LEN, HALL_H);
const vestEndBrickMat      = makeBrickWallMaterial(VEST_W, HALL_H);
const entSegBackBrickMat   = makeBrickWallMaterial(ENT_SEG_BACK_W, HALL_H);
const entSegFrontBrickMat  = makeBrickWallMaterial(ENT_SEG_FRONT_W, HALL_H);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: BrickWall
// Renders a single wall as a base plane + horizontal mortar-band strips.
// wallW × HALL_H rectangle, centred at local origin.
//
interface BrickWallProps {
  wallW: number;      // width of this wall section
  wallH?: number;     // height (defaults to HALL_H)
  baseMat?: THREE.Material;  // mapped base-plane material (defaults to long wall)
}

function BrickWall({ wallW, wallH = HALL_H, baseMat = longWallBrickMat }: BrickWallProps) {
  const bands: ReactNode[] = [];

  for (let c = 0; c < BRICK_COURSES; c++) {
    const y = c * BRICK_COURSE_H + BRICK_COURSE_H / 2;
    if (y > wallH) break;

    const isAccent = (c % 4 === 0);

    // Brick body (most of course height)
    const brickH = BRICK_COURSE_H * 0.78;
    bands.push(
      <mesh
        key={`b${String(c)}`}
        position={[0, y - BRICK_COURSE_H * 0.11, 0.001]}
      >
        <planeGeometry args={[wallW - 0.001, brickH]} />
        <primitive
          object={isAccent ? brickAccentMat : brickFaceMat}
          attach="material"
        />
      </mesh>,
    );

    // Mortar joint: thin strip at bottom of each course (every course has one)
    {
      const jointH = BRICK_COURSE_H * 0.12;
      bands.push(
        <mesh
          key={`m${String(c)}`}
          position={[0, y - BRICK_COURSE_H / 2 + jointH / 2, 0.0005]}
        >
          <planeGeometry args={[wallW - 0.001, jointH]} />
          <primitive object={mortarMat} attach="material" />
        </mesh>,
      );
    }
  }

  return (
    <group name="brick-wall">
      {/* Base wall plane — painted-brick texture map (subtle running bond) */}
      <mesh>
        <planeGeometry args={[wallW, wallH]} />
        <primitive object={baseMat} attach="material" />
      </mesh>
      {/* Brick course bands */}
      {bands}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: WindowUnit — glass pane + frame on a wall face
interface WindowUnitProps {
  w?: number;
  h?: number;
}

function WindowUnit({ w = WIN_W, h = WIN_H }: WindowUnitProps) {
  const frameT = 0.05;
  return (
    <group name="window">
      {/* Glass pane */}
      <mesh>
        <planeGeometry args={[w, h]} />
        <primitive object={glassMat} attach="material" />
      </mesh>
      {/* Frame: top, bottom, left, right bars */}
      <mesh position={[0,  h / 2, 0.002]}>
        <boxGeometry args={[w + frameT * 2, frameT, 0.04]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      <mesh position={[0, -h / 2, 0.002]}>
        <boxGeometry args={[w + frameT * 2, frameT, 0.04]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      <mesh position={[-w / 2, 0, 0.002]}>
        <boxGeometry args={[frameT, h, 0.04]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      <mesh position={[ w / 2, 0, 0.002]}>
        <boxGeometry args={[frameT, h, 0.04]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      {/* Centre mullion */}
      <mesh position={[0, 0, 0.002]}>
        <boxGeometry args={[frameT * 0.6, h, 0.04]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export: Hall

export function Hall() {
  return (
    <group name="hall">

      {/* ── FLOOR ─────────────────────────────────────────────────────────── */}
      <mesh
        name="floor"
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[HALL_CX, 0, HALL_CZ]}
      >
        <planeGeometry args={[HALL_W, HALL_D]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      {/* ── CEILING ───────────────────────────────────────────────────────── */}
      <mesh
        name="ceiling"
        rotation={[Math.PI / 2, 0, 0]}
        position={[HALL_CX, HALL_H, HALL_CZ]}
      >
        <planeGeometry args={[HALL_W, HALL_D]} />
        <primitive object={ceilingMat} attach="material" />
      </mesh>

      {/* ── LATHE-ROW WALL (−Z long wall, brick) ───────────────────────────── */}
      {/* Lathes hug this wall; no windows here. */}
      <group
        name="wall-lathe-row"
        position={[HALL_CX, HALL_H / 2, HALL_Z_MIN]}
        rotation={[0, 0, 0]}
      >
        <BrickWall wallW={HALL_W} />
      </group>

      {/* ── SIGN END WALL (+X short wall, brick) ────────────────────────────── */}
      {/* HAMESTER HALL sign is on THIS wall — the far end the player walks toward. */}
      {/* No lathes on this wall. Rotation -π/2 so face points into the hall (-X). */}
      <group
        name="wall-sign-end"
        position={[HALL_X_MAX, HALL_H / 2, HALL_CZ]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <BrickWall wallW={HALL_D} baseMat={endWallBrickMat} />
      </group>

      {/* ── ENTRANCE END WALL (−X short wall, brick) — SPLIT for corridor mouth ─ */}
      {/* The vestibule corridor joins the hall here, so this wall is rendered as */}
      {/* TWO segments leaving a gap at Z ∈ [VEST_Z_MIN, VEST_Z_MAX] (the corridor */}
      {/* mouth). The player walks +X from the corridor into the hall through it.  */}
      {/* Each segment group is positioned at its own centre-Z; rotation +π/2 so   */}
      {/* the face points into the hall (+X).                                      */}
      {/* Back segment: Z ∈ [HALL_Z_MIN, VEST_Z_MIN]. */}
      <group
        name="wall-entrance-end-back"
        position={[HALL_X_MIN, HALL_H / 2, ENT_SEG_BACK_CZ]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <BrickWall wallW={ENT_SEG_BACK_W} baseMat={entSegBackBrickMat} />
      </group>
      {/* Front segment: Z ∈ [VEST_Z_MAX, HALL_Z_MAX]. */}
      <group
        name="wall-entrance-end-front"
        position={[HALL_X_MIN, HALL_H / 2, ENT_SEG_FRONT_CZ]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <BrickWall wallW={ENT_SEG_FRONT_W} baseMat={entSegFrontBrickMat} />
      </group>

      {/* ── ENTRY VESTIBULE (narrow corridor off the -X entrance end) ────────── */}
      {/* A short hallway the player spawns in and walks +X through into the hall. */}
      {/* Footprint X ∈ [VEST_X_MIN, HALL_X_MIN], Z ∈ [VEST_Z_MIN, VEST_Z_MAX].   */}
      <group name="vestibule">
        {/* Corridor floor */}
        <mesh
          name="vestibule-floor"
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[VEST_CX, 0, VEST_CZ]}
        >
          <planeGeometry args={[VEST_LEN, VEST_W]} />
          <primitive object={floorMat} attach="material" />
        </mesh>

        {/* Corridor ceiling */}
        <mesh
          name="vestibule-ceiling"
          rotation={[Math.PI / 2, 0, 0]}
          position={[VEST_CX, HALL_H, VEST_CZ]}
        >
          <planeGeometry args={[VEST_LEN, VEST_W]} />
          <primitive object={ceilingMat} attach="material" />
        </mesh>

        {/* -Z side wall (at Z = VEST_Z_MIN), running X VEST_X_MIN→HALL_X_MIN. */}
        {/* Rotation 0 → face points into the corridor (+Z). */}
        <group
          name="vestibule-wall-back"
          position={[VEST_CX, HALL_H / 2, VEST_Z_MIN]}
          rotation={[0, 0, 0]}
        >
          <BrickWall wallW={VEST_LEN} baseMat={vestSideBrickMat} />
        </group>

        {/* +Z side wall (at Z = VEST_Z_MAX). Rotation π → face points into the */}
        {/* corridor (-Z). */}
        <group
          name="vestibule-wall-front"
          position={[VEST_CX, HALL_H / 2, VEST_Z_MAX]}
          rotation={[0, Math.PI, 0]}
        >
          <BrickWall wallW={VEST_LEN} baseMat={vestSideBrickMat} />
        </group>

        {/* Outer END wall at X = VEST_X_MIN (holds the entrance door — Doorways). */}
        {/* Rotation +π/2 → face points into the corridor (+X). */}
        <group
          name="vestibule-wall-end"
          position={[VEST_X_MIN, HALL_H / 2, VEST_CZ]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <BrickWall wallW={VEST_W} baseMat={vestEndBrickMat} />
        </group>
      </group>

      {/* ── AISLE WALL (+Z long wall, brick + windows) ──────────────────────── */}
      {/* Windows on the front/aisle side — light comes in over the operator's */}
      {/* shoulder (operator stands on the +Z side of the lathe). */}
      {/* Rotation π so face points into the hall (-Z). */}
      <group
        name="wall-aisle"
        position={[HALL_CX, HALL_H / 2, HALL_Z_MAX]}
        rotation={[0, Math.PI, 0]}
      >
        <BrickWall wallW={HALL_W} />

        {/* Windows spaced along the aisle wall (world-X positions). */}
        {WIN_POSITIONS_X.map((wx, i) => {
          // Local origin of this group is at (HALL_CX, HALL_H/2, HALL_Z_MAX).
          // Wall is rotated π around Y, so local X maps to world -X direction.
          // Local X = -(wx - HALL_CX)
          const localX = -(wx - HALL_CX);
          const localY = WIN_Y + WIN_H / 2 - HALL_H / 2;
          return (
            <group key={i} position={[localX, localY, 0]}>
              <WindowUnit />
            </group>
          );
        })}
      </group>

      {/* ── CEILING DUCT RUNS ─────────────────────────────────────────────── */}
      {DUCT_RUNS.map((d, i) => (
        <mesh
          key={`duct-${String(i)}`}
          name={`duct-${String(i)}`}
          castShadow
          position={[d.cx, HALL_H - d.h / 2, d.cz]}
        >
          <boxGeometry args={[d.lx, d.h, d.lz]} />
          <primitive object={ductMat} attach="material" />
        </mesh>
      ))}

      {/* ── HAMESTER HALL SIGN ─────────────────────────────────────────── */}
      {/* Canvas-texture panel on the SHORT +X END WALL — the wall at the      */}
      {/* far end of the lathe row, which has NO lathes on it.                 */}
      {/* Sign faces -X into the hall (rotation Y = -π/2).                    */}
      {/* The sign material is lazily created so the canvas API is only        */}
      {/* called in a browser context (safe for SSR / test environments).      */}
      <group
        name="sign-hamester-hall"
        position={[SIGN_X, SIGN_Y, SIGN_Z]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        {/* Panel backing (depth protrudes in local +Z = world +X) */}
        <mesh position={[0, 0, 0.01]}>
          <boxGeometry args={[SIGN_W + 0.06, SIGN_H + 0.06, 0.018]} />
          <primitive object={signPanelMat} attach="material" />
        </mesh>

        {/* Sign face with canvas texture — faces +Z in local space = +X world */}
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[SIGN_W, SIGN_H]} />
          <meshStandardMaterial
            map={getSignTexture()}
            roughness={0.80}
            metalness={0.0}
          />
        </mesh>
      </group>

    </group>
  );
}
