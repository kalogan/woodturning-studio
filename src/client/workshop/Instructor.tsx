/**
 * Instructor.tsx — Stylized low-poly woodturning instructor NPC.
 *
 * A blocky, clean low-poly humanoid (~1.75 m) built entirely from primitives
 * (boxes / cylinders / spheres) — clearly a person, NOT realistic. He stands at
 * the OPERATOR side of the demo lathe, turned to FACE the bed, leaning slightly
 * forward with his near (tool) hand reaching toward the tool-rest area as if
 * presenting a cut. He wears a dark canvas apron, safety glasses, and a plaid-ish
 * work shirt.
 *
 * The room may not use external character assets (CLAUDE.md), so the figure is
 * 100% procedural code.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +7.25], floor Y=0.
 *
 * PLACEMENT — derived from the demo station (see DemoBench.tsx):
 *   The demo cluster sits at DEMO_BENCH_POS = [-7, 0, 4.0], rotation [0, π, 0].
 *   Inside that group the demo lathe is at local origin; its spindle (the work)
 *   is at local (SPINDLE_X=-0.62, SPINDLE_Y=0.99, 0). A local point (lx,ly,lz)
 *   maps to world (POSx - lx, ly, POSz - lz) under the group's π Y-rotation.
 *
 *   • Spindle/work in WORLD (demo cluster at Z=4.0): (-7 - (-0.62), 0.99, 4.0) =
 *     (-6.38, 0.99, 4.0).
 *   • The demo cluster was reworked so the LATHE is the front piece (world Z≈4.0,
 *     closest to the room centre) and the TV/shelf sit behind it against the
 *     pillar (world Z≈5.1). The instructor therefore stands on the PILLAR side of
 *     the lathe (world Z > 4.0) and FACES the room centre (-Z) across the bed —
 *     so the class watching from the centre sees his front + the work + the TV.
 *   • He stands at WORLD (-6.23, 0, 4.62) with yaw = π (facing -Z). His fixed
 *     in-hand workpiece offset of local (0.15, 0.99, 0.62) then maps, under yaw π,
 *     to world (-6.23-0.15, 0.99, 4.62-0.62) = (-6.38, 0.99, 4.0) = the spindle.
 *
 * Subtle idle animation lives in ONE useFrame, reading state.clock.elapsedTime
 * and mutating ref transforms IN PLACE — no per-frame heap allocation, no
 * Math.random, no Date.now. This is a client visual (NOT the physics core), so
 * clock use here is fine.
 *
 * Materials are pre-allocated ONCE at module scope and attached via
 * <primitive object={mat} attach="material" /> (avoids the no-misused-spread
 * lint rule on class instances).
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** World position of the instructor's FEET (floor level), operator side of the
 *  demo lathe — the PILLAR side, so he faces the room centre across the bed.
 *  Derived above so his in-hand workpiece lands on the spindle at world Z≈4.5. */
export const INSTRUCTOR_POS: [number, number, number] = [-6.23, 0, 4.62];

/** Yaw (radians). π = facing -Z, i.e. across the bed toward the room centre /
 *  the demo lathe at world Z≈4.5 and the class beyond it. */
export const INSTRUCTOR_YAW = Math.PI;

// Figure proportions (metres). Total height ≈ shoes + legs + torso + neck + head.
const SHOE_H    = 0.07;
const LEG_H     = 0.84;   // ankle → hip
const LEG_T     = 0.15;   // leg cross-section (X)
const LEG_D     = 0.17;   // leg depth (Z)
const HIP_GAP   = 0.10;   // half-distance between the two legs (X)
const TORSO_H   = 0.56;   // hip → shoulders
const TORSO_W   = 0.42;
const TORSO_D   = 0.24;
const NECK_H    = 0.06;
const HEAD_R    = 0.115;  // head half-size
const ARM_UP_L  = 0.28;   // upper arm length
const ARM_LO_L  = 0.26;   // forearm length
const ARM_T     = 0.085;  // arm thickness

