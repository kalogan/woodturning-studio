import { describe, it, expect } from 'vitest';
import { evaluateLesson } from './LessonEvaluator.js';
import type { LessonRunState } from './LessonEvaluator.js';
import type { CurriculumLesson } from '../../session/index.js';
import type { WoodState } from '../../core/types.js';

/** Minimal lesson fixture matching the shape of lesson-01-roughing.json */
const minimalLesson: CurriculumLesson = {
  id: 'test-lesson',
  title: 'Test Lesson',
  tool: 'roughing-gouge',
  order: 1,
  brief: 'A test lesson.',
  successCriteria: {
    minMaterialRemoved: 0.3,
    maxTearout: 0.2,
    noCatches: false,
    catchesTolerance: 2,
  },
  coachingCues: [
    { trigger: 'catch', message: 'Catch!' },
    { trigger: 'tearout', message: 'Tearout!' },
    { trigger: 'complete', message: 'Clean cylinder — bevel contact mastered!' },
  ],
};

/** Minimal WoodState for tests — tearout not used in pass criteria check */
function makeWoodState(): WoodState {
  return {
    length: 0.3,
    originalProfile: new Float32Array(64).fill(0.05),
    profile: new Float32Array(64).fill(0.05),
    tearout: new Float32Array(64),
  };
}

function makeRun(overrides: Partial<LessonRunState> = {}): LessonRunState {
  return {
    totalMaterialRemoved: 0,
    catchCount: 0,
    maxTearout: 0,
    elapsed: 0,
    ...overrides,
  };
}

describe('evaluateLesson', () => {
  it('returns null when criteria not yet met', () => {
    const run = makeRun({ totalMaterialRemoved: 0.1 }); // below minMaterialRemoved
    const result = evaluateLesson(minimalLesson, run, makeWoodState());
    expect(result).toBeNull();
  });

  it('returns passed EvalResult when material threshold reached with acceptable catches/tearout', () => {
    const run = makeRun({
      totalMaterialRemoved: 0.31,
      catchCount: 1, // within catchesTolerance (2)
      maxTearout: 0.1, // below maxTearout (0.2)
    });
    const result = evaluateLesson(minimalLesson, run, makeWoodState());
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(true);
    expect(result?.reason).toBe('Clean cylinder — bevel contact mastered!');
  });

  it('returns failed EvalResult when catch tolerance exceeded and noCatches is true', () => {
    const strictLesson: CurriculumLesson = {
      ...minimalLesson,
      successCriteria: {
        ...minimalLesson.successCriteria,
        noCatches: true,
        catchesTolerance: 0,
      },
    };
    const run = makeRun({ catchCount: 1 }); // exceeds tolerance of 0
    const result = evaluateLesson(strictLesson, run, makeWoodState());
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(false);
    expect(result?.reason).toBe('Too many catches — focus on bevel contact.');
  });

  it('returns null when material removed exactly at threshold boundary (not yet passed)', () => {
    const run = makeRun({ totalMaterialRemoved: 0.29 });
    expect(evaluateLesson(minimalLesson, run, makeWoodState())).toBeNull();
  });

  it('uses fallback reason when no complete cue exists', () => {
    const noCompleteCue: CurriculumLesson = {
      ...minimalLesson,
      coachingCues: [],
    };
    const run = makeRun({ totalMaterialRemoved: 0.31 });
    const result = evaluateLesson(noCompleteCue, run, makeWoodState());
    expect(result?.passed).toBe(true);
    expect(result?.reason).toBe('Lesson complete!');
  });
});
