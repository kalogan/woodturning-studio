/**
 * AtLatheOverlay — DOM overlay for AT_LATHE state.
 *
 * Shows the proximity-locked operator affordances plus an explicit
 * "← Step back" button to return to WORKSHOP_WALK.
 *
 * Hints shown:
 *  - "Click the [tool name] from the rack to start turning" (expected tool from lesson)
 *  - Transient wrong-tool nudge when the player clicks the wrong rack tool
 *  - START / dial hint
 *  - Step-back button
 *
 * The "← Menu" escape button is rendered by App.tsx at the fixed position
 * shared with TURNING and LESSON_COMPLETE — this overlay adds its own
 * step-back affordance below the lathe hints.
 */

import { hudStyle, kbdStyle, escapeBtnStyle } from '../sharedStyles.js';
import { useSceneStore } from '../../../workshop/index.js';
import type { ToolKind } from '../../../core/types.js';
import type { SceneCtx } from '../sceneCtx.js';

// Display names for tool kinds — kept local to the overlay.
const TOOL_DISPLAY_NAMES: Record<ToolKind, string> = {
  'roughing-gouge': 'roughing gouge',
  'spindle-gouge': 'spindle gouge',
  'parting-tool': 'parting tool',
};

interface Props { ctx: SceneCtx }

export function AtLatheOverlay({ ctx }: Props) {
  const toolHint = useSceneStore((s) => s.toolHint);

  const handleStepBack = () => {
    // stepBack() is guarded: only transitions AT_LATHE → WORKSHOP_WALK.
    // FPSCamera will remount and spawn at WALK_SPAWN (> 1.2 m from tool rest)
    // so the first proximity check will NOT immediately re-enter AT_LATHE.
    useSceneStore.getState().stepBack();
  };

  const expectedTool = ctx.lesson?.tool ?? null;
  const expectedToolName =
    expectedTool !== null ? TOOL_DISPLAY_NAMES[expectedTool] : 'the correct tool';

  return (
    <div style={hudStyle}>
      <span style={{ color: '#c8873a', fontWeight: 600 }}>At the lathe</span>

      {/* START / dial hint */}
      <span style={{ color: '#e0e0e0', fontSize: 13 }}>
        Click <span style={{ color: '#55cc55' }}>START</span> · drag the dial to set speed
      </span>

      {/* Correct-tool instruction — or wrong-tool nudge when active */}
      {toolHint !== null ? (
        <span
          style={{
            color: '#e07040',
            fontSize: 13,
            fontStyle: 'italic',
            maxWidth: 360,
            textAlign: 'center',
          }}
        >
          {toolHint}
        </span>
      ) : (
        <span style={{ color: '#e0e0e0', fontSize: 13 }}>
          Click the{' '}
          <span style={{ color: '#c8d855', fontWeight: 600 }}>{expectedToolName}</span>
          {' '}from the rack to start turning
        </span>
      )}

      {/* E-key shortcut hint */}
      <span style={{ color: '#888', fontSize: 12 }}>
        (or press <kbd style={kbdStyle}>E</kbd> to grab the correct tool)
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
