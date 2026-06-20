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
// Hall footprint:
//   X ∈ [HALL_X_MIN, HALL_X_MAX]  — left(-) to right(+)
//   Z ∈ [HALL_Z_MIN, HALL_Z_MAX]  — back wall(-) to entrance(+)
//   Y  0  →  HALL_H               — floor to ceiling
//
// Origin [0,0,0] is the player lathe = back-left region.
// Back wall Z = HALL_Z_MIN  (casework + sign live on this wall)
// Left wall X = HALL_X_MIN
//
export const HALL_X_MIN = -3.0;   // left wall
export const HALL_X_MAX = 12.0;   // right wall
export const HALL_Z_MIN = -2.5;   // back wall (casework stays here)
export const HALL_Z_MAX =  9.0;   // front entrance wall / open
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
// Two main runs crossing the hall; director can add/remove entries.
type DuctRun = { cx: number; cz: number; lx: number; lz: number; w: number; h: number };
const DUCT_RUNS: DuctRun[] = [
  // Main spine along Z direction (front-back), left-centre of hall
  { cx: 1.5, cz: HALL_CZ, lx: 0.45, lz: HALL_D * 0.85, w: 0.45, h: 0.20 },
  // Branch run along X direction (left-right), at mid-depth
  { cx: HALL_CX, cz: 2.5, lx: HALL_W * 0.7, lz: 0.40, w: 0.38, h: 0.18 },
];

// ─── Window parameters (right / +X wall) ──────────────────────────────────────
const WIN_W = 1.2;   // window width (metres)
const WIN_H = 0.9;   // window height
const WIN_Y = 2.1;   // sill height
// X positions for windows on the right wall
const WIN_POSITIONS_Z: number[] = [0.0, 3.5, 7.0];

// ─── Sign parameters ─────────────────────────────────────────────────────────
const SIGN_W   = 2.4;    // sign panel width
const SIGN_H   = 0.45;   // sign panel height
const SIGN_Y   = HALL_H - 0.55;  // near top of back wall
const SIGN_X   = HALL_CX + 1.0;  // offset right from dead-centre (director tune)
const SIGN_Z   = HALL_Z_MIN + 0.025;  // just in front of back wall

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

      {/* ── BACK WALL (−Z, brick) ─────────────────────────────────────────── */}
      <group
        name="wall-back"
        position={[HALL_CX, HALL_H / 2, HALL_Z_MIN]}
        rotation={[0, 0, 0]}
      >
        <BrickWall wallW={HALL_W} />
      </group>

      {/* ── LEFT WALL (−X, brick) ─────────────────────────────────────────── */}
      <group
        name="wall-left"
        position={[HALL_X_MIN, HALL_H / 2, HALL_CZ]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <BrickWall wallW={HALL_D} />
      </group>

      {/* ── RIGHT WALL (+X, brick + windows) ────────────────────────────── */}
      <group
        name="wall-right"
        position={[HALL_X_MAX, HALL_H / 2, HALL_CZ]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <BrickWall wallW={HALL_D} />

        {/* Windows on right wall, evenly spaced along depth */}
        {WIN_POSITIONS_Z.map((wz, i) => {
          // Convert world Z → local position along the wall
          // Local origin of this group is at (HALL_X_MAX, HALL_H/2, HALL_CZ)
          // The wall is rotated -90° around Y, so local X maps to world -Z direction.
          // Local X = -(wz - HALL_CZ)
          const localX = -(wz - HALL_CZ);
          const localY = WIN_Y + WIN_H / 2 - HALL_H / 2;
          return (
            <group key={i} position={[localX, localY, 0]}>
              <WindowUnit />
            </group>
          );
        })}
      </group>

      {/* ── FRONT WALL (+Z, optional — leave open or add later) ─────────── */}
      {/* Currently no front wall — the hall is open at the entrance side.  */}
      {/* Add a group here with <BrickWall> when the entrance slice lands.  */}

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
      {/* Canvas-texture panel on the back wall, near the top. */}
      {/* The sign material is lazily created so the canvas API is only   */}
      {/* called in a browser context (safe for SSR / test environments). */}
      <group
        name="sign-hamester-hall"
        position={[SIGN_X, SIGN_Y, SIGN_Z]}
      >
        {/* Panel backing */}
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[SIGN_W + 0.06, SIGN_H + 0.06, 0.018]} />
          <primitive object={signPanelMat} attach="material" />
        </mesh>

        {/* Sign face with canvas texture */}
        <mesh>
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
