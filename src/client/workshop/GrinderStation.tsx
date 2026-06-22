/**
 * GrinderStation.tsx — Pedestal bench grinder station.
 *
 * A steel stand with a motor body and two grinding wheels on each end,
 * adjustable tool rests, and a small water pot for cooling tool tips.
 * Dark grey / gunmetal metal throughout.
 *
 * Default placement: along the left (-X) wall, near the player lathe.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at player lathe.
 *   Hall extends X ∈ [-2, +16], Z ∈ [-2.5, +4].
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No browser APIs — Three.js only.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// Long-hallway layout: hall X ∈ [-16, +2], Z ∈ [-2.5, +7.25].
// Grinder station previously sat dead-centre just inside the entrance
// ([-14.5, 0, 1.5]), blocking the centre entry aisle. Relocated to the +Z side
// near the entrance (Z=3.6) — clear of the centre aisle (Z 0.4–2.1) and of the
// shop vac (X=-15.5, Z=3.0, ~1.4 m away). Still faces down the hall (+X).

/** World position of the grinder station (base centre). */
export const GRINDER_POS: [number, number, number] = [-14.5, 0, 3.6];

/** Rotation (radians). Faces down the hall toward player lathe (+X direction). */
export const GRINDER_ROT: [number, number, number] = [0, Math.PI / 2, 0];

// Pedestal stand
const STAND_W  = 0.28;  // stand width
const STAND_D  = 0.28;  // stand depth
const STAND_H  = 0.82;  // pedestal height (to motor centre-line)
const STAND_WT = 0.035; // wall thickness (for gusset ribs)

// Motor body
const MOTOR_W = 0.22;
const MOTOR_H = 0.18;
const MOTOR_D = 0.22;
const MOTOR_Y = STAND_H;

// Grinding wheels
const WHEEL_R  = 0.095;  // radius
const WHEEL_T  = 0.030;  // thickness (axial)
const WHEEL_OX = MOTOR_D / 2 + WHEEL_T / 2 + 0.005;  // offset from motor centre

// Arbor / spindle shafts
const ARBOR_R = 0.010;
const ARBOR_L = MOTOR_D / 2 + WHEEL_T + 0.025;

// Tool rests (angled flat plates below each wheel)
const REST_W     = 0.085;
const REST_T     = 0.008;
const REST_H     = 0.06;
const REST_ANGLE = 0.35;  // tilt angle (radians)

// Water pot
const POT_R = 0.040;
const POT_H = 0.060;

// ─── Module-scope materials ───────────────────────────────────────────────────

