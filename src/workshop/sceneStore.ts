import { create } from 'zustand';
import { getCurriculum } from '../session/curriculum.js';
import type { ToolKind } from '../core/types.js';

export type SceneState =
  | 'MENU'
  | 'SETUP'
  | 'WORKSHOP_WALK'
  | 'AT_LATHE'
  | 'TURNING'
  | 'LESSON_COMPLETE';

interface SceneStore {
  state: SceneState;
  activeLessonId: string | null;
  lastPassed: boolean | null;

  /** The tool the player is currently holding (set when entering TURNING). */
  heldTool: ToolKind | null;

  /**
   * Transient wrong-tool coaching nudge.
   * Set when the player clicks the wrong rack tool; cleared after a timeout
   * or on the next interaction. null = no hint showing.
   */
  toolHint: string | null;

  // Guarded transitions — no-op if source state is wrong
  startLesson: (lessonId: string) => void;
  /** Lesson 0 — enter the lathe-setup flow (MENU → SETUP). */
  startSetup: () => void;
  /** Finish lathe setup (SETUP → MENU). */
  finishSetup: () => void;
  enterLathe: () => void;
  stepBack: () => void;
  /**
   * Grab a specific tool from the rack.
   * Guard: only AT_LATHE → TURNING. Sets heldTool to the grabbed tool.
   */
  pickUpTool: (tool: ToolKind) => void;
  setDownTool: () => void;
  completeLesson: (passed: boolean) => void;
  finishCutscene: (completedIds: Set<string>) => void;
  returnToMenu: () => void;

  /** Show a transient coaching nudge; auto-cleared after 3 s. */
  setToolHint: (hint: string | null) => void;
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  state: 'MENU',
  activeLessonId: null,
  lastPassed: null,
  heldTool: null,
  toolHint: null,

  startLesson: (lessonId) => {
    if (get().state !== 'MENU') return;
    set({ state: 'WORKSHOP_WALK', activeLessonId: lessonId });
  },

  startSetup: () => {
    if (get().state !== 'MENU') return;
    set({ state: 'SETUP' });
  },

  finishSetup: () => {
    if (get().state !== 'SETUP') return;
    set({ state: 'MENU' });
  },

  enterLathe: () => {
    if (get().state !== 'WORKSHOP_WALK') return;
    set({ state: 'AT_LATHE' });
  },

  stepBack: () => {
    if (get().state !== 'AT_LATHE') return;
    set({ state: 'WORKSHOP_WALK' });
  },

  pickUpTool: (tool) => {
    if (get().state !== 'AT_LATHE') return;
    set({ state: 'TURNING', heldTool: tool, toolHint: null });
  },

  setDownTool: () => {
    if (get().state !== 'TURNING') return;
    set({ state: 'AT_LATHE', heldTool: null });
  },

  completeLesson: (passed) => {
    if (get().state !== 'TURNING') return;
    set({ state: 'LESSON_COMPLETE', lastPassed: passed });
  },

  finishCutscene: (completedIds) => {
    if (get().state !== 'LESSON_COMPLETE') return;
    const allIds = getCurriculum().map((l) => l.id);
    const allDone = allIds.every((id) => completedIds.has(id));
    if (allDone) {
      set({ state: 'MENU', activeLessonId: null });
    } else {
      set({ state: 'WORKSHOP_WALK' });
    }
  },

  returnToMenu: () => {
    set({ state: 'MENU', activeLessonId: null, lastPassed: null, heldTool: null, toolHint: null });
  },

  setToolHint: (hint) => {
    set({ toolHint: hint });
  },
}));
