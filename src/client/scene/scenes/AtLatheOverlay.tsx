/**
 * AtLatheOverlay — DOM overlay for AT_LATHE state.
 *
 * Shows the proximity-locked "Press E to pick up the tool" affordance.
 * The escape button (← Menu) is rendered by App.tsx at the fixed position
 * shared with TURNING and LESSON_COMPLETE.
 */

import { hudStyle, kbdStyle } from '../sharedStyles.js';
import type { SceneCtx } from '../sceneCtx.js';

// Props type used only to satisfy the registry FC signature; no ctx fields needed
// beyond what's already being rendered by App's shared escape button.
interface Props { ctx: SceneCtx }

export function AtLatheOverlay(_: Props) {
  return (
    <div style={hudStyle}>
      <span style={{ color: '#c8873a', fontWeight: 600 }}>At the lathe</span>
      <span style={{ color: '#e0e0e0', fontSize: 13 }}>
        Click <span style={{ color: '#55cc55' }}>START</span> · drag the dial to set speed
      </span>
      <span style={{ color: '#e0e0e0', fontSize: 13 }}>
        Press <kbd style={kbdStyle}>E</kbd> to pick up the tool
      </span>
      <span style={{ color: '#888', fontSize: 12 }}>
        Step back to return to walk mode
      </span>
    </div>
  );
}
