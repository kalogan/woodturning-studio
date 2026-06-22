import { describe, it, expect, vi } from 'vitest';
import { sendChat, ChatClientError } from './chatClient.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('sendChat', () => {
  it('returns the reply text on a 200', async () => {
    const fetchImpl = vi.fn(async () =>
      Promise.resolve(jsonResponse({ reply: 'Use a 40/40 grind.' })),
    ) as unknown as typeof fetch;

    const reply = await sendChat([{ role: 'user', content: 'grind?' }], { fetchImpl });
    expect(reply).toBe('Use a 40/40 grind.');
  });

  it('POSTs to /api/chat with the conversation and optional context', async () => {
    const fetchImpl = vi.fn(async () =>
      Promise.resolve(jsonResponse({ reply: 'ok' })),
    ) as unknown as typeof fetch;

    await sendChat([{ role: 'user', content: 'q' }], {
      fetchImpl,
      context: 'curated note',
    });

    const mock = fetchImpl as unknown as ReturnType<typeof vi.fn>;
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/chat');
    expect(init.method).toBe('POST');
    const sent = JSON.parse(init.body as string) as {
      messages: unknown[];
      context?: string;
    };
    expect(sent.messages).toHaveLength(1);
    expect(sent.context).toBe('curated note');
  });

  it('throws no_key on a 503', async () => {
    const fetchImpl = vi.fn(async () =>
      Promise.resolve(jsonResponse({ error: 'no_key' }, 503)),
    ) as unknown as typeof fetch;

    await expect(
      sendChat([{ role: 'user', content: 'q' }], { fetchImpl }),
    ).rejects.toMatchObject({ kind: 'no_key' });
  });

  it('throws llm_failed on a 500', async () => {
    const fetchImpl = vi.fn(async () =>
      Promise.resolve(jsonResponse({ error: 'llm_failed' }, 500)),
    ) as unknown as typeof fetch;

    await expect(
      sendChat([{ role: 'user', content: 'q' }], { fetchImpl }),
    ).rejects.toMatchObject({ kind: 'llm_failed' });
  });

  it('throws network when fetch rejects', async () => {
    const fetchImpl = vi.fn(async () =>
      Promise.reject(new Error('offline')),
    ) as unknown as typeof fetch;

    const err = await sendChat([{ role: 'user', content: 'q' }], { fetchImpl }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ChatClientError);
    expect((err as ChatClientError).kind).toBe('network');
  });

  it('throws bad_response when reply is missing or empty', async () => {
    const fetchImpl = vi.fn(async () =>
      Promise.resolve(jsonResponse({ reply: '   ' })),
    ) as unknown as typeof fetch;

    await expect(
      sendChat([{ role: 'user', content: 'q' }], { fetchImpl }),
    ).rejects.toMatchObject({ kind: 'bad_response' });
  });
});
