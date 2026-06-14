import React, { useEffect } from 'react';
import { getCurriculum, isLessonUnlocked } from '../../session/index.js';
import { useSessionStore } from '../../session/index.js';
import { getLatheSetup } from '../../session/setup.js';

export interface LessonSelectProps {
  onStart: (lessonId: string) => void;
  /** Lesson 0 — enter the lathe-setup flow. */
  onStartSetup: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  'roughing-gouge': 'Roughing Gouge',
  'spindle-gouge': 'Spindle Gouge',
  'parting-tool': 'Parting Tool',
};

export function LessonSelect({ onStart, onStartSetup }: LessonSelectProps): React.ReactElement {
  const record = useSessionStore((s) => s.record);
  const loadFromDB = useSessionStore((s) => s.loadFromDB);

  useEffect(() => {
    void loadFromDB();
  }, [loadFromDB]);

  const curriculum = getCurriculum();

  const completedIds = new Set(
    record.lessons
      .filter((l) => l.completedAt !== null)
      .map((l) => l.lessonId),
  );

  const styles = {
    container: {
      minHeight: '100vh',
      background: '#1a1a1a',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      padding: '48px 24px',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    },
    header: {
      color: '#c8873a',
      fontSize: '2rem',
      fontWeight: 700,
      letterSpacing: '0.04em',
      marginBottom: '12px',
    },
    subtitle: {
      color: '#888',
      fontSize: '0.95rem',
      marginBottom: '48px',
    },
    grid: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '24px',
      justifyContent: 'center',
      maxWidth: '960px',
      width: '100%',
    },
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Woodturning Studio</h1>
      <p style={styles.subtitle}>Select a lesson to begin</p>
      <div style={styles.grid}>
        {/* Lesson 0 — lathe setup (always available, distinct from the turning curriculum) */}
        <div
          style={{
            background: '#2a2a2a', borderRadius: '10px', padding: '24px', width: '260px',
            display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #c8873a55', position: 'relative',
          }}
        >
          <h2 style={{ color: '#e0e0e0', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>{getLatheSetup().title}</h2>
          <span style={{ color: '#c8873a', fontSize: '0.8rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lesson 0 · Setup</span>
          <p style={{ color: '#aaa', fontSize: '0.85rem', lineHeight: 1.5, flexGrow: 1 }}>
            Mount the workholding (drive centre, live centre), fit the tool rest, and plug in — get the lathe ready before you turn.
          </p>
          <button
            style={{
              marginTop: '8px', padding: '10px 20px', background: '#c8873a', color: '#1a1a1a', border: 'none',
              borderRadius: '6px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', letterSpacing: '0.02em', alignSelf: 'flex-start',
            }}
            onClick={() => { onStartSetup(); }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#d9963f'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#c8873a'; }}
          >
            Start →
          </button>
        </div>
        {curriculum.map((lesson) => {
          const unlocked = isLessonUnlocked(lesson, completedIds);
          const completed = completedIds.has(lesson.id);
          const brief =
            lesson.brief.length > 80
              ? lesson.brief.slice(0, 80) + '…'
              : lesson.brief;
          const toolLabel = TOOL_LABELS[lesson.tool] ?? lesson.tool;

          const cardStyle: React.CSSProperties = {
            background: '#2a2a2a',
            borderRadius: '10px',
            padding: '24px',
            width: '260px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            border: unlocked ? '1px solid #3a3a3a' : '1px solid #2a2a2a',
            opacity: unlocked ? 1 : 0.6,
            position: 'relative',
          };

          const titleStyle: React.CSSProperties = {
            color: unlocked ? '#e0e0e0' : '#666',
            fontSize: '1.1rem',
            fontWeight: 600,
            margin: 0,
          };

          const toolStyle: React.CSSProperties = {
            color: unlocked ? '#c8873a' : '#555',
            fontSize: '0.8rem',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          };

          const briefStyle: React.CSSProperties = {
            color: unlocked ? '#aaa' : '#555',
            fontSize: '0.85rem',
            lineHeight: 1.5,
            flexGrow: 1,
          };

          const badgeStyle: React.CSSProperties = {
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: '#2e6b3e',
            color: '#7dcea0',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
          };

          const buttonStyle: React.CSSProperties = {
            marginTop: '8px',
            padding: '10px 20px',
            background: '#c8873a',
            color: '#1a1a1a',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            letterSpacing: '0.02em',
            alignSelf: 'flex-start',
          };

          const lockStyle: React.CSSProperties = {
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: '#555',
            fontSize: '0.85rem',
          };

          return (
            <div key={lesson.id} style={cardStyle}>
              {completed && <div style={badgeStyle}>✓</div>}
              <h2 style={titleStyle}>{lesson.title}</h2>
              <span style={toolStyle}>{toolLabel}</span>
              <p style={briefStyle}>{brief}</p>
              {unlocked ? (
                <button
                  style={buttonStyle}
                  onClick={() => { onStart(lesson.id); }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#d9963f';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#c8873a';
                  }}
                >
                  {completed ? 'Replay' : 'Start →'}
                </button>
              ) : (
                <div style={lockStyle}>
                  <span>🔒</span>
                  <span>Complete previous lessons to unlock</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
