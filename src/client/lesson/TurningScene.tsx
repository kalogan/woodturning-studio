import { useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { WoodBlank } from '../wood/index.js';
import { ToolMesh, PhysicsLoop } from '../scene/index.js';
import { evaluateLesson } from './LessonEvaluator.js';
import { getWoodSpeciesById } from '../../session/wood.js';
import type { CurriculumLesson } from '../../session/index.js';
import type { InputAdapter } from '../../input/types.js';
import type { WoodState, PhysicsResult } from '../../core/types.js';
import type { RefObject } from 'react';
import type { PoseContainer } from './useTurningSession.js';
import type { LessonRunState, EvalResult } from './LessonEvaluator.js';

// TODO(W4): replace with per-lesson species driven by curriculum data
const TEMP_SPECIES = 'cherry';
const TEMP_VISUAL = getWoodSpeciesById(TEMP_SPECIES)?.visual;

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
        {...(TEMP_VISUAL !== undefined ? { visual: TEMP_VISUAL } : {})}
      />
      <ToolMesh toolKind={lesson.tool} pose={poseContainer.pose} />
      <PhysicsLoop
        woodState={woodState}
        toolPose={poseContainer.pose}
        toolKind={lesson.tool}
        onResult={handleResult}
      />
    </group>
  );
}
