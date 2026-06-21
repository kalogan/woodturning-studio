/**
 * CeilingFan.tsx — Industrial ceiling fan (static, non-spinning).
 *
 * A short drop-rod from the ceiling, a central motor hub, and five wide flat
 * blades radiating out (~1.2 m span), light-grey painted metal. Hung BELOW the
 * ceiling and clear of the Y≈3.54 light fixtures (hub at Y≈3.1).
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +7.25], ceiling HALL_H = 3.6 m, floor Y=0.
 *   Two light rows at Z≈-1.5 / Z≈+1.5; ceiling air filters at X≈-4.5/-10.5,
 *   Z≈+0.15; unit heater at X≈-14.5, Z≈+3.0.
 *
 * PLACEMENT (verified clear): one fan over the open centre aisle at
 *   FAN_POS = [-4, 3.1, 2.5]. The air filters sit at Z≈0.15 (rear ≈0.36) and
 *   the duct spine at Z≈0.525–0.975, so a hub at Z=2.5 with a 0.6 m blade reach
 *   (tip Z≈3.1) stays clear of both. Nearest light X-positions are -3/-6 at
 *   Z≈+1.5; the hub at X=-4, Z=2.5 sits between/below them with ~0.4 m vertical
 *   clearance under the Y=3.54 fixtures.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation (static), no Math.random, no Date.now, no browser APIs — Three.js
 * only. No per-frame allocation.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** World position of the ceiling fan hub centre. */
const FAN_POS: [number, number, number] = [-4, 3.1, 2.5];

const CEILING_Y = 3.6;   // HALL_H — drop-rod terminates here

const BLADE_COUNT = 5;
const BLADE_LEN   = 0.55;   // length of one blade (hub edge → tip)
const BLADE_W     = 0.16;   // blade width
const BLADE_T     = 0.012;  // blade thickness
const BLADE_PITCH = 0.18;   // slight tilt (radians) so blades read as pitched

const HUB_R = 0.11;   // central motor hub radius
const HUB_H = 0.10;   // hub height

const ROD_R = 0.018;  // drop-rod radius

// ─── Module-scope materials ───────────────────────────────────────────────────

const _bladeMat = new THREE.MeshStandardMaterial({
  color: '#d8d8d2', roughness: 0.55, metalness: 0.45,   // light-grey painted metal
});
const _hubMat = new THREE.MeshStandardMaterial({
  color: '#9a9a96', roughness: 0.45, metalness: 0.60,   // brushed metal motor hub
});
const _rodMat = new THREE.MeshStandardMaterial({
  color: '#6a6a70', roughness: 0.40, metalness: 0.70,   // steel drop-rod
});

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * CeilingFan — one static industrial ceiling fan over the centre aisle.
 * Five flat pitched blades, a central motor hub, a drop-rod to the ceiling.
 * No animation.
 */
export function CeilingFan() {
  const hubY = FAN_POS[1];
  const rodLen = CEILING_Y - (hubY + HUB_H / 2);
  const rodCY = (CEILING_Y + hubY + HUB_H / 2) / 2 - hubY;  // local Y of rod centre

  // Blade reach from hub centre to mid-blade.
  const bladeReach = HUB_R + BLADE_LEN / 2;

  return (
    <group name="ceiling-fan" position={FAN_POS}>
      {/* Drop-rod from hub up to the ceiling */}
      <mesh castShadow position={[0, rodCY, 0]}>
        <cylinderGeometry args={[ROD_R, ROD_R, rodLen, 10]} />
        <primitive object={_rodMat} attach="material" />
      </mesh>

      {/* Central motor hub */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[HUB_R, HUB_R * 0.92, HUB_H, 16]} />
        <primitive object={_hubMat} attach="material" />
      </mesh>

      {/* Blades radiating out, slightly pitched */}
      {Array.from({ length: BLADE_COUNT }, (_, i) => {
        const ang = (i / BLADE_COUNT) * Math.PI * 2;
        const bx = Math.cos(ang) * bladeReach;
        const bz = Math.sin(ang) * bladeReach;
        return (
          <group key={i} position={[bx, -HUB_H * 0.15, bz]} rotation={[0, -ang, BLADE_PITCH]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[BLADE_LEN, BLADE_T, BLADE_W]} />
              <primitive object={_bladeMat} attach="material" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
