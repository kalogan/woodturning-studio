import { useState, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { WoodBlank } from '../wood/index.js';
import { ToolMesh, PhysicsLoop } from '../scene/index.js';
import { evaluateLesson } from './LessonEvaluator.js';
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
    // Identity-transform group — Slice A2 seam for positioning the rig in world space
    <group>
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
