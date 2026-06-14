import { useState, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WoodBlank } from '../wood/index.js';
import { useLatheStore } from '../../workshop/index.js';
import { ToolMesh, PhysicsLoop } from '../scene/index.js';
import { evaluateLesson } from './LessonEvaluator.js';
import { getWoodSpeciesById, getCuttingCoefficients } from '../../session/wood.js';
import type { CurriculumLesson } from '../../session/index.js';
import type { InputAdapter } from '../../input/types.js';
import type { WoodState, PhysicsResult, SpeciesCutProfile } from '../../core/types.js';
import type { RefObject } from 'react';
import type { PoseContainer } from './useTurningSession.js';
import { BLANK_LENGTH, BLANK_RADIUS, BLANK_CENTRE_X } from './useTurningSession.js';
import type { LessonRunState, EvalResult } from './LessonEvaluator.js';

// ─── Mouse cursor → work plane constants ─────────────────────────────────────
//
// These mirror OPERATOR_CAM_POS / OPERATOR_CAM_FOV from TurningEntry.tsx.
// They are used when adapter.source === 'mouse' to raycast the cursor onto
// the lathe work plane so the tool tip tracks the mouse cursor in world space.
//
// MOUSE_WORK_PLANE_Z — world Z of the vertical plane containing the blank axis.
//   The blank lies along world X at Z ≈ 0 (rig origin Z).  The camera is at
//   Z = +1.0 and looks toward Z = 0, so this is the plane the camera faces.
//   Tune if the rig or lathe is repositioned along Z.
//
// MOUSE_ANGLE_X_DEFAULT — default bevel angle (radians) for the mouse path.
//   Positive = tip tilted up, matching the hand adapter's default (0.3 rad ≈ 17°).
//   The contact gate fires independently of this angle; bevel contact in physics
//   requires absAngle ≤ bevelThreshold per tool (see src/core/physics.ts).
//   Keep this at or just below the roughing-gouge threshold (0.52 rad) so the
//   mouse path is always in "bevel contact" by default — reduces friction for new
//   players who don't yet understand bevel riding.
//
//
const MOUSE_WORK_PLANE_Z = 0.07;       // TUNABLE — world Z of the tool/work plane (≈ tool-rest depth, matches TOOL_REST_ANCHOR Z)
const MOUSE_ANGLE_X_DEFAULT = 0.3;     // TUNABLE — default bevel angle (rad)

// When the cursor leaves the blank (e.g. moving to the speed knob on the control
// panel), the tool must NOT track over there and poke into the lathe. Instead it
// stays within the blank's working span and lifts to a raised "ready" pose above the
// wood — as if held clear while you adjust the machine.
const TOOL_END_MARGIN = 0.05;     // TUNABLE — keep the tool this far (m) inside the blank ends so its body clears the headstock/tailstock
const TOOL_READY_LIFT_Y = 0.16;   // TUNABLE — pose.y when the cursor is off the blank: tool lifts ~0.1 m above the wood surface, clear of the lathe

// ─── Pre-allocated raycast scratch (module scope — no per-frame heap alloc) ───
//
// We raycast the cursor through the REAL camera (which is pitched down ~29°)
// onto the vertical work plane Z = MOUSE_WORK_PLANE_Z. THREE.Raycaster uses the
// camera's full orientation, so the hit lands exactly under the cursor — unlike
// a hand-rolled axis-aligned ray, which ignored the pitch and placed the tool
// well above the cursor.
//
const _ray = new THREE.Raycaster();
const _workPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -MOUSE_WORK_PLANE_Z);
const _ptr = new THREE.Vector2();
const _hit = new THREE.Vector3();

// ─── Director tuning knob ─────────────────────────────────────────────────────
//
// RIG_WORLD_POSITION mirrors the lathe spindle blank centre in world space.
//
// Derivation (read-only, from content/lathe/jet-jwl-1642.json):
//   stand.legHeight (0.80) + stand.topPlateThickness (0.02)  = machineY 0.82
//   bed.thickness/2 (0.035) + bed.wayHeight (0.04)           = bedTopY  0.075  (machine-local)
//   bedTopY + headstock.spindleHeight (0.2032)               = spindleY 0.2782 (machine-local)
//   world spindle Y = machineY + spindleY                    ≈ 1.098 ≈ 1.10
//
//   bedLeftX = -bed.length/2 = -0.725
//   headstockSpindleFaceX = bedLeftX + headstock.width (0.30) + spindleNoseLength (0.06) = -0.365
//   driveCenterTipX = -0.365 + driveCenter.length (0.055) + centerPointLength (0.009) = -0.301
//   blankCentreX = driveCenterTipX + betweenCenters/2 = -0.301 + 0.5334 ≈ +0.23
//
// The blank is a FIRST-PASS DRAFT (length 0.3, radius 0.05) — smaller than the
// real between-centers span (1.07 m). Full-size blank unification is a follow-up slice.
// Adjust X/Y here to re-seat the rig on the spindle axis if the lathe moves.
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * World-space position of the turning rig group — mirrors the lathe blank centre
 * on the spindle axis (X axis, +Z = operator side).  FIRST-PASS DRAFT values;
 * tune freely without touching physics or lathe files.
 */
