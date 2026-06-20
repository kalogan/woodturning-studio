/**
 * ShopMachines.tsx — Standalone shop floor machines (match-photo props).
 *
 * Three recognizable procedural machines that fill out the entrance end of
 * Hamester Hall, modelled after the real shop photos:
 *
 *   1. BAND SAW   — Delta-style two-wheel band saw: tall column on a base,
 *                   upper + lower enclosed wheel housings, a mid-height work
 *                   table with a thin blade slot, and an upper blade-guard arm.
 *   2. DRILL PRESS — Delta-style floor drill press: round base plate, vertical
 *                   column, box head with motor + twin pulley humps, a small
 *                   round work table on the column, a quill/chuck stub, and
 *                   three feed-handle spokes.
 *   3. PEDESTAL FAN — big floor fan: round wide base, vertical post, large round
 *                   cage head (two concentric ring cages + hub + blades),
 *                   tilted slightly. Static (NOT spinning).
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling HALL_H = 3.6 m, floor Y=0.
 *   -Z wall (Z≈-2.5) = lathe wall; prop lathes at X = -2.5…-12.5, Z≈0.
 *   +Z wall (Z≈+4) = aisle/window wall.
 *
 * PLACEMENT (verified clear of existing props — see notes per machine):
 *   • Band saw    : [-13.5, 0, -1.0]  — entrance end, between last lathe
 *                   (X=-12.5) and dust collector (X=-15, Z=-1.7). Z=-1.0 sits
 *                   between the -Z wall and the lathe row; cubbies are on the
 *                   +Z wall (X≈-13, Z≈+3.5) so no conflict.
 *   • Drill press : [-11.0, 0, -2.0]  — against the -Z lathe wall, in the gap
 *                   between prop lathes at X=-10 and X=-12.5 (those sit at Z≈0).
 *   • Pedestal fan: [-9.5, 0, -1.3]   — aisle-edge floor spot, angled to face
 *                   down the hall (+X) toward the working area.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation, no Math.random, no Date.now, no browser APIs — Three.js only.
 * No per-frame allocation.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** Band saw base centre (world). Entrance end, between last lathe + collector. */
export const BANDSAW_POS: [number, number, number] = [-13.5, 0, -1.0];
/** Band saw yaw — face the work table toward the aisle (+Z). */
export const BANDSAW_ROT: [number, number, number] = [0, 0, 0];

/** Drill press base centre (world). Against -Z wall, between lathes -10/-12.5. */
export const DRILLPRESS_POS: [number, number, number] = [-11.0, 0, -2.0];
/** Drill press yaw — table/chuck face the aisle (+Z). */
export const DRILLPRESS_ROT: [number, number, number] = [0, 0, 0];

/** Pedestal fan base centre (world). Aisle-edge spot, angled down the hall. */
export const FAN_POS: [number, number, number] = [-9.5, 0, -1.3];
/** Pedestal fan yaw — face down the hall toward +X working area. */
export const FAN_ROT: [number, number, number] = [0, -0.8, 0];

// ── Band saw dimensions ──────────────────────────────────────────────────────
const BS_BASE_W = 0.42;   // cabinet base footprint X
const BS_BASE_D = 0.42;   // cabinet base footprint Z
const BS_BASE_H = 0.55;   // base cabinet height
const BS_COL_W  = 0.30;   // upper column width X
const BS_COL_D  = 0.26;   // upper column depth Z
const BS_COL_H  = 1.05;   // column height above base
const BS_WHEEL_R = 0.225; // wheel-housing disc radius
const BS_WHEEL_T = 0.13;  // wheel-housing thickness (axial, along Z)
const BS_TABLE_W = 0.46;  // work table width
const BS_TABLE_D = 0.40;  // work table depth
const BS_TABLE_T = 0.02;  // table thickness
const BS_TABLE_Y = 0.92;  // table top height
const BS_GUARD_H = 0.42;  // upper blade-guard arm drop length
// Note: overall height = BS_BASE_H + BS_COL_H ≈ 1.6 m (with housings ~1.7 m).

