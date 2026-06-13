import { useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSceneStore } from '../workshop/index.js';
import { useSessionStore } from '../session/index.js';
import { getCurriculum } from '../session/index.js';
import { LessonSelect, CoachingOverlay, InputToggle } from './ui/index.js';
import { TurningScene, LessonComplete, useTurningSession } from './lesson/index.js';
import type { EvalResult } from './lesson/index.js';
import { Room, Furniture, Lighting } from './workshop/index.js';
import { Lathe } from './lathe/index.js';
import type { PhysicsResult } from '../core/types.js';
import type React from 'react';

export default function App() {
  const {
    state,
    activeLessonId,
    lastPassed,
    startLesson,
    enterLathe,
    stepBack,
    pickUpTool,
    finishCutscene,
    returnToMenu,
  } = useSceneStore();

  const lesson = getCurriculum().find((l) => l.id === activeLessonId) ?? null;

  // Turning session lifecycle — adapter starts/stops when inputSource changes
  const {
    adapter,
    adapterReady,
    poseContainer,
    woodState,
    runStateRef,
    inputSource,
    setInputSource,
    cameraAvailable,
  } = useTurningSession();

  const [completionResult, setCompletionResult] = useState<EvalResult | null>(null);
  const [lastResult, setLastResult] = useState<PhysicsResult | null>(null);

  const handleEvalResult = useCallback(
    (result: EvalResult) => {
      setCompletionResult((prev) => {
        if (prev !== null) return prev;
        const score = result.passed ? 1 : 0;
        // Persist completion to IndexedDB — same call as original LessonRunner
        useSessionStore.getState().completeLesson(activeLessonId ?? '', score).catch(() => {
          /* no-op */
        });
        // Advance scene state machine: TURNING → LESSON_COMPLETE
        useSceneStore.getState().completeLesson(result.passed);
        return result;
      });
    },
    [activeLessonId],
  );

  const handleContinue = useCallback(() => {
    const record = useSessionStore.getState().record;
    const completedIds = new Set(
      record.lessons.filter((l) => l.completedAt !== null).map((l) => l.lessonId),
    );
    finishCutscene(completedIds);
    setCompletionResult(null);
  }, [finishCutscene]);

  const toolAngleDeg = (poseContainer.current.pose.angleX * 180) / Math.PI;

  // Workshop scene rendered in WORKSHOP_WALK, AT_LATHE, and LESSON_COMPLETE states
  const workshopScene = (
    <>
      <Lighting />
      <Room />
      <Furniture />
      {/* Lathe is floor-standing; its own stand provides working height */}
      <Lathe position={[0, 0, 0]} defaultBlankVisible />
      <OrbitControls target={[0, 1.05, 0]} />
    </>
  );

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a1a', position: 'relative' }}>
      {/* ── Single persistent Canvas — never conditionally unmounted ── */}
      <Canvas shadows camera={{ position: [2.0, 1.6, 2.2], fov: 55 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 4, 3]} intensity={1.2} />

        {(state === 'WORKSHOP_WALK' || state === 'AT_LATHE' || state === 'LESSON_COMPLETE') &&
          workshopScene}

        {state === 'TURNING' && lesson !== null && adapter !== null && adapterReady && (
          <TurningScene
            lesson={lesson}
            adapter={adapter}
            poseContainer={poseContainer.current}
            woodState={woodState.current}
            runStateRef={runStateRef}
            onEvalResult={handleEvalResult}
            onResult={setLastResult}
            completed={completionResult !== null}
          />
        )}
        {/* OrbitControls for turning view — Slice B replaces with locked turning camera */}
        {state === 'TURNING' && <OrbitControls />}
      </Canvas>

      {/* ── DOM overlays by state ──────────────────────────────────── */}

      {state === 'MENU' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <LessonSelect onStart={(id) => { startLesson(id); }} />
        </div>
      )}

      {/* TEMP Slice-B seam: replace with FPS walk + proximity auto-lock detection */}
      {state === 'WORKSHOP_WALK' && lesson !== null && (
        <div style={hudStyle}>
          <span style={{ color: '#c8873a', fontWeight: 600 }}>{lesson.title}</span>
          <button style={tempBtnStyle} onClick={enterLathe}>
            Approach lathe → {/* TEMP: Slice B proximity auto-lock */}
          </button>
          <button style={escapeBtnStyle} onClick={returnToMenu}>← Menu</button>
        </div>
      )}

      {/* TEMP Slice-B seam: replace with E-to-grab and distance-based step-back */}
      {state === 'AT_LATHE' && (
        <div style={hudStyle}>
          <button style={tempBtnStyle} onClick={pickUpTool}>
            Pick up tool → {/* TEMP: Slice B E-to-grab */}
          </button>
          <button style={escapeBtnStyle} onClick={stepBack}>
            ← Step back {/* TEMP: Slice B distance-based auto-unlock */}
          </button>
        </div>
      )}

      {state === 'TURNING' && lesson !== null && (
        <>
          <InputToggle
            source={inputSource}
            onSwitch={setInputSource}
            cameraAvailable={cameraAvailable}
          />
          <CoachingOverlay
            lesson={lesson}
            lastResult={lastResult}
            woodState={woodState.current}
            toolAngleDeg={toolAngleDeg}
          />
        </>
      )}

      {state === 'LESSON_COMPLETE' && completionResult !== null && lesson !== null && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
          <LessonComplete
            result={completionResult}
            lessonTitle={lesson.title}
            onContinue={handleContinue}
          />
        </div>
      )}

      {/* Escape hatch — always available in non-MENU states (except WORKSHOP_WALK which has its own) */}
      {(state === 'AT_LATHE' || state === 'TURNING' || state === 'LESSON_COMPLETE') && (
        <button
          style={{ ...escapeBtnStyle, position: 'fixed', top: 12, left: 12, zIndex: 200 }}
          onClick={returnToMenu}
        >
          ← Menu
        </button>
      )}

      {/* Brief pass/fail indicator after returning to walk */}
      {state === 'WORKSHOP_WALK' && lastPassed !== null && (
        <div style={{
          position: 'fixed', top: 12, right: 12, zIndex: 200,
          color: lastPassed ? '#7dcea0' : '#cc4444',
          fontFamily: 'sans-serif', fontSize: 14,
        }}>
          {lastPassed ? '✓ Lesson passed' : '✗ Lesson failed'}
        </div>
      )}
    </div>
  );
}

const hudStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 32,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 50,
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  background: 'rgba(26,26,26,0.85)',
  borderRadius: 8,
  padding: '12px 20px',
  fontFamily: 'sans-serif',
  fontSize: 14,
  color: '#e0e0e0',
};

const tempBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#c8873a',
  color: '#1a1a1a',
  border: 'none',
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};

const escapeBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  color: '#888',
  border: '1px solid #444',
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
};
