/**
 * sceneRegistry — maps every SceneState to a { Scene3D?, Overlay? } pair.
 *
 * Scene3D components render INSIDE the R3F <Canvas> (Three.js/R3F world).
 * Overlay components render OUTSIDE the Canvas (DOM layer).
 * Either may be absent for a given state.
 *
 * INVARIANT (pointer-lock safety):
 *   registry.WORKSHOP_WALK.Scene3D === registry.AT_LATHE.Scene3D
 *
 * Both states share the same WalkScene component reference so React does NOT
 * unmount/remount it when the player crosses the proximity threshold.
 * Remounting FPSCamera while pointer lock is active breaks pointer lock.
 */

import type { FC } from 'react';
import type { SceneState } from '../../workshop/index.js';
import type { SceneCtx } from './sceneCtx.js';
import { MenuOverlay } from './scenes/MenuScene.js';
import { WalkScene } from './scenes/WalkScene.js';
import { WalkOverlay } from './scenes/WalkOverlay.js';
import { AtLatheOverlay } from './scenes/AtLatheOverlay.js';
import { TurningScene3D, TurningOverlay } from './scenes/TurningEntry.js';
import { LessonCompleteScene3D, LessonCompleteOverlay } from './scenes/LessonCompleteScene.js';

export interface RegistryEntry {
  /** Rendered inside the R3F Canvas. Absent means no 3D content for this state. */
  Scene3D?: FC<{ ctx: SceneCtx }>;
  /** Rendered in the DOM outside the Canvas. Absent means no overlay for this state. */
  Overlay?: FC<{ ctx: SceneCtx }>;
}

export type SceneRegistry = Record<SceneState, RegistryEntry>;

export const sceneRegistry: SceneRegistry = {
  MENU: {
    // No 3D scene in the menu
    Overlay: MenuOverlay,
  },

  WORKSHOP_WALK: {
    // WalkScene is shared with AT_LATHE — same reference, no remount on transition
    Scene3D: WalkScene,
    Overlay: WalkOverlay,
  },

  AT_LATHE: {
    // ⚠️  SAME WalkScene reference as WORKSHOP_WALK — preserves pointer lock
    Scene3D: WalkScene,
    Overlay: AtLatheOverlay,
  },

  TURNING: {
    Scene3D: TurningScene3D,
    Overlay: TurningOverlay,
  },

  LESSON_COMPLETE: {
    Scene3D: LessonCompleteScene3D,
    Overlay: LessonCompleteOverlay,
  },
};
