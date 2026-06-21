/**
 * TaskLamps.tsx — Gooseneck articulated task lamps clamped to lathe stations.
 *
 * In the director's reference photos most stations have a cheap clamp-on
 * gooseneck task light gripping the lathe bed / stand edge, the flexible arm
 * arcing up then over so the shade hangs above the work pointing down.
 *
 * Each lamp is built from:
 *   • a small dark-metal CLAMP base gripping an edge,
 *   • a segmented FLEXIBLE GOOSENECK arm — a series of short dark cylinder
 *     sections following a quarter-arc that rises then bends over (~0.5–0.7 m),
 *   • a metal SHADE (truncated cone) angled DOWN toward the work, with a pale
 *     emissive BULB disc inside it.
 *
 * The bulb is faked with an emissive material only — we do NOT add real
 * pointLights (that would blow the WebGL light budget with 3–4 lamps).
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at player lathe.
 *   Prop lathes sit at X = -2.5, -5.0, -7.5, -10.0, -12.5, Z ≈ 0.
 *   Demo bench cluster centres around DEMO_BENCH_POS ≈ [-7, 0, 4.5].
 *
 * Arm curl is varied by lamp index so the four lamps do not look cloned.
 *
 * Materials + the gooseneck section geometry are pre-allocated ONCE at module
 * scope and attached via <primitive object={mat} attach="material" />.
 * No browser APIs, no animation, no Math.random, no Date.now — Three.js only.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// Each lamp is positioned at the edge it clamps to (world coords), with a yaw
// orienting the arc, and a `curl` 0..1 tuning how far the gooseneck bends over.
interface LampPlacement {
  pos: [number, number, number];   // clamp base position (world)
  rotY: number;                     // yaw — direction the arm reaches
  curl: number;                     // 0 = mostly upright, 1 = bends far over
}

/**
 * Four task lamps: three clamped to prop-lathe stations (their arms arc toward
 * +Z over the bed) and one on the demo bench area. Lathe-bed top is ~0.9 m;
 * the clamp grips just under it. Varied curl keeps them from looking identical.
 */
export const LAMP_PLACEMENTS: LampPlacement[] = [
  // Prop lathe near X = -2.5 — arm arcs toward the aisle (+Z) over the bed.
  { pos: [-2.5, 0.86, -0.18], rotY: 0.0,  curl: 0.85 },
  // Prop lathe near X = -7.5.
  { pos: [-7.5, 0.86, -0.18], rotY: 0.18, curl: 0.65 },
  // Prop lathe near X = -12.5.
  { pos: [-12.5, 0.86, -0.18], rotY: -0.15, curl: 0.95 },
  // Demo bench area (near DEMO_BENCH_POS) — clamped to the maple bench edge,
  // arm reaching back toward the demo lathe (-Z).
  { pos: [-7.4, 0.90, 4.0], rotY: Math.PI + 0.1, curl: 0.55 },
];

// Clamp base (C-clamp grabbing an edge)
const CLAMP_W = 0.06;
const CLAMP_H = 0.05;
const CLAMP_D = 0.10;

// Gooseneck arm
const ARM_R       = 0.012;   // arm tube radius
const ARM_SEGS    = 7;       // number of short sections forming the arc
const ARM_SEG_LEN = 0.10;    // length of each section
const ARM_BASE_Y  = 0.04;    // where the arm leaves the clamp post

// Shade head (truncated cone) + bulb disc
const SHADE_R_TOP = 0.025;   // narrow (mounting) end
const SHADE_R_BOT = 0.07;    // wide (open) end
const SHADE_H     = 0.09;
const BULB_R      = 0.055;

// ─── Module-scope materials ───────────────────────────────────────────────────

const _clampMat = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.50, metalness: 0.55 });
const _armMat   = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.45, metalness: 0.55 });
const _shadeMat = new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.40, metalness: 0.60, side: THREE.DoubleSide });
const _bulbMat  = new THREE.MeshStandardMaterial({
  color: '#fff6e0', roughness: 0.30, metalness: 0.0,
  emissive: new THREE.Color('#fff6e0'), emissiveIntensity: 0.8,
});

