/**
 * Buckets.tsx — Scattered 5-gallon shop buckets.
 *
 * Five tapered-cylinder buckets (~0.28 m dia × 0.38 m tall) in varied colours,
 * each with a thin rolled rim and a wire handle arc, scattered on the floor near
 * the machines (dust collector, band saw, grinder).
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +7.25], ceiling 3.6 m, floor Y=0.
 *   Dust collector [-15,0,-1.7]; band saw [-13.5,0,-1]; drill press [-11,0,-2];
 *   grinder [-14.5,0,1.5].
 *
 * PLACEMENT (verified clear of machine footprints, ~0.3 m bucket footprint):
 *   [-15.6, -0.9] near collector; [-14.2, -1.7] gap between collector + band
 *   saw; [-12.6, -1.4] -Z gap on the band-saw side (moved off the centre entry
 *   aisle); [-12.2, -1.9] near drill press; [-10.2, -1.9] off the drill-press
 *   side. All sit in open floor between machines, none in the entry walkway.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation, no Math.random, no Date.now, no browser APIs — Three.js only.
 * No per-frame allocation.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** Bucket placements: [x, z, colorIndex, yaw]. colorIndex selects the body mat. */
const BUCKETS: readonly [number, number, number, number][] = [
  [-15.6, -0.9, 0, 0.4],   // grey  — near dust collector
  [-14.2, -1.7, 1, -0.6],  // white — between collector + band saw
  [-12.6, -1.4, 2, 1.1],   // orange— moved off centre aisle to -Z gap (band saw side)
  [-12.2, -1.9, 0, 0.2],   // grey  — near drill press
  [-10.2, -1.9, 2, -0.9],  // orange— off drill-press side
];

const BUCK_R_TOP = 0.145;  // top radius (bucket is wider at top)
const BUCK_R_BOT = 0.115;  // bottom radius
const BUCK_H     = 0.38;   // bucket height
const RIM_R      = 0.155;  // rolled rim outer radius
const RIM_H      = 0.018;
const HANDLE_R   = 0.135;  // wire handle arc radius

// ─── Module-scope materials ───────────────────────────────────────────────────

const _greyMat   = new THREE.MeshStandardMaterial({ color: '#9a9a96', roughness: 0.70, metalness: 0.05 });
const _whiteMat  = new THREE.MeshStandardMaterial({ color: '#e2e2dc', roughness: 0.70, metalness: 0.05 });
const _orangeMat = new THREE.MeshStandardMaterial({ color: '#d2691e', roughness: 0.68, metalness: 0.05 });
const _bodyMats: readonly [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] = [
  _greyMat, _whiteMat, _orangeMat,
];
const _rimMat = new THREE.MeshStandardMaterial({
  color: '#7a7a76', roughness: 0.55, metalness: 0.20,   // slightly darker rolled rim
});
const _handleMat = new THREE.MeshStandardMaterial({
  color: '#6a6a70', roughness: 0.40, metalness: 0.75,   // bare-wire handle
});

// ─── Sub-component ─────────────────────────────────────────────────────────────

/** One 5-gallon bucket with rim + wire handle, base at the group origin. */
function Bucket({ colorIndex }: { colorIndex: number }) {
  const bodyMat = _bodyMats[colorIndex % _bodyMats.length] ?? _greyMat;

  return (
    <group name="bucket">
      {/* Tapered body */}
      <mesh castShadow receiveShadow position={[0, BUCK_H / 2, 0]}>
        <cylinderGeometry args={[BUCK_R_TOP, BUCK_R_BOT, BUCK_H, 16]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>

      {/* Rolled rim near the top */}
      <mesh castShadow position={[0, BUCK_H - RIM_H / 2, 0]}>
        <cylinderGeometry args={[RIM_R, RIM_R, RIM_H, 16]} />
        <primitive object={_rimMat} attach="material" />
      </mesh>

      {/* Wire handle arc — a half-torus rising over the bucket */}
      <mesh position={[0, BUCK_H + HANDLE_R * 0.5, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[HANDLE_R, 0.006, 6, 12, Math.PI]} />
        <primitive object={_handleMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * Buckets — five scattered 5-gallon shop buckets near the machines. Static.
 */
export function Buckets() {
  return (
    <group name="buckets">
      {BUCKETS.map(([x, z, colorIndex, yaw], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, yaw, 0]}>
          <Bucket colorIndex={colorIndex} />
        </group>
      ))}
    </group>
  );
}
