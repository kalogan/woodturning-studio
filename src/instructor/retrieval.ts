import type { KbEntry } from './schema.js';

/**
 * Pure, deterministic keyword retrieval over the instructor knowledge base.
 *
 * No Date.now / Math.random, no browser APIs — given the same query and the
 * same entries it always returns the same result. The caller compares the
 * returned `score` against CONFIDENCE_THRESHOLD to decide whether to answer
 * locally or fall back to the (separate) LLM slice.
 */

export interface RetrievalResult {
  entry: KbEntry;
  /** Normalized confidence in [0, 1]. */
  score: number;
}

/**
 * Suggested cut-off: at or above this, the local answer is trustworthy enough
 * to show directly; below it, the caller should fall back.
 */
export const CONFIDENCE_THRESHOLD = 0.34;

// Common English + domain filler words that carry no retrieval signal.
const STOPWORDS = new Set<string>([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'could',
  'do', 'does', 'doing', 'done', 'for', 'from', 'get', 'getting', 'got',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'my', 'of', 'on',
  'or', 'should', 'so', 'some', 'than', 'that', 'the', 'their', 'them', 'then',
  'there', 'they', 'this', 'to', 'use', 'used', 'using', 'very', 'was', 'what',
  'when', 'where', 'which', 'while', 'who', 'why', 'will', 'with', 'would',
  'you', 'your', 'about', 'am', 'been', 'being', 'have', 'has', 'had', 'just',
  'much', 'need', 'want', 'whats',
]);

// Field weights — keyword and question matches are the strongest signal,
// the answer body is a weak tie-breaker.
const WEIGHT_KEYWORD = 3;
const WEIGHT_QUESTION = 2;
const WEIGHT_ANSWER = 0.5;

/**
 * Lowercase, strip punctuation, split on whitespace, drop stopwords and
 * single-character tokens. Returns the meaningful tokens of a string.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Builds the de-duplicated token set for a single entry's searchable text. */
function entryTokens(entry: KbEntry): {
  keyword: Set<string>;
  question: Set<string>;
  answer: Set<string>;
} {
  const keyword = new Set<string>();
  for (const kw of entry.keywords) {
    for (const t of tokenize(kw)) keyword.add(t);
  }
  const question = new Set<string>(tokenize(entry.question));
  const answer = new Set<string>(tokenize(entry.answer));
  return { keyword, question, answer };
}

/**
 * Scores one entry against the already-tokenized query. Each unique query
 * token contributes at most once per field (using the highest-weight field it
 * appears in), so longer answers cannot win by sheer word count. The raw score
 * is normalized by the maximum achievable score for this query (every token
 * hitting a keyword), giving a value in [0, 1].
 */
function scoreEntry(queryTokens: string[], entry: KbEntry): number {
  if (queryTokens.length === 0) return 0;

  const { keyword, question, answer } = entryTokens(entry);
  // De-dup query tokens so a repeated word does not double-count.
  const uniqueQuery = new Set(queryTokens);

  let raw = 0;
  for (const token of uniqueQuery) {
    if (keyword.has(token)) raw += WEIGHT_KEYWORD;
    else if (question.has(token)) raw += WEIGHT_QUESTION;
    else if (answer.has(token)) raw += WEIGHT_ANSWER;
  }

  // Best possible: every unique query token landing on a keyword.
  const maxPossible = uniqueQuery.size * WEIGHT_KEYWORD;
  return maxPossible === 0 ? 0 : raw / maxPossible;
}

/**
 * Returns the single best-matching entry for `query` along with a normalized
 * confidence score in [0, 1], or null when there are no entries to search.
 *
 * The top match is always returned (with its score); deciding whether the
 * match is good enough is the caller's job via CONFIDENCE_THRESHOLD.
 */
export function retrieve(
  query: string,
  entries: KbEntry[],
): RetrievalResult | null {
  if (entries.length === 0) return null;

  const queryTokens = tokenize(query);

  let best: KbEntry | undefined;
  let bestScore = -1;
  for (const entry of entries) {
    const score = scoreEntry(queryTokens, entry);
    // Strictly-greater keeps the first entry on ties → deterministic ordering.
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (best === undefined) return null;
  return { entry: best, score: Math.max(0, bestScore) };
}
