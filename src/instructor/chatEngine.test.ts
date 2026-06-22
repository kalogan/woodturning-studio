import { describe, it, expect, vi } from 'vitest';
import {
  answerQuestion,
  FALLBACK_NOTE,
  NO_MATCH_FALLBACK,
} from './chatEngine.js';
import { ChatClientError } from './chatClient.js';
import { getKnowledgeBase } from './knowledgeBase.js';
import { retrieve, CONFIDENCE_THRESHOLD } from './retrieval.js';

const KB = getKnowledgeBase();

// A question that confidently hits the KB (>= threshold) and one that does not
// (off-topic gibberish), verified against the real retriever so the test stays
// honest if the KB or threshold changes.
const CONFIDENT_Q = 'How do I sharpen a bowl gouge?';
const OFFTOPIC_Q = 'zzqq xylophone quantum teapot';

describe('answerQuestion — hybrid decision flow', () => {
  it('precondition: the fixtures straddle the confidence threshold', () => {
    const hit = retrieve(CONFIDENT_Q, KB);
    expect(hit).not.toBeNull();
    expect(hit?.score ?? 0).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);

    const miss = retrieve(OFFTOPIC_Q, KB);
    // Off-topic should score below threshold (it may still return a top entry).
    expect((miss?.score ?? 0)).toBeLessThan(CONFIDENCE_THRESHOLD);
  });

  it('answers from the KB instantly when the match is confident (no network)', async () => {
    const sendChatImpl = vi.fn();
    const answer = await answerQuestion(
      CONFIDENT_Q,
      [{ role: 'user', content: CONFIDENT_Q }],
      { sendChatImpl: sendChatImpl as never },
    );
    expect(answer.source).toBe('kb');
    expect(sendChatImpl).not.toHaveBeenCalled();
    expect(answer.content.length).toBeGreaterThan(0);
  });

  it('falls back to the LLM when below threshold, grounding it with the best match', async () => {
    const sendChatImpl = vi.fn(async () => Promise.resolve('A live, expanded answer.'));
    // Use a partial/weak query that still has a best match but scores low.
    const weakQ = 'tell me a bit more about wood';
    const answer = await answerQuestion(
      weakQ,
      [{ role: 'user', content: weakQ }],
      { sendChatImpl },
    );
    expect(answer.source).toBe('instructor');
    expect(answer.content).toBe('A live, expanded answer.');
    expect(sendChatImpl).toHaveBeenCalledTimes(1);
    // Context (the best KB answer) should have been passed for grounding.
    const opts = (sendChatImpl.mock.calls[0] as unknown[])[1] as { context?: string };
    expect(typeof opts.context).toBe('string');
  });

  it('degrades to the best KB note when the LLM endpoint has no key', async () => {
    const sendChatImpl = vi.fn(async () =>
      Promise.reject(new ChatClientError('no_key')),
    );
    const weakQ = 'tell me a bit more about wood';
    const answer = await answerQuestion(
      weakQ,
      [{ role: 'user', content: weakQ }],
      { sendChatImpl },
    );
    expect(answer.source).toBe('kb-fallback');
    expect(answer.content.startsWith(FALLBACK_NOTE)).toBe(true);
  });

  it('degrades to a kb-fallback note on a network failure', async () => {
    const sendChatImpl = vi.fn(async () =>
      Promise.reject(new ChatClientError('network')),
    );
    // Off-topic still resolves to a (weak) best match, so the network failure
    // degrades to the noted fallback rather than the bare no-match steer.
    const answer = await answerQuestion(
      OFFTOPIC_Q,
      [{ role: 'user', content: OFFTOPIC_Q }],
      { sendChatImpl },
    );
    // Off-topic still has a (weak) best match, so we expect the noted fallback.
    expect(answer.source).toBe('kb-fallback');
    expect(
      answer.content.startsWith(FALLBACK_NOTE) ||
        answer.content === NO_MATCH_FALLBACK,
    ).toBe(true);
  });
});
