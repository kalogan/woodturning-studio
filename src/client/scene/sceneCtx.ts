/**
 * SceneCtx — shared props bag threaded from App into every scene component.
 *
 * App.tsx computes all of this once; the registry entries receive it as `ctx`.
 * Nothing in here is per-frame — these are React state/refs/callbacks.
 */

import type { RefObject } from 'react';
import type { SceneState } from '../../workshop/index.js';
import type { EvalResult } from '../lesson/index.js';
import type { PhysicsResult } from '../../core/types.js';
import type { InputAdapter, InputSource } from '../../input/types.js';
import type { TurningSessionResult } from '../lesson/useTurningSession.js';
import type { WoodState } from '../../core/types.js';
import type { LessonRunState } from '../lesson/index.js';
import type { CurriculumLesson } from '../../session/index.js';

export interface SceneCtx {
  // ── Scene store fields ─────────────────────────────────────────────────────
  state: SceneState;
  activeLessonId: string | null;
  lastPassed: boolean | null;

  // ── Scene store actions ────────────────────────────────────────────────────
  startLesson: (lessonId: string) => void;
  startSetup: () => void;
  finishSetup: () => void;
  pickUpTool: (tool: import('../../core/types.js').ToolKind) => void;
  finishCutscene: (completedIds: Set<string>) => void;
  returnToMenu: () => void;

  // ── Resolved curriculum entry ──────────────────────────────────────────────
  lesson: CurriculumLesson | null;

  // ── Turning session ────────────────────────────────────────────────────────
  adapter: InputAdapter | null;
  adapterReady: boolean;
  poseContainer: TurningSessionResult['poseContainer'];
  woodState: RefObject<WoodState>;
  runStateRef: RefObject<LessonRunState>;
  inputSource: InputSource;
  setInputSource: (src: InputSource) => void;
  cameraAvailable: boolean;

  // ── Derived turning value (pre-computed in App to avoid re-computing) ──────
  toolAngleDeg: number;

  // ── Result state ───────────────────────────────────────────────────────────
  completionResult: EvalResult | null;
  lastResult: PhysicsResult | null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  handlePlayerMove: (x: number, z: number) => void;
  handleInteract: () => void;
  handleEvalResult: (result: EvalResult) => void;
  handleContinue: () => void;
  setLastResult: (result: PhysicsResult | null) => void;
}
