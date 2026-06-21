/**
 * CeilingPipes.tsx — Exposed overhead pipe + electrical conduit runs.
 *
 * The director's photos show the black ceiling crisscrossed with exposed
 * structural PIPE and surface electrical CONDUIT runs. This component adds a
 * tasteful set of straight horizontal runs along the hall's long (X) axis,
 * tucked just under the ceiling:
 *   • A couple of fatter dark IRON PIPES (near-black, ~0.05 m radius).
 *   • A few thinner gray EMT CONDUITS (~0.02 m radius).
 *   • A couple of short 90° ELBOWS where a run turns toward a wall.
 *   • Small hanger straps/clips holding the runs up to the ceiling.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +7.25], ceiling HALL_H = 3.6 m, floor Y=0.
 *
 * HEIGHT / CLEARANCE (verified against Lighting.tsx, Hall.tsx, DustCollection.tsx,
 * CeilingEquipment.tsx):
 *   • Light fixtures (Lighting.tsx): panel Y≈3.54, in rows at Z≈-1.5 (Row A) and
 *     Z≈+1.5 (Row B), at X = -15,-12,-9,-6,-3,+0.5.
 *   • Black ceiling DUCT_RUNS (Hall.tsx): X-spine over aisle centre Z≈0.75
 *     (Z 0.525–0.975), Y 3.4–3.6; Z cross-branch at X≈-7 wall-to-wall, Y 3.42–3.6.
 *   • Dust trunk (DustCollection.tsx): Y≈2.95, Z≈-2.15 (lathe-wall side).
 *   Our pipes hang at Y 3.30–3.40 — BELOW the Y=3.54 light fixtures and BELOW the
 *   bottom of the black ducts (Y≈3.42), so they pass cleanly under the X=-7
 *   cross-branch. Z lanes chosen to dodge the light rows and the duct spine:
 *     • Z ≈ -2.20  (lathe-wall side, between -Z wall and Row A lights at -1.5)
 *     • Z ≈ +3.50  (between Row B lights at +1.5 and the far aisle wall)
 *     • Z ≈ +6.50  (near the +Z aisle wall at +7.25; empty ceiling band)
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation, no Math.random, no Date.now, no browser APIs — Three.js only.
 * No per-frame allocation. Geometry built once at module scope.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// Pipe radii — fatter dark iron vs thinner gray EMT conduit.
const PIPE_R    = 0.05;   // black iron pipe radius
const CONDUIT_R = 0.02;   // gray EMT conduit radius

// Y lanes (just under the ceiling, below the Y=3.54 lights and Y≈3.42 duct floor).
const Y_LOW  = 3.30;   // lower lane (clears everything overhead)
const Y_HIGH = 3.40;   // upper lane (still below light fixtures + duct bottoms)

// Z lanes — chosen to dodge light rows (Z≈-1.5 / +1.5) and the duct spine (Z≈0.75).
const Z_WALL = -2.20;  // lathe-wall side
const Z_MID  =  3.50;  // between Row B lights and the far aisle
const Z_AISLE = 6.50;  // near the +Z aisle wall

// X extents for the long runs (leave margin off the end walls at -16 / +2).
const X_LO = -15.0;
const X_HI =  1.0;

// Elbow + hanger geometry.
const ELBOW_TURN = 1.0;  // length of the short leg a run turns into toward a wall
const STRAP_W    = 0.02; // hanger strap band thickness
const STRAP_D    = 0.012;

// ─── Run table ────────────────────────────────────────────────────────────────
// Each run: a straight horizontal cylinder along X at [y, z], from xLo→xHi.
//   kind 'pipe'  → fat dark iron (PIPE_R), kind 'conduit' → thin gray EMT.
// Kept to ~6 long runs spread across 3 Z lanes and both Y lanes — tasteful, not
// a spaghetti mess.
interface PipeRun {
  xLo: number;
  xHi: number;
  y: number;
  z: number;
  kind: 'pipe' | 'conduit';
}

const RUNS: readonly PipeRun[] = [
  // ── Lathe-wall lane (Z ≈ -2.20) ──
  { xLo: X_LO, xHi: X_HI, y: Y_LOW,  z: Z_WALL,         kind: 'pipe' },     // fat iron pipe
  { xLo: X_LO, xHi: X_HI, y: Y_HIGH, z: Z_WALL + 0.16,  kind: 'conduit' },  // EMT alongside
  // ── Mid lane (Z ≈ +3.50) ──
  { xLo: X_LO, xHi: X_HI, y: Y_LOW,  z: Z_MID,          kind: 'pipe' },     // second fat iron pipe
  { xLo: X_LO, xHi: X_HI, y: Y_HIGH, z: Z_MID + 0.14,   kind: 'conduit' },  // EMT alongside
  // ── Aisle lane (Z ≈ +6.50) ──
  { xLo: X_LO, xHi: X_HI, y: Y_HIGH, z: Z_AISLE,        kind: 'conduit' },  // long EMT near aisle wall
  { xLo: -9.0, xHi: X_HI, y: Y_LOW,  z: Z_AISLE - 0.18, kind: 'conduit' },  // shorter EMT partner
];

// ─── Elbow table ──────────────────────────────────────────────────────────────
// A couple of short 90° turns: a run reaches an X end and turns in Z toward a
// wall. Each entry places a quarter-torus elbow at the corner plus the short
// turning leg. zSign: +1 turns toward +Z, -1 toward -Z.
interface PipeElbow {
  x: number;
  y: number;
  z: number;
  zSign: 1 | -1;
  kind: 'pipe' | 'conduit';
}

const ELBOWS: readonly PipeElbow[] = [
  // The lathe-wall iron pipe turns toward the -Z wall at its +X end.
  { x: X_HI, y: Y_LOW, z: Z_WALL, zSign: -1, kind: 'pipe' },
  // The mid-lane EMT turns toward the +Z aisle at its -X end.
  { x: X_LO, y: Y_HIGH, z: Z_MID + 0.14, zSign: 1, kind: 'conduit' },
];

// ─── Hanger straps ────────────────────────────────────────────────────────────
// Small clips up to the ceiling holding the long pipe runs. A handful spaced
// along the two fat iron pipes (light touch — not on every conduit).
const HALL_H = 3.6;   // ceiling Y (must match Hall.tsx)
interface PipeStrap { x: number; y: number; z: number }
const STRAPS: readonly PipeStrap[] = [
  { x: -12.0, y: Y_LOW, z: Z_WALL },
  { x:  -6.0, y: Y_LOW, z: Z_WALL },
  { x:   0.0, y: Y_LOW, z: Z_WALL },
  { x: -12.0, y: Y_LOW, z: Z_MID },
  { x:  -3.0, y: Y_LOW, z: Z_MID },
];

// ─── Module-scope materials ───────────────────────────────────────────────────

const _pipeMat = new THREE.MeshStandardMaterial({
  color: '#2a2a2e', roughness: 0.55, metalness: 0.55,   // dark iron pipe
});
const _conduitMat = new THREE.MeshStandardMaterial({
  color: '#8a8d92', roughness: 0.40, metalness: 0.70,   // gray EMT conduit
});
const _strapMat = new THREE.MeshStandardMaterial({
  color: '#3a3a40', roughness: 0.50, metalness: 0.60,   // steel hanger band
});

// ─── Module-scope geometry (built once) ───────────────────────────────────────

// Quarter-torus elbows (90° arc) — one per pipe kind. Built in the local XY
// plane; oriented per-elbow in the component.
const _pipeElbowGeo    = new THREE.TorusGeometry(0.10, PIPE_R,    12, 18, Math.PI / 2);
const _conduitElbowGeo = new THREE.TorusGeometry(0.08, CONDUIT_R, 10, 16, Math.PI / 2);

// ─── Sub-components ───────────────────────────────────────────────────────────

/** One straight horizontal run along X (a cylinder laid on its side). */
function Run({ run }: { run: PipeRun }) {
  const len = run.xHi - run.xLo;
  const cx  = (run.xHi + run.xLo) / 2;
  const r   = run.kind === 'pipe' ? PIPE_R : CONDUIT_R;
  const mat = run.kind === 'pipe' ? _pipeMat : _conduitMat;
  return (
    <mesh castShadow position={[cx, run.y, run.z]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[r, r, len, 14]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/** A short 90° elbow at the end of a run, turning in Z toward a wall, plus its
 *  short turning leg. */
function Elbow({ elbow }: { elbow: PipeElbow }) {
  const r    = elbow.kind === 'pipe' ? PIPE_R : CONDUIT_R;
  const geo  = elbow.kind === 'pipe' ? _pipeElbowGeo : _conduitElbowGeo;
  const mat  = elbow.kind === 'pipe' ? _pipeMat : _conduitMat;
  const bend = elbow.kind === 'pipe' ? 0.10 : 0.08;   // matches torus arc radius

  // Quarter-torus sweeps from the +X horizontal tangent to a Z-axis tangent.
  // Rotate about Y by +/- so the arc bends toward the chosen Z direction.
  const yRot = elbow.zSign > 0 ? -Math.PI / 2 : Math.PI / 2;

  return (
    <group position={[elbow.x, elbow.y, elbow.z]}>
      {/* The curved bend itself */}
      <mesh castShadow position={[0, 0, 0]} rotation={[Math.PI / 2, 0, yRot]}>
        <primitive object={geo} attach="geometry" />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* Short straight leg continuing into the wall after the bend */}
      <mesh castShadow
            position={[0, 0, elbow.zSign * (bend + ELBOW_TURN / 2)]}
            rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, ELBOW_TURN, 14]} />
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  );
}

/** A small hanger strap/clip running from the pipe up to the ceiling. */
function Strap({ strap }: { strap: PipeStrap }) {
  const len = HALL_H - strap.y;
  const cy  = (HALL_H + strap.y) / 2;
  return (
    <mesh castShadow position={[strap.x, cy, strap.z]}>
      <boxGeometry args={[STRAP_W, len, STRAP_D]} />
      <primitive object={_strapMat} attach="material" />
    </mesh>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * CeilingPipes — exposed overhead iron pipe + EMT conduit runs on the black
 * ceiling, with a couple of 90° elbows and a few hanger straps. Static
 * industrial ceiling dressing matching the reference photos; no animation.
 */
export function CeilingPipes() {
  return (
    <group name="ceiling-pipes">
      {RUNS.map((run, i) => (
        <Run key={`run-${String(i)}`} run={run} />
      ))}
      {ELBOWS.map((elbow, i) => (
        <Elbow key={`elbow-${String(i)}`} elbow={elbow} />
      ))}
      {STRAPS.map((strap, i) => (
        <Strap key={`strap-${String(i)}`} strap={strap} />
      ))}
    </group>
  );
}
