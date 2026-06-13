import { create } from 'zustand';
import { getCurriculum } from '../session/curriculum.js';

export type SceneState =
  | 'MENU'
  | 'WORKSHOP_WALK'
  | 'AT_LATHE'
  | 'TURNING'
  | 'LESSON_COMPLETE';

interface SceneStore {
  state: SceneState;
  activeLessonId: string | null;
  lastPassed: boolean | null;

  // Guarded transitions — no-op if source state is wrong
  startLesson: (lessonId: string) => void;
  enterLathe: () => void;
  stepBack: () => void;
  pickUpTool: () => void;
  setDownTool: () => void;
  completeLesson: (passed: boolean) => void;
  finishCutscene: (completedIds: Set<string>) => void;
  returnToMenu: () => void;
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  state: 'MENU',
  activeLessonId: null,
  lastPassed: null,

  startLesson: (lessonId) => {
    if (get().state !== 'MENU') return;
    set({ state: 'WORKSHOP_WALK', activeLessonId: lessonId });
  },

  enterLathe: () => {
    if (get().state !== 'WORKSHOP_WALK') return;
    set({ state: 'AT_LATHE' });
  },

  stepBack: () => {
    if (get().state !== 'AT_LATHE') return;
    set({ state: 'WORKSHOP_WALK' });
  },

  pickUpTool: () => {
    if (get().state !== 'AT_LATHE') return;
    set({ state: 'TURNING' });
  },

  setDownTool: () => {
    if (get().state !== 'TURNING') return;
    set({ state: 'AT_LATHE' });
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
    set({ state: 'MENU', activeLessonId: null, lastPassed: null });
  },
}));