const _standMat    = new THREE.MeshStandardMaterial({ color: '#323232', roughness: 0.60, metalness: 0.55 });
const _motorMat    = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.50, metalness: 0.60 });
const _ribMat      = new THREE.MeshStandardMaterial({ color: '#323232', roughness: 0.60, metalness: 0.55 });
const _wheelMat    = new THREE.MeshStandardMaterial({ color: '#b8b09a', roughness: 0.85, metalness: 0.05 });  // abrasive stone
const _wheelRimMat = new THREE.MeshStandardMaterial({ color: '#6a6a70', roughness: 0.40, metalness: 0.70 }); // metal hub flange
const _arborMat    = new THREE.MeshStandardMaterial({ color: '#7a7a80', roughness: 0.30, metalness: 0.88 }); // bare steel
const _restMat     = new THREE.MeshStandardMaterial({ color: '#4a4a50', roughness: 0.40, metalness: 0.65 }); // tool rest plate
const _shieldMat   = new THREE.MeshStandardMaterial({
  color: '#1a2a30', roughness: 0.10, metalness: 0.0,
  transparent: true, opacity: 0.65,
});
const _badgeMat    = new THREE.MeshStandardMaterial({ color: '#c8b050', roughness: 0.55, metalness: 0.45 });
const _potMat      = new THREE.MeshStandardMaterial({ color: '#3a5a70', roughness: 0.55, metalness: 0.40 }); // blue metal can
const _waterMat    = new THREE.MeshStandardMaterial({
  color: '#1a3050', roughness: 0.05, metalness: 0.0,
  emissive: new THREE.Color('#0a1828'), emissiveIntensity: 0.15,
});

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Steel pedestal stand with a top plate and base foot plate. */
function Pedestal() {
  const gussetPositions = [-1, 1] as const;

  return (
    <group name="pedestal">
      {/* Main column */}
      <mesh castShadow receiveShadow position={[0, STAND_H / 2, 0]}>
        <boxGeometry args={[STAND_W, STAND_H, STAND_D]} />
        <primitive object={_standMat} attach="material" />
      </mesh>

      {/* Top mounting plate */}
      <mesh castShadow position={[0, STAND_H + 0.018, 0]}>
        <boxGeometry args={[STAND_W + 0.04, 0.022, STAND_D + 0.04]} />
        <primitive object={_standMat} attach="material" />
      </mesh>

      {/* Base foot plate */}
      <mesh castShadow receiveShadow position={[0, 0.012, 0]}>
        <boxGeometry args={[STAND_W + 0.08, 0.022, STAND_D + 0.08]} />
        <primitive object={_standMat} attach="material" />
      </mesh>

      {/* Gusset ribs — front and back */}
      {gussetPositions.map((sign, i) => (
        <mesh key={i} castShadow
              position={[0, STAND_H * 0.35, sign * (STAND_D / 2 - STAND_WT / 2)]}>
          <boxGeometry args={[STAND_W * 0.6, STAND_H * 0.25, STAND_WT]} />
          <primitive object={_ribMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** Motor housing with cooling ribs and nameplate badge. */
function MotorBody() {
  const ribOffsets = [0.04, 0, -0.04] as const;

  return (
    <group name="motor-body" position={[0, MOTOR_Y, 0]}>
      {/* Main housing */}
      <mesh castShadow>
        <boxGeometry args={[MOTOR_W, MOTOR_H, MOTOR_D]} />
        <primitive object={_motorMat} attach="material" />
      </mesh>

      {/* Cooling rib strips on front face */}
      {ribOffsets.map((y, i) => (
        <mesh key={i} position={[0, y, MOTOR_D / 2 + 0.003]}>
          <boxGeometry args={[MOTOR_W * 0.85, 0.016, 0.006]} />
          <primitive object={_motorMat} attach="material" />
        </mesh>
      ))}

      {/* Nameplate badge */}
      <mesh position={[0, -0.04, MOTOR_D / 2 + 0.004]}>
        <boxGeometry args={[0.06, 0.022, 0.003]} />
        <primitive object={_badgeMat} attach="material" />
      </mesh>
    </group>
  );
}

/** One grinding wheel + arbor shaft + eye shield + tool rest.
 *  side: -1 = left wheel, +1 = right wheel. */
function GrindingWheel({ side }: { side: -1 | 1 }) {
  const zOff    = side * WHEEL_OX;
  const arborCZ = side * ARBOR_L / 2;
  const flangeOffsets = [-0.5, 0.5] as const;

  return (
    <group name={side < 0 ? 'wheel-left' : 'wheel-right'} position={[0, MOTOR_Y, 0]}>
      {/* Arbor shaft */}
      <mesh castShadow position={[0, 0, arborCZ]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[ARBOR_R, ARBOR_R, ARBOR_L, 10]} />
        <primitive object={_arborMat} attach="material" />
      </mesh>

      {/* Abrasive wheel disc */}
      <mesh castShadow position={[0, 0, zOff]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[WHEEL_R, WHEEL_R, WHEEL_T, 24]} />
        <primitive object={_wheelMat} attach="material" />
      </mesh>

      {/* Hub flanges (metal washers either side of wheel) */}
      {flangeOffsets.map((s, i) => (
        <mesh key={i} castShadow
              position={[0, 0, zOff + s * (WHEEL_T + 0.004)]}
              rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[WHEEL_R * 0.42, WHEEL_R * 0.42, 0.008, 16]} />
          <primitive object={_wheelRimMat} attach="material" />
        </mesh>
      ))}

      {/* Eye-shield arc above wheel */}
      <mesh castShadow position={[0, WHEEL_R * 0.8, zOff]}>
        <boxGeometry args={[WHEEL_R * 2.1, WHEEL_R * 0.30, 0.005]} />
        <primitive object={_shieldMat} attach="material" />
      </mesh>

      {/* Tool rest (angled plate below and in front of wheel) */}
      <mesh castShadow
            position={[0, -WHEEL_R * 0.55, zOff + side * 0.02]}
            rotation={[REST_ANGLE * side, 0, 0]}>
        <boxGeometry args={[REST_W, REST_T, REST_H]} />
        <primitive object={_restMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Small water pot for cooling tool tips beside the grinder. */
function WaterPot() {
  return (
    <group name="water-pot" position={[STAND_W / 2 + POT_R + 0.02, STAND_H + 0.06, 0]}>
      {/* Can body */}
      <mesh castShadow>
        <cylinderGeometry args={[POT_R, POT_R * 0.92, POT_H, 12]} />
        <primitive object={_potMat} attach="material" />
      </mesh>
      {/* Water surface */}
      <mesh position={[0, POT_H / 2 - 0.008, 0]}>
        <cylinderGeometry args={[POT_R - 0.003, POT_R - 0.003, 0.004, 12]} />
        <primitive object={_waterMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface GrinderStationProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * GrinderStation — pedestal bench grinder with two wheels, tool rests,
 * and a water cooling pot.
 *
 * Default position: GRINDER_POS = [-14.5, 0, 3.6]  (+Z side, near entrance)
 * Default rotation: GRINDER_ROT = [0, π/2, 0]      (faces down the hall, +X)
 * Both constants are exported for easy director tuning.
 */
export function GrinderStation({
  position = GRINDER_POS,
  rotation = GRINDER_ROT,
}: GrinderStationProps = {}) {
  return (
    <group name="grinder-station" position={position} rotation={rotation}>
      <Pedestal />
      <MotorBody />
      <GrindingWheel side={-1} />
      <GrindingWheel side={1} />
      <WaterPot />
    </group>
  );
}
