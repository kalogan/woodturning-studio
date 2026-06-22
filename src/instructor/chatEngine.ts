/**
 * chatEngine.ts — the pure hybrid decision flow shared by the chat UI and the
 * (future) in-game NPC. Given a question, it decides where the answer comes from:
 *
 *   1. KB-first:  retrieve() over the local knowledge base. If the top match
 *                 scores >= CONFIDENCE_THRESHOLD, answer instantly from the KB
 *                 (free, offline, no network). source = 'kb'.
 *   2. LLM:       otherwise POST the conversation to /api/chat, grounding the
 *                 model with the best match's answer (even below threshold) so a
 *                 weak-but-relevant note still steers it. source = 'instructor'.
 *   3. Fallback:  if the LLM endpoint has no key (503) or the network fails,
 *                 degrade to the best KB match's answer with a friendly note;
 *                 if there is NO match at all, a graceful "not sure" steer.
 *                 source = 'kb-fallback'.
 *
 * This module is UI-agnostic and allocation-light; it does no rendering and
 * calls neither Date.now nor Math.random.
 */
import { getKnowledgeBase } from './knowledgeBase.js';
import { retrieve, CONFIDENCE_THRESHOLD } from './retrieval.js';
import { sendChat, ChatClientError, type ChatTurn } from './chatClient.js';

export type AnswerSource = 'kb' | 'instructor' | 'kb-fallback';

export interface ChatAnswer {
  content: string;
  source: AnswerSource;
}

/** Prefix shown when we degrade to the KB because the live instructor is down. */
export const FALLBACK_NOTE =
  "The live instructor isn't connected right now, but here's the closest thing in my notes:";

/** Shown when nothing in the KB is even close and the LLM is unavailable. */
export const NO_MATCH_FALLBACK =
  "I'm not sure about that one — try asking about tools, sharpening, technique, wood, or safety.";

export interface AnswerDeps {
  /** Injectable for tests; defaults to the real sendChat. */
  sendChatImpl?: typeof sendChat;
}

/**
 * Resolve one user turn into an answer, following the KB-first → LLM →
 * graceful-fallback flow described above.
 *
 * @param question     the latest user question (used for retrieval)
 * @param conversation the full conversation so far INCLUDING this question,
 *                     forwarded to the LLM so it has context
 */
export async function answerQuestion(
  question: string,
  conversation: ChatTurn[],
  deps: AnswerDeps = {},
): Promise<ChatAnswer> {
  const send = deps.sendChatImpl ?? sendChat;
  const match = retrieve(question, getKnowledgeBase());

  // 1. KB-first — confident local hit wins outright.
  if (match !== null && match.score >= CONFIDENCE_THRESHOLD) {
    return { content: match.entry.answer, source: 'kb' };
  }

  // 2. LLM fallback — ground it with the best (sub-threshold) match if any.
  try {
    const context = match !== null ? match.entry.answer : undefined;
    const reply = await send(conversation, context === undefined ? {} : { context });
    return { content: reply, source: 'instructor' };
  } catch (err) {
    // 3. Graceful degrade — endpoint down / no key / network error.
    void (err instanceof ChatClientError); // typed, but we treat all the same here
    if (match !== null) {
      return {
        content: `${FALLBACK_NOTE}\n\n${match.entry.answer}`,
        source: 'kb-fallback',
      };
    }
    return { content: NO_MATCH_FALLBACK, source: 'kb-fallback' };
  }
}
