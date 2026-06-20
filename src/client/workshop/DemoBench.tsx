/**
 * DemoBench.tsx — Instructor demo stand: the centre-aisle teaching fixture.
 *
 * A sturdy wooden bench with:
 *   • A mini desk-lathe / chuck on the bench top
 *   • An articulated overhead camera arm (angled tubes reaching ~2 m up + over)
 *     with a small camera head pointing down at the work
 *   • A flat-screen TV (emissive panel, blue-white glow) raised behind/above
 *   • Two turned demo bowls and a small spindle on a lower shelf
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
import { makeBoardMaterial } from '../wood/woodMaterial.js';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// Long-hallway layout: hall X ∈ [-2, +16], Z ∈ [-2.5, +4].
// Lathe row is at Z ≈ 0 (against -Z wall). Aisle runs from Z ≈ 0.5 to Z ≈ 4.
// Demo bench sits in the mid-aisle, mid-hall, facing the lathe row (-Z direction).

/** World position of the demo bench group centre. */
export const DEMO_BENCH_POS: [number, number, number] = [7.0, 0, 2.5];

/** Rotation (radians). Faces the lathe row (-Z direction, toward Z=0). */
export const DEMO_BENCH_ROT: [number, number, number] = [0, Math.PI, 0];

// ─── Bench body dimensions ────────────────────────────────────────────────────
const BENCH_W  = 1.3;   // width  (X) metres
const BENCH_D  = 0.72;  // depth  (Z) metres
const BENCH_H  = 0.92;  // worktop surface height (Y)
const TOP_T    = 0.06;  // top-slab thickness
const SHELF_Y  = 0.32;  // lower shelf height
const SHELF_T  = 0.04;  // lower shelf thickness
const LEG_W    = 0.07;  // leg square cross-section
const LEG_H    = BENCH_H - TOP_T;

// Mini-lathe on top
const ML_BED_W = 0.55;
const ML_BED_H = 0.065;
const ML_BED_D = 0.18;
const ML_Y     = BENCH_H + ML_BED_H / 2;

// Camera arm
const ARM_BASE_Y = BENCH_H;
const ARM_SEG1_L = 1.15;   // vertical riser
const ARM_SEG2_L = 0.80;   // horizontal boom
const ARM_SEG3_L = 0.45;   // angled drop to camera
const ARM_THICK  = 0.025;  // tube cross-section

// TV screen
const TV_W  = 0.78;
const TV_H  = 0.48;
const TV_D  = 0.05;
const TV_Y  = BENCH_H + 1.55;
const TV_TZ = -BENCH_D / 2 - 0.12;  // behind the bench

// Demo items on shelf
const BOWL_R1 = 0.095;
const BOWL_R2 = 0.065;

// ─── Module-scope materials (never re-allocated per render) ───────────────────

const _benchTopMat  = makeBoardMaterial('#8e6035');                              // honey oak top
const _benchLegMat  = makeBoardMaterial('#7a5028', undefined, { grainAxis: 'y' });
const _shelfMat     = makeBoardMaterial('#9b7040');
const _mlBodyMat    = new THREE.MeshStandardMaterial({ color: '#d8d4c8', roughness: 0.52, metalness: 0.08 });
const _mlBedMat     = new THREE.MeshStandardMaterial({ color: '#252523', roughness: 0.58, metalness: 0.18 });
const _mlArborMat   = new THREE.MeshStandardMaterial({ color: '#6a6a6a', roughness: 0.30, metalness: 0.88 });
const _armMat       = new THREE.MeshStandardMaterial({ color: '#4a4a50', roughness: 0.45, metalness: 0.55 });
const _camHeadMat   = new THREE.MeshStandardMaterial({ color: '#1a1a1e', roughness: 0.50, metalness: 0.30 });
const _camLensMat   = new THREE.MeshStandardMaterial({
  color: '#222230', roughness: 0.08, metalness: 0.10,
  emissive: new THREE.Color('#112244'), emissiveIntensity: 0.25,
});
const _tvBezelMat   = new THREE.MeshStandardMaterial({ color: '#1a1a1e', roughness: 0.60, metalness: 0.25 });
const _tvScreenMat  = new THREE.MeshStandardMaterial({
  color: '#8ab4d8', roughness: 0.05, metalness: 0.0,
  emissive: new THREE.Color('#6090b8'), emissiveIntensity: 0.7,
});
const _tvBracketMat = new THREE.MeshStandardMaterial({ color: '#333338', roughness: 0.70, metalness: 0.35 });
const _bowl1Mat     = makeBoardMaterial('#7a3820', undefined, { grainAxis: 'y' }); // cherry
const _bowl2Mat     = makeBoardMaterial('#4a3018', undefined, { grainAxis: 'y' }); // walnut
const _spindleMat   = makeBoardMaterial('#c09050', undefined, { grainAxis: 'y' }); // maple