// Derived stack heights.
const LEG_BASE_Y   = SHOE_H;                       // legs start atop the shoes
const HIP_Y        = LEG_BASE_Y + LEG_H;           // hip / torso base
const TORSO_MID_Y  = HIP_Y + TORSO_H / 2;
const SHOULDER_Y   = HIP_Y + TORSO_H;
const NECK_Y       = SHOULDER_Y + NECK_H / 2;
const HEAD_Y       = SHOULDER_Y + NECK_H + HEAD_R; // head centre

// The whole figure leans slightly forward (toward the lathe, +Z) about X.
const LEAN_FWD = 0.10;   // radians

// ─── Idle-animation tuning (subtle — alive, not fidgety) ──────────────────────
const BOB_AMP   = 0.012;  // breathing/idle vertical bob (m)
const BOB_FREQ  = 1.10;   // bob speed
const SWAY_AMP  = 0.020;  // gentle weight-shift roll (rad)
const SWAY_FREQ = 0.70;   // sway speed
const WORK_SPIN = 0.9;    // demo workpiece spin (rad/s) about the spindle axis

// Demo workpiece (a pale turned bowl/cylinder) mounted at the spindle.
const WORK_R = 0.060;
const WORK_L = 0.12;

// ─── Module-scope materials (never re-allocated per render) ───────────────────

const _skinMat   = new THREE.MeshStandardMaterial({ color: '#c8a07a', roughness: 0.70, metalness: 0.0 });
const _hairMat   = new THREE.MeshStandardMaterial({ color: '#3a2e26', roughness: 0.85, metalness: 0.0 });
const _shirtMat  = new THREE.MeshStandardMaterial({ color: '#8a4438', roughness: 0.80, metalness: 0.0 }); // plaid-ish flannel red
const _shirtDkMat = new THREE.MeshStandardMaterial({ color: '#5a2e26', roughness: 0.82, metalness: 0.0 }); // darker plaid band
const _apronMat  = new THREE.MeshStandardMaterial({ color: '#3a3a40', roughness: 0.88, metalness: 0.05 }); // dark canvas
const _strapMat  = new THREE.MeshStandardMaterial({ color: '#2c2c30', roughness: 0.85, metalness: 0.05 });
const _pantsMat  = new THREE.MeshStandardMaterial({ color: '#39414a', roughness: 0.80, metalness: 0.0 });  // denim
const _shoeMat   = new THREE.MeshStandardMaterial({ color: '#241c16', roughness: 0.70, metalness: 0.05 });
const _glassMat  = new THREE.MeshStandardMaterial({
  color: '#cfe0e6', roughness: 0.12, metalness: 0.05,
  transparent: true, opacity: 0.55,
});
const _workMat   = new THREE.MeshStandardMaterial({ color: '#d8c79a', roughness: 0.55, metalness: 0.0 }); // pale wood blank
const _faceplateMat = new THREE.MeshStandardMaterial({ color: '#8a8d92', roughness: 0.35, metalness: 0.80 });

// ─── Sub-components ───────────────────────────────────────────────────────────

/** One leg: a denim box atop a shoe. side: -1 = left, +1 = right. */
function Leg({ side }: { side: -1 | 1 }) {
  const x = side * HIP_GAP;
  return (
    <group name={side < 0 ? 'leg-left' : 'leg-right'} position={[x, 0, 0]}>
      {/* Denim leg */}
      <mesh castShadow receiveShadow position={[0, LEG_BASE_Y + LEG_H / 2, 0]}>
        <boxGeometry args={[LEG_T, LEG_H, LEG_D]} />
        <primitive object={_pantsMat} attach="material" />
      </mesh>
      {/* Shoe (slightly longer in Z, toed forward) */}
      <mesh castShadow receiveShadow position={[0, SHOE_H / 2, 0.04]}>
        <boxGeometry args={[LEG_T + 0.01, SHOE_H, LEG_D + 0.10]} />
        <primitive object={_shoeMat} attach="material" />
      </mesh>
    </group>
  );
}

/**
 * One arm: upper + forearm boxes with a slight elbow bend, plus a blocky hand.
 * side: -1 = left, +1 = right.
 *  reach > 0 swings the whole arm forward (toward the lathe / +Z) so the near
 *  hand presents at the tool-rest area.
 */
