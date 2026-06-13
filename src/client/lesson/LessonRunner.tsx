import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { createWoodState } from '../../core/physics.js';
import { MouseAdapter } from '../../input/mouseAdapter.js';
import { CameraAdapter } from '../../input/cameraAdapter.js';
import type { InputAdapter, InputSource } from '../../input/types.js';
import { WoodBlank } from '../wood/index.js';
import { ToolMesh, PhysicsLoop } from '../scene/index.js';
import { useSessionStore } from '../../session/index.js';
import type { CurriculumLesson } from '../../session/index.js';
import type { WoodState, ToolPose, PhysicsResult } from '../../core/types.js';
import { evaluateLesson } from './LessonEvaluator.js';
import type { RefObject } from 'react';
import type { LessonRunState, EvalResult } from './LessonEvaluator.js';
import { LessonComplete } from './LessonComplete.js';
import { CoachingOverlay, InputToggle } from '../ui/index.js';

interface LessonRunnerProps {
  lesson: CurriculumLesson;
  onComplete: (passed: boolean) => void;
}

const DEFAULT_POSE: ToolPose = {
  position: { x: 0, y: 0, z: 0 },
  angleX: 0.3,
  angleY: 0,
  pressure: 0,
};

interface PoseContainer {
  pose: ToolPose;
}

interface SceneProps {
  lesson: CurriculumLesson;
  adapter: InputAdapter;
  poseContainer: PoseContainer;
  woodState: WoodState;
  runStateRef: RefObject<LessonRunState>;
  onEvalResult: (result: EvalResult) => void;
  onResult: (result: PhysicsResult) => void;
  completed: boolean;
}

function Scene({
  lesson,
  adapter,
  poseContainer,
  woodState,
  runStateRef,
  onEvalResult,
  onResult,
  completed,
}: SceneProps) {
  const [, rerender] = useState(0);

  useFrame(() => {
    const latest = adapter.getLatestPose();
    if (latest !== null) {
      poseContainer.pose = latest;
    }
    rerender((n) => n + 1);
  });

  const handleResult = useCallback(
    (r: PhysicsResult) => {
      onResult(r);

      if (completed) return;

      const run = runStateRef.current;
      run.totalMaterialRemoved += r.materialRemoved;
      if (r.catch) run.catchCount += 1;

      // Update max tearout from all stations
      let maxT = run.maxTearout;
      for (let i = 0; i < woodState.tearout.length; i++) {
        const t = woodState.tearout[i] ?? 0;
        if (t > maxT) maxT = t;
      }
      run.maxTearout = maxT;

      const evalResult = evaluateLesson(lesson, run, woodState);
      if (evalResult !== null) {
        onEvalResult(evalResult);
      }
    },
    [completed, lesson, onEvalResult, onResult, runStateRef, woodState],
  );

  return (
    <>
      <WoodBlank woodState={woodState} length={0.3} radius={0.05} />
      <ToolMesh toolKind={lesson.tool} pose={poseContainer.pose} />
      <PhysicsLoop
        woodState={woodState}
        toolPose={poseContainer.pose}
        toolKind={lesson.tool}
        onResult={handleResult}
      />
    </>
  );
}

export function LessonRunner({ lesson, onComplete }: LessonRunnerProps) {
  const woodState = useRef<WoodState>(createWoodState(0.3, 0.05));
  const adapterRef = useRef<InputAdapter | null>(null);
  const poseContainer = useRef<PoseContainer>({ pose: DEFAULT_POSE });
  const runStateRef = useRef<LessonRunState>({
    totalMaterialRemoved: 0,
    catchCount: 0,
    maxTearout: 0,
    elapsed: 0,
  });

  const [completionResult, setCompletionResult] = useState<EvalResult | null>(null);
  const [lastResult, setLastResult] = useState<PhysicsResult | null>(null);
  const [inputSource, setInputSource] = useState<InputSource>('mouse');
  const [cameraAvailable] = useState<boolean>(
    typeof navigator !== 'undefined' &&
      'mediaDevices' in navigator &&
      'getUserMedia' in navigator.mediaDevices,
  );
  const [adapterReady, setAdapterReady] = useState(false);

  useEffect(() => {
    setAdapterReady(false);
    const adapter: InputAdapter =
      inputSource === 'camera' ? new CameraAdapter() : new MouseAdapter();
    adapterRef.current = adapter;

    adapter.start().then(() => {
      setAdapterReady(true);
    }).catch(() => {
      // Camera permission denied or unavailable — fall back to mouse
      adapter.stop();
      const fallback = new MouseAdapter();
      adapterRef.current = fallback;
      fallback.start().catch(() => { /* no-op */ });
      setInputSource('mouse');
      setAdapterReady(true);
    });

    return () => {
      adapter.stop();
    };
  }, [inputSource]);

  const handleEvalResult = useCallback(
    (result: EvalResult) => {
      setCompletionResult((prev) => {
        if (prev !== null) return prev; // already done
        // Persist to session store
        const score = result.passed ? 1 : 0;
        useSessionStore.getState().completeLesson(lesson.id, score).catch(() => {
          /* no-op */
        });
        return result;
      });
    },
    [lesson.id],
  );

  const handleContinue = useCallback(() => {
    if (completionResult !== null) {
      onComplete(completionResult.passed);
    }
  }, [completionResult, onComplete]);

  const adapter = adapterRef.current;
  const toolAngleDeg = (poseContainer.current.pose.angleX * 180) / Math.PI;

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a1a', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0.3, 0.8], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 4, 3]} intensity={1.2} />
        {adapter !== null && adapterReady && (
          <Scene
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
        <OrbitControls />
      </Canvas>

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

      {completionResult !== null && (
        <LessonComplete
          result={completionResult}
          lessonTitle={lesson.title}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}
