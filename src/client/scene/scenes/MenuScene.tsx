/**
 * MenuScene — DOM overlay for MENU state.
 *
 * No Scene3D: the workshop geometry is not visible in the menu.
 * Renders the full-screen LessonSelect panel.
 */

import { LessonSelect } from '../../ui/index.js';
import type { SceneCtx } from '../sceneCtx.js';

interface Props { ctx: SceneCtx }

export function MenuOverlay({ ctx }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
      <LessonSelect onStart={(id) => { ctx.startLesson(id); }} />
    </div>
  );
}
