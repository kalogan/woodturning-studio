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
import { LoadingOverlay } from './LoadingOverlay.js';
import { FirstFrameSignal } from './FirstFrameSignal.js';

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
  const hasScene3D = Scene3D !== undefined;

  // ── Loading indicator for heavy 3D scene mounts ───────────────────────────
  // Entering a Scene3D state synchronously builds a lot of procedural geometry
  // (~3–4 s). Rendering the overlay in the SAME commit as <Scene3D> would not
  // paint until after that block. So when a 3D scene first needs to mount we:
  //   1. show the overlay and DEFER the <Scene3D> mount by one tick (the
  //      overlay paints first),
  //   2. then mount <Scene3D> (which blocks),
  //   3. hide the overlay once FirstFrameSignal fires (first real frame),
  //      with a 6 s safety timeout so it can never get stuck on.
  // The single <Canvas> is NEVER unmounted — only the Scene3D content render
  // and overlay visibility are gated.
  //
  // `everMounted3D` latches once the FIRST heavy 3D scene has been mounted, so
  // the loader shows on the very first entry into a 3D scene (the expensive
  // one). Later WALK↔AT_LATHE↔TURNING transitions don't re-show it — keeping
  // this simple while covering the one case the player actually waits on.
  const everMounted3DRef = useRef(false);
  const [mountScene, setMountScene] = useState(false);
  const [loading, setLoading] = useState(false);

  // Drive the deferred-mount sequence. For non-3D states (MENU) there is no
  // heavy content: mount immediately and never show the loader. For the first
  // 3D state, defer the mount one tick so the overlay paints before the freeze.
  useEffect(() => {
    if (!hasScene3D) {
      setMountScene(true);
      setLoading(false);
      return;
    }
    // Already past the first heavy mount — render scene content directly.
    if (everMounted3DRef.current) {
      setMountScene(true);
      setLoading(false);
      return;
    }

    // First entry into a 3D scene: show overlay now, defer the heavy mount so
    // the overlay can paint before the synchronous geometry build freezes the
    // main thread.
    setMountScene(false);
    setLoading(true);
    // Defer the heavy mount via setTimeout (NOT requestAnimationFrame): rAF is
    // paused while the page/tab is hidden, which would leave the scene unmounted
    // until the tab regains focus. setTimeout still fires when hidden, so the
    // workshop always finishes mounting. A 0 ms macrotask still lets the browser
    // paint the overlay (committed this render) before the geometry build freezes
    // the main thread on the next task.
    const deferMount = window.setTimeout(() => {
      everMounted3DRef.current = true;
      setMountScene(true);
    }, 0);
    // Safety net: never let the loader stick on even if the first frame
    // signal never fires.
    const timeout = window.setTimeout(() => { setLoading(false); }, 6000);
    return () => {
      window.clearTimeout(deferMount);
      window.clearTimeout(timeout);
    };
  }, [hasScene3D, state]);

  // Cleared by FirstFrameSignal once the heavy scene paints its first frame.
  const handleSceneReady = useCallback(() => {
    setLoading(false);
  }, []);

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
        {/* Scene3D mount is deferred one tick so the loading overlay paints
            first; the Canvas itself stays mounted so WebGL context and
            pointer lock are preserved. */}
        {Scene3D !== undefined && mountScene && (
          <>
            <Scene3D ctx={ctx} />
            {loading && <FirstFrameSignal onReady={handleSceneReady} />}
          </>
        )}
      </Canvas>

      {/* ── Loading overlay — DOM, above the Canvas, while a 3D scene mounts ── */}
      {loading && <LoadingOverlay />}

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