function Arm({ side, reach }: { side: -1 | 1; reach: number }) {
  const shoulderX = side * (TORSO_W / 2 + ARM_T * 0.35);
  return (
    <group
      name={side < 0 ? 'arm-left' : 'arm-right'}
      position={[shoulderX, SHOULDER_Y - 0.03, 0]}
      rotation={[-reach, 0, side * 0.06]}
    >
      {/* Upper arm (shirt) — hangs down from the shoulder */}
      <mesh castShadow position={[0, -ARM_UP_L / 2, 0]}>
        <boxGeometry args={[ARM_T, ARM_UP_L, ARM_T]} />
        <primitive object={_shirtMat} attach="material" />
      </mesh>
      {/* Plaid band on the upper arm (sleeve hint) */}
      <mesh position={[0, -ARM_UP_L * 0.7, 0]}>
        <boxGeometry args={[ARM_T + 0.004, 0.05, ARM_T + 0.004]} />
        <primitive object={_shirtDkMat} attach="material" />
      </mesh>
      {/* Forearm — bent forward at the elbow */}
      <group position={[0, -ARM_UP_L, 0]} rotation={[-0.55 - reach * 0.4, 0, 0]}>
        <mesh castShadow position={[0, -ARM_LO_L / 2, 0]}>
          <boxGeometry args={[ARM_T * 0.92, ARM_LO_L, ARM_T * 0.92]} />
          <primitive object={_skinMat} attach="material" />
        </mesh>
        {/* Hand (blocky) */}
        <mesh castShadow position={[0, -ARM_LO_L - 0.025, 0.01]}>
          <boxGeometry args={[ARM_T, 0.07, ARM_T * 1.1]} />
          <primitive object={_skinMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface InstructorProps {
  position?: [number, number, number];
  yaw?: number;
}

/**
 * Instructor — low-poly procedural humanoid NPC at the demo lathe.
 *
 * Standing on the operator side, facing the bed, leaning slightly forward with
 * the near hand presenting a tool toward the tool-rest. One useFrame drives a
 * subtle idle (breathing bob + gentle weight-shift sway) and slowly spins a pale
 * demo workpiece at the spindle — all allocation-free, mutating refs in place.
 *
 * Default position: INSTRUCTOR_POS = [-6.23, 0, 4.62]
 * Default yaw:      INSTRUCTOR_YAW = π  (faces -Z, across the bed toward the
 *                   room centre / class; the lathe is in front of him at Z≈4.0)
 */
export function Instructor({
  position = INSTRUCTOR_POS,
  yaw = INSTRUCTOR_YAW,
}: InstructorProps = {}) {
  // Refs for the allocation-free idle tick (pre-allocated at component scope).
  const bodyRef = useRef<THREE.Group | null>(null);  // breathing bob + sway
  const workRef = useRef<THREE.Group | null>(null);  // spinning demo workpiece

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Breathing/idle bob + gentle weight-shift sway on the whole body.
    const body = bodyRef.current;
    if (body !== null) {
      body.position.y = Math.sin(t * BOB_FREQ) * BOB_AMP;
      body.rotation.z = Math.sin(t * SWAY_FREQ) * SWAY_AMP;
    }

    // Slowly spin the pale demo workpiece about the spindle (its local Y axis;
    // the group is laid on its side so Y points along the bed).
    const work = workRef.current;
    if (work !== null) {
      work.rotation.y += WORK_SPIN * (1 / 60);
    }
  });

  return (
    <group name="instructor" position={position} rotation={[0, yaw, 0]}>
      {/* Body wrapper: idle bob (Y) + sway (Z) ride on this group; the static
          forward lean is applied beneath so it composes cleanly. */}
      <group ref={bodyRef}>
        <group rotation={[LEAN_FWD, 0, 0]}>
          {/* Legs + shoes */}
          <Leg side={-1} />
          <Leg side={1} />

          {/* Torso (flannel shirt) */}
          <mesh castShadow receiveShadow position={[0, TORSO_MID_Y, 0]}>
            <boxGeometry args={[TORSO_W, TORSO_H, TORSO_D]} />
            <primitive object={_shirtMat} attach="material" />
          </mesh>
          {/* A couple of darker plaid bands across the shirt */}
          <mesh position={[0, TORSO_MID_Y + 0.10, TORSO_D / 2 + 0.002]}>
            <boxGeometry args={[TORSO_W + 0.004, 0.06, 0.004]} />
            <primitive object={_shirtDkMat} attach="material" />
          </mesh>
          <mesh position={[0, TORSO_MID_Y - 0.12, TORSO_D / 2 + 0.002]}>
            <boxGeometry args={[TORSO_W + 0.004, 0.06, 0.004]} />
            <primitive object={_shirtDkMat} attach="material" />
          </mesh>

          {/* ── Dark canvas apron over the torso front + neck strap ── */}
          <mesh castShadow position={[0, TORSO_MID_Y - 0.04, TORSO_D / 2 + 0.012]}>
            <boxGeometry args={[TORSO_W - 0.06, TORSO_H + 0.14, 0.02]} />
            <primitive object={_apronMat} attach="material" />
          </mesh>
          {/* Apron skirt continues a little past the hips */}
          <mesh castShadow position={[0, HIP_Y - 0.06, TORSO_D / 2 + 0.01]}>
            <boxGeometry args={[TORSO_W - 0.04, 0.16, 0.02]} />
            <primitive object={_apronMat} attach="material" />
          </mesh>
          {/* Neck strap (over the shoulders, both sides) */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.10, SHOULDER_Y + 0.02, 0.02]} rotation={[0.18, 0, 0]}>
              <boxGeometry args={[0.03, 0.22, 0.012]} />
              <primitive object={_strapMat} attach="material" />
            </mesh>
          ))}

          {/* Neck */}
          <mesh castShadow position={[0, NECK_Y, 0]}>
            <cylinderGeometry args={[0.045, 0.05, NECK_H + 0.03, 10]} />
            <primitive object={_skinMat} attach="material" />
          </mesh>

          {/* Head (blocky low-seg sphere) */}
          <mesh castShadow position={[0, HEAD_Y, 0]}>
            <sphereGeometry args={[HEAD_R, 10, 8]} />
            <primitive object={_skinMat} attach="material" />
          </mesh>
          {/* Dark hair cap over the top + back of the head */}
          <mesh castShadow position={[0, HEAD_Y + 0.035, -0.012]}>
            <sphereGeometry args={[HEAD_R + 0.012, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <primitive object={_hairMat} attach="material" />
          </mesh>
          {/* Beard hint (dark band on the lower face) */}
          <mesh position={[0, HEAD_Y - 0.06, HEAD_R * 0.55]}>
            <boxGeometry args={[HEAD_R * 1.3, 0.06, 0.04]} />
            <primitive object={_hairMat} attach="material" />
          </mesh>
          {/* Safety glasses — a thin translucent band across the eyes */}
          <mesh position={[0, HEAD_Y + 0.02, HEAD_R * 0.78]}>
            <boxGeometry args={[HEAD_R * 1.7, 0.045, 0.02]} />
            <primitive object={_glassMat} attach="material" />
          </mesh>

          {/* Arms — near (right) hand reaches forward to present a tool; the
              left hand rests with only a small reach. */}
          <Arm side={1} reach={0.95} />
          <Arm side={-1} reach={0.18} />
        </group>
      </group>

      {/* ── Spinning pale demo workpiece at the demo-lathe spindle ──
          Spindle in WORLD is (-6.38, 0.99, 4.0); the instructor group is at
          (-6.23, 0, 4.62) with yaw π, so the spindle sits at LOCAL
          (0.15, 0.99, 0.62) (the yaw-π map negates the x/z of the world delta).
          The piece is laid on its side (cylinder axis along the bed) and spun
          about local Y. */}
      <group ref={workRef} position={[0.15, 0.99, 0.62]} rotation={[Math.PI / 2, 0, 0]}>
        {/* Pale turned workpiece (a small bowl-ish cylinder) */}
        <mesh castShadow>
          <cylinderGeometry args={[WORK_R, WORK_R * 0.82, WORK_L, 20]} />
          <primitive object={_workMat} attach="material" />
        </mesh>
        {/* Steel faceplate disc at the headstock end */}
        <mesh castShadow position={[0, -WORK_L / 2 - 0.012, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.022, 16]} />
          <primitive object={_faceplateMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
