import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from './sceneStore.js';

const INITIAL = { state: 'MENU' as const, activeLessonId: null, lastPassed: null };

beforeEach(() => {
  useSceneStore.setState(INITIAL);
});

describe('initial state', () => {
  it('starts as MENU with null ids', () => {
    const s = useSceneStore.getState();
    expect(s.state).toBe('MENU');
    expect(s.activeLessonId).toBeNull();
    expect(s.lastPassed).toBeNull();
  });
});

describe('legal transitions', () => {
  it('startLesson: MENU → WORKSHOP_WALK, sets activeLessonId', () => {
    useSceneStore.getState().startLesson('lesson-01');
    const s = useSceneStore.getState();
    expect(s.state).toBe('WORKSHOP_WALK');
    expect(s.activeLessonId).toBe('lesson-01');
  });

  it('enterLathe: WORKSHOP_WALK → AT_LATHE', () => {
    useSceneStore.setState({ state: 'WORKSHOP_WALK' });
    useSceneStore.getState().enterLathe();
    expect(useSceneStore.getState().state).toBe('AT_LATHE');
  });

  it('stepBack: AT_LATHE → WORKSHOP_WALK', () => {
    useSceneStore.setState({ state: 'AT_LATHE' });
    useSceneStore.getState().stepBack();
    expect(useSceneStore.getState().state).toBe('WORKSHOP_WALK');
  });

  it('pickUpTool: AT_LATHE → TURNING', () => {
    useSceneStore.setState({ state: 'AT_LATHE' });
    useSceneStore.getState().pickUpTool();
    expect(useSceneStore.getState().state).toBe('TURNING');
  });

  it('setDownTool: TURNING → AT_LATHE', () => {
    useSceneStore.setState({ state: 'TURNING' });
    useSceneStore.getState().setDownTool();
    expect(useSceneStore.getState().state).toBe('AT_LATHE');
  });

  it('completeLesson: TURNING → LESSON_COMPLETE, sets lastPassed', () => {
    useSceneStore.setState({ state: 'TURNING' });
    useSceneStore.getState().completeLesson(true);
    const s = useSceneStore.getState();
    expect(s.state).toBe('LESSON_COMPLETE');
    expect(s.lastPassed).toBe(true);
  });

  it('completeLesson: records failed (passed=false)', () => {
    useSceneStore.setState({ state: 'TURNING' });
    useSceneStore.getState().completeLesson(false);
    expect(useSceneStore.getState().lastPassed).toBe(false);
  });

  it('finishCutscene → WORKSHOP_WALK when not all lessons done', () => {
    useSceneStore.setState({ state: 'LESSON_COMPLETE', activeLessonId: 'lesson-01' });
    useSceneStore.getState().finishCutscene(new Set(['lesson-01'])); // only 1 of 4
    expect(useSceneStore.getState().state).toBe('WORKSHOP_WALK');
  });

  it('finishCutscene → MENU + clears activeLessonId when all lessons done', () => {
    useSceneStore.setState({ state: 'LESSON_COMPLETE', activeLessonId: 'lesson-01' });
    const allIds = new Set([
      'lesson-01-roughing',
      'lesson-02-spindle',
      'lesson-03-parting',
      'lesson-04-beads',
    ]);
    useSceneStore.getState().finishCutscene(allIds);
    const s = useSceneStore.getState();
    expect(s.state).toBe('MENU');
    expect(s.activeLessonId).toBeNull();
  });

  it('returnToMenu: works from any state', () => {
    for (const state of ['WORKSHOP_WALK', 'AT_LATHE', 'TURNING', 'LESSON_COMPLETE'] as const) {
      useSceneStore.setState({ state, activeLessonId: 'lesson-01', lastPassed: true });
      useSceneStore.getState().returnToMenu();
      const s = useSceneStore.getState();
      expect(s.state).toBe('MENU');
      expect(s.activeLessonId).toBeNull();
      expect(s.lastPassed).toBeNull();
    }
  });
});

describe('illegal transitions are no-ops', () => {
  it('pickUpTool from MENU does nothing', () => {
    useSceneStore.getState().pickUpTool();
    expect(useSceneStore.getState().state).toBe('MENU');
  });

  it('enterLathe from TURNING does nothing', () => {
    useSceneStore.setState({ state: 'TURNING' });
    useSceneStore.getState().enterLathe();
    expect(useSceneStore.getState().state).toBe('TURNING');
  });

  it('startLesson from WORKSHOP_WALK does nothing', () => {
    useSceneStore.setState({ state: 'WORKSHOP_WALK', activeLessonId: 'lesson-01' });
    useSceneStore.getState().startLesson('lesson-02');
    // still WORKSHOP_WALK, activeLessonId unchanged
    const s = useSceneStore.getState();
    expect(s.state).toBe('WORKSHOP_WALK');
    expect(s.activeLessonId).toBe('lesson-01');
  });

  it('completeLesson from MENU does nothing', () => {
    useSceneStore.getState().completeLesson(true);
    expect(useSceneStore.getState().state).toBe('MENU');
  });

  it('finishCutscene from WORKSHOP_WALK does nothing', () => {
    useSceneStore.setState({ state: 'WORKSHOP_WALK' });
    useSceneStore.getState().finishCutscene(new Set());
    expect(useSceneStore.getState().state).toBe('WORKSHOP_WALK');
  });
});

describe('activeLessonId lifecycle', () => {
  it('is set by startLesson and cleared by returnToMenu', () => {
    useSceneStore.getState().startLesson('lesson-01');
    expect(useSceneStore.getState().activeLessonId).toBe('lesson-01');
    useSceneStore.getState().returnToMenu();
    expect(useSceneStore.getState().activeLessonId).toBeNull();
  });
});
