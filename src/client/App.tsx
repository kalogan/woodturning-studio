import { useCallback, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSceneStore } from '../workshop/index.js';
import { nextProximityZone, horizontalDistance } from '../workshop/index.js';
import { useSessionStore } from '../session/index.js';
import { getCurriculum } from '../session/index.js';
import { LessonSelect, CoachingOverlay, InputToggle } from './ui/index.js';
import { TurningScene, LessonComplete, useTurningSession } from './lesson/index.js';
import type { EvalResult } from './lesson/index.js';
import { Room, Furniture, Lighting } from './workshop/index.js';
import { Lathe } from './lathe/index.js';
import { FPSCamera } from './scene/index.js';
import type { PhysicsResult } from '../core/types.js';
import type React from 'react';

// ── Tool-rest world XZ position ────────────────────────────────────────────
// Derived from content/lathe/jet-jwl-1642.json + Lathe.tsx layout math.
// Lathe is placed at [0, 0, 0] in App; proximity check is XZ-plane only.
//
//   bedLeftX             = -bed.length / 2                      = -0.725
//   headstockSpindleFaceX = bedLeftX + headstock.width
//                         + headstock.spindleNoseLength         = -0.365
//   banjoCentreX          = headstockSpindleFaceX
//                         + betweenCenters * 0.4               ≈  0.062
//   toolRestZ             = banjoCentreZ (0) + blankRadius (0.07)
//                         + toolRest.barDiameter (0.022)        =  0.092
//
// DO NOT edit Lathe.tsx or content/lathe/*.json to change these — read only.
const TOOL_REST_WORLD_X =  0.062;
const TOOL_REST_WORLD_Z =  0.092;

export default function App() {
  const {
    state,
    activeLessonId,
    lastPassed,
    startLesson,
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

  // ── FPS walk + proximity ────────────────────────────────────────────────
  // Player position stored as scalars in refs — no per-frame object allocation.
  const playerX = useRef(0);
  const playerZ = useRef(2.5); // Start near the back of the workshop, facing the lathe

  // Called every frame by FPSCamera with updated XZ position (scalars only).
  const handlePlayerMove = useCallback((x: number, z: number) => {
    playerX.current = x;
    playerZ.current = z;

    // Compute horizontal distance to tool rest and drive proximity transitions.
    // enterLathe() / stepBack() are guarded no-ops if the scene state is wrong,
    // so calling them every frame is safe.
    const dist = horizontalDistance(x, z, TOOL_REST_WORLD_X, TOOL_REST_WORLD_Z);
    const currentZone =
      useSceneStore.getState().state === 'AT_LATHE' ? 'AT_LATHE' : 'WORKSHOP_WALK';
    const nextZone = nextProximityZone(currentZone, dist);

    if (nextZone === 'AT_LATHE' && currentZone === 'WORKSHOP_WALK') {
      useSceneStore.getState().enterLathe();
    } else if (nextZone === 'WORKSHOP_WALK' && currentZone === 'AT_LATHE') {
      useSceneStore.getState().stepBack();
    }
  }, []);

  // ── Interact (E key) handler — called from FPSCamera frame loop ─────────
  // Tool-pickup seam: AT_LATHE + interact → TURNING
  // FPSController edge-triggers interact, so this is only true for one frame.
  // We read it inside FPSCamera's useFrame via onInteract prop.
  const handleInteract = useCallback(() => {
    if (useSceneStore.getState().state === 'AT_LATHE') {
      pickUpTool();
    }
  }, [pickUpTool]);

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

  // Workshop scene rendered in WORKSHOP_WALK, AT_LATHE, and LESSON_COMPLETE states.
  // FPSCamera replaces OrbitControls in walk/at-lathe states.
  const workshopScene = (
    <>
      <Lighting />
      <Room />
      <Furniture />
      {/* Lathe is floor-standing; its own stand provides working height */}
      <Lathe position={[0, 0, 0]} defaultBlankVisible />
    </>
  );

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a1a', position: 'relative' }}>
      {/* ── Single persistent Canvas — never conditionally unmounted ── */}
      <Canvas shadows camera={{ position: [0, 1.6, 2.5], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 4, 3]} intensity={1.2} />

        {(state === 'WORKSHOP_WALK' || state === 'AT_LATHE') && (
          <>
            {workshopScene}
            {/* FPS walk controller — replaces OrbitControls in walk/lathe states */}
            <FPSCamera onMove={handlePlayerMove} onInteract={handleInteract} />
          </>
        )}

        {state === 'LESSON_COMPLETE' && (
          <>
            {workshopScene}
            {/* Use orbit in lesson-complete so player can see the result */}
            <OrbitControls target={[0, 1.05, 0]} />
          </>
        )}

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
        {/* OrbitControls for turning view — Slice C replaces with locked turning camera */}
        {state === 'TURNING' && <OrbitControls />}
      </Canvas>

      {/* ── DOM overlays by state ──────────────────────────────────── */}

      {state === 'MENU' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <LessonSelect onStart={(id) => { startLesson(id); }} />
        </div>
      )}

      {/* WORKSHOP_WALK: show lesson title + walk hint overlay */}
      {state === 'WORKSHOP_WALK' && lesson !== null && (
        <div style={hudStyle}>
          <span style={{ color: '#c8873a', fontWeight: 600 }}>{lesson.title}</span>
          <span style={{ color: '#aaa', fontSize: 12 }}>
            Click to look · WASD to walk · approach the lathe to lock in
          </span>
          <button style={escapeBtnStyle} onClick={returnToMenu}>← Menu</button>
        </div>
      )}

      {/* AT_LATHE: proximity-locked — show E-to-grab affordance.
          Tool-pickup seam: E key triggers pickUpTool() via FPSCamera onInteract. */}
      {state === 'AT_LATHE' && (
        <div style={hudStyle}>
          <span style={{ color: '#c8873a', fontWeight: 600 }}>At the lathe</span>
          <span style={{ color: '#e0e0e0', fontSize: 13 }}>
            Press <kbd style={kbdStyle}>E</kbd> to pick up the tool
          </span>
          <span style={{ color: '#888', fontSize: 12 }}>
            Step back to return to walk mode
          </span>
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

      {/* Escape hatch — always available in non-MENU states (WORKSHOP_WALK has its own) */}
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

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  background: '#444',
  color: '#fff',
  borderRadius: 4,
  padding: '1px 6px',
  fontFamily: 'monospace',
  fontSize: 13,
  border: '1px solid #666',
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
