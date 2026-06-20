/**
 * DustCollection.tsx — Shop dust collection system.
 *
 * Photo-matched to a real WHITE CYCLONE collector (Oneida / Grizzly style):
 *   • A floor-standing CYCLONE unit tucked into the entrance / lathe-wall
 *     corner: a GRAY motor + blower scroll housing on top, a WHITE cylindrical
 *     upper body, tapering into a WHITE CONICAL cyclone cone, ending over a
 *     tan/kraft fiber collection DRUM with a black bag-clamp ring. A small
 *     cyclone inlet stub and a slim vertical filter/exhaust stack read the
 *     classic Oneida silhouette.
 *   • A horizontal SHINY galvanized SPIRAL duct TRUNK running the length of
 *     the lathe wall, just below the overhead light fixtures, with a smooth
 *     curved quarter-torus ELBOW where the trunk meets the cyclone and turns
 *     up toward the wall — like the big curved silver pipe in the photo.
 *   • Vertical DROP branches descending over individual lathe stations,
 *     each ending in a blast gate, a corrugated flex hose, and a flared
 *     pickup hood.
 *   • Steel mounting straps holding the trunk up near the wall.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling HALL_H = 3.6 m, floor Y=0.
 *   -Z wall (Z≈-2.5) = lathe wall; prop lathes at X = -2.5, -5, -7.5, -10, -12.5.
 *
 * HEIGHT CLEARANCE (verified against Lighting.tsx + Hall.tsx):
 *   • Light fixtures (Lighting.tsx) sit at Y≈3.45–3.54 over Row A (Z≈-1.5)
 *     and Row B (Z≈1.5). Existing black ceiling ducts (Hall.tsx) hang at
 *     Y 3.4–3.6 over the aisle centre (Z≈0.75) and a Z-branch at X=-7.
 *   • Our trunk runs at Y=2.95 (well below those) and at Z=-2.15 — between
 *     the -Z wall (Z=-2.5) and the lathes (Z=0), clear of the Row A lights
 *     at Z=-1.5. No intersection with lights or existing ducts.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation, no Math.random, no Date.now, no browser APIs — Three.js only.
 * No per-frame allocation.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// ── Cyclone collector unit (floor-standing, -X/-Z corner) ────────────────────
/** World position of the collector base centre (corner; grinder is at +Z side). */
const COLLECTOR_POS: [number, number, number] = [-15.0, 0, -1.7];

// Fiber collection drum at the floor (tan kraft cardboard).
const DRUM_R = 0.30;   // drum radius
const DRUM_H = 0.55;   // drum height

// Black bag-clamp ring sealing the cone to the drum.
const CLAMP_R = 0.32;
const CLAMP_H = 0.05;

// White conical cyclone cone (wide at top, narrow into the drum).
const CONE_TOP_R = 0.31;   // matches body radius
const CONE_BOT_R = 0.13;   // narrow throat above the drum
const CONE_H     = 0.62;

// White cylindrical upper body (the main cyclone barrel).
const BODY_R = 0.31;
const BODY_H = 0.46;

// Gray motor / blower scroll housing on top.
const SCROLL_R = 0.235;  // blower scroll radius
const SCROLL_T = 0.27;   // axial thickness of the scroll
const MOTOR_R  = 0.13;   // motor can radius (sits atop the scroll)
const MOTOR_H  = 0.20;   // motor can height

// Slim vertical filter / exhaust stack rising off the scroll exhaust.
const STACK_R = 0.075;
const STACK_H = 0.42;

// Cyclone tangential inlet stub (where the trunk elbow connects).
const INLET_R   = 0.105;
const INLET_LEN = 0.30;

// ── Main duct trunk (horizontal, along X, near the lathe wall) ───────────────
const TRUNK_Y = 2.95;    // BELOW light fixtures (Y≈3.5) and ceiling ducts (Y≥3.4)
const TRUNK_Z = -2.15;   // between -Z wall (-2.5) and lathes (0); clear of lights
const TRUNK_R = 0.10;    // round duct radius (~0.20 m dia)
const TRUNK_X_HI = -1.4;     // +X end of the trunk (near player lathe)

// Curved elbow joining the trunk to the cyclone inlet (quarter-torus).
const ELBOW_R = 0.22;    // bend radius of the elbow centreline
/** X where the elbow's vertical leg sits (just +X of the cyclone). */
const ELBOW_X = COLLECTOR_POS[0] + 0.55;

// Trunk now runs from the elbow's top to the +X end.
const TRUNK_X_LO = ELBOW_X;