// ── Drill press dimensions ───────────────────────────────────────────────────
const DP_BASE_R = 0.22;   // round base plate radius
const DP_BASE_H = 0.04;   // base plate thickness
const DP_COL_R  = 0.045;  // column radius
const DP_COL_H  = 1.65;   // column height
const DP_TABLE_R = 0.15;  // round work table radius
const DP_TABLE_T = 0.025; // table thickness
const DP_TABLE_Y = 0.95;  // work table height on the column
const DP_HEAD_W = 0.20;   // motor head body width X
const DP_HEAD_H = 0.22;   // head height
const DP_HEAD_D = 0.42;   // head depth Z (motor sticks out the back)
const DP_HEAD_Y = 1.55;   // head centre height
const DP_PULLEY_R = 0.075;// pulley hump radius
const DP_QUILL_R = 0.022; // quill/chuck stub radius
const DP_QUILL_LEN = 0.18;// quill drop below the head
const DP_HANDLE_LEN = 0.16;// feed handle spoke length
const DP_HANDLE_R = 0.012;

// ── Pedestal fan dimensions ──────────────────────────────────────────────────
const FAN_BASE_R = 0.26;  // wide round base radius
const FAN_BASE_H = 0.05;  // base plate thickness
const FAN_POST_R = 0.035; // post radius
const FAN_POST_H = 1.15;  // post height (to cage hub)
const FAN_CAGE_R = 0.27;  // outer cage radius (~0.54 m dia)
const FAN_CAGE_RING_R = 0.012; // cage ring tube radius
const FAN_HUB_R = 0.07;   // centre hub radius
const FAN_HUB_T = 0.06;   // hub depth
const FAN_BLADE_W = 0.07; // blade width
const FAN_BLADE_L = 0.20; // blade length (hub → near outer ring)
const FAN_TILT = -0.18;   // head tilt (radians, nods slightly up)

// ─── Module-scope materials ───────────────────────────────────────────────────

// Band saw — dark gray Delta-style cast/painted steel
const _bsBodyMat  = new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.55, metalness: 0.55 });
const _bsHousMat  = new THREE.MeshStandardMaterial({ color: '#34373c', roughness: 0.50, metalness: 0.60 });
const _bsTableMat = new THREE.MeshStandardMaterial({ color: '#9a9da2', roughness: 0.35, metalness: 0.75 }); // machined cast-iron table
const _bsTrimMat  = new THREE.MeshStandardMaterial({ color: '#5a5d62', roughness: 0.45, metalness: 0.60 });

// Drill press — gray body + black head
const _dpBodyMat  = new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.50, metalness: 0.60 });
const _dpColMat   = new THREE.MeshStandardMaterial({ color: '#6a6d72', roughness: 0.35, metalness: 0.80 }); // chromed column
const _dpHeadMat  = new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.50, metalness: 0.55 }); // black head
const _dpTableMat = new THREE.MeshStandardMaterial({ color: '#9a9da2', roughness: 0.35, metalness: 0.75 }); // cast-iron table
const _dpQuillMat = new THREE.MeshStandardMaterial({ color: '#8a8d92', roughness: 0.25, metalness: 0.88 }); // bare steel quill/chuck

// Pedestal fan — muted industrial green-gray base, steel cage
const _fanBaseMat = new THREE.MeshStandardMaterial({ color: '#46504a', roughness: 0.55, metalness: 0.45 });
const _fanPostMat = new THREE.MeshStandardMaterial({ color: '#7a7d82', roughness: 0.35, metalness: 0.78 });
const _fanCageMat = new THREE.MeshStandardMaterial({ color: '#9aa0a2', roughness: 0.30, metalness: 0.82 });
const _fanHubMat  = new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.50, metalness: 0.55 });
const _fanBladeMat = new THREE.MeshStandardMaterial({ color: '#5a5d62', roughness: 0.45, metalness: 0.55 });

// ─── Band saw ─────────────────────────────────────────────────────────────────

/** One enclosed wheel housing (a flat steel disc, axis along Z). */
function WheelHousing({ y }: { y: number }) {
  return (
    <mesh castShadow position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[BS_WHEEL_R, BS_WHEEL_R, BS_WHEEL_T, 28]} />
      <primitive object={_bsHousMat} attach="material" />
    </mesh>
  );
}