// ─── Sub-components ───────────────────────────────────────────────────────────

function BenchFrame() {
  const legPositions: [number, number][] = [
    [-BENCH_W / 2 + LEG_W / 2,  BENCH_D / 2 - LEG_W / 2],
    [ BENCH_W / 2 - LEG_W / 2,  BENCH_D / 2 - LEG_W / 2],
    [-BENCH_W / 2 + LEG_W / 2, -BENCH_D / 2 + LEG_W / 2],
    [ BENCH_W / 2 - LEG_W / 2, -BENCH_D / 2 + LEG_W / 2],
  ];

  return (
    <group name="bench-frame">
      {/* Bench top slab */}
      <mesh castShadow receiveShadow position={[0, BENCH_H - TOP_T / 2, 0]}>
        <boxGeometry args={[BENCH_W, TOP_T, BENCH_D]} />
        <primitive object={_benchTopMat} attach="material" />
      </mesh>

      {/* Four legs */}
      {legPositions.map(([lx, lz], i) => (
        <mesh key={i} castShadow position={[lx, LEG_H / 2, lz]}>
          <boxGeometry args={[LEG_W, LEG_H, LEG_W]} />
          <primitive object={_benchLegMat} attach="material" />
        </mesh>
      ))}

      {/* Lower shelf */}
      <mesh castShadow receiveShadow position={[0, SHELF_Y + SHELF_T / 2, 0]}>
        <boxGeometry args={[BENCH_W - 0.04, SHELF_T, BENCH_D - 0.04]} />
        <primitive object={_shelfMat} attach="material" />
      </mesh>

      {/* Front apron rail */}
      <mesh castShadow position={[0, BENCH_H - 0.15, BENCH_D / 2 - LEG_W * 0.5]}>
        <boxGeometry args={[BENCH_W - LEG_W * 2, 0.12, LEG_W * 0.6]} />
        <primitive object={_benchLegMat} attach="material" />
      </mesh>
    </group>
  );
}

function MiniLathe() {
  return (
    <group name="mini-lathe" position={[-0.15, ML_Y, 0]}>
      {/* Bed */}
      <mesh castShadow>
        <boxGeometry args={[ML_BED_W, ML_BED_H, ML_BED_D]} />
        <primitive object={_mlBedMat} attach="material" />
      </mesh>
      {/* Headstock */}
      <mesh castShadow position={[-ML_BED_W / 2 + 0.075, ML_BED_H / 2 + 0.05, 0]}>
        <boxGeometry args={[0.12, 0.10, 0.16]} />
        <primitive object={_mlBodyMat} attach="material" />
      </mesh>
      {/* Drive spindle nub */}
      <mesh castShadow
            position={[-ML_BED_W / 2 + 0.075, ML_BED_H / 2 + 0.05, -ML_BED_D / 2 - 0.02]}
            rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.06, 10]} />
        <primitive object={_mlArborMat} attach="material" />
      </mesh>
      {/* Tailstock */}
      <mesh castShadow position={[ML_BED_W / 2 - 0.055, ML_BED_H / 2 + 0.04, 0]}>
        <boxGeometry args={[0.09, 0.085, 0.15]} />
        <primitive object={_mlBodyMat} attach="material" />
      </mesh>
    </group>
  );
}

