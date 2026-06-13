import { z } from 'zod';

export const SCHEMA_VERSION = 1;

export const LessonProgressSchema = z.object({
  lessonId: z.string(),
  completedAt: z.number().nullable(),
  bestScore: z.number().min(0).max(1),
});

export const SessionRecordSchema = z.object({
  schemaVersion: z.literal(1),
  lastOpenedAt: z.number(),
  lessons: z.array(LessonProgressSchema),
});

export type LessonProgress = z.infer<typeof LessonProgressSchema>;
export type SessionRecord = z.infer<typeof SessionRecordSchema>;
