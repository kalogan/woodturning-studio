import { z } from 'zod';

/**
 * The set of topics the instructor knowledge base covers. Kept in one place so
 * the Zod schema (content lint) and the typed loader stay in lock-step.
 */
export const KB_TOPICS = [
  'tools',
  'sharpening',
  'technique',
  'wood',
  'speed',
  'safety',
  'workholding',
  'finishing',
  'troubleshooting',
] as const;

export type KbTopic = (typeof KB_TOPICS)[number];

/** Zod schema for a single knowledge-base entry. */
export const KbEntrySchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must be kebab-case'),
  topic: z.enum(KB_TOPICS),
  question: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  answer: z.string().min(1),
});

/** A file in content/instructor is an array of entries. */
export const KbFileSchema = z.array(KbEntrySchema).min(1);

export type KbEntry = z.infer<typeof KbEntrySchema>;
