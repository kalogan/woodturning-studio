/**
 * SupportColumn.tsx — White-painted brick structural column.
 *
 * A single floor-to-ceiling square brick column (~0.5 × 0.5 m) that the
 * instructor demo bench backs against in the director's reference photos.
 * The brick is PAINTED WHITE, so the look is a mostly-flat warm off-white
 * face (#d8d6cf) with only a few faint horizontal mortar courses suggested
 * by thin slightly-darker inset bands — subtle, not a raw-brick texture.
 * A slightly wider base plinth grounds it; a thin cap finishes the top.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at player lathe.
 *   Hall extends X ∈ [-16, +2], Z ∈ [-2.5, +7.25], ceiling HALL_H ≈ 3.6 m.
 *
 * Placed just BEHIND the demo cluster (toward +Z) so the demo stand reads as
 * set against it. Verified clear of the demo bench meshes (roughly X∈[-8,-6],
 * Z∈[4..6.5]) and the +Z aisle wall.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the no-misused-spread
 * lint rule on class instances. No browser APIs, no animation, no Math.random,
 * no Date.now — Three.js only.
 */

import * as THREE from 'three';
import { HALL_H } from './Hall.js';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** World position of the column (centre of its footprint, floor level). */
export const COLUMN_POS: [number, number, number] = [-7.0, 0, 5.6];

// Column shaft (square, floor → ceiling)
const COL_W = 0.50;   // shaft width  (X)
const COL_D = 0.50;   // shaft depth  (Z)
const COL_H = HALL_H; // full height — floor to ceiling

// Base plinth (slightly wider, short)
const PLINTH_W = COL_W + 0.14;
const PLINTH_D = COL_D + 0.14;
const PLINTH_H = 0.18;

// Cap (thin, slightly wider than the shaft)
const CAP_W = COL_W + 0.08;
const CAP_D = COL_D + 0.08;
const CAP_H = 0.06;

// Faint painted-over mortar courses — a handful of thin inset bands.
const COURSE_T   = 0.018;  // band thickness (Y)
const COURSE_INSET = 0.004; // how far the band sits proud/inset (slight)
// Y heights of the suggested courses (sparse — it is painted, so subtle).
const COURSE_YS: number[] = [0.55, 1.05, 1.55, 2.05, 2.55, 3.05];

// ─── Module-scope materials ───────────────────────────────────────────────────

// Painted-white brick face — warm off-white, slightly rough.
const _brickMat = new THREE.MeshStandardMaterial({
  color: '#d8d6cf', roughness: 0.82, metalness: 0.0,
});
// Mortar courses — barely darker than the face (it is painted over).
const _mortarMat = new THREE.MeshStandardMaterial({
  color: '#cbc9c1', roughness: 0.86, metalness: 0.0,
});
// Plinth + cap — a touch cooler/greyer to read as cast concrete trim.
const _trimMat = new THREE.MeshStandardMaterial({
  color: '#cfcdc5', roughness: 0.80, metalness: 0.0,
});

// ─── Public export ────────────────────────────────────────────────────────────

interface SupportColumnProps {
  position?: [number, number, number];
}

/**
 * SupportColumn — single white-painted brick structural column, floor to ceiling.
 *
 * Default position: COLUMN_POS = [-7.0, 0, 5.6]  (behind the demo cluster, +Z).
 * The constant is exported for easy director tuning.
 */
export function SupportColumn({
  position = COLUMN_POS,
}: SupportColumnProps = {}) {
  return (
    <group name="support-column" position={position}>
      {/* Base plinth */}
      <mesh castShadow receiveShadow position={[0, PLINTH_H / 2, 0]}>
        <boxGeometry args={[PLINTH_W, PLINTH_H, PLINTH_D]} />
        <primitive object={_trimMat} attach="material" />
      </mesh>

      {/* Main brick shaft */}
      <mesh castShadow receiveShadow position={[0, COL_H / 2, 0]}>
        <boxGeometry args={[COL_W, COL_H, COL_D]} />
        <primitive object={_brickMat} attach="material" />
      </mesh>

      {/* Faint horizontal mortar courses on all four faces (painted-over brick) */}
      {COURSE_YS.map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[COL_W + COURSE_INSET, COURSE_T, COL_D + COURSE_INSET]} />
          <primitive object={_mortarMat} attach="material" />
        </mesh>
      ))}

      {/* Thin cap at the ceiling */}
      <mesh castShadow position={[0, COL_H - CAP_H / 2, 0]}>
        <boxGeometry args={[CAP_W, CAP_H, CAP_D]} />
        <primitive object={_trimMat} attach="material" />
      </mesh>
    </group>
  );
}
