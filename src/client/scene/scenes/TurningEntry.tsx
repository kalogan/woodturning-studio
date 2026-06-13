/**
 * TurningEntry — R3F Scene3D + DOM Overlay for TURNING state.
 *
 * Scene3D: renders the full workshop in first-person (Lighting, Room, Furniture, Lathe),
 * a FIXED operator camera, and the turning rig (TurningScene) positioned on the spindle.
 *
 * Overlay: renders InputToggle and CoachingOverlay (unchanged from A-series).
 *
 * Note: TurningScene is only rendered when adapter is ready and lesson is set,
 * matching the original guard in App.tsx.
 */

import { useRef, useEffect } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Lighting, Room, Furniture } from '../../workshop/index.js';
import { Lathe } from '../../lathe/index.js';
import { TurningScene } from '../../lesson/index.js';
import { InputToggle, CoachingOverlay } from '../../ui/index.js';
import type { SceneCtx } from '../sceneCtx.js';

// ─── Director tuning knobs ────────────────────────────────────────────────────
//
// OPERATOR_CAM_POS: eye position of the operator standing at the lathe (+Z side,
//   ~eye height).  Nudge Z to move closer/further; Y for taller/shorter operator.
//
// OPERATOR_CAM_TARGET: the point the camera looks at — roughly the blank centre
//   on the spindle axis (X ≈ +0.23, Y ≈ spindle height, Z = 0).
//
// OPERATOR_CAM_FOV: vertical field-of-view in degrees (60 feels natural for
//   a close-up of the lathe; widen to see more of the shop).
//
// All three are FIRST-PASS DRAFT values — easy to tune without hunting through code.
// ─────────────────────────────────────────────────────────────────────────────

/** Operator eye position: ~1.0 m in front of (+Z) the lathe, ~1.65 m tall. */
const OPERATOR_CAM_POS: [number, number, number] = [0.23, 1.65, 1.0];

/** Point the camera looks at: blank centre on the spindle axis. */
const OPERATOR_CAM_TARGET: [number, number, number] = [0.23, 1.10, 0.0];

/** Vertical FOV in degrees — narrower pulls in the lathe detail. */
const OPERATOR_CAM_FOV = 60;

// Pre-allocated Three.js target so lookAt is NEVER called with a heap-allocation
// on every render frame (it's called once in useEffect).
const _camTarget = new THREE.Vector3(...OPERATOR_CAM_TARGET);

// ─────────────────────────────────────────────────────────────────────────────

interface Props { ctx: SceneCtx }

export function TurningScene3D({ ctx }: Props) {
  const {
    lesson, adapter, adapterReady, poseContainer, woodState,
    runStateRef, handleEvalResult, setLastResult, completionResult,
  } = ctx;

  // Ref to the camera so we can call lookAt once after mount (no per-frame alloc).
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    const cam = camRef.current;
    if (cam === null) return;
    // _camTarget was pre-allocated above — zero heap cost here.
    cam.lookAt(_camTarget);
  }, []);

  return (
    <>
      {/* ── Fixed operator camera ── PRIMARY TUNING KNOB (see constants above) */}
      <PerspectiveCamera
        ref={camRef}
        makeDefault
        position={OPERATOR_CAM_POS}
        fov={OPERATOR_CAM_FOV}
      />

      {/* ── Workshop geometry ── mirrors WalkScene composition exactly ──────── */}
      <Lighting />
      <Room />
      <Furniture />
      {/*
       * Lathe at world origin, stand included.
       * NO defaultBlankVisible — the physics TurningScene blank is the blank now.
       * Read-only import — no lathe files were modified (constraint §7 satisfied).
       */}
      <Lathe position={[0, 0, 0]} />

      {/* ── Turning rig (WoodBlank + ToolMesh + PhysicsLoop) ────────────────── */}
      {/* Guard mirrors original App.tsx guard — only render when ready */}
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
      {/* OrbitControls deliberately REMOVED — replaced by fixed operator camera */}
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
