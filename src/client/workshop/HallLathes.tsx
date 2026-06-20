/**
 * HallLathes.tsx — fills Hamester Hall with a row of non-interactive prop lathes
 * and places the anti-fatigue mat under the player's lathe at the origin.
 *
 * Layout overview (all positions are WORLD coordinates, Y=0 = floor):
 *
 *   Hall X: [-2, +16]  Z: [-2.5, +4]  — LONG along X
 *   Player lathe is at origin [0,0,0] — FAR/left (-X) end of the lathe row.
 *   Prop lathes extend DOWN THE HALL in +X direction along the BACK (-Z) wall,
 *   all oriented like the player's lathe (bed along X, operator side facing +Z).
 *
 *   Row: 5 lathes spaced 2.5 m apart starting at X = 2.5.
 *   Positions: X = 2.5, 5.0, 7.5, 10.0, 12.5  (all at Z ≈ 0, against -Z wall).
 *
 * Colour mix (real turning-class shops):
 *   Lathes 0,1,3 → Jet white/cream   (#e8e6dc)
 *   Lathe  2     → Powermatic yellow  (#c9a227)
 *   Lathe  4     → Vintage grey       (#b8bcb8)
 *
 * All positions/colours are named constants so the director can tune without
 * reading geometry logic.
 *
 * Anti-fatigue mat is a thin dark rubber box, 0.7 × 0.01 × 1.4 m, centred on
 * the world origin (under the player's lathe).
 */

import * as THREE from 'three';
import { PropLathe } from './PropLathe.js';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/**
 * Yaw (radians, about Y) applied to every lathe so the beds sit at an angle to
 * the wall — matching the real Hamester Hall, where the machines are turned off
 * the wall line (headstock toward the wall, tailstock/operator end swung out
 * toward the aisle) rather than running parallel to it.
 *
 * Sign: negative yaw swings each lathe's tailstock (+X end) toward the aisle
 * (+Z) and the headstock (-X end) toward the wall (-Z) — see PropLathe local
 * axes. Flip the sign to mirror the angle direction; change the magnitude to
 * make the angle shallower/steeper. This same constant angles the player's
 * interactive lathe in WORKSHOP_WALK (see WalkScene) so the whole row matches.
 */
export const LATHE_YAW = -0.45;   // ≈ -26°

/** Z position of all prop lathes — against the -Z back wall, same as player lathe */
const ROW_Z = 0.0;

/** X of the first prop lathe in the row (2.5 m along the hall from the player lathe) */
const ROW_START_X = -2.5;

/** Spacing between adjacent prop lathes along X */
const ROW_SPACING_X = -2.5;

/** Shared Y (floor level — PropLathe positions its own stand) */
const ROW_Y = 0.0;

/** Colour for each prop lathe in the row (index 0…4) */
const ROW_COLORS: string[] = [
  '#e8e6dc',  // 0 — Jet cream
  '#e8e6dc',  // 1 — Jet cream
  '#c9a227',  // 2 — Powermatic yellow
  '#e8e6dc',  // 3 — Jet cream
  '#b8bcb8',  // 4 — vintage grey
];

/** Number of prop lathes */
const ROW_COUNT = ROW_COLORS.length;   // 5

// ─── Anti-fatigue mat constants ───────────────────────────────────────────────

/** Mat width along X (lathe axis) — covers the operator standing area */
const MAT_W = 1.4;
/** Mat depth along Z (operator front-back) */
const MAT_D = 0.7;
/** Mat thickness (Y) — thin rubber slab */
const MAT_T = 0.012;

/** Mat centre in X — centred on the player lathe origin */
const MAT_CX = 0.0;
/** Mat centre in Z — the operator stands on +Z side of the lathe */
const MAT_CZ = 0.55;

// ─── Module-scope mat material ────────────────────────────────────────────────
const matMaterial = new THREE.MeshStandardMaterial({
  color: '#23232a',
  roughness: 0.95,
  metalness: 0.0,
});

// ─── AntiFatigueMat ───────────────────────────────────────────────────────────

function AntiFatigueMat() {
  return (
    <mesh
      name="anti-fatigue-mat"
      position={[MAT_CX, MAT_T / 2, MAT_CZ]}
      receiveShadow
    >
      <boxGeometry args={[MAT_W, MAT_T, MAT_D]} />
      <primitive object={matMaterial} attach="material" />
    </mesh>
  );
}

// ─── HallLathes (exported) ────────────────────────────────────────────────────

/**
 * Renders the row of 6 prop lathes filling the hall, plus the anti-fatigue mat
 * under the player's lathe at the origin.
 *
 * Drop this inside Shop (shared environment) so every scene sees a populated hall.
 */
export function HallLathes() {
  return (
    <group name="hall-lathes">
      {/* Anti-fatigue mat under the player's interactive lathe */}
      <AntiFatigueMat />

      {/* Row of prop lathes — oriented identically to the player lathe */}
      {Array.from({ length: ROW_COUNT }, (_, i) => (
        <PropLathe
          key={i}
          position={[ROW_START_X + i * ROW_SPACING_X, ROW_Y, ROW_Z]}
          rotation={[0, LATHE_YAW, 0]}
          color={ROW_COLORS[i] ?? '#e8e6dc'}
        />
      ))}
    </group>
  );
}