const RIG_WORLD_POSITION: [number, number, number] = [BLANK_CENTRE_X, 1.10, 0.0];

// ─── Tool rest anchor (rig-local space) ───────────────────────────────────────
//
// TOOL_REST_ANCHOR — where the tool "sits" on the tool rest bar, expressed in
// rig-local coordinates (origin = blank centre on spindle axis).
//
//   X = 0        — centred on the blank along the spindle axis (tune to slide
//                  the contact point toward headstock/tailstock)
//   Y = -0.01    — just below spindle-centre height; the base rotation aims the
//                  tip up ~14° so it reaches the blank surface at radius 0.05 m
//   Z = +0.07    — on the operator/+Z side, just beyond the blank's 0.05 m
//                  radius (the tool rest bar is typically ~1–1.5× blank radius
//                  in front of the centre line)
//
// The pose position offsets (±0.15 / ±0.05 / ±0.12 m) are added on top of this
// anchor in ToolMesh, giving the player the feeling of moving the tool along the
// rest and into/out of the cut.
//
// Tune Z to move the anchor closer or further from the blank.
// Tune Y to raise or lower the rest height.
//
const TOOL_REST_ANCHOR: [number, number, number] = [
  0,      // X — centred on blank (spindle axis)
  -0.01,  // Y — slightly below spindle-centre (tip rotation aims up to blank surface)
  0.07,   // Z — operator side, just forward of blank radius
];
// ─────────────────────────────────────────────────────────────────────────────

export interface TurningSceneProps {
  lesson: CurriculumLesson;
  adapter: InputAdapter;
  poseContainer: PoseContainer;
  woodState: WoodState;
  runStateRef: RefObject<LessonRunState>;
  onEvalResult: (result: EvalResult) => void;
  onResult: (result: PhysicsResult) => void;
  completed: boolean;
}

/**
 * In-Canvas turning scene — rendered inside the persistent App Canvas.
 * Wraps content in a <group> (identity in A1) so Slice A2 can inject position/rotation.
 */