// ─── Shared geometry (built once) ─────────────────────────────────────────────
const _armSegGeo = new THREE.CylinderGeometry(ARM_R, ARM_R, ARM_SEG_LEN, 8);
const _jointGeo  = new THREE.SphereGeometry(ARM_R * 1.25, 8, 6);

// ─── Sub-component: one gooseneck task lamp ───────────────────────────────────

/**
 * A single clamp-on gooseneck lamp. The arm is a chain of short cylinder
 * sections walked along a quarter-arc in the local X-Y plane: it rises off the
 * clamp, then curls over so the shade ends up forward (+X local) pointing down.
 * `curl` (0..1) scales how much of the quarter-turn the arc completes.
 */
function TaskLamp({ placement }: { placement: LampPlacement }) {
  const { pos, rotY, curl } = placement;

  // Walk the arc segment by segment, accumulating a position + tangent angle.
  // angle = 0 → pointing straight up; increases toward +X (over the work).
  const maxAngle = (Math.PI / 2) * (0.55 + 0.45 * curl); // sweep amount
  let px = 0;
  let py = ARM_BASE_Y;
  const segs: { x: number; y: number; ang: number }[] = [];
  for (let i = 0; i < ARM_SEGS; i++) {
    // tangent angle at this segment's midpoint (0..maxAngle along the arc)
    const t = (i + 0.5) / ARM_SEGS;
    const ang = maxAngle * t;
    // step direction: up component cos(ang), forward (+X) component sin(ang)
    const dx = Math.sin(ang) * ARM_SEG_LEN;
    const dy = Math.cos(ang) * ARM_SEG_LEN;
    segs.push({ x: px + dx / 2, y: py + dy / 2, ang });
    px += dx;
    py += dy;
  }

  // Shade sits at the arm end, tipped to point down (cone open end faces -Y).
  const headX = px;
  const headY = py;
  const headTip = maxAngle;  // shade axis rotated to match final arm tangent

  return (
    <group name="task-lamp" position={pos} rotation={[0, rotY, 0]}>
      {/* Clamp body gripping an edge */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[CLAMP_W, CLAMP_H, CLAMP_D]} />
        <primitive object={_clampMat} attach="material" />
      </mesh>
      {/* Clamp screw knob underneath */}
      <mesh castShadow position={[0, -CLAMP_H / 2 - 0.015, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.03, 8]} />
        <primitive object={_clampMat} attach="material" />
      </mesh>

      {/* Gooseneck arm — chain of short sections following the arc */}
      {segs.map((s, i) => (
        <group key={i}>
          <mesh castShadow position={[s.x, s.y, 0]} rotation={[0, 0, -s.ang]}>
            <primitive object={_armSegGeo} attach="geometry" />
            <primitive object={_armMat} attach="material" />
          </mesh>
          {/* Joint bead between sections */}
          <mesh position={[s.x, s.y, 0]}>
            <primitive object={_jointGeo} attach="geometry" />
            <primitive object={_armMat} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Shade head at the arm end, angled down toward the work */}
      <group position={[headX, headY, 0]} rotation={[0, 0, -headTip - Math.PI / 2]}>
        {/* Truncated-cone metal shade (open end faces local -Y → toward work) */}
        <mesh castShadow rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[SHADE_R_TOP, SHADE_R_BOT, SHADE_H, 18, 1, true]} />
          <primitive object={_shadeMat} attach="material" />
        </mesh>
        {/* Pale emissive bulb disc just inside the open mouth */}
        <mesh position={[0, -SHADE_H / 2 + 0.012, 0]}>
          <cylinderGeometry args={[BULB_R, BULB_R, 0.006, 16]} />
          <primitive object={_bulbMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * TaskLamps — the four clamp-on gooseneck task lamps around the hall.
 *
 * Static decoration only; placements + arm curl are tuned per index via
 * LAMP_PLACEMENTS (exported for director tuning).
 */
export function TaskLamps() {
  return (
    <group name="task-lamps">
      {LAMP_PLACEMENTS.map((placement, i) => (
        <TaskLamp key={i} placement={placement} />
      ))}
    </group>
  );
}
