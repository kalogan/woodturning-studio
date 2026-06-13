import { useState, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
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
import type { LessonRunState, EvalResult } from './LessonEvaluator.js';

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
const RIG_WORLD_POSITION: [number, number, number] = [0.23, 1.10, 0.0];

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

    const latest = adapter.getLatestPose();
    if (latest !== null) {
      poseContainer.pose = latest;
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
          length={0.3}
          radius={0.05}
          {...(woodVisual !== undefined ? { visual: woodVisual } : {})}
        />
      </group>
      {/* Anchor the tool at the tool rest bar position (TOOL_REST_ANCHOR).
          ToolMesh adds the pose position offset on top of this anchor, so the
          player's mouse/pencil input moves the tool relative to the rest.
          NOTE: blind-placed GrippingHands removed — visible hands are DEFERRED to a
          dedicated, eyeball-tuned pass (see docs/ROADMAP.md). The hands model +
          GrippingHands/ReachingHand components remain in src/client/hands for it. */}
      <group position={TOOL_REST_ANCHOR}>
        <ToolMesh toolKind={lesson.tool} pose={poseContainer.pose} />
      </group>
      <PhysicsLoop
        woodState={woodState}
        toolPose={poseContainer.pose}
        toolKind={lesson.tool}
        cutProfile={cutProfile}
        onResult={handleResult}
      />
    </group>
  );
}
