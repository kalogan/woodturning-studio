/**
 * WallConduit.tsx — Surface-mounted EMT electrical conduit on the shop walls.
 *
 * Thin gray steel conduit runs (like the real shop photos): vertical drops from
 * near ceiling height down to outlet boxes at counter height, a couple of
 * horizontal runs near the top of the wall, and small junction / outlet boxes
 * where the runs terminate.
 *
 * Mounted flush on TWO walls:
 *   • -Z lathe wall (Z ≈ -2.46, conduit faces +Z into the hall)
 *   • +Z aisle wall (Z ≈ +3.96, conduit faces -Z into the hall)
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling HALL_H = 3.6 m, floor Y=0.
 *
 * PLACEMENT — kept in CLEAR wall spots:
 *   • -Z wall drops sit ABOVE/BETWEEN the prop lathes (lathes at X=-2.5…-12.5,
 *     Z≈0; the wall is at Z=-2.5 so drops are behind the lathe row).
 *   • +Z wall drops AVOID the pegboard ToolWall (X ≈ -8.5…-5.5) and the
 *     StockCubbies (X ≈ -13). Chosen X spots: -3, -10.5 (clear of both).
 *   • Horizontal runs sit at Y≈3.25, above everything.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation, no Math.random, no Date.now, no browser APIs — Three.js only.
 * No per-frame allocation.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** Conduit tube radius (~3/4" EMT). */
const PIPE_R = 0.02;
/** Conduit standoff from the wall face (mounts flush, slightly proud). */
const STANDOFF = 0.03;

/** Top of vertical drops (just below ceiling, HALL_H = 3.6). */
const DROP_TOP_Y = 3.30;
/** Bottom of vertical drops, at the outlet box. */
const DROP_BOT_Y = 1.10;
/** Height of horizontal runs near the top of the wall. */
const RUN_Y = 3.25;

/** Outlet / junction box dimensions. */
const BOX_W = 0.10;
const BOX_H = 0.13;
const BOX_D = 0.05;

// Wall Z faces (just proud of the brick).
const Z_LATHE_WALL = -2.5 + STANDOFF;   // -Z wall, conduit faces +Z
const Z_AISLE_WALL =  7.25 - STANDOFF;  // +Z wall, conduit faces -Z — widened +3.25 m

// ─── Module-scope materials ───────────────────────────────────────────────────

const _pipeMat = new THREE.MeshStandardMaterial({ color: '#8a8d92', roughness: 0.45, metalness: 0.70 });
const _boxMat  = new THREE.MeshStandardMaterial({ color: '#9a9da2', roughness: 0.55, metalness: 0.55 });

// ─── Run descriptors (literal positions, tasteful spread) ─────────────────────

/** A vertical drop at world X on a given wall Z, with a box at the bottom. */
type Drop = { x: number; z: number };
/** A horizontal run between two world-X points at RUN_Y on a given wall Z. */
type Run = { x0: number; x1: number; z: number };

// -Z lathe wall: drops behind the lathe row (between/above lathes), plus a run.
const LATHE_WALL_DROPS: Drop[] = [
  { x: -4.0,  z: Z_LATHE_WALL },
  { x: -8.5,  z: Z_LATHE_WALL },
  { x: -12.0, z: Z_LATHE_WALL },
];
const LATHE_WALL_RUNS: Run[] = [
  { x0: -12.0, x1: -4.0, z: Z_LATHE_WALL },
];

// +Z aisle wall: drops clear of pegboard (X -8.5..-5.5) and cubbies (X≈-13).
const AISLE_WALL_DROPS: Drop[] = [
  { x: -3.0,  z: Z_AISLE_WALL },
  { x: -10.5, z: Z_AISLE_WALL },
];
const AISLE_WALL_RUNS: Run[] = [
  { x0: -10.5, x1: -3.0, z: Z_AISLE_WALL },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A vertical conduit drop with a junction/outlet box at the bottom. */
function ConduitDrop({ x, z }: Drop) {
  const len = DROP_TOP_Y - DROP_BOT_Y;
  const cy = (DROP_TOP_Y + DROP_BOT_Y) / 2;
  return (
    <group name="conduit-drop">
      {/* Vertical pipe */}
      <mesh castShadow position={[x, cy, z]}>
        <cylinderGeometry args={[PIPE_R, PIPE_R, len, 10]} />
        <primitive object={_pipeMat} attach="material" />
      </mesh>
      {/* Outlet box at the bottom */}
      <mesh castShadow position={[x, DROP_BOT_Y, z]}>
        <boxGeometry args={[BOX_W, BOX_H, BOX_D]} />
        <primitive object={_boxMat} attach="material" />
      </mesh>
    </group>
  );
}

/** A horizontal conduit run (along X) at RUN_Y. */
function ConduitRun({ x0, x1, z }: Run) {
  const len = Math.abs(x1 - x0);
  const cx = (x0 + x1) / 2;
  return (
    <mesh name="conduit-run" castShadow position={[cx, RUN_Y, z]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[PIPE_R, PIPE_R, len, 10]} />
      <primitive object={_pipeMat} attach="material" />
    </mesh>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * WallConduit — surface EMT conduit (drops + horizontal runs + boxes) on the
 * -Z lathe wall and +Z aisle wall of Hamester Hall. Static, procedural.
 *
 * Total runs: 3 + 2 vertical drops, 1 + 1 horizontal runs = 7 conduit runs.
 */
export function WallConduit() {
  return (
    <group name="wall-conduit">
      {LATHE_WALL_DROPS.map((d, i) => (
        <ConduitDrop key={`lwd-${String(i)}`} x={d.x} z={d.z} />
      ))}
      {LATHE_WALL_RUNS.map((r, i) => (
        <ConduitRun key={`lwr-${String(i)}`} x0={r.x0} x1={r.x1} z={r.z} />
      ))}
      {AISLE_WALL_DROPS.map((d, i) => (
        <ConduitDrop key={`awd-${String(i)}`} x={d.x} z={d.z} />
      ))}
      {AISLE_WALL_RUNS.map((r, i) => (
        <ConduitRun key={`awr-${String(i)}`} x0={r.x0} x1={r.x1} z={r.z} />
      ))}
    </group>
  );
}
