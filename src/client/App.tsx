import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import AudioManager from './audio/AudioManager.js';
import { useSceneStore } from '../workshop/index.js';
import { nextProximityZone, horizontalDistance } from '../workshop/index.js';
import { useSessionStore } from '../session/index.js';
import { getCurriculum } from '../session/index.js';
import { useTurningSession } from './lesson/index.js';
import type { EvalResult } from './lesson/index.js';
import type { PhysicsResult } from '../core/types.js';
import { sceneRegistry } from './scene/sceneRegistry.js';
import { escapeBtnStyle } from './scene/sharedStyles.js';
import type { SceneCtx } from './scene/sceneCtx.js';
import { SettingsMenu } from './ui/SettingsMenu.js';
import { useSettingsStore } from './ui/settingsStore.js';

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
    startSetup,
    finishSetup,
    pickUpTool,
    finishCutscene,
    returnToMenu,
    leaveLathe,
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

  // ── Settings menu: Esc key toggles the modal ───────────────────────────────
  // A global keydown listener at the App level; minimal — just toggle().
  // Esc also releases pointer lock (browser default), which is desirable —
  // the menu needs free cursor movement.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        useSettingsStore.getState().toggle();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); };
  }, []);

  // ── FPS walk + proximity ────────────────────────────────────────────────
  // Player position stored as scalars in refs — no per-frame object allocation.
  const playerX = useRef(-14); // Match WALK_SPAWN.x in FPSCamera — entrance end of long hall
  const playerZ = useRef(1.5); // Match WALK_SPAWN.z in FPSCamera

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
  // E is a shortcut that grabs the lesson's CORRECT tool directly —
  // it bypasses the wrong-tool gate (the rack UI enforces that for mouse clicks).
  // If no lesson is active we do nothing (lesson is null → no tool to grab).
  const handleInteract = useCallback(() => {
    if (useSceneStore.getState().state === 'AT_LATHE' && lesson !== null) {
      pickUpTool(lesson.tool);
    }
  }, [pickUpTool, lesson]);

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

  // ── Build the shared context bag ─────────────────────────────────────────
  const ctx: SceneCtx = {
    state,
    activeLessonId,
    lastPassed,
    startLesson,
    startSetup,
    finishSetup,
    pickUpTool,
    finishCutscene,
    returnToMenu,
    leaveLathe,
    lesson,
    adapter,
    adapterReady,
    poseContainer,
    woodState,
    runStateRef,
    inputSource,
    setInputSource,
    cameraAvailable,
    toolAngleDeg,
    completionResult,
    lastResult,
    handlePlayerMove,
    handleInteract,
    handleEvalResult,
    handleContinue,
    setLastResult,
  };

  // ── Registry lookup ───────────────────────────────────────────────────────
  const entry = sceneRegistry[state];
  const { Scene3D, Overlay } = entry;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a1a', position: 'relative' }}>
      {/* ── Audio manager — always mounted, renders null, unlocks on first gesture ── */}
      <AudioManager />

      {/* ── Settings modal — always mounted, visible only when isOpen=true ── */}
      <SettingsMenu />

      {/* ── Single persistent Canvas — never conditionally unmounted ── */}
      <Canvas shadows camera={{ position: [0, 1.6, 2.5], fov: 75 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 4, 3]} intensity={1.2} />
        {Scene3D !== undefined && <Scene3D ctx={ctx} />}
      </Canvas>

      {/* ── DOM overlays by state (via registry) ─────────────────────── */}
      {Overlay !== undefined && <Overlay ctx={ctx} />}

      {/* Escape hatch — available for SETUP / AT_LATHE / LESSON_COMPLETE.
          TURNING is excluded: TurningOverlay's bottom bar provides both
          "Step away" and "Menu" so no duplicate button is needed here.
          WORKSHOP_WALK has its own ← Menu button embedded in the HUD. */}
      {(state === 'SETUP' || state === 'AT_LATHE' || state === 'LESSON_COMPLETE') && (
        <button
          style={{ ...escapeBtnStyle, position: 'fixed', top: 12, left: 12, zIndex: 200 }}
          onClick={returnToMenu}
        >
          ← Menu
        </button>
      )}
    </div>
  );
}
