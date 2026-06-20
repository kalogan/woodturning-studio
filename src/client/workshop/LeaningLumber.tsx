/**
 * LeaningLumber.tsx — Rough boards leaning in a corner + short offcuts.
 *
 * A few long rough-sawn planks (varied wood tones) leaning at a shallow angle
 * against the entrance (-X) wall, plus a couple of shorter offcuts stacked at
 * the base. The classic "I'll get to these eventually" corner of every shop.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +7.25], ceiling 3.6 m, floor Y=0.
 *   -X wall (X≈-16) = entrance end wall.
 *
 * PLACEMENT (verified clear): leaning against the -X entrance wall, low-Z side.
 *   LUMBER_POS = [-15.7, 0, 0.3]. The dust collector is at X≈-15 / Z≈-1.7,
 *   the grinder at X=-14.5 / Z=1.5, and the shop vac at X=-15.5 / Z=3.0 — the
 *   boards lean back into the -X wall and tip toward +X, clear of all three.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation, no Math.random, no Date.now, no browser APIs — Three.js only.
 * No per-frame allocation.
 */

import type { ReactNode } from 'react';
import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** World position of the lumber pile (floor contact, against -X wall). */
export const LUMBER_POS: [number, number, number] = [-15.7, 0, 0.3];

/** Rotation (radians). Boards run along Z; the lean tips them toward +X. */
export const LUMBER_ROT: [number, number, number] = [0, 0, 0];

// Board dimensions
const BOARD_T = 0.028;   // board thickness
const LEAN    = 0.22;    // lean angle off vertical (radians ≈ 12.6°)

// ─── Module-scope materials ───────────────────────────────────────────────────

// Varied rough-sawn wood tones
const _boardMats = [
  new THREE.MeshStandardMaterial({ color: '#a07840', roughness: 0.88, metalness: 0.0 }), // oak
  new THREE.MeshStandardMaterial({ color: '#7a5630', roughness: 0.90, metalness: 0.0 }), // walnut-ish
  new THREE.MeshStandardMaterial({ color: '#c0a062', roughness: 0.85, metalness: 0.0 }), // maple / pine
  new THREE.MeshStandardMaterial({ color: '#6e4a2a', roughness: 0.90, metalness: 0.0 }), // dark mahogany
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Long planks leaning against the wall (tilted toward +X via rotation Z). */
function LeaningBoards() {
  // [length, width, zOffset, matIndex, extraLean]
  const boards: ReadonlyArray<[number, number, number, number, number]> = [
    [2.10, 0.22, -0.18, 0,  0.00],
    [1.95, 0.18, -0.02, 1,  0.03],
    [2.20, 0.26,  0.14, 2, -0.02],
    [1.80, 0.15,  0.30, 3,  0.04],
  ];

  const items: ReactNode[] = [];
  boards.forEach(([len, w, zOff, matIdx, extra], i) => {
    const lean = LEAN + extra;
    // Pivot the board at its base. Centre rises by (len/2)*cos(lean) and the
    // top tips toward +X by (len/2)*sin(lean).
    const cy = (len / 2) * Math.cos(lean);
    const cx = (len / 2) * Math.sin(lean);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const mat = _boardMats[matIdx % _boardMats.length]!;
    items.push(
      <mesh
        key={String(i)}
        castShadow
        receiveShadow
        position={[cx, cy, zOff]}
        rotation={[0, 0, -lean]}
      >
        <boxGeometry args={[BOARD_T, len, w]} />
        <primitive object={mat} attach="material" />
      </mesh>,
    );
  });

  return <group name="leaning-boards">{items}</group>;
}

/** A couple of short offcuts stacked at the base of the pile. */
function Offcuts() {
  // [length, width, x, y, z, yaw, matIndex]
  const offcuts: ReadonlyArray<[number, number, number, number, number, number, number]> = [
    [0.55, 0.20, 0.30, 0.03, -0.10, 0.10, 2],
    [0.42, 0.16, 0.40, 0.09, -0.06, -0.25, 0],
    [0.60, 0.14, 0.34, 0.03,  0.22, 0.30, 1],
  ];

  const items: ReactNode[] = [];
  offcuts.forEach(([len, w, x, y, z, yaw, matIdx], i) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const mat = _boardMats[matIdx % _boardMats.length]!;
    items.push(
      <mesh
        key={String(i)}
        castShadow
        receiveShadow
        position={[x, y + BOARD_T / 2, z]}
        rotation={[0, yaw, 0]}
      >
        <boxGeometry args={[len, BOARD_T, w]} />
        <primitive object={mat} attach="material" />
      </mesh>,
    );
  });

  return <group name="lumber-offcuts">{items}</group>;
}

// ─── Public export ────────────────────────────────────────────────────────────

interface LeaningLumberProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * LeaningLumber — rough planks leaning in the entrance corner + base offcuts.
 * Default LUMBER_POS = [-15.7, 0, 0.3] against the -X entrance wall. Both
 * constants exported for director tuning.
 *
 * Boards ~1.8–2.2 m long, tilted ~12–15° off vertical.
 */
export function LeaningLumber({
  position = LUMBER_POS,
  rotation = LUMBER_ROT,
}: LeaningLumberProps = {}) {
  return (
    <group name="leaning-lumber" position={position} rotation={rotation}>
      <LeaningBoards />
      <Offcuts />
    </group>
  );
}
