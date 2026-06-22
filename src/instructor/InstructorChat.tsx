/**
 * InstructorChat.tsx — the reusable hybrid instructor chat panel.
 *
 * Used by the preview harness's "Instructor" tab today, and by the in-game NPC
 * later. It owns a conversation, runs each question through the KB-first →
 * LLM → graceful-fallback flow (chatEngine.answerQuestion), and renders the
 * thread with a per-message source badge so a tester can see at a glance whether
 * an answer came from the local knowledge base or the live instructor.
 *
 * Pure React + DOM — no Three.js, no Anthropic SDK, no API key. The only network
 * touch is via chatEngine → chatClient → fetch('/api/chat').
 */
import { useCallback, useRef, useState } from 'react';
import { answerQuestion, type AnswerSource } from './chatEngine.js';
import type { ChatTurn } from './chatClient.js';

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Where an assistant message came from; undefined for user turns. */
  source?: AnswerSource;
}

const EXAMPLE_QUESTIONS = [
  'How do I sharpen a bowl gouge?',
  'What speed should I rough out a bowl at?',
  "What's a catch and how do I avoid it?",
  'How do I mount a blank safely?',
] as const;

const SOURCE_LABEL: Record<AnswerSource, string> = {
  kb: 'Knowledge base',
  instructor: 'Live instructor',
  'kb-fallback': 'Notes (offline)',
};

export function InstructorChat(): React.JSX.Element {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = useCallback(() => {
    const el = logRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, []);

  const submit = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (question === '' || busy) return;

      setDraft('');
      setBusy(true);

      // Build the conversation to send: prior turns + this question.
      const userTurn: DisplayMessage = { role: 'user', content: question };
      const priorTurns: ChatTurn[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const conversation: ChatTurn[] = [
        ...priorTurns,
        { role: 'user', content: question },
      ];

      setMessages((prev) => [...prev, userTurn]);
      requestAnimationFrame(scrollToEnd);

      const answer = await answerQuestion(question, conversation);

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: answer.content, source: answer.source },
      ]);
      setBusy(false);
      requestAnimationFrame(scrollToEnd);
    },
    [busy, messages, scrollToEnd],
  );

  const onSubmit = useCallback(
    (e: React.SyntheticEvent) => {
      e.preventDefault();
      void submit(draft);
    },
    [draft, submit],
  );

  return (
    <div className="chat" data-testid="instructor-chat">
      <div className="chat__intro">
        <div className="chat__intro-title">Studio Instructor</div>
        <div className="chat__intro-note">
          Ask the demo-station instructor about tools, sharpening, technique, wood,
          speed, or safety. Answers come from the local knowledge base first, with a
          live instructor for everything else.
        </div>
      </div>

      <div className="chat__log" data-testid="chat-log" ref={logRef}>
        {messages.length === 0 && (
          <div className="chat__empty">No questions yet — try one below.</div>
        )}
        {messages.map((m, i) => (
          <div
            // Index key is safe: messages are append-only and never reordered.
            key={i}
            className={`chat__msg chat__msg--${m.role}`}
            data-testid="chat-message"
            data-role={m.role}
            data-source={m.source ?? ''}
          >
            <div className="chat__bubble">{m.content}</div>
            {m.role === 'assistant' && m.source !== undefined && (
              <span className={`chat__badge chat__badge--${m.source}`}>
                {SOURCE_LABEL[m.source]}
              </span>
            )}
          </div>
        ))}
        {busy && (
          <div className="chat__msg chat__msg--assistant" data-testid="chat-thinking">
            <div className="chat__bubble chat__bubble--thinking">Thinking…</div>
          </div>
        )}
      </div>

      <div className="chat__chips">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            className="chat__chip"
            data-testid="chat-chip"
            disabled={busy}
            onClick={() => void submit(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <form className="chat__form" onSubmit={onSubmit}>
        <input
          type="text"
          className="chat__input"
          data-testid="chat-input"
          placeholder="Ask the instructor…"
          value={draft}
          disabled={busy}
          onChange={(e) => { setDraft(e.target.value); }}
        />
        <button
          type="submit"
          className="chat__send"
          data-testid="chat-send"
          disabled={busy || draft.trim() === ''}
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
