import { describe, it, expect } from 'vitest';
import { getKnowledgeBase, getKbEntryById } from './knowledgeBase.js';
import { KbEntrySchema, KB_TOPICS } from './schema.js';

describe('knowledge base loading', () => {
  const kb = getKnowledgeBase();

  it('loads a substantial number of entries (50+)', () => {
    expect(kb.length).toBeGreaterThanOrEqual(50);
  });

  it('every entry passes the Zod schema', () => {
    for (const entry of kb) {
      expect(KbEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it('all entry ids are unique', () => {
    const ids = kb.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every declared topic', () => {
    const topics = new Set(kb.map((e) => e.topic));
    for (const t of KB_TOPICS) {
      expect(topics.has(t)).toBe(true);
    }
  });

  it('every entry has at least one keyword and a non-empty answer', () => {
    for (const entry of kb) {
      expect(entry.keywords.length).toBeGreaterThan(0);
      expect(entry.answer.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('getKbEntryById', () => {
  it('returns the matching entry for a known id', () => {
    const entry = getKbEntryById('safety-no-gloves-loose-clothing');
    expect(entry).toBeDefined();
    expect(entry?.topic).toBe('safety');
  });

  it('returns undefined for an unknown id', () => {
    expect(getKbEntryById('does-not-exist')).toBeUndefined();
    expect(getKbEntryById('')).toBeUndefined();
  });
});
