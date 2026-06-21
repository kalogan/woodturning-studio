/**
 * Doorways.tsx — walk-through door openings for Hamester Hall.
 *
 * The real classroom (per the director's photo) has WHITE interior doors with
 * TWO stacked recessed (raised) panels and a brushed knob, propped slightly
 * ajar. Each doorway reads as a framed portal into an adjacent (dark) space:
 *   • A light painted jamb frame (off-white) around the opening
 *   • A DARK recessed interior backing panel, inset behind the wall plane so
 *     the opening reads as real depth (a portal, not a painted rectangle)
 *   • A SINGLE white 2-panel raised-panel door leaf, swung slightly AJAR so
 *     the dark opening behind it is visible
 *
 * COORDINATE CONVENTION — same as Hall.tsx (origin at the player lathe):
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling 3.6 m, floor Y=0.
 *   -X end (HALL_X_MIN = -16) = ENTRANCE wall — entrance doorway faces +X.
 *   +X end (HALL_X_MAX = +2)  = sign wall — sign-wall doorway faces -X.
 *
 * The HAMESTER HALL sign sits on the +X wall centred at Z ≈ +0.75, spanning
 * Z ∈ [-0.45, +1.95] (SIGN_Z ± SIGN_W/2). The +X doorway sits just LEFT of the
 * sign on the -Z side (Z ≈ -1.3, spanning -2.1..-0.5) so it clears the banner.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the no-misused-spread
 * lint rule on class instances. All geometry is static — no per-frame
 * allocation, no animation, no browser APIs (Three.js only).
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// Opening (clear span between jambs)
const OPEN_W = 0.92;   // opening width  (≈ single 36" interior door)
const OPEN_H = 2.1;    // opening height

// Frame (jambs + header) — light painted jamb
const FRAME_T = 0.09;  // jamb / header face thickness (along the wall)
const FRAME_D = 0.16;  // frame depth (into / out of the wall)

// Recessed dark backing panel — inset behind the wall plane for depth.
const RECESS = 0.18;   // how far the backing sits behind the opening
const LEAF_AJAR = 0.30; // hinge swing of the leaf (radians, ≈ 17°)

// Door leaf (white raised-panel slab)
const LEAF_W = OPEN_W - 0.02; // leaf spans the opening (small reveal gap)
const LEAF_H = OPEN_H - 0.03;
const LEAF_T = 0.045;         // door-leaf slab thickness

// Raised-panel layout (on the leaf's outer face). The leaf has an outer
// frame of stiles (verticals) + rails (horizontals); the two panels are
// sunken rectangles between them.
const STILE_W = 0.12;  // side stile / outer frame width
const RAIL_W  = 0.13;  // top/bottom rail + centre mid-rail width
const PANEL_RECESS = 0.012; // how far each panel sinks below the frame face
const PANEL_LIP = 0.018;    // thin bevel/lip frame around each sunken panel

// Brushed-metal knob
const KNOB_R = 0.028;
const KNOB_Y = -LEAF_H / 2 + 0.95; // handle height ≈ 0.95 m up the leaf

// Placements (world). The entrance door now lives on the ENTRY VESTIBULE's
// OUTER end wall (X = VEST_X_MIN = -19.5), centred in the corridor mouth
// (Z ≈ 1.25), facing +X into the corridor. The sign-wall doorway is unchanged:
// +X wall, faces -X, pushed to the -Z half to clear the HAMESTER HALL sign.
const HALL_X_MAX = 2.0;
const VEST_X_MIN = -19.5;
const ENTRANCE_DOOR_X = VEST_X_MIN + 0.05; // just proud of the corridor end wall
const ENTRANCE_DOOR_Z = 1.25;              // centred in the corridor (Z ∈ [0, 2.5])
const SIGN_DOOR_X = HALL_X_MAX - 0.02;     // just proud of the sign wall
const SIGN_DOOR_Z = -1.3;                  // -Z side, just LEFT of the sign (door spans -2.1..-0.5)

// ─── Module-scope materials ───────────────────────────────────────────────────

const _frameMat   = new THREE.MeshStandardMaterial({ color: '#dcdad2', roughness: 0.70, metalness: 0.02 }); // light painted jamb
const _backingMat = new THREE.MeshStandardMaterial({ color: '#14141a', roughness: 0.92, metalness: 0.05 }); // dark recessed interior
const _leafMat    = new THREE.MeshStandardMaterial({ color: '#ece9e1', roughness: 0.55, metalness: 0.02 }); // warm off-white door
const _panelMat   = new THREE.MeshStandardMaterial({ color: '#e4e0d6', roughness: 0.60, metalness: 0.02 }); // slightly shaded sunken panel
const _knobMat    = new THREE.MeshStandardMaterial({ color: '#b8a06a', roughness: 0.30, metalness: 0.85 }); // brushed brass knob

// ─── Sub-component: a single sunken raised panel ──────────────────────────────

/**
 * One recessed rectangular panel with a thin beveled lip frame, built on the
 * leaf's outer face (local +Z). `cx`/`cy` is the panel centre on the leaf face,
 * `w`/`h` the panel's outer size (lip included).
 */
