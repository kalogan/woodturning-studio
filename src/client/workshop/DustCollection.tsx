/**
 * DustCollection.tsx — Shop dust collection system.
 *
 * The defining infrastructure of a real woodturning shop:
 *   • A floor-standing dust collector (blower housing + tall fabric bag +
 *     intake elbow) tucked into the entrance / lathe-wall corner.
 *   • A horizontal galvanized round duct TRUNK running the length of the
 *     lathe wall, just below the overhead light fixtures.
 *   • Vertical DROP branches descending over individual lathe stations,
 *     each ending in a blast gate, a corrugated flex hose, and a flared
 *     pickup hood.
 *   • Steel mounting straps holding the trunk up near the wall.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling HALL_H = 3.6 m, floor Y=0.
 *   -Z wall (Z≈-2.5) = lathe wall; prop lathes at X = -2.5, -5, -7.5, -10, -12.5.
 *
 * HEIGHT CLEARANCE (verified against Lighting.tsx + Hall.tsx):
 *   • Light fixtures (Lighting.tsx) sit at Y≈3.45–3.54 over Row A (Z≈-1.5)
 *     and Row B (Z≈1.5). Existing black ceiling ducts (Hall.tsx) hang at
 *     Y 3.4–3.6 over the aisle centre (Z≈0.75) and a Z-branch at X=-7.
 *   • Our trunk runs at Y=2.95 (well below those) and at Z=-2.15 — between
 *     the -Z wall (Z=-2.5) and the lathes (Z=0), clear of the Row A lights
 *     at Z=-1.5. No intersection with lights or existing ducts.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation, no Math.random, no Date.now, no browser APIs — Three.js only.
 * No per-frame allocation.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// ── Collector unit (floor-standing, -X/-Z corner) ───────────────────────────
/** World position of the collector base centre (corner; grinder is at +Z side). */
const COLLECTOR_POS: [number, number, number] = [-15.0, 0, -1.7];

const BASE_W = 0.62;   // blower / motor housing (square-ish steel base)
const BASE_H = 0.60;
const BASE_D = 0.62;

const BLOWER_R = 0.20;  // blower scroll housing on top of the base
const BLOWER_T = 0.26;  // axial thickness of the scroll

const BAG_R   = 0.225;  // fabric collection bag radius
const BAG_H   = 1.40;   // bag height
const RING_R  = 0.235;  // metal support ring radii at bag top/bottom
const RING_T  = 0.02;

const INTAKE_R   = 0.10;  // intake elbow pipe radius
const INTAKE_LEN = 0.35;  // horizontal intake stub length

// ── Main duct trunk (horizontal, along X, near the lathe wall) ───────────────
const TRUNK_Y = 2.95;    // BELOW light fixtures (Y≈3.5) and ceiling ducts (Y≥3.4)
const TRUNK_Z = -2.15;   // between -Z wall (-2.5) and lathes (0); clear of lights
const TRUNK_R = 0.10;    // round duct radius (~0.20 m dia)
const TRUNK_X_HI = -1.4;     // +X end of the trunk (near player lathe)
const TRUNK_X_LO = COLLECTOR_POS[0]; // -X end, over the collector

// ── Drop branches (vertical, descending to lathe stations) ───────────────────
/** X positions of the drops (above selected lathe stations). */
const DROP_XS: readonly number[] = [-2.5, -7.5, -12.5];
const DROP_R       = 0.06;    // drop pipe radius (~0.12 m dia)
const DROP_BOTTOM_Y = 1.60;   // where the drop ends (blast gate top), above bed
const HOOD_R       = 0.11;    // flared pickup hood mouth radius
const FLEX_R       = 0.055;   // flex hose radius (a touch under the drop)

// Blast gate (flat box valve with a handle tab)
const GATE_W = 0.17;
const GATE_H = 0.13;
const GATE_T = 0.045;

// Mounting straps holding the trunk to the wall
/** X positions of the trunk support straps. */
const STRAP_XS: readonly number[] = [-13.5, -9.0, -4.5];

// ─── Module-scope materials ───────────────────────────────────────────────────