function CameraArm() {
  // Riser base position (back-left corner of bench)
  const riserX    = -BENCH_W / 2 + 0.10;
  const riserZ    = -BENCH_D / 2 + 0.10;
  const riserTopY = ARM_BASE_Y + ARM_SEG1_L;

  // Boom extends from riser top toward bench centre
  const boomEndX = riserX + ARM_SEG2_L;
  const boomCX   = riserX + ARM_SEG2_L / 2;

  // Drop segment: angled down toward work area
  const DROP_ANGLE = -0.55; // radians, tilt downward
  const dropCY = riserTopY - (ARM_SEG3_L * 0.5) * Math.sin(-DROP_ANGLE);
  const dropCZ = riserZ    + (ARM_SEG3_L * 0.5) * Math.cos(-DROP_ANGLE);

  const camY = riserTopY - ARM_SEG3_L * Math.sin(-DROP_ANGLE);
  const camZ = riserZ    + ARM_SEG3_L * Math.cos(-DROP_ANGLE);

  return (
    <group name="camera-arm">
      {/* Vertical riser */}
      <mesh castShadow position={[riserX, ARM_BASE_Y + ARM_SEG1_L / 2, riserZ]}>
        <boxGeometry args={[ARM_THICK, ARM_SEG1_L, ARM_THICK]} />
        <primitive object={_armMat} attach="material" />
      </mesh>

      {/* Elbow joint block */}
      <mesh castShadow position={[riserX, riserTopY, riserZ]}>
        <boxGeometry args={[ARM_THICK * 2.5, ARM_THICK * 2.5, ARM_THICK * 2.5]} />
        <primitive object={_armMat} attach="material" />
      </mesh>

      {/* Horizontal boom */}
      <mesh castShadow position={[boomCX, riserTopY, riserZ]}>
        <boxGeometry args={[ARM_SEG2_L, ARM_THICK, ARM_THICK]} />
        <primitive object={_armMat} attach="material" />
      </mesh>

      {/* Shoulder joint block */}
      <mesh castShadow position={[boomEndX, riserTopY, riserZ]}>
        <boxGeometry args={[ARM_THICK * 2.5, ARM_THICK * 2.5, ARM_THICK * 2.5]} />
        <primitive object={_armMat} attach="material" />
      </mesh>

      {/* Angled drop */}
      <mesh castShadow
            position={[boomEndX, dropCY, dropCZ]}
            rotation={[DROP_ANGLE, 0, 0]}>
        <boxGeometry args={[ARM_THICK, ARM_SEG3_L, ARM_THICK]} />
        <primitive object={_armMat} attach="material" />
      </mesh>

      {/* Camera head body */}
      <mesh castShadow position={[boomEndX, camY, camZ]}>
        <boxGeometry args={[0.07, 0.055, 0.09]} />
        <primitive object={_camHeadMat} attach="material" />
      </mesh>

      {/* Lens ring (cylinder, pointing downward) */}
      <mesh castShadow position={[boomEndX, camY - 0.035, camZ]}>
        <cylinderGeometry args={[0.022, 0.022, 0.014, 12]} />
        <primitive object={_camLensMat} attach="material" />
      </mesh>
    </group>
  );
}

function DemoTV() {
  return (
    <group name="demo-tv" position={[0, TV_Y, TV_TZ]}>
      {/* Bezel */}
      <mesh castShadow>
        <boxGeometry args={[TV_W, TV_H, TV_D]} />
        <primitive object={_tvBezelMat} attach="material" />
      </mesh>

      {/* Emissive screen face */}
      <mesh position={[0, 0, TV_D / 2 + 0.001]}>
        <boxGeometry args={[TV_W - 0.03, TV_H - 0.03, 0.004]} />
        <primitive object={_tvScreenMat} attach="material" />
      </mesh>

      {/* Vertical bracket arm */}
      <mesh castShadow position={[0, -TV_H / 2 - 0.12, TV_D / 2 + 0.06]}>
        <boxGeometry args={[0.06, 0.28, 0.06]} />
        <primitive object={_tvBracketMat} attach="material" />
      </mesh>

      {/* Horizontal foot resting on bench top */}
      <mesh castShadow position={[0, -TV_H / 2 - 0.26, TV_D / 2 + 0.18]}>
        <boxGeometry args={[0.14, 0.04, 0.26]} />
        <primitive object={_tvBracketMat} attach="material" />
      </mesh>
    </group>
  );
}

function DemoItems() {
  const shelfSurfaceY = SHELF_Y + SHELF_T;
  return (
    <group name="demo-items">
      {/* Larger bowl — cherry */}
      <mesh castShadow position={[-0.32, shelfSurfaceY + BOWL_R1 * 0.45, 0.0]}
            rotation={[0, 0.3, 0]}>
        <sphereGeometry args={[BOWL_R1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <primitive object={_bowl1Mat} attach="material" />
      </mesh>

      {/* Smaller bowl — walnut */}
      <mesh castShadow position={[0.10, shelfSurfaceY + BOWL_R2 * 0.45, 0.05]}
            rotation={[0, -0.6, 0]}>
        <sphereGeometry args={[BOWL_R2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <primitive object={_bowl2Mat} attach="material" />
      </mesh>

      {/* Demo spindle — maple, lying on its side */}
      <mesh castShadow position={[0.35, shelfSurfaceY + 0.028, 0.0]}
            rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.042, 0.38, 12]} />
        <primitive object={_spindleMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface DemoBenchProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * DemoBench — instructor demo stand, centre-aisle.
 *
 * Default position: DEMO_BENCH_POS = [5.5, 0, 4.5]
 * Default rotation: DEMO_BENCH_ROT = [0, π, 0]  (faces class toward -Z)
 * Both constants are exported for easy director tuning.
 */
export function DemoBench({
  position = DEMO_BENCH_POS,
  rotation = DEMO_BENCH_ROT,
}: DemoBenchProps = {}) {
  return (
    <group name="demo-bench" position={position} rotation={rotation}>
      <BenchFrame />
      <MiniLathe />
      <CameraArm />
      <DemoTV />
      <DemoItems />
    </group>
  );
}
