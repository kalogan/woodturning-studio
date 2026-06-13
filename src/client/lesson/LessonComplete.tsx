import type { EvalResult } from './LessonEvaluator.js';

interface LessonCompleteProps {
  result: EvalResult;
  lessonTitle: string;
  onContinue: () => void;
}

export function LessonComplete({ result, lessonTitle, onContinue }: LessonCompleteProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        background: 'rgba(26, 26, 26, 0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      {/* Icon */}
      <div
        style={{
          fontSize: 72,
          lineHeight: 1,
          color: result.passed ? '#c8873a' : '#cc4444',
        }}
      >
        {result.passed ? '✓' : '✗'}
      </div>

      {/* Lesson title */}
      <div
        style={{
          color: '#c8873a',
          fontFamily: 'sans-serif',
          fontSize: 14,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          opacity: 0.8,
        }}
      >
        {lessonTitle}
      </div>

      {/* Reason / coaching message */}
      <div
        style={{
          color: '#e0e0e0',
          fontFamily: 'sans-serif',
          fontSize: 22,
          fontWeight: 500,
          textAlign: 'center',
          maxWidth: 480,
          lineHeight: 1.45,
          padding: '0 24px',
        }}
      >
        {result.reason}
      </div>

      {/* Continue button */}
      <button
        onClick={onContinue}
        style={{
          marginTop: 8,
          padding: '12px 36px',
          background: '#c8873a',
          color: '#1a1a1a',
          border: 'none',
          borderRadius: 6,
          fontFamily: 'sans-serif',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.04em',
        }}
      >
        Continue →
      </button>
    </div>
  );
}
