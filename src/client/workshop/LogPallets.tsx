/**
 * LogPallets.tsx — Wheeled plywood pallets each holding a rough bark-on log.
 *
 * Two low plywood platforms on four casters, each carrying a stout bark-on log
 * round (brown body with a darker bark rim and a pale cut end-grain), like the
 * log-on-a-dolly in the director's photos.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +7.25], ceiling 3.6 m, floor Y=0.
 *   -Z wall = lathe wall; +Z wall (Z≈7.25) = aisle/window wall.
 *
 * PLACEMENT (verified clear): on the +Z (right) side near the wire rack /
 *   cubbies. Pallet A = [-12, 0, 5.5], pallet B = [-10.5, 0, 6.2]. The wire rack
 *   sits at X=-15.4/Z=6.5 (~3.4 m away in X), the cubbies at X=-13/Z=6.75
 *   (~1.0 m away in X, ~1.25 m in Z) — no overlap with either ~0.8 m footprint.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation, no Math.random, no Date.now, no browser APIs — Three.js only.
 * No per-frame allocation.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** Pallet placements: [x, y, z, yaw] — vary rotation per pallet. */
const PALLETS: readonly [number, number, number, number][] = [
  [-12.0, 0, 5.5, 0.3],
  [-10.5, 0, 6.2, -0.5],
];

// Plywood platform
const DECK_W = 0.72;    // X
const DECK_D = 0.62;    // Z
const DECK_T = 0.06;    // thickness
const DECK_Y = 0.085;   // deck underside height (on top of casters)

// Casters
const CASTER_R = 0.05;
const CASTER_W = 0.035;
const CASTER_INSET = 0.08;   // inset from deck corners

// Log round on the deck
const LOG_R = 0.21;     // log radius
const LOG_H = 0.42;     // log height (standing on end)
const BARK_T = 0.025;   // bark-rim thickness (radial shell)
const ENDGRAIN_T = 0.012;

// ─── Module-scope materials ───────────────────────────────────────────────────

const _deckMat = new THREE.MeshStandardMaterial({
  color: '#c7a878', roughness: 0.85, metalness: 0.0,   // plywood platform
});
const _casterMat = new THREE.MeshStandardMaterial({
  color: '#26262a', roughness: 0.55, metalness: 0.35,  // black caster wheel
});
const _logMat = new THREE.MeshStandardMaterial({
  color: '#6e5234', roughness: 0.92, metalness: 0.0,   // brown log body
});
const _barkMat = new THREE.MeshStandardMaterial({
  color: '#3a2a1a', roughness: 0.95, metalness: 0.0,   // dark bark rim
});
const _endGrainMat = new THREE.MeshStandardMaterial({
  color: '#c8b48a', roughness: 0.80, metalness: 0.0,   // pale cut end-grain
});

// ─── Sub-component ─────────────────────────────────────────────────────────────

/** One wheeled pallet with a bark-on log round, centred at the group origin. */
function Pallet() {
  const cornerX = DECK_W / 2 - CASTER_INSET;
  const cornerZ = DECK_D / 2 - CASTER_INSET;
  const casterCorners: readonly [number, number][] = [
    [-cornerX, -cornerZ],
    [ cornerX, -cornerZ],
    [-cornerX,  cornerZ],
    [ cornerX,  cornerZ],
  ];

  const deckTopY = DECK_Y + DECK_T / 2;
  const logBaseY = deckTopY + DECK_T / 2;

  return (
    <group name="log-pallet">
      {/* Casters — short dark cylinders lying on their side */}
      {casterCorners.map(([cx, cz], i) => (
        <mesh key={i} castShadow position={[cx, CASTER_R, cz]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[CASTER_R, CASTER_R, CASTER_W, 12]} />
          <primitive object={_casterMat} attach="material" />
        </mesh>
      ))}

      {/* Plywood deck */}
      <mesh castShadow receiveShadow position={[0, DECK_Y + DECK_T / 2, 0]}>
        <boxGeometry args={[DECK_W, DECK_T, DECK_D]} />
        <primitive object={_deckMat} attach="material" />
      </mesh>

      {/* Log round — brown body standing on end */}
      <mesh castShadow receiveShadow position={[0, logBaseY + LOG_H / 2, 0]}>
        <cylinderGeometry args={[LOG_R, LOG_R, LOG_H, 20]} />
        <primitive object={_logMat} attach="material" />
      </mesh>

      {/* Bark rim — a thin dark shell hugging the cylinder side */}
      <mesh position={[0, logBaseY + LOG_H / 2, 0]}>
        <cylinderGeometry args={[LOG_R + BARK_T, LOG_R + BARK_T, LOG_H * 0.96, 20, 1, true]} />
        <primitive object={_barkMat} attach="material" />
      </mesh>

      {/* Pale cut end-grain disc on top */}
      <mesh position={[0, logBaseY + LOG_H + ENDGRAIN_T / 2, 0]}>
        <cylinderGeometry args={[LOG_R, LOG_R, ENDGRAIN_T, 20]} />
        <primitive object={_endGrainMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * LogPallets — two wheeled plywood pallets, each carrying a rough bark-on log
 * round, parked on the +Z side near the wire rack / cubbies. Static.
 */
export function LogPallets() {
  return (
    <group name="log-pallets">
      {PALLETS.map(([x, y, z, yaw], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, yaw, 0]}>
          <Pallet />
        </group>
      ))}
    </group>
  );
}