function BandSaw() {
  // Wheel housings sit on the front face of the column, slightly proud (+Z).
  const housingZ = BS_COL_D / 2 + BS_WHEEL_T / 2 - 0.02;
  const lowerWheelY = BS_BASE_H + 0.12;
  const upperWheelY = BS_BASE_H + BS_COL_H - 0.12;

  return (
    <group name="band-saw" position={BANDSAW_POS} rotation={BANDSAW_ROT}>
      {/* Base cabinet */}
      <mesh castShadow receiveShadow position={[0, BS_BASE_H / 2, 0]}>
        <boxGeometry args={[BS_BASE_W, BS_BASE_H, BS_BASE_D]} />
        <primitive object={_bsBodyMat} attach="material" />
      </mesh>

      {/* Upper column (C-frame body) */}
      <mesh castShadow position={[0, BS_BASE_H + BS_COL_H / 2, -0.02]}>
        <boxGeometry args={[BS_COL_W, BS_COL_H, BS_COL_D]} />
        <primitive object={_bsBodyMat} attach="material" />
      </mesh>

      {/* Two enclosed wheel housings on the column front */}
      <group position={[0, 0, housingZ]}>
        <WheelHousing y={lowerWheelY} />
        <WheelHousing y={upperWheelY} />
      </group>

      {/* Work table (cast-iron) with a thin blade slot */}
      <group position={[0, BS_TABLE_Y, housingZ - 0.01]}>
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[BS_TABLE_W, BS_TABLE_T, BS_TABLE_D]} />
          <primitive object={_bsTableMat} attach="material" />
        </mesh>
        {/* Blade slot — a thin dark gap front-to-back through the table */}
        <mesh position={[0, BS_TABLE_T / 2 - 0.001, BS_TABLE_D * 0.18]}>
          <boxGeometry args={[0.012, 0.006, BS_TABLE_D * 0.6]} />
          <primitive object={_bsHousMat} attach="material" />
        </mesh>
      </group>

      {/* Upper blade-guard arm — descends from the top housing toward the table */}
      <mesh castShadow position={[0, upperWheelY - BS_GUARD_H / 2 - 0.05, housingZ + 0.01]}>
        <boxGeometry args={[0.05, BS_GUARD_H, 0.05]} />
        <primitive object={_bsTrimMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Drill press ──────────────────────────────────────────────────────────────

function DrillPress() {
  const handleAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3] as const;
  // The feed-handle hub sits on the right side of the head (local +X), low.
  const hubX = DP_HEAD_W / 2 + 0.02;
  const hubY = DP_HEAD_Y - 0.08;
  const hubZ = 0.0;

  return (
    <group name="drill-press" position={DRILLPRESS_POS} rotation={DRILLPRESS_ROT}>
      {/* Round base plate */}
      <mesh castShadow receiveShadow position={[0, DP_BASE_H / 2, 0]}>
        <cylinderGeometry args={[DP_BASE_R, DP_BASE_R * 1.05, DP_BASE_H, 24]} />
        <primitive object={_dpBodyMat} attach="material" />
      </mesh>

      {/* Vertical column */}
      <mesh castShadow position={[0, DP_COL_H / 2, -0.05]}>
        <cylinderGeometry args={[DP_COL_R, DP_COL_R, DP_COL_H, 18]} />
        <primitive object={_dpColMat} attach="material" />
      </mesh>

      {/* Round work table on the column (faces +Z, toward aisle) */}
      <group position={[0, DP_TABLE_Y, -0.05]}>
        {/* table collar around the column */}
        <mesh castShadow position={[0, 0, 0]}>
          <cylinderGeometry args={[DP_COL_R * 1.8, DP_COL_R * 1.8, 0.08, 14]} />
          <primitive object={_dpBodyMat} attach="material" />
        </mesh>
        {/* table disc, cantilevered toward +Z */}
        <mesh castShadow receiveShadow position={[0, 0.02, DP_TABLE_R * 0.7]}>
          <cylinderGeometry args={[DP_TABLE_R, DP_TABLE_R, DP_TABLE_T, 22]} />
          <primitive object={_dpTableMat} attach="material" />
        </mesh>
      </group>

      {/* Head: black box body with motor extending to the back (-Z) */}
      <mesh castShadow position={[0, DP_HEAD_Y, -0.02]}>
        <boxGeometry args={[DP_HEAD_W, DP_HEAD_H, DP_HEAD_D]} />
        <primitive object={_dpHeadMat} attach="material" />
      </mesh>

      {/* Two pulley humps on top of the head (belt cover) */}
      <mesh castShadow position={[0, DP_HEAD_Y + DP_HEAD_H / 2 + DP_PULLEY_R * 0.4, -0.12]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[DP_PULLEY_R, DP_PULLEY_R, 0.16, 16]} />
        <primitive object={_dpHeadMat} attach="material" />
      </mesh>
      <mesh castShadow position={[0, DP_HEAD_Y + DP_HEAD_H / 2 + DP_PULLEY_R * 0.4, 0.04]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[DP_PULLEY_R * 0.78, DP_PULLEY_R * 0.78, 0.14, 16]} />
        <primitive object={_dpHeadMat} attach="material" />
      </mesh>

      {/* Quill / chuck stub pointing down from the front of the head */}
      <mesh castShadow position={[0, DP_HEAD_Y - DP_HEAD_H / 2 - DP_QUILL_LEN / 2, DP_HEAD_D / 2 - 0.06]}>
        <cylinderGeometry args={[DP_QUILL_R, DP_QUILL_R * 1.3, DP_QUILL_LEN, 14]} />
        <primitive object={_dpQuillMat} attach="material" />
      </mesh>

      {/* Three feed-handle spokes radiating from the side hub */}
      <group position={[hubX, hubY, hubZ]}>
        <mesh castShadow>
          <sphereGeometry args={[0.03, 12, 12]} />
          <primitive object={_dpHeadMat} attach="material" />
        </mesh>
        {handleAngles.map((a, i) => (
          <mesh
            key={i}
            castShadow
            position={[0, Math.sin(a) * DP_HANDLE_LEN / 2, Math.cos(a) * DP_HANDLE_LEN / 2]}
            rotation={[a, 0, 0]}
          >
            <cylinderGeometry args={[DP_HANDLE_R, DP_HANDLE_R, DP_HANDLE_LEN, 8]} />
            <primitive object={_dpQuillMat} attach="material" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ─── Pedestal fan ─────────────────────────────────────────────────────────────

function PedestalFan() {
  const cageHubY = FAN_POST_H;
  // blades: 4 around the hub, inside the cage
  const bladeAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] as const;

  return (
    <group name="pedestal-fan" position={FAN_POS} rotation={FAN_ROT}>
      {/* Wide round base */}
      <mesh castShadow receiveShadow position={[0, FAN_BASE_H / 2, 0]}>
        <cylinderGeometry args={[FAN_BASE_R, FAN_BASE_R * 1.08, FAN_BASE_H, 28]} />
        <primitive object={_fanBaseMat} attach="material" />
      </mesh>

      {/* Vertical post */}
      <mesh castShadow position={[0, FAN_POST_H / 2, 0]}>
        <cylinderGeometry args={[FAN_POST_R, FAN_POST_R * 1.2, FAN_POST_H, 16]} />
        <primitive object={_fanPostMat} attach="material" />
      </mesh>

      {/* Fan head — tilted slightly. Cage axis along local Z (faces +Z). */}
      <group position={[0, cageHubY, 0]} rotation={[FAN_TILT, 0, 0]}>
        {/* Centre hub (motor can) */}
        <mesh castShadow position={[0, 0, -FAN_HUB_T / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[FAN_HUB_R, FAN_HUB_R, FAN_HUB_T, 18]} />
          <primitive object={_fanHubMat} attach="material" />
        </mesh>

        {/* Blades inside the cage */}
        {bladeAngles.map((a, i) => (
          <mesh
            key={i}
            castShadow
            position={[Math.cos(a) * FAN_BLADE_L * 0.55, Math.sin(a) * FAN_BLADE_L * 0.55, 0.01]}
            rotation={[0, 0, a]}
          >
            <boxGeometry args={[FAN_BLADE_L, FAN_BLADE_W, 0.006]} />
            <primitive object={_fanBladeMat} attach="material" />
          </mesh>
        ))}

        {/* Two concentric ring cages (torus, axis along Z) */}
        <mesh castShadow position={[0, 0, 0.06]}>
          <torusGeometry args={[FAN_CAGE_R, FAN_CAGE_RING_R, 10, 40]} />
          <primitive object={_fanCageMat} attach="material" />
        </mesh>
        <mesh castShadow position={[0, 0, 0.04]}>
          <torusGeometry args={[FAN_CAGE_R * 0.62, FAN_CAGE_RING_R, 10, 32]} />
          <primitive object={_fanCageMat} attach="material" />
        </mesh>
        {/* Cage rim ring at the front lip */}
        <mesh castShadow position={[0, 0, 0.08]}>
          <torusGeometry args={[FAN_CAGE_R * 0.92, FAN_CAGE_RING_R * 1.2, 10, 40]} />
          <primitive object={_fanCageMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * ShopMachines — band saw, drill press, and pedestal fan props for the
 * entrance end of Hamester Hall. All static, all procedural.
 */
export function ShopMachines() {
  return (
    <group name="shop-machines">
      <BandSaw />
      <DrillPress />
      <PedestalFan />
    </group>
  );
}