function RaisedPanel({ cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  const innerW = w - PANEL_LIP * 2;
  const innerH = h - PANEL_LIP * 2;
  return (
    <group position={[cx, cy, LEAF_T / 2]}>
      {/* Sunken panel field — set back below the leaf face */}
      <mesh position={[0, 0, -PANEL_RECESS]}>
        <boxGeometry args={[innerW, innerH, 0.006]} />
        <primitive object={_panelMat} attach="material" />
      </mesh>
      {/* Thin beveled lip frame around the sunken field (four thin bars) */}
      <mesh position={[0, h / 2 - PANEL_LIP / 2, -PANEL_RECESS / 2]}>
        <boxGeometry args={[w, PANEL_LIP, PANEL_RECESS]} />
        <primitive object={_leafMat} attach="material" />
      </mesh>
      <mesh position={[0, -(h / 2 - PANEL_LIP / 2), -PANEL_RECESS / 2]}>
        <boxGeometry args={[w, PANEL_LIP, PANEL_RECESS]} />
        <primitive object={_leafMat} attach="material" />
      </mesh>
      <mesh position={[-(w / 2 - PANEL_LIP / 2), 0, -PANEL_RECESS / 2]}>
        <boxGeometry args={[PANEL_LIP, h - PANEL_LIP * 2, PANEL_RECESS]} />
        <primitive object={_leafMat} attach="material" />
      </mesh>
      <mesh position={[w / 2 - PANEL_LIP / 2, 0, -PANEL_RECESS / 2]}>
        <boxGeometry args={[PANEL_LIP, h - PANEL_LIP * 2, PANEL_RECESS]} />
        <primitive object={_leafMat} attach="material" />
      </mesh>
    </group>
  );
}

// ─── Sub-component: Doorway ───────────────────────────────────────────────────

/**
 * A single framed door opening with one white 2-panel raised-panel leaf,
 * built facing local +Z.
 *
 * Local space: the wall plane is at local Z = 0; the opening recedes toward
 * local -Z (into the adjacent space). Place + rotate the group so local +Z
 * points into the hall. The leaf hinges at the -X jamb and swings into the
 * recess (-Z) so the dark opening behind it reads as a propped-open door.
 */
function Doorway() {
  const halfW = OPEN_W / 2;

  // Panel layout on the leaf face. Two stacked panels between the stiles,
  // separated by a centre mid-rail. Panels share the width between the stiles.
  const panelW = LEAF_W - STILE_W * 2;
  // Vertical region available for panels = leaf height minus top, mid, bottom rails.
  const panelStackH = LEAF_H - RAIL_W * 3;
  const panelH = panelStackH / 2;
  // Centre Y of the upper / lower panels relative to the leaf centre.
  const upperCY = RAIL_W / 2 + panelH / 2;
  const lowerCY = -(RAIL_W / 2 + panelH / 2);

  return (
    <group name="doorway">
      {/* ── FRAME: header + two jambs (light painted, face the hall) ── */}
      {/* Header */}
      <mesh castShadow position={[0, OPEN_H + FRAME_T / 2, 0]}>
        <boxGeometry args={[OPEN_W + FRAME_T * 2, FRAME_T, FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
      {/* Left jamb */}
      <mesh castShadow position={[-(halfW + FRAME_T / 2), OPEN_H / 2, 0]}>
        <boxGeometry args={[FRAME_T, OPEN_H + FRAME_T, FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
      {/* Right jamb */}
      <mesh castShadow position={[halfW + FRAME_T / 2, OPEN_H / 2, 0]}>
        <boxGeometry args={[FRAME_T, OPEN_H + FRAME_T, FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>

      {/* ── DARK RECESSED BACKING — inset RECESS behind the opening ── */}
      <mesh position={[0, OPEN_H / 2, -RECESS]} receiveShadow>
        <planeGeometry args={[OPEN_W + 0.02, OPEN_H + 0.02]} />
        <primitive object={_backingMat} attach="material" />
      </mesh>
      {/* Recess side reveals so the opening reads as a box, not a flat panel */}
      <mesh position={[-halfW, OPEN_H / 2, -RECESS / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[RECESS, OPEN_H]} />
        <primitive object={_backingMat} attach="material" />
      </mesh>
      <mesh position={[halfW, OPEN_H / 2, -RECESS / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[RECESS, OPEN_H]} />
        <primitive object={_backingMat} attach="material" />
      </mesh>
      <mesh position={[0, OPEN_H, -RECESS / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[OPEN_W, RECESS]} />
        <primitive object={_backingMat} attach="material" />
      </mesh>

      {/* ── WHITE 2-PANEL DOOR LEAF — hinged at -X jamb, swung AJAR ── */}
      {/* Hinge group at the -X jamb; swings open into the recess (-Z). */}
      <group position={[-halfW, OPEN_H / 2, -RECESS + LEAF_T]} rotation={[0, -LEAF_AJAR, 0]}>
        {/* Leaf slab (the door body). Offset so the hinge edge is at x=0. */}
        <group position={[LEAF_W / 2, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[LEAF_W, LEAF_H, LEAF_T]} />
            <primitive object={_leafMat} attach="material" />
          </mesh>

          {/* Two stacked sunken raised panels on the outer (+Z) face */}
          <RaisedPanel cx={0} cy={upperCY} w={panelW} h={panelH} />
          <RaisedPanel cx={0} cy={lowerCY} w={panelW} h={panelH} />

          {/* Brushed knob near the latch (meeting) stile, both faces */}
          <mesh position={[LEAF_W / 2 - 0.06, KNOB_Y, LEAF_T / 2 + KNOB_R * 0.6]}>
            <sphereGeometry args={[KNOB_R, 16, 12]} />
            <primitive object={_knobMat} attach="material" />
          </mesh>
          <mesh position={[LEAF_W / 2 - 0.06, KNOB_Y, -(LEAF_T / 2 + KNOB_R * 0.6)]}>
            <sphereGeometry args={[KNOB_R, 16, 12]} />
            <primitive object={_knobMat} attach="material" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * Doorways — two framed white-door openings, one at each end of the hall.
 *
 *   1. Entrance doorway — on the ENTRY VESTIBULE's outer end wall (X = -19.5),
 *      faces +X into the corridor, centred in the corridor mouth (Z ≈ 1.25).
 *   2. Sign-wall doorway — +X wall, faces -X into the hall, on the -Z side just
 *      LEFT of the centred HAMESTER HALL sign (Z ≈ -1.3, spanning -2.1..-0.5).
 */
export function Doorways() {
  return (
    <group name="doorways">
      {/* Entrance doorway — vestibule outer end wall. Rotation +π/2 maps local +Z → world +X. */}
      <group
        name="doorway-entrance"
        position={[ENTRANCE_DOOR_X, 0, ENTRANCE_DOOR_Z]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <Doorway />
      </group>

      {/* Sign-wall doorway — +X wall. Rotation -π/2 maps local +Z → world -X. */}
      <group
        name="doorway-sign-end"
        position={[SIGN_DOOR_X, 0, SIGN_DOOR_Z]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Doorway />
      </group>
    </group>
  );
}
