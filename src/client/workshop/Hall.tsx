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
export const HALL_Z_MAX =  4.0;   // front long wall (aisle side, windows)
export const HALL_H     =  3.6;   // ceiling height

// Derived dimensions (read-only — do not edit directly)
const HALL_W = HALL_X_MAX - HALL_X_MIN;   // total width  X
const HALL_D = HALL_Z_MAX - HALL_Z_MIN;   // total depth  Z
const HALL_CX = (HALL_X_MIN + HALL_X_MAX) / 2;  // centre X
const HALL_CZ = (HALL_Z_MIN + HALL_Z_MAX) / 2;  // centre Z

// ─── Brick wall parameters ────────────────────────────────────────────────────
// Procedural brick: alternating mortar-joint colour bands every BRICK_COURSE_H
// plus a base and top band in slightly different tone.
const BRICK_COURSE_H  = 0.08;   // height of one brick course (metres)
const BRICK_COURSES   = Math.ceil(HALL_H / BRICK_COURSE_H);

// Painted-brick palette — warm grey-white as in the reference photos
const BRICK_BASE_COLOR   = '#c8c4bc';   // main painted face
const MORTAR_COLOR       = '#b8b4ac';   // recessed mortar band (subtle contrast)
const BRICK_ACCENT_COLOR = '#bab6ae';   // slight variation every 4th course

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

// ─── Sign parameters ─────────────────────────────────────────────────────────
// Sign is on the SHORT +X END WALL (the wall the player walks toward; no lathes).
// It faces -X (into the hall) — players approaching from -X see it straight ahead.
const SIGN_W   = 2.4;    // sign panel width
const SIGN_H   = 0.45;   // sign panel height
const SIGN_Y   = HALL_H - 0.55;   // near top of the end wall
const SIGN_Z   = HALL_CZ;         // centred on the short wall depth
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

// Brick face — base coat
const brickFaceMat = new THREE.MeshStandardMaterial({
  color: BRICK_BASE_COLOR,
  roughness: 0.88,
  metalness: 0.0,
});

// Mortar band (slightly darker/cooler)
const mortarMat = new THREE.MeshStandardMaterial({
  color: MORTAR_COLOR,
  roughness: 0.90,
  metalness: 0.0,
});

// Accent band (every 4th course, very subtle)
const brickAccentMat = new THREE.MeshStandardMaterial({
  color: BRICK_ACCENT_COLOR,
  roughness: 0.86,
  metalness: 0.0,
});

// Duct / structural steel
const ductMat = new THREE.MeshStandardMaterial({
  color: DUCT_COLOR,
  roughness: 0.60,
  metalness: 0.35,
});

// Window glass — transparent grey-blue
const glassMat = new THREE.MeshStandardMaterial({
  color: '#8ab0cc',
  roughness: 0.05,
  metalness: 0.0,
  transparent: true,
  opacity: 0.30,
  side: THREE.DoubleSide,
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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: BrickWall
// Renders a single wall as a base plane + horizontal mortar-band strips.
// wallW × HALL_H rectangle, centred at local origin.
//
interface BrickWallProps {
  wallW: number;      // width of this wall section
  wallH?: number;     // height (defaults to HALL_H)
}

function BrickWall({ wallW, wallH = HALL_H }: BrickWallProps) {
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
      {/* Base wall plane — provides the background and some depth */}
      <mesh>
        <planeGeometry args={[wallW, wallH]} />
        <primitive object={brickFaceMat} attach="material" />
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
        <BrickWall wallW={HALL_D} />
      </group>

      {/* ── ENTRANCE END WALL (−X short wall, brick) ─────────────────────────── */}
      {/* Player spawns near here. Rotation +π/2 so face points into the hall (+X). */}
      <group
        name="wall-entrance-end"
        position={[HALL_X_MIN, HALL_H / 2, HALL_CZ]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <BrickWall wallW={HALL_D} />
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
