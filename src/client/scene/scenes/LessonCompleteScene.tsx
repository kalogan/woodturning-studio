/**
 * LessonCompleteScene — R3F Scene3D + DOM Overlay for LESSON_COMPLETE state.
 *
 * Scene3D: renders the workshop geometry (same as WalkScene but without
 * FPSCamera) plus OrbitControls so the player can inspect their work.
 * Overlay: renders the LessonComplete result panel (full-screen).
 *
 * Note: WalkScene is NOT reused here because LESSON_COMPLETE must render
 * OrbitControls (not FPSCamera). Mounting a different camera controller
 * is fine here because the transition WORKSHOP_WALK ↔ AT_LATHE is the
 * one that must not remount (that pair shares WalkScene). The transition
 * into LESSON_COMPLETE always comes from TURNING (no FPS pointer lock
 * is active at that moment), so a remount here is safe.
 */

import { OrbitControls } from '@react-three/drei';
import { Lighting, Room, Furniture } from '../../workshop/index.js';
import { Lathe } from '../../lathe/index.js';
import { LessonComplete } from '../../lesson/index.js';
import type { SceneCtx } from '../sceneCtx.js';

interface Props { ctx: SceneCtx }

export function LessonCompleteScene3D(_: Props) {
  return (
    <>
      <Lighting />
      <Room />
      <Furniture />
      <Lathe position={[0, 0, 0]} defaultBlankVisible />
      {/* Use orbit in lesson-complete so player can see the result */}
      <OrbitControls target={[0, 1.05, 0]} />
    </>
  );
}

export function LessonCompleteOverlay({ ctx }: Props) {
  const { completionResult, lesson, handleContinue } = ctx;

  if (completionResult === null || lesson === null) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <LessonComplete
        result={completionResult}
        lessonTitle={lesson.title}
        onContinue={handleContinue}
      />
    </div>
  );
}
