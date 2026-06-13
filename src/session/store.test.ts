import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurriculum, isLessonUnlocked, type CurriculumLesson } from './curriculum.js';
import { useSessionStore } from './store.js';

vi.mock('./db.js', () => ({
  loadSession: vi.fn().mockResolvedValue(null),
  saveSession: vi.fn().mockResolvedValue(undefined),
  emptySession: () => ({
    schemaVersion: 1 as const,
    lastOpenedAt: 0,
    lessons: [],
  }),
}));

beforeEach(() => {
  useSessionStore.setState({
    record: { schemaVersion: 1, lastOpenedAt: 0, lessons: [] },
    activeLessonId: null,
  });
});

const fakeLessonOrder2: CurriculumLesson = {
  id: 'lesson-02-fake',
  title: 'Fake lesson 2',
  tool: 'spindle-gouge',
  order: 2,
  brief: '',
  successCriteria: { minMaterialRemoved: 0.3, maxTearout: 0.2, noCatches: false, catchesTolerance: 2 },
  coachingCues: [],
};

describe('getCurriculum', () => {
  it('returns at least 1 lesson', () => {
    const lessons = getCurriculum();
    expect(lessons.length).toBeGreaterThanOrEqual(1);
  });

  it('returns lessons sorted by order', () => {
    const lessons = getCurriculum();
    for (let i = 1; i < lessons.length; i++) {
      const prev = lessons[i - 1];
      const curr = lessons[i];
      if (prev != null && curr != null) {
        expect(curr.order).toBeGreaterThan(prev.order);
      }
    }
  });
});

describe('isLessonUnlocked', () => {
  it('returns true for order-1 lesson with empty completedIds', () => {
    const lessons = getCurriculum();
    const first = lessons.find((l) => l.order === 1);
    if (first == null) throw new Error('No order-1 lesson found');
    expect(isLessonUnlocked(first, new Set())).toBe(true);
  });

  it('returns false for order-2 lesson with empty completedIds', () => {
    expect(isLessonUnlocked(fakeLessonOrder2, new Set())).toBe(false);
  });

  it('returns true for order-2 lesson when prerequisites completed', () => {
    const lessons = getCurriculum();
    const first = lessons[0];
    if (first == null) throw new Error('No lessons in curriculum');
    expect(isLessonUnlocked(fakeLessonOrder2, new Set([first.id]))).toBe(true);
  });
});

describe('completeLesson', () => {
  it('updates the record with completed lesson', async () => {
    const { completeLesson } = useSessionStore.getState();
    await completeLesson('lesson-01-roughing', 0.85);
    const { record } = useSessionStore.getState();
    const progress = record.lessons.find((l) => l.lessonId === 'lesson-01-roughing');
    if (progress == null) throw new Error('Progress not found');
    expect(progress.bestScore).toBe(0.85);
    expect(progress.completedAt).not.toBeNull();
  });

  it('keeps bestScore as maximum when completing again with lower score', async () => {
    const { completeLesson } = useSessionStore.getState();
    await completeLesson('lesson-01-roughing', 0.9);
    await completeLesson('lesson-01-roughing', 0.5);
    const { record } = useSessionStore.getState();
    const progress = record.lessons.find((l) => l.lessonId === 'lesson-01-roughing');
    if (progress == null) throw new Error('Progress not found');
    expect(progress.bestScore).toBe(0.9);
  });

  it('calls saveSession', async () => {
    const { saveSession } = await import('./db.js');
    const { completeLesson } = useSessionStore.getState();
    await completeLesson('lesson-01-roughing', 0.75);
    expect(saveSession).toHaveBeenCalled();
  });
});
