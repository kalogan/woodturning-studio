/**
 * api/chat.ts — Vercel serverless function for the live instructor LLM fallback.
 *
 * SERVER ONLY. This file lives in the repo-root `api/` directory which Vercel
 * auto-detects as a serverless function. It is NOT part of the client Vite
 * bundle and must NEVER be imported by client code: it is the only place the
 * Anthropic SDK and the ANTHROPIC_API_KEY are referenced. The client reaches it
 * exclusively via `fetch('/api/chat')`.
 *
 * It is excluded from the client tsconfig (`include: ["src", "content"]`) and
 * from the lint step (`eslint src` / `depcruise src`), so the client gate is
 * unaffected. Vercel typechecks + builds this file at deploy time using the
 * self-contained `api/tsconfig.json`.
 *
 * Uses a Web-standard NAMED HTTP-method export (`export function POST(req)`),
 * which Vercel recognizes as a fetch-style handler returning a `Response` — so no
 * `@vercel/node` dependency. (A `export default (req) => Response` is instead
 * treated as the Node `(req, res)` signature: the returned Response is ignored and
 * the function hangs to a 300s timeout. Named-method exports avoid that.)
 */
import Anthropic from '@anthropic-ai/sdk';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  context?: string;
}

const SYSTEM_PROMPT = [
  'You are a master woodturner and turning instructor at a friendly community',
  'woodworking studio. You coach beginners and intermediate turners at the lathe.',
  '',
  'Voice: warm, encouraging, plain-spoken, and concise — answer in 2 to 5',
  'sentences unless the turner explicitly asks for more depth. Be accurate and',
  'practical, the way an experienced mentor talks across the bench.',
  '',
  'SAFETY FIRST: woodturning involves a spinning lathe, sharp tools, and dust.',
  'When a question touches speed, mounting, tool presentation, or anything that',
  'could hurt someone, lead with the safe practice. Never give advice that would',
  'put the turner at risk.',
  '',
  'Stay on woodturning and woodworking. If asked about something unrelated,',
  'gently redirect back to the lathe and the craft. If you are not sure about a',
  'specific number or claim, say so plainly rather than inventing details — it is',
  'better to admit uncertainty than to mislead a student at a spinning machine.',
].join('\n');

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.role === 'user' || v.role === 'assistant') &&
    typeof v.content === 'string'
  );
}

function parseBody(body: unknown): ChatRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages) || b.messages.length === 0) return null;
  if (!b.messages.every(isChatMessage)) return null;
  const context = typeof b.context === 'string' ? b.context : undefined;
  return context === undefined
    ? { messages: b.messages as ChatMessage[] }
    : { messages: b.messages as ChatMessage[], context };
}

export async function POST(req: Request): Promise<Response> {
  // Graceful degrade: without a key the live instructor simply isn't connected,
  // so the client falls back to its local knowledge base.
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'no_key' }, 503);
  }

  let parsed: ChatRequest | null;
  try {
    parsed = parseBody(await req.json());
  } catch {
    parsed = null;
  }
  if (parsed === null) {
    return json({ error: 'bad_request' }, 400);
  }

  const system =
    parsed.context !== undefined && parsed.context.trim() !== ''
      ? `${SYSTEM_PROMPT}\n\nUse the following note from the studio's curated handbook as authoritative grounding for your answer, and expand on it naturally in your own voice:\n\n${parsed.context}`
      : SYSTEM_PROMPT;

  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: parsed.messages,
    });

    const text = resp.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return json({ reply: text }, 200);
  } catch {
    // Never leak the raw error or the key.
    return json({ error: 'llm_failed' }, 500);
  }
}
