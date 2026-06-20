/**
 * ShopVac.tsx — Orange shop vacuum sitting on a small plywood rolling cart.
 *
 * A stout cylindrical orange tank with a dark top motor/lid unit, a curved
 * intake hose stub, and casters — parked on a low plywood cart with four
 * casters of its own. The kind of thing that lives next to a machine for
 * quick chip pickup.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +7.25], ceiling 3.6 m, floor Y=0.
 *
 * PLACEMENT (verified clear): beside the grinder station, in open floor.
 *   SHOP_VAC_POS = [-15.5, 0, 3.0]. The GrinderStation is at X=-14.5 / Z=1.5,
 *   the WireRack at X=-15.4 / Z=6.5, and the band saw at X=-13.5 / Z=-1.0 —
 *   this open spot against the -X wall sits clear between them.
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

/** World position of the shop vac + cart (cart bottom-centre). */
export const SHOP_VAC_POS: [number, number, number] = [-15.5, 0, 3.0];

/** Rotation (radians). Slight yaw so it reads as casually parked. */
export const SHOP_VAC_ROT: [number, number, number] = [0, 0.4, 0];

// Rolling cart (plywood)
const CART_W   = 0.60;   // cart deck width
const CART_D   = 0.60;   // cart deck depth
const CART_T   = 0.04;   // deck thickness
const CART_CLR = 0.10;   // deck height above floor (caster clearance)
const CASTER_R = 0.035;  // caster radius

// Vacuum tank
const TANK_R   = 0.225;  // tank radius (~0.45 m dia)
const TANK_H   = 0.42;   // tank body height
const LID_H    = 0.16;   // motor/lid height
const HOSE_R   = 0.035;  // intake hose radius

// ─── Module-scope materials ───────────────────────────────────────────────────

const _tankMat   = new THREE.MeshStandardMaterial({ color: '#d2691e', roughness: 0.55, metalness: 0.10 }); // orange tank
const _lidMat    = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.45, metalness: 0.35 }); // dark motor lid
const _hoseMat   = new THREE.MeshStandardMaterial({ color: '#1f1f22', roughness: 0.70, metalness: 0.05 }); // black hose
const _latchMat  = new THREE.MeshStandardMaterial({ color: '#3a3a3e', roughness: 0.50, metalness: 0.45 }); // tank latch
const _deckMat   = new THREE.MeshStandardMaterial({ color: '#c7a878', roughness: 0.80, metalness: 0.0 });  // plywood deck
const _casterMat = new THREE.MeshStandardMaterial({ color: '#202024', roughness: 0.60, metalness: 0.25 }); // rubber caster

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Small plywood deck on four casters. */
function Cart() {
  const halfW = CART_W / 2 - CASTER_R - 0.02;
  const halfD = CART_D / 2 - CASTER_R - 0.02;
  const casterPos: ReadonlyArray<[number, number]> = [
    [-halfW, -halfD],
    [ halfW, -halfD],
    [-halfW,  halfD],
    [ halfW,  halfD],
  ];

  return (
    <group name="vac-cart">
      {/* Plywood deck */}
      <mesh castShadow receiveShadow position={[0, CART_CLR + CART_T / 2, 0]}>
        <boxGeometry args={[CART_W, CART_T, CART_D]} />
        <primitive object={_deckMat} attach="material" />
      </mesh>
      {/* Casters */}
      {casterPos.map(([x, z], i) => (
        <mesh key={String(i)} castShadow position={[x, CASTER_R, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[CASTER_R, CASTER_R, 0.03, 12]} />
          <primitive object={_casterMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** The orange tank + dark motor lid + intake hose. Sits on the cart deck. */
function Vacuum() {
  const deckTop = CART_CLR + CART_T;
  const tankY = deckTop + TANK_H / 2;
  const lidY = deckTop + TANK_H + LID_H / 2;
  const latchOffsets = [0, Math.PI] as const;

  const items: ReactNode[] = [];

  return (
    <group name="vacuum">
      {/* Tank body */}
      <mesh castShadow receiveShadow position={[0, tankY, 0]}>
        <cylinderGeometry args={[TANK_R, TANK_R * 0.96, TANK_H, 24]} />
        <primitive object={_tankMat} attach="material" />
      </mesh>

      {/* Dark motor / lid unit on top */}
      <mesh castShadow position={[0, lidY, 0]}>
        <cylinderGeometry args={[TANK_R * 0.92, TANK_R, LID_H, 24]} />
        <primitive object={_lidMat} attach="material" />
      </mesh>
      {/* Lid top dome / motor cap */}
      <mesh castShadow position={[0, deckTop + TANK_H + LID_H + 0.02, 0]}>
        <cylinderGeometry args={[TANK_R * 0.42, TANK_R * 0.55, 0.06, 16]} />
        <primitive object={_lidMat} attach="material" />
      </mesh>

      {/* Two side latches clamping the lid to the tank */}
      {latchOffsets.map((a, i) => (
        <mesh
          key={`latch-${String(i)}`}
          castShadow
          position={[Math.cos(a) * TANK_R, deckTop + TANK_H - 0.01, Math.sin(a) * TANK_R]}
        >
          <boxGeometry args={[0.05, 0.07, 0.03]} />
          <primitive object={_latchMat} attach="material" />
        </mesh>
      ))}

      {/* Intake port stub on the tank front (local +X) */}
      <mesh castShadow position={[TANK_R, tankY + 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[HOSE_R, HOSE_R, 0.10, 12]} />
        <primitive object={_lidMat} attach="material" />
      </mesh>
      {/* Hose looping down toward the cart deck */}
      <mesh castShadow position={[TANK_R + 0.10, tankY - 0.10, 0]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[HOSE_R, HOSE_R, 0.30, 12]} />
        <primitive object={_hoseMat} attach="material" />
      </mesh>

      {items}
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface ShopVacProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * ShopVac — orange shop vacuum on a small plywood rolling cart. Default
 * SHOP_VAC_POS = [-15.5, 0, 3.0] beside the grinder station. Both constants
 * exported for director tuning.
 *
 * Footprint: ~0.6 m cart, ~0.45 m tank diameter.
 */
export function ShopVac({
  position = SHOP_VAC_POS,
  rotation = SHOP_VAC_ROT,
}: ShopVacProps = {}) {
  return (
    <group name="shop-vac" position={position} rotation={rotation}>
      <Cart />
      <Vacuum />
    </group>
  );
}
