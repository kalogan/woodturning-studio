import { useState, useEffect } from 'react';
import type { CurriculumLesson } from '../../session/curriculum.js';
import type { PhysicsResult, WoodState } from '../../core/types.js';

export interface CoachingOverlayProps {
  lesson: CurriculumLesson;
  lastResult: PhysicsResult | null;
  woodState: WoodState;
  toolAngleDeg: number;
}

type CueKind = 'catch' | 'tearout' | 'info';

interface ActiveCue {
  message: string;
  kind: CueKind;
}

function angleColor(deg: number): string {
  if (deg <= 35) return '#4caf50';
  if (deg <= 50) return '#c8873a';
  return '#ff3333';
}

function pillBackground(kind: CueKind): string {
  if (kind === 'catch') return 'rgba(180,0,0,0.85)';
  if (kind === 'tearout') return 'rgba(150,90,0,0.85)';
  return 'rgba(0,0,0,0.7)';
}

export function CoachingOverlay({
  lesson,
  lastResult,
  woodState,
  toolAngleDeg,
}: CoachingOverlayProps) {
  const [activeCue, setActiveCue] = useState<ActiveCue | null>(null);

  useEffect(() => {
    if (lastResult === null) return;

    let cue: ActiveCue | null = null;

    if (lastResult.catch) {
      const found = lesson.coachingCues.find((c) => c.trigger === 'catch');
      if (found) {
        cue = { message: found.message, kind: 'catch' };
      } else {
        cue = { message: 'CATCH! Ease off the angle.', kind: 'catch' };
      }
    } else {
      const hasTearout = woodState.tearout.some((t) => t > 0.3);
      if (hasTearout) {
        const found = lesson.coachingCues.find((c) => c.trigger === 'tearout');
        if (found) {
          cue = { message: found.message, kind: 'tearout' };
        }
      }
    }

    if (cue === null) return;

    setActiveCue(cue);
    const timer = setTimeout(() => {
      setActiveCue(null);
    }, 4000);

    return () => {
      clearTimeout(timer);
    };
  }, [lastResult, lesson.coachingCues, woodState.tearout]);

  const color = angleColor(toolAngleDeg);

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        pointerEvents: 'none',
        zIndex: 10,
        fontFamily: 'monospace',
        color: '#e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <span>Tool angle: {toolAngleDeg.toFixed(1)}°</span>
      </div>

      {activeCue !== null && (
        <div
          style={{
            background: pillBackground(activeCue.kind),
            padding: '8px 12px',
            borderRadius: 6,
            color: '#ffffff',
            maxWidth: 320,
          }}
        >
          {activeCue.message}
        </div>
      )}
    </div>
  );
}
