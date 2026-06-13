/**
 * TurningEntry — R3F Scene3D + DOM Overlay for TURNING state.
 *
 * Scene3D: renders TurningScene (lathe + wood + physics) and OrbitControls.
 * Overlay: renders InputToggle and CoachingOverlay.
 *
 * Note: TurningScene is only rendered when adapter is ready and lesson is set,
 * matching the original guard in App.tsx.
 */

import { OrbitControls } from '@react-three/drei';
import { TurningScene } from '../../lesson/index.js';
import { InputToggle, CoachingOverlay } from '../../ui/index.js';
import type { SceneCtx } from '../sceneCtx.js';

interface Props { ctx: SceneCtx }

export function TurningScene3D({ ctx }: Props) {
  const {
    lesson, adapter, adapterReady, poseContainer, woodState,
    runStateRef, handleEvalResult, setLastResult, completionResult,
  } = ctx;

  return (
    <>
      {lesson !== null && adapter !== null && adapterReady && (
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
      <OrbitControls />
    </>
  );
}

export function TurningOverlay({ ctx }: Props) {
  const { lesson, inputSource, setInputSource, cameraAvailable, lastResult, woodState, toolAngleDeg } = ctx;

  if (lesson === null) return null;

  return (
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
  );
}
