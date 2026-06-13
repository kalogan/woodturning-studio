import lesson01 from '../../content/curriculum/lesson-01-roughing.json';
import lesson02 from '../../content/curriculum/lesson-02-spindle.json';
import lesson03 from '../../content/curriculum/lesson-03-parting.json';
import lesson04 from '../../content/curriculum/lesson-04-beads.json';

export interface CurriculumLesson {
  id: string;
  title: string;
  tool: 'roughing-gouge' | 'spindle-gouge' | 'parting-tool';
  order: number;
  brief: string;
  successCriteria: {
    minMaterialRemoved: number;
    maxTearout: number;
    noCatches: boolean;
    catchesTolerance: number;
  };
  coachingCues: Array<{ trigger: string; message: string }>;
}

const ALL_LESSONS: CurriculumLesson[] = [
  lesson01 as CurriculumLesson,
  lesson02 as CurriculumLesson,
  lesson03 as CurriculumLesson,
  lesson04 as CurriculumLesson,
];

export function getCurriculum(): CurriculumLesson[] {
  return [...ALL_LESSONS].sort((a, b) => a.order - b.order);
}

export function isLessonUnlocked(
  lesson: CurriculumLesson,
  completedIds: Set<string>,
): boolean {
  if (lesson.order === 1) return true;
  const curriculum = getCurriculum();
  const prerequisites = curriculum.filter((l) => l.order < lesson.order);
  return prerequisites.every((l) => completedIds.has(l.id));
}