const _ductMat = new THREE.MeshStandardMaterial({
  color: '#b4b8bc', roughness: 0.45, metalness: 0.60,   // galvanized steel
});
const _flexMat = new THREE.MeshStandardMaterial({
  color: '#8a8c90', roughness: 0.70, metalness: 0.35,   // darker flex hose
});
const _housingMat = new THREE.MeshStandardMaterial({
  color: '#4a5258', roughness: 0.55, metalness: 0.50,   // shop steel housing
});
const _bagMat = new THREE.MeshStandardMaterial({
  color: '#e8e6dc', roughness: 0.90, metalness: 0.0,     // off-white fabric bag
});
const _ringMat = new THREE.MeshStandardMaterial({
  color: '#9a9ea2', roughness: 0.40, metalness: 0.65,    // bag support ring
});
const _gateMat = new THREE.MeshStandardMaterial({
  color: '#6a6a70', roughness: 0.45, metalness: 0.55,    // blast gate body
});
const _handleMat = new THREE.MeshStandardMaterial({
  color: '#c0392b', roughness: 0.50, metalness: 0.10,    // red handle tab
});
const _strapMat = new THREE.MeshStandardMaterial({
  color: '#5a5e62', roughness: 0.50, metalness: 0.60,    // steel band
});

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Floor-standing collector: steel base, blower scroll, fabric bag, intake. */
function Collector() {
  const bagBottomY = BASE_H + BLOWER_T / 2;  // bag rises off the blower top
  return (
    <group name="dust-collector" position={COLLECTOR_POS}>
      {/* Steel base / motor housing */}
      <mesh castShadow receiveShadow position={[0, BASE_H / 2, 0]}>
        <boxGeometry args={[BASE_W, BASE_H, BASE_D]} />
        <primitive object={_housingMat} attach="material" />
      </mesh>

      {/* Blower scroll housing (cylinder on its side) atop the base */}
      <mesh castShadow position={[0, BASE_H + BLOWER_T / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[BLOWER_R, BLOWER_R, BLOWER_T, 20]} />
        <primitive object={_housingMat} attach="material" />
      </mesh>

      {/* Intake elbow — horizontal stub off the +X face of the blower */}
      <mesh castShadow
            position={[BLOWER_R + INTAKE_LEN / 2, BASE_H + BLOWER_T / 2, 0]}
            rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[INTAKE_R, INTAKE_R, INTAKE_LEN, 16]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>
      {/* Intake elbow — vertical riser turning up toward the trunk */}
      <mesh castShadow
            position={[BLOWER_R + INTAKE_LEN, BASE_H + BLOWER_T / 2 + INTAKE_LEN / 2, 0]}>
        <cylinderGeometry args={[INTAKE_R, INTAKE_R, INTAKE_LEN, 16]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>

      {/* Fabric collection bag */}
      <mesh castShadow position={[0, bagBottomY + BAG_H / 2, 0]}>
        <cylinderGeometry args={[BAG_R, BAG_R, BAG_H, 20]} />
        <primitive object={_bagMat} attach="material" />
      </mesh>
      {/* Support rings at bag bottom and top */}
      <mesh position={[0, bagBottomY + RING_T / 2, 0]}>
        <cylinderGeometry args={[RING_R, RING_R, RING_T, 20, 1, true]} />
        <primitive object={_ringMat} attach="material" />
      </mesh>
      <mesh position={[0, bagBottomY + BAG_H - RING_T / 2, 0]}>
        <cylinderGeometry args={[RING_R, RING_R, RING_T, 20, 1, true]} />
        <primitive object={_ringMat} attach="material" />
      </mesh>
    </group>
  );
}

// Strap geometry — a short vertical band from just above the trunk up toward
// the ceiling line; kept well below the Y≈3.54 light fixtures.
const HALL_TRUNK_TOP = 3.30;                  // top of the strap (below lights)
const STRAP_LEN = HALL_TRUNK_TOP - TRUNK_Y;   // band length

/** The horizontal galvanized round duct trunk running along X near the wall. */
function Trunk() {
  const len = TRUNK_X_HI - TRUNK_X_LO;
  const cx  = (TRUNK_X_HI + TRUNK_X_LO) / 2;
  return (
    <group name="dust-trunk">
      {/* Long round duct lying along X */}
      <mesh castShadow position={[cx, TRUNK_Y, TRUNK_Z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[TRUNK_R, TRUNK_R, len, 20]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>

      {/* End cap at the +X end (capped run) */}
      <mesh position={[TRUNK_X_HI, TRUNK_Y, TRUNK_Z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[TRUNK_R * 1.05, TRUNK_R * 1.05, 0.03, 20]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>

      {/* Mounting straps — steel bands from the wall down to the trunk */}
      {STRAP_XS.map((x, i) => (
        <mesh key={i} castShadow
              position={[x, (TRUNK_Y + HALL_TRUNK_TOP) / 2, TRUNK_Z - TRUNK_R - 0.04]}>
          <boxGeometry args={[0.03, STRAP_LEN, 0.02]} />
          <primitive object={_strapMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** A single drop branch: vertical pipe → blast gate → flex hose → pickup hood. */
function Drop({ x }: { x: number }) {
  const dropLen = TRUNK_Y - DROP_BOTTOM_Y;   // vertical pipe length
  const dropCY  = (TRUNK_Y + DROP_BOTTOM_Y) / 2;

  // Blast gate sits just below the drop's bottom.
  const gateCY = DROP_BOTTOM_Y - GATE_H / 2;

  // Flex hose hangs below the gate, drifting toward the lathe (+Z, toward Z=0).
  const flexTopY = gateCY - GATE_H / 2;
  const flexLen  = 0.26;
  const flexZ0   = 0.0;   // hose pivot sits on the drop centreline (Z drift via tilt)

  return (
    <group name="dust-drop" position={[x, 0, TRUNK_Z]}>
      {/* Vertical drop pipe from the trunk down to the gate */}
      <mesh castShadow position={[0, dropCY, 0]}>
        <cylinderGeometry args={[DROP_R, DROP_R, dropLen, 16]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>

      {/* Blast gate — flat box valve */}
      <mesh castShadow position={[0, gateCY, 0]}>
        <boxGeometry args={[GATE_W, GATE_H, GATE_T]} />
        <primitive object={_gateMat} attach="material" />
      </mesh>
      {/* Gate handle tab (slid to one side) */}
      <mesh castShadow position={[GATE_W / 2 + 0.03, gateCY, 0]}>
        <boxGeometry args={[0.06, GATE_H * 0.5, 0.012]} />
        <primitive object={_handleMat} attach="material" />
      </mesh>

      {/* Flex hose — corrugated look via stacked ribs on a core cylinder.
          Tilted toward the lathe (+Z) to suggest the hose curving to the hood. */}
      <group position={[0, flexTopY, flexZ0]} rotation={[-0.55, 0, 0]}>
        {/* Smooth core */}
        <mesh castShadow position={[0, -flexLen / 2, 0]}>
          <cylinderGeometry args={[FLEX_R, FLEX_R, flexLen, 14]} />
          <primitive object={_flexMat} attach="material" />
        </mesh>
        {/* Corrugation ribs — a few stacked thin rings */}
        {[0.12, 0.28, 0.44, 0.60, 0.76, 0.92].map((t, i) => (
          <mesh key={i} position={[0, -flexLen * t, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[FLEX_R + 0.006, 0.009, 6, 14]} />
            <primitive object={_flexMat} attach="material" />
          </mesh>
        ))}
        {/* Flared pickup hood at the hose mouth (cone funnel) */}
        <mesh castShadow position={[0, -flexLen - 0.05, 0]}>
          <coneGeometry args={[HOOD_R, 0.13, 18, 1, true]} />
          <primitive object={_ductMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * DustCollection — collector unit + overhead duct trunk + drop branches with
 * blast gates and flex-hose pickup hoods over the lathe stations.
 */
export function DustCollection() {
  return (
    <group name="dust-collection">
      <Collector />
      <Trunk />
      {DROP_XS.map((x, i) => (
        <Drop key={i} x={x} />
      ))}
    </group>
  );
}
