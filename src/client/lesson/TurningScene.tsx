import { useState, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { WoodBlank } from '../wood/index.js';
import { ToolMesh, PhysicsLoop } from '../scene/index.js';
import { evaluateLesson } from './LessonEvaluator.js';

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
import { getWoodSpeciesById, getCuttingCoefficients } from '../../session/wood.js';
import type { CurriculumLesson } from '../../session/index.js';
import type { InputAdapter } from '../../input/types.js';
import type { WoodState, PhysicsResult, SpeciesCutProfile } from '../../core/types.js';
import type { RefObject } from 'react';
import type { PoseContainer } from './useTurningSession.js';
import type { LessonRunState, EvalResult } from './LessonEvaluator.js';

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

  useFrame(() => {
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
      <WoodBlank
        woodState={woodState}
        length={0.3}
        radius={0.05}
        {...(woodVisual !== undefined ? { visual: woodVisual } : {})}
      />
      <ToolMesh toolKind={lesson.tool} pose={poseContainer.pose} />
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
