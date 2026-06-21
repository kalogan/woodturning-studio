import { describe, it, expect } from 'vitest';
import {
  retrieve,
  tokenize,
  CONFIDENCE_THRESHOLD,
  type RetrievalResult,
} from './retrieval.js';
import { getKnowledgeBase } from './knowledgeBase.js';
import type { KbEntry } from './schema.js';

const KB = getKnowledgeBase();

function top(query: string): RetrievalResult {
  const r = retrieve(query, KB);
  expect(r).not.toBeNull();
  // narrow for the type-checker
  if (r === null) throw new Error('expected a result');
  return r;
}

describe('tokenize', () => {
  it('lowercases, strips punctuation and drops stopwords', () => {
    expect(tokenize('How do I sharpen a BOWL gouge?')).toEqual([
      'sharpen',
      'bowl',
      'gouge',
    ]);
  });

  it('drops single-character tokens', () => {
    expect(tokenize('a b cd ef')).toEqual(['cd', 'ef']);
  });

  it('returns an empty array for all-stopword input', () => {
    expect(tokenize('what is the')).toEqual([]);
  });
});

describe('retrieve — representative queries map to the right entry', () => {
  const cases: Array<{ query: string; expectedId: string }> = [
    { query: 'what bevel angle for a bowl gouge', expectedId: 'sharpening-bowl-gouge-angle' },
    { query: 'can I wear gloves at the lathe', expectedId: 'safety-no-gloves-loose-clothing' },
    { query: 'what rpm should I turn a big bowl at', expectedId: 'speed-large-unbalanced' },
    { query: 'how do I stop blanks cracking when drying', expectedId: 'wood-sealing-endgrain' },
    { query: 'what is a parting tool for', expectedId: 'tool-parting-tool' },
    { query: 'how do I get a food safe finish on a bowl', expectedId: 'finishing-food-safe' },
    { query: 'when should I use a scroll chuck', expectedId: 'workholding-scroll-chuck' },
    { query: 'what does riding the bevel mean', expectedId: 'technique-riding-the-bevel' },
  ];

  for (const { query, expectedId } of cases) {
    it(`"${query}" -> ${expectedId} above threshold`, () => {
      const r = top(query);
      expect(r.entry.id).toBe(expectedId);
      expect(r.score).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });
  }
});

describe('retrieve — paraphrases still match', () => {
  it('"my tool keeps digging in" finds catch help', () => {
    const r = top('my tool keeps digging in suddenly');
    expect(['trouble-catch-what-is', 'trouble-catch-fix']).toContain(r.entry.id);
    expect(r.score).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });

  it('"why do I keep getting catches" finds catch help', () => {
    const r = top('why do I keep getting catches');
    expect(['trouble-catch-what-is', 'trouble-catch-fix']).toContain(r.entry.id);
    expect(r.score).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });

  it('"surface is fuzzy and torn" finds tearout help', () => {
    const r = top('the surface is fuzzy and torn');
    expect(r.entry.id).toBe('trouble-tearout');
    expect(r.score).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });

  it('"how fast should the lathe spin" finds a speed entry', () => {
    const r = top('how fast should the lathe spin');
    expect(r.entry.topic).toBe('speed');
    expect(r.score).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });
});

describe('retrieve — off-topic queries fall below threshold', () => {
  const nonsense = [
    'how do I bake a chocolate cake',
    'what time does the train leave',
    'asdf qwerty zxcv plumbing invoice',
  ];

  for (const query of nonsense) {
    it(`"${query}" scores below threshold`, () => {
      const r = top(query);
      expect(r.score).toBeLessThan(CONFIDENCE_THRESHOLD);
    });
  }
});

describe('retrieve — contract & determinism', () => {
  it('returns null when there are no entries', () => {
    expect(retrieve('anything', [])).toBeNull();
  });

  it('always returns a top match with a score in [0, 1]', () => {
    const r = top('bevel');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it('is deterministic — same query yields the same result twice', () => {
    const a = retrieve('what angle to sharpen a skew', KB);
    const b = retrieve('what angle to sharpen a skew', KB);
    expect(a?.entry.id).toBe(b?.entry.id);
    expect(a?.score).toBe(b?.score);
  });

  it('an exact keyword phrase scores very high', () => {
    const entry: KbEntry = {
      id: 'test-entry',
      topic: 'tools',
      question: 'placeholder',
      keywords: ['skew chisel planing cut'],
      answer: 'placeholder answer',
    };
    const r = retrieve('skew chisel planing cut', [entry]);
    expect(r?.score).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
  });
});