export function TurningScene({
  lesson,
  adapter,
  poseContainer,
  woodState,
  runStateRef,
  onEvalResult,
  onResult,
  completed,
}: TurningSceneProps) {
  const [, rerender] = useState(0);

  // Grab camera + pointer from R3F — used in the mouse cursor-to-work-plane path.
  // useThree is called once per render; camera and pointer are live references
  // that R3F updates each frame, so we read them inside useFrame below.
  const { camera, pointer } = useThree();

  // Resolve species visual + cut-profile ONCE per lesson (memoized — not per frame).
  const woodVisual = useMemo(
    () => getWoodSpeciesById(lesson.woodSpecies)?.visual,
    [lesson.woodSpecies],
  );

  const cutProfile = useMemo<SpeciesCutProfile | undefined>(
    () => getCuttingCoefficients(lesson.woodSpecies, lesson.tool) ?? undefined,
    [lesson.woodSpecies, lesson.tool],
  );

  useFrame((_, dt) => {
    // Advance the spindle motor simulation so currentRpm eases toward targetRpm
    // (and spins down gracefully when power is cut) while the player is turning.
    // Read imperatively — no hook subscription, no per-frame React re-render.
    useLatheStore.getState().tick(dt);

    if (adapter.source === 'mouse') {
      // ── Mouse path: raycast cursor through the REAL camera onto the work plane ──
      // setFromCamera uses the camera's full transform (position + the ~29° downward
      // pitch + fov + aspect), so the hit lands exactly under the cursor on the
      // Z = MOUSE_WORK_PLANE_Z plane (≈ the tool-rest depth).
      _ptr.set(pointer.x, pointer.y);
      _ray.setFromCamera(_ptr, camera);
      const hit = _ray.ray.intersectPlane(_workPlane, _hit);
      if (hit !== null) {
        // Mutate the existing pose in place — no new object (constraint §3).
        // pose.z = station along the blank (world X, relative to the rig centre);
        // pose.y = tool-tip height above the spindle axis. ToolMesh (cursorFollowMode)
        // renders the tool body at (pose.z, pose.y) so its CENTRE sits exactly under
        // the cursor; the contact gate in PhysicsLoop reads the same pose.z/pose.y.
        const p = poseContainer.pose;
        p.position.x = 0;
        // Working span along the blank (world X), kept clear of the machine.
        const workLeft = RIG_WORLD_POSITION[0] - BLANK_LENGTH / 2 + TOOL_END_MARGIN;
        const workRight = RIG_WORLD_POSITION[0] + BLANK_LENGTH / 2 - TOOL_END_MARGIN;
        if (_hit.x < workLeft || _hit.x > workRight) {
          // Cursor off the blank (e.g. over the control panel adjusting the speed knob):
          // clamp the tool over the nearest blank end and LIFT it to a raised ready pose
          // above the wood — it should hang clear, not poke into the lathe.
          const clampedX = _hit.x < workLeft ? workLeft : workRight;
          p.position.z = clampedX - RIG_WORLD_POSITION[0];
          p.position.y = TOOL_READY_LIFT_Y;
        } else {
          // Over the blank: tip tracks the cursor; lower onto the wood to cut.
          p.position.z = _hit.x - RIG_WORLD_POSITION[0];
          p.position.y = _hit.y - RIG_WORLD_POSITION[1] - TOOL_REST_ANCHOR[1];
        }
        p.angleX = MOUSE_ANGLE_X_DEFAULT;
        // Pressure (mousedown/up) + angleY still come from the adapter.
        const adapterPose = adapter.getLatestPose();
        if (adapterPose !== null) {
          p.pressure = adapterPose.pressure;
          p.angleY = adapterPose.angleY;
        }
      }
    } else {
      // ── Camera / MediaPipe hand path — unchanged ─────────────────────────
      const latest = adapter.getLatestPose();
      if (latest !== null) {
        poseContainer.pose = latest;
      }
    }
    rerender((n) => n + 1);
  });

  const handleResult = useCallback(
    (r: PhysicsResult) => {
      onResult(r);

      if (completed) return;

      const run = runStateRef.current;
      run.totalMaterialRemoved += r.materialRemoved;
      if (r.catch) run.catchCount += 1;

      // Update max tearout from all stations
      let maxT = run.maxTearout;
      for (let i = 0; i < woodState.tearout.length; i++) {
        const t = woodState.tearout[i] ?? 0;
        if (t > maxT) maxT = t;
      }
      run.maxTearout = maxT;

      const evalResult = evaluateLesson(lesson, run, woodState);
      if (evalResult !== null) {
        onEvalResult(evalResult);
      }
    },
    [completed, lesson, onEvalResult, onResult, runStateRef, woodState],
  );

  return (
    // RIG_WORLD_POSITION places the rig on the lathe spindle axis — see constant above.
    // Physics call is UNCHANGED; only the group position has been set (T4 slice).
    <group position={RIG_WORLD_POSITION}>
      {/* Lay the blank HORIZONTAL along the lathe spindle axis (world X), between the
          centers. The blank's length axis is local Y (LatheGeometry revolves the profile
          around Y); rotating -90° about Z maps that length axis onto the lathe's horizontal
          axis. The blank spins in place about that axis (rotation.y inside WoodBlank) — so
          the wood spins on the lathe while you move the tool into it. */}
      <group rotation={[0, 0, -Math.PI / 2]}>
        <WoodBlank
          woodState={woodState}
          length={BLANK_LENGTH}
          radius={BLANK_RADIUS}
          {...(woodVisual !== undefined ? { visual: woodVisual } : {})}
        />
      </group>
      {/* Anchor the tool at the tool rest bar position (TOOL_REST_ANCHOR).
          ToolMesh adds the pose position offset on top of this anchor, so the
          player's mouse/pencil input moves the tool relative to the rest.
          (Disembodied gripping-hands removed per director — they read as awful;
          a proper arm-anchored hand pass is deferred.) */}
      <group position={TOOL_REST_ANCHOR}>
        <ToolMesh
          toolKind={lesson.tool}
          pose={poseContainer.pose}
          cursorFollowMode={adapter.source === 'mouse'}
        />
      </group>
      <PhysicsLoop
        woodState={woodState}
        toolPose={poseContainer.pose}
        toolKind={lesson.tool}
        rpm={useLatheStore.getState().currentRpm}
        cutProfile={cutProfile}
        onResult={handleResult}
      />
    </group>
  );
}
