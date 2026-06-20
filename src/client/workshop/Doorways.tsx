/**
 * Doorways.tsx — walk-through double-door openings for Hamester Hall.
 *
 * The real classroom has dark double-door openings at each end of the hall.
 * Each doorway reads as a framed portal into an adjacent (dark) space:
 *   • An outer frame — jambs + header in dark painted steel
 *   • A DARK recessed interior backing panel, inset behind the wall plane so
 *     the opening reads as real depth (a portal, not a painted rectangle)
 *   • Two dark door leaves, shown slightly AJAR so the opening is visible
 *
 * COORDINATE CONVENTION — same as Hall.tsx (origin at the player lathe):
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling 3.6 m, floor Y=0.
 *   -X end (HALL_X_MIN = -16) = ENTRANCE wall — entrance doorway faces +X.
 *   +X end (HALL_X_MAX = +2)  = sign wall — sign-wall doorway faces -X.
 *
 * The HAMESTER HALL sign sits on the +X wall centred at Z ≈ +0.75, spanning
 * Z ∈ [-0.45, +1.95] (SIGN_Z ± SIGN_W/2). The +X doorway is pushed toward the
 * +Z half (Z ≈ +2.8) so it clears the sign and the TurnedDisplay (+Z wall).
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the no-misused-spread
 * lint rule on class instances. All geometry is static — no per-frame
 * allocation, no animation, no browser APIs (Three.js only).
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// Opening (clear span between jambs)
const OPEN_W = 1.6;    // opening width  (≈ 1.6 m double-door span)
const OPEN_H = 2.1;    // opening height

// Frame (jambs + header)
const FRAME_T = 0.10;  // jamb / header face thickness (along the wall)
const FRAME_D = 0.16;  // frame depth (into / out of the wall)

// Recessed dark backing panel — inset behind the wall plane for depth.
const RECESS = 0.15;   // how far the backing sits behind the opening
const LEAF_T = 0.05;   // door-leaf thickness
const LEAF_AJAR = 0.45; // hinge swing of each leaf (radians, ≈ 26°)

// Placements (world). Entrance on -X wall (faces +X); sign-wall on +X wall
// (faces -X), pushed to the +Z half to clear the HAMESTER HALL sign.
const HALL_X_MIN = -16.0;
const HALL_X_MAX = 2.0;
const ENTRANCE_DOOR_X = HALL_X_MIN + 0.02; // just proud of the entrance wall
const ENTRANCE_DOOR_Z = -0.6;              // clear of the grinder [-14.5,0,1.5]
const SIGN_DOOR_X = HALL_X_MAX - 0.02;     // just proud of the sign wall
const SIGN_DOOR_Z = 2.8;                   // +Z half, clear of the centred sign

// ─── Module-scope materials ───────────────────────────────────────────────────

const _frameMat   = new THREE.MeshStandardMaterial({ color: '#2c2c30', roughness: 0.55, metalness: 0.45 }); // dark painted steel
const _backingMat  = new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.92, metalness: 0.05 }); // dark recessed interior
const _leafMat     = new THREE.MeshStandardMaterial({ color: '#1c1c22', roughness: 0.60, metalness: 0.30 }); // dark door leaf
const _handleMat   = new THREE.MeshStandardMaterial({ color: '#6a6a72', roughness: 0.35, metalness: 0.80 }); // pull handle

// ─── Sub-component: Doorway ───────────────────────────────────────────────────

/**
 * A single framed double-door opening, built facing local +Z.
 *
 * Local space: the wall plane is at local Z = 0; the opening recedes toward
 * local -Z (into the adjacent space). Place + rotate the group so local +Z
 * points into the hall.
 */
