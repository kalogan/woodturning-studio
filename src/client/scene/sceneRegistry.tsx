/**
 * sceneRegistry — maps every SceneState to a { Scene3D?, Overlay? } pair.
 *
 * Scene3D components render INSIDE the R3F <Canvas> (Three.js/R3F world).
 * Overlay components render OUTSIDE the Canvas (DOM layer).
 * Either may be absent for a given state.
 *
 * PROXIMITY AUTO-LOCK DESIGN:
 *   AT_LATHE intentionally uses a DIFFERENT Scene3D from WORKSHOP_WALK.
 *   When proximity triggers AT_LATHE, React unmounts WalkScene (FPSCamera +
 *   pointer lock) and mounts AtLatheScene (fixed operator camera, free cursor).
 *   This is the "proximity auto-lock" mechanic: the camera snaps to the
 *   operator stance and the cursor is freed for clicking controls.
 *
 *   The old invariant (WALK === AT_LATHE, same ref to preserve pointer lock)
 *   is intentionally REVERSED: we now WANT the FPSCamera to unmount so pointer
 *   lock is released and the mouse cursor appears for the control-panel UI.
 */

import type { FC } from 'react';
import type { SceneState } from '../../workshop/index.js';
import type { SceneCtx } from './sceneCtx.js';
import { MenuOverlay } from './scenes/MenuScene.js';
import { SetupScene3D, SetupOverlay } from './scenes/SetupScene.js';
import { WalkScene } from './scenes/WalkScene.js';
import { WalkOverlay } from './scenes/WalkOverlay.js';
import { AtLatheScene } from './scenes/AtLatheScene.js';
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

  SETUP: {
    // Lesson 0 — set up the lathe (grab + mount workholding) before turning.
    Scene3D: SetupScene3D,
    Overlay: SetupOverlay,
  },

  WORKSHOP_WALK: {
    // WalkScene is shared with AT_LATHE — same reference, no remount on transition
    Scene3D: WalkScene,
    Overlay: WalkOverlay,
  },

  AT_LATHE: {
    // AT_LATHE intentionally uses a fixed operator camera + free cursor
    // (proximity auto-lock); the WALK↔AT_LATHE camera swap is by design.
    // AtLatheScene mounts a PerspectiveCamera (no FPSCamera / pointer lock)
    // so the player can click the START button and drag the speed dial.
    Scene3D: AtLatheScene,
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
