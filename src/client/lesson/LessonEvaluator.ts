import type { WoodState } from '../../core/types.js';
import type { CurriculumLesson } from '../../session/index.js';

export interface LessonRunState {
  totalMaterialRemoved: number; // cumulative m³
  catchCount: number;
  maxTearout: number; // 0–1, worst station seen
  elapsed: number; // seconds
}

export interface EvalResult {
  passed: boolean;
  reason: string;
}

/**
 * Returns null if lesson not yet complete, EvalResult when done.
 * Called every physics tick — kept pure and allocation-free.
 */
export function evaluateLesson(
  lesson: CurriculumLesson,
  run: LessonRunState,
  woodState: WoodState,
): EvalResult | null {
  const { successCriteria, coachingCues } = lesson;

  // Fail fast: catch tolerance exceeded while noCatches is active
  if (successCriteria.noCatches && run.catchCount > successCriteria.catchesTolerance) {
    return {
      passed: false,
      reason: 'Too many catches — focus on bevel contact.',
    };
  }

  // Check all pass conditions
  const enoughMaterial = run.totalMaterialRemoved >= successCriteria.minMaterialRemoved;
  const catchesOk =
    !successCriteria.noCatches || run.catchCount <= successCriteria.catchesTolerance;
  const tearoutOk = run.maxTearout <= successCriteria.maxTearout;

  // Suppress unused-variable warning — woodState is available for future criteria
  void woodState;

  if (enoughMaterial && catchesOk && tearoutOk) {
    const completeCue = coachingCues.find((c) => c.trigger === 'complete');
    const reason = completeCue?.message ?? 'Lesson complete!';
    return { passed: true, reason };
  }

  return null;
}