function Doorway() {
  const halfW = OPEN_W / 2;
  const leafW = OPEN_W / 2 - 0.01; // each leaf spans half the opening

  return (
    <group name="doorway">
      {/* ── FRAME: header + two jambs (face the hall at local Z≈0) ── */}
      {/* Header */}
      <mesh castShadow position={[0, OPEN_H + FRAME_T / 2, 0]}>
        <boxGeometry args={[OPEN_W + FRAME_T * 2, FRAME_T, FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
      {/* Left jamb */}
      <mesh castShadow position={[-(halfW + FRAME_T / 2), OPEN_H / 2, 0]}>
        <boxGeometry args={[FRAME_T, OPEN_H + FRAME_T, FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
      {/* Right jamb */}
      <mesh castShadow position={[halfW + FRAME_T / 2, OPEN_H / 2, 0]}>
        <boxGeometry args={[FRAME_T, OPEN_H + FRAME_T, FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>

      {/* ── DARK RECESSED BACKING — inset RECESS behind the opening ── */}
      <mesh position={[0, OPEN_H / 2, -RECESS]} receiveShadow>
        <planeGeometry args={[OPEN_W + 0.02, OPEN_H + 0.02]} />
        <primitive object={_backingMat} attach="material" />
      </mesh>
      {/* Recess side reveals so the opening reads as a box, not a flat panel */}
      <mesh position={[-halfW, OPEN_H / 2, -RECESS / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[RECESS, OPEN_H]} />
        <primitive object={_backingMat} attach="material" />
      </mesh>
      <mesh position={[halfW, OPEN_H / 2, -RECESS / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[RECESS, OPEN_H]} />
        <primitive object={_backingMat} attach="material" />
      </mesh>
      <mesh position={[0, OPEN_H, -RECESS / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[OPEN_W, RECESS]} />
        <primitive object={_backingMat} attach="material" />
      </mesh>

      {/* ── DOOR LEAVES — hinged at the jambs, swung slightly AJAR ── */}
      {/* Left leaf: hinge at -halfW, swings open into the recess (-Z). */}
      <group position={[-halfW, OPEN_H / 2, -RECESS + LEAF_T]} rotation={[0, -LEAF_AJAR, 0]}>
        <mesh castShadow position={[leafW / 2, 0, 0]}>
          <boxGeometry args={[leafW, OPEN_H - 0.02, LEAF_T]} />
          <primitive object={_leafMat} attach="material" />
        </mesh>
        {/* Vertical pull handle near the meeting stile */}
        <mesh position={[leafW - 0.10, 0, LEAF_T / 2 + 0.02]}>
          <boxGeometry args={[0.02, 0.30, 0.03]} />
          <primitive object={_handleMat} attach="material" />
        </mesh>
      </group>

      {/* Right leaf: hinge at +halfW, swings open into the recess (-Z). */}
      <group position={[halfW, OPEN_H / 2, -RECESS + LEAF_T]} rotation={[0, LEAF_AJAR, 0]}>
        <mesh castShadow position={[-leafW / 2, 0, 0]}>
          <boxGeometry args={[leafW, OPEN_H - 0.02, LEAF_T]} />
          <primitive object={_leafMat} attach="material" />
        </mesh>
        <mesh position={[-(leafW - 0.10), 0, LEAF_T / 2 + 0.02]}>
          <boxGeometry args={[0.02, 0.30, 0.03]} />
          <primitive object={_handleMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * Doorways — two framed double-door openings, one at each end of the hall.
 *
 *   1. Entrance doorway — -X wall, faces +X into the hall (replaces the old
 *      entry door). Placed at Z ≈ -0.6, clear of the grinder station.
 *   2. Sign-wall doorway — +X wall, faces -X into the hall, pushed to the +Z
 *      half (Z ≈ +2.8) so it clears the centred HAMESTER HALL sign and the
 *      TurnedDisplay on the +Z wall.
 */
export function Doorways() {
  return (
    <group name="doorways">
      {/* Entrance doorway — -X wall. Rotation +π/2 maps local +Z → world +X. */}
      <group
        name="doorway-entrance"
        position={[ENTRANCE_DOOR_X, 0, ENTRANCE_DOOR_Z]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <Doorway />
      </group>

      {/* Sign-wall doorway — +X wall. Rotation -π/2 maps local +Z → world -X. */}
      <group
        name="doorway-sign-end"
        position={[SIGN_DOOR_X, 0, SIGN_DOOR_Z]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Doorway />
      </group>
    </group>
  );
}