// ── Drop branches (vertical, descending to lathe stations) ───────────────────
/** X positions of the drops (above selected lathe stations). */
const DROP_XS: readonly number[] = [-2.5, -7.5, -12.5];
const DROP_R       = 0.06;    // drop pipe radius (~0.12 m dia)
const DROP_BOTTOM_Y = 1.60;   // where the drop ends (blast gate top), above bed
const HOOD_R       = 0.11;    // flared pickup hood mouth radius
const FLEX_R       = 0.055;   // flex hose radius (a touch under the drop)

// Blast gate (flat box valve with a handle tab)
const GATE_W = 0.17;
const GATE_H = 0.13;
const GATE_T = 0.045;

// Mounting straps holding the trunk to the wall
/** X positions of the trunk support straps. */
const STRAP_XS: readonly number[] = [-13.5, -9.0, -4.5];

// ─── Module-scope materials ───────────────────────────────────────────────────

const _ductMat = new THREE.MeshStandardMaterial({
  color: '#c4c8cc', roughness: 0.25, metalness: 0.85,    // shiny galvanized steel
});
const _seamMat = new THREE.MeshStandardMaterial({
  color: '#aeb2b6', roughness: 0.30, metalness: 0.85,    // spiral-seam ring hint
});
const _flexMat = new THREE.MeshStandardMaterial({
  color: '#8a8c90', roughness: 0.70, metalness: 0.35,    // darker flex hose
});
const _scrollMat = new THREE.MeshStandardMaterial({
  color: '#5a5d63', roughness: 0.55, metalness: 0.50,    // gray blower scroll
});
const _whiteMat = new THREE.MeshStandardMaterial({
  color: '#e8e8e2', roughness: 0.55, metalness: 0.10,    // white cyclone body/cone
});
const _drumMat = new THREE.MeshStandardMaterial({
  color: '#b89a6a', roughness: 0.85, metalness: 0.0,     // tan kraft fiber drum
});
const _clampMat = new THREE.MeshStandardMaterial({
  color: '#1c1c1e', roughness: 0.55, metalness: 0.25,    // black bag-clamp ring
});
const _gateMat = new THREE.MeshStandardMaterial({
  color: '#6a6a70', roughness: 0.45, metalness: 0.55,    // blast gate body
});
const _handleMat = new THREE.MeshStandardMaterial({
  color: '#c0392b', roughness: 0.50, metalness: 0.10,    // red handle tab
});
const _strapMat = new THREE.MeshStandardMaterial({
  color: '#5a5e62', roughness: 0.50, metalness: 0.60,    // steel band
});

// ─── Module-scope geometry (built once) ───────────────────────────────────────

