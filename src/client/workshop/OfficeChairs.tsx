/**
 * OfficeChairs.tsx — Rolling office/task chairs parked around the hall.
 *
 * Three dark-fabric task chairs (seat + low back, a gas-cylinder post, and a
 * 5-star caster base), parked on the operator side (+Z) of a couple of prop
 * lathes and one by the demo bench. Rotation varies per chair.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +7.25], ceiling 3.6 m, floor Y=0.
 *   Prop lathes at X = -2.5…-12.5, Z≈0 (operator faces +Z). Demo bench at
 *   [-7, 0, 4.5].
 *
 * PLACEMENT (operator side of lathes + by the demo bench):
 *   [-5, 0, 0.9]  — operator side of the X=-5 lathe.
 *   [-10, 0, 0.9] — operator side of the X=-10 lathe.
 *   [-8.4, 0, 3.9] — by the demo bench (slightly off so it doesn't clip).
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation, no Math.random, no Date.now, no browser APIs — Three.js only.
 * No per-frame allocation.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** Chair placements: [x, z, yaw]. Vary rotation per chair. */
const CHAIRS: readonly [number, number, number][] = [
  [-5.0,  0.9, 0.3],    // operator side of X=-5 lathe
  [-10.0, 0.9, -0.5],   // operator side of X=-10 lathe
  [-8.4,  3.9, 2.4],    // by the demo bench
];

const SEAT_W   = 0.42;   // seat width (X)
const SEAT_D   = 0.40;   // seat depth (Z)
const SEAT_T   = 0.08;   // seat cushion thickness
const SEAT_Y   = 0.46;   // seat-top height

const BACK_W   = 0.40;
const BACK_H   = 0.36;   // low back
const BACK_T   = 0.07;

const POST_R   = 0.028;  // gas-cylinder post radius
const POST_TOP = SEAT_Y - SEAT_T;   // post rises to seat underside

const BASE_HUB_R = 0.05;  // 5-star base centre hub
const LEG_COUNT  = 5;
const LEG_LEN    = 0.26;  // length of each star leg
const LEG_W      = 0.05;
const CASTER_R   = 0.035;

// ─── Module-scope materials ───────────────────────────────────────────────────

const _fabricMat = new THREE.MeshStandardMaterial({
  color: '#2e2e32', roughness: 0.85, metalness: 0.05,   // dark fabric seat/back
});
const _postMat = new THREE.MeshStandardMaterial({
  color: '#3a3a40', roughness: 0.35, metalness: 0.65,   // chromed/painted gas post
});
const _baseMat = new THREE.MeshStandardMaterial({
  color: '#26262a', roughness: 0.50, metalness: 0.45,   // black plastic star base
});
const _casterMat = new THREE.MeshStandardMaterial({
  color: '#1c1c1f', roughness: 0.55, metalness: 0.30,   // dark caster
});

// ─── Sub-component ─────────────────────────────────────────────────────────────

/** One rolling task chair, base at the group origin. */
function Chair() {
  const legAngles = Array.from({ length: LEG_COUNT }, (_, i) => (i / LEG_COUNT) * Math.PI * 2);

  return (
    <group name="office-chair">
      {/* 5-star caster base */}
      <group name="base" position={[0, CASTER_R + 0.01, 0]}>
        {/* Centre hub */}
        <mesh castShadow>
          <cylinderGeometry args={[BASE_HUB_R, BASE_HUB_R, 0.06, 12]} />
          <primitive object={_baseMat} attach="material" />
        </mesh>
        {/* Star legs + casters */}
        {legAngles.map((ang, i) => {
          const lx = Math.cos(ang) * (LEG_LEN / 2 + BASE_HUB_R * 0.4);
          const lz = Math.sin(ang) * (LEG_LEN / 2 + BASE_HUB_R * 0.4);
          const tx = Math.cos(ang) * (LEG_LEN + BASE_HUB_R * 0.4);
          const tz = Math.sin(ang) * (LEG_LEN + BASE_HUB_R * 0.4);
          return (
            <group key={i}>
              <mesh castShadow position={[lx, 0, lz]} rotation={[0, -ang, 0]}>
                <boxGeometry args={[LEG_LEN, 0.035, LEG_W]} />
                <primitive object={_baseMat} attach="material" />
              </mesh>
              <mesh castShadow position={[tx, -CASTER_R + 0.005, tz]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[CASTER_R, CASTER_R, 0.03, 10]} />
                <primitive object={_casterMat} attach="material" />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Gas-cylinder post */}
      <mesh castShadow position={[0, POST_TOP / 2 + 0.06, 0]}>
        <cylinderGeometry args={[POST_R, POST_R, POST_TOP, 10]} />
        <primitive object={_postMat} attach="material" />
      </mesh>

      {/* Seat cushion */}
      <mesh castShadow receiveShadow position={[0, SEAT_Y - SEAT_T / 2, 0]}>
        <boxGeometry args={[SEAT_W, SEAT_T, SEAT_D]} />
        <primitive object={_fabricMat} attach="material" />
      </mesh>

      {/* Low back — at the rear (-Z) edge of the seat, leaning back slightly */}
      <mesh castShadow position={[0, SEAT_Y + BACK_H / 2, -SEAT_D / 2 + BACK_T / 2]} rotation={[-0.12, 0, 0]}>
        <boxGeometry args={[BACK_W, BACK_H, BACK_T]} />
        <primitive object={_fabricMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * OfficeChairs — three rolling task chairs parked around lathe stations and the
 * demo bench. Static.
 */
export function OfficeChairs() {
  return (
    <group name="office-chairs">
      {CHAIRS.map(([x, z, yaw], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, yaw, 0]}>
          <Chair />
        </group>
      ))}
    </group>
  );
}
