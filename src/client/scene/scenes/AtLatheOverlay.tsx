/**
 * AtLatheOverlay — DOM overlay for AT_LATHE state.
 *
 * Shows the proximity-locked operator affordances plus an explicit
 * "← Step back" button to return to WORKSHOP_WALK.
 *
 * The "← Menu" escape button is rendered by App.tsx at the fixed position
 * shared with TURNING and LESSON_COMPLETE — this overlay adds its own
 * step-back affordance below the lathe hints.
 */

import { hudStyle, kbdStyle, escapeBtnStyle } from '../sharedStyles.js';
import { useSceneStore } from '../../../workshop/index.js';
import type { SceneCtx } from '../sceneCtx.js';

// Props type used only to satisfy the registry FC signature.
interface Props { ctx: SceneCtx }

export function AtLatheOverlay(_: Props) {
  const handleStepBack = () => {
    // stepBack() is guarded: only transitions AT_LATHE → WORKSHOP_WALK.
    // FPSCamera will remount and spawn at WALK_SPAWN (> 1.2 m from tool rest)
    // so the first proximity check will NOT immediately re-enter AT_LATHE.
    useSceneStore.getState().stepBack();
  };

  return (
    <div style={hudStyle}>
      <span style={{ color: '#c8873a', fontWeight: 600 }}>At the lathe</span>
      <span style={{ color: '#e0e0e0', fontSize: 13 }}>
        Click <span style={{ color: '#55cc55' }}>START</span> · drag the dial to set speed
      </span>
      <span style={{ color: '#e0e0e0', fontSize: 13 }}>
        Press <kbd style={kbdStyle}>E</kbd> to pick up the tool
      </span>
      <button
        style={escapeBtnStyle}
        onClick={handleStepBack}
        type="button"
      >
        ← Step back
      </button>
    </div>
  );
}