// Quarter-torus elbow: a 90° arc of pipe. Built in the XY plane (tube around
// the +Z axis), then oriented in the component so it sweeps from horizontal
// (trunk) to vertical (down to the cyclone inlet).
const _elbowGeo = new THREE.TorusGeometry(ELBOW_R, TRUNK_R, 16, 24, Math.PI / 2);

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Floor-standing WHITE CYCLONE: gray scroll, white body + cone, fiber drum. */
function Collector() {
  const drumTopY  = DRUM_H;
  const clampY    = drumTopY + CLAMP_H / 2;
  const coneBotY  = drumTopY + CLAMP_H;            // cone narrow end meets clamp
  const coneTopY  = coneBotY + CONE_H;
  const bodyBotY  = coneTopY;
  const bodyTopY  = bodyBotY + BODY_H;
  const scrollY   = bodyTopY + SCROLL_T / 2;       // scroll centreline
  const motorY    = bodyTopY + SCROLL_T + MOTOR_H / 2;
  const stackBotY = bodyTopY + SCROLL_T;
  const inletY    = bodyTopY - 0.06;               // inlet near top of the body

  return (
    <group name="dust-collector" position={COLLECTOR_POS}>
      {/* Fiber collection drum (tan kraft cardboard) at the floor */}
      <mesh castShadow receiveShadow position={[0, DRUM_H / 2, 0]}>
        <cylinderGeometry args={[DRUM_R, DRUM_R, DRUM_H, 24]} />
        <primitive object={_drumMat} attach="material" />
      </mesh>
      {/* Drum rim band (top hoop) */}
      <mesh position={[0, drumTopY - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[DRUM_R + 0.005, 0.012, 8, 24]} />
        <primitive object={_drumMat} attach="material" />
      </mesh>

      {/* Black bag-clamp ring sealing cone to drum */}
      <mesh castShadow position={[0, clampY, 0]}>
        <cylinderGeometry args={[CLAMP_R, CLAMP_R, CLAMP_H, 24]} />
        <primitive object={_clampMat} attach="material" />
      </mesh>

      {/* White conical cyclone cone (wide top → narrow throat into drum) */}
      <mesh castShadow position={[0, coneBotY + CONE_H / 2, 0]}>
        <cylinderGeometry args={[CONE_TOP_R, CONE_BOT_R, CONE_H, 28]} />
        <primitive object={_whiteMat} attach="material" />
      </mesh>

      {/* White cylindrical upper body (cyclone barrel) */}
      <mesh castShadow position={[0, bodyBotY + BODY_H / 2, 0]}>
        <cylinderGeometry args={[BODY_R, BODY_R, BODY_H, 28]} />
        <primitive object={_whiteMat} attach="material" />
      </mesh>

      {/* Cyclone tangential INLET stub off the +X side, near body top */}
      <mesh castShadow
            position={[BODY_R + INLET_LEN / 2 - 0.04, inletY, 0]}
            rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[INLET_R, INLET_R, INLET_LEN, 16]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>

      {/* Gray blower SCROLL housing (cylinder on its side) atop the body */}
      <mesh castShadow position={[0, scrollY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[SCROLL_R, SCROLL_R, SCROLL_T, 24]} />
        <primitive object={_scrollMat} attach="material" />
      </mesh>
      {/* Gray motor can on top of the scroll */}
      <mesh castShadow position={[0, motorY, 0]}>
        <cylinderGeometry args={[MOTOR_R, MOTOR_R, MOTOR_H, 20]} />
        <primitive object={_scrollMat} attach="material" />
      </mesh>

      {/* Slim vertical filter / exhaust stack rising off the scroll (-X side) */}
      <mesh castShadow position={[-BODY_R - STACK_R - 0.02, stackBotY + STACK_H / 2 - SCROLL_T, 0]}>
        <cylinderGeometry args={[STACK_R, STACK_R, STACK_H, 18]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>
      {/* Short cross-over duct from the scroll exhaust to the stack top */}
      <mesh castShadow
            position={[-BODY_R / 2 - STACK_R, stackBotY + STACK_H / 2 - SCROLL_T + STACK_H / 2 - 0.04, 0]}
            rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[STACK_R * 0.8, STACK_R * 0.8, BODY_R, 14]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>
    </group>
  );
}

// Strap geometry — a short vertical band from just above the trunk up toward
// the ceiling line; kept well below the Y≈3.54 light fixtures.
const HALL_TRUNK_TOP = 3.30;                  // top of the strap (below lights)
const STRAP_LEN = HALL_TRUNK_TOP - TRUNK_Y;   // band length

/** The horizontal SHINY spiral duct trunk + curved elbow down to the cyclone. */
function Trunk() {
  const len = TRUNK_X_HI - TRUNK_X_LO;
  const cx  = (TRUNK_X_HI + TRUNK_X_LO) / 2;

  // Spiral-seam ring hints spaced along the trunk.
  const seamXs = [-3.0, -5.5, -8.0, -10.5, -13.0];

  // Elbow geometry sweeps a 90° arc. We place its centre so one tangent is
  // horizontal at TRUNK_Y (continuing the trunk) and the other is vertical,
  // dropping down toward the cyclone inlet at ELBOW_X.
  // Torus arc spans angle 0→π/2 in its local XY plane; centre at elbow corner.
  const elbowCx = ELBOW_X;
  const elbowCy = TRUNK_Y - ELBOW_R;   // arc centre below the trunk line

  return (
    <group name="dust-trunk">
      {/* Long round shiny duct lying along X */}
      <mesh castShadow position={[cx, TRUNK_Y, TRUNK_Z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[TRUNK_R, TRUNK_R, len, 24]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>

      {/* Spiral-seam ring bands (thin hoops) */}
      {seamXs.map((x, i) => (
        <mesh key={i} position={[x, TRUNK_Y, TRUNK_Z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[TRUNK_R + 0.004, TRUNK_R + 0.004, 0.02, 24]} />
          <primitive object={_seamMat} attach="material" />
        </mesh>
      ))}

      {/* End cap at the +X end (capped run) */}
      <mesh position={[TRUNK_X_HI, TRUNK_Y, TRUNK_Z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[TRUNK_R * 1.05, TRUNK_R * 1.05, 0.03, 24]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>

      {/* Smooth curved ELBOW: trunk → turns down toward the cyclone.
          Torus arc (0→π/2) in its local XY plane; rotate about Y so the bend
          lies in the X/Y plane at Z=TRUNK_Z, sweeping from the +X horizontal
          tangent down to the vertical drop. */}
      <mesh castShadow
            position={[elbowCx, elbowCy, TRUNK_Z]}
            rotation={[0, Math.PI, 0]}>
        <primitive object={_elbowGeo} attach="geometry" />
        <primitive object={_ductMat} attach="material" />
      </mesh>

      {/* Vertical leg of the elbow dropping toward the cyclone inlet */}
      <mesh castShadow
            position={[
              elbowCx - ELBOW_R,
              (elbowCy + (COLLECTOR_POS[1] + 1.9)) / 2,
              TRUNK_Z,
            ]}>
        <cylinderGeometry args={[TRUNK_R, TRUNK_R, Math.max(0.05, elbowCy - 1.9), 24]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>

      {/* Mounting straps — steel bands from the wall down to the trunk */}
      {STRAP_XS.map((x, i) => (
        <mesh key={i} castShadow
              position={[x, (TRUNK_Y + HALL_TRUNK_TOP) / 2, TRUNK_Z - TRUNK_R - 0.04]}>
          <boxGeometry args={[0.03, STRAP_LEN, 0.02]} />
          <primitive object={_strapMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** A single drop branch: vertical pipe → blast gate → flex hose → pickup hood. */
function Drop({ x }: { x: number }) {
  const dropLen = TRUNK_Y - DROP_BOTTOM_Y;   // vertical pipe length
  const dropCY  = (TRUNK_Y + DROP_BOTTOM_Y) / 2;

  // Blast gate sits just below the drop's bottom.
  const gateCY = DROP_BOTTOM_Y - GATE_H / 2;

  // Flex hose hangs below the gate, drifting toward the lathe (+Z, toward Z=0).
  const flexTopY = gateCY - GATE_H / 2;
  const flexLen  = 0.26;
  const flexZ0   = 0.0;   // hose pivot sits on the drop centreline (Z drift via tilt)

  return (
    <group name="dust-drop" position={[x, 0, TRUNK_Z]}>
      {/* Vertical drop pipe from the trunk down to the gate */}
      <mesh castShadow position={[0, dropCY, 0]}>
        <cylinderGeometry args={[DROP_R, DROP_R, dropLen, 16]} />
        <primitive object={_ductMat} attach="material" />
      </mesh>

      {/* Blast gate — flat box valve */}
      <mesh castShadow position={[0, gateCY, 0]}>
        <boxGeometry args={[GATE_W, GATE_H, GATE_T]} />
        <primitive object={_gateMat} attach="material" />
      </mesh>
      {/* Gate handle tab (slid to one side) */}
      <mesh castShadow position={[GATE_W / 2 + 0.03, gateCY, 0]}>
        <boxGeometry args={[0.06, GATE_H * 0.5, 0.012]} />
        <primitive object={_handleMat} attach="material" />
      </mesh>

      {/* Flex hose — corrugated look via stacked ribs on a core cylinder.
          Tilted toward the lathe (+Z) to suggest the hose curving to the hood. */}
      <group position={[0, flexTopY, flexZ0]} rotation={[-0.55, 0, 0]}>
        {/* Smooth core */}
        <mesh castShadow position={[0, -flexLen / 2, 0]}>
          <cylinderGeometry args={[FLEX_R, FLEX_R, flexLen, 14]} />
          <primitive object={_flexMat} attach="material" />
        </mesh>
        {/* Corrugation ribs — a few stacked thin rings */}
        {[0.12, 0.28, 0.44, 0.60, 0.76, 0.92].map((t, i) => (
          <mesh key={i} position={[0, -flexLen * t, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[FLEX_R + 0.006, 0.009, 6, 14]} />
            <primitive object={_flexMat} attach="material" />
          </mesh>
        ))}
        {/* Flared pickup hood at the hose mouth (cone funnel) */}
        <mesh castShadow position={[0, -flexLen - 0.05, 0]}>
          <coneGeometry args={[HOOD_R, 0.13, 18, 1, true]} />
          <primitive object={_ductMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * DustCollection — white cyclone collector unit + shiny overhead duct trunk
 * with a curved elbow + drop branches with blast gates and flex-hose pickup
 * hoods over the lathe stations.
 */
export function DustCollection() {
  return (
    <group name="dust-collection">
      <Collector />
      <Trunk />
      {DROP_XS.map((x, i) => (
        <Drop key={i} x={x} />
      ))}
    </group>
  );
}
