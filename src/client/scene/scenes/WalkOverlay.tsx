/**
 * WalkOverlay — DOM overlay for WORKSHOP_WALK state.
 *
 * Shows the lesson title, walk hint, pass/fail badge from the previous
 * session, and the ← Menu escape button embedded in the HUD.
 */

import { hudStyle, escapeBtnStyle } from '../sharedStyles.js';
import type { SceneCtx } from '../sceneCtx.js';

interface Props { ctx: SceneCtx }

export function WalkOverlay({ ctx }: Props) {
  const { lesson, lastPassed, returnToMenu } = ctx;

  return (
    <>
      {lesson !== null && (
        <div style={hudStyle}>
          <span style={{ color: '#c8873a', fontWeight: 600 }}>{lesson.title}</span>
          <span style={{ color: '#aaa', fontSize: 12 }}>
            Click to look · WASD to walk · approach the lathe to lock in
          </span>
          <button style={escapeBtnStyle} onClick={returnToMenu}>← Menu</button>
        </div>
      )}

      {/* Brief pass/fail indicator after returning from a lesson */}
      {lastPassed !== null && (
        <div style={{
          position: 'fixed', top: 12, right: 12, zIndex: 200,
          color: lastPassed ? '#7dcea0' : '#cc4444',
          fontFamily: 'sans-serif', fontSize: 14,
        }}>
          {lastPassed ? '✓ Lesson passed' : '✗ Lesson failed'}
        </div>
      )}
    </>
  );
}
