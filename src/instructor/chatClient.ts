/**
 * chatClient.ts — the client-side bridge to the live instructor LLM endpoint.
 *
 * This is the ONLY thing that talks to `/api/chat`. It never imports the
 * Anthropic SDK and never sees the API key — the serverless function (api/chat.ts)
 * owns both. On any non-200 response or network failure it throws a typed
 * ChatClientError so the InstructorChat component can decide how to fall back to
 * the local knowledge base.
 *
 * No Date.now / Math.random — nothing here runs in a render tick.
 */

export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

/** Why a live-instructor request failed, so callers can branch on it. */
export type ChatErrorKind =
  | 'no_key' // 503 — endpoint up but no ANTHROPIC_API_KEY configured
  | 'llm_failed' // 500 — the model call itself errored server-side
  | 'bad_response' // 2xx but malformed / missing reply
  | 'network'; // fetch rejected, offline, or unexpected status

export class ChatClientError extends Error {
  readonly kind: ChatErrorKind;
  constructor(kind: ChatErrorKind, message?: string) {
    super(message ?? kind);
    this.name = 'ChatClientError';
    this.kind = kind;
  }
}

export interface SendChatOptions {
  /** The closest curated KB answer, passed to ground the model when available. */
  context?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface ChatReplyBody {
  reply?: unknown;
}

/**
 * POSTs the conversation to `/api/chat` and resolves the instructor's reply.
 * Throws ChatClientError on 503 (no key), 500 (llm_failed), a malformed body,
 * or any network/transport failure.
 */
export async function sendChat(
  messages: ChatTurn[],
  options: SendChatOptions = {},
): Promise<string> {
  const doFetch = options.fetchImpl ?? fetch;

  const payload: { messages: ChatTurn[]; context?: string } =
    options.context !== undefined
      ? { messages, context: options.context }
      : { messages };

  let res: Response;
  try {
    res = await doFetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ChatClientError('network', 'request failed to reach /api/chat');
  }

  if (res.status === 503) {
    throw new ChatClientError('no_key', 'live instructor is not connected');
  }
  if (!res.ok) {
    throw new ChatClientError('llm_failed', `endpoint returned ${String(res.status)}`);
  }

  let body: ChatReplyBody;
  try {
    body = (await res.json()) as ChatReplyBody;
  } catch {
    throw new ChatClientError('bad_response', 'reply was not valid JSON');
  }

  if (typeof body.reply !== 'string' || body.reply.trim() === '') {
    throw new ChatClientError('bad_response', 'reply was missing or empty');
  }

  return body.reply;
}
