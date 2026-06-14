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

import { useRef, useEffect, useState } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Lighting, Room, Furniture } from '../../workshop/index.js';
import { Lathe } from '../../lathe/index.js';
import { TurningScene } from '../../lesson/index.js';
import { InputToggle, CoachingOverlay } from '../../ui/index.js';
import { useSettingsStore } from '../../ui/settingsStore.js';
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

// ─── Overhead view (press V to toggle) ───────────────────────────────────────
// High and looking down over the blank — turners change sightline constantly to
// judge roundness/progress. Kept angled (not straight top-down) so the cursor-
// follow tool still tracks correctly through this camera. Tunable.
const OVERHEAD_CAM_POS: [number, number, number] = [0.23, 2.30, 0.60];
const OVERHEAD_CAM_TARGET: [number, number, number] = [0.23, 1.10, 0.0];
const OVERHEAD_CAM_FOV = 64;

interface CamPreset {
  name: string;
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
}

/** TURNING camera presets — cycle with the V key. Index 0 is the default. */
const CAM_PRESETS: CamPreset[] = [
  { name: 'Operator', pos: OPERATOR_CAM_POS, target: OPERATOR_CAM_TARGET, fov: OPERATOR_CAM_FOV },
  { name: 'Overhead', pos: OVERHEAD_CAM_POS, target: OVERHEAD_CAM_TARGET, fov: OVERHEAD_CAM_FOV },
];

// Pre-allocated Three.js target so lookAt is NEVER called with a heap-allocation
// on every render frame (it's .set() in a preset-change effect, not per frame).
const _camTarget = new THREE.Vector3(...OPERATOR_CAM_TARGET);

// ─────────────────────────────────────────────────────────────────────────────

interface Props { ctx: SceneCtx }

export function TurningScene3D({ ctx }: Props) {
  const {
    lesson, adapter, adapterReady, poseContainer, woodState,
    runStateRef, handleEvalResult, setLastResult, completionResult,
  } = ctx;

  // Ref to the camera so we can reposition + lookAt on preset change (no per-frame alloc).
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [camIdx, setCamIdx] = useState(0);

  // V cycles the camera preset (operator ↔ overhead) while turning.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') {
        setCamIdx((i) => (i + 1) % CAM_PRESETS.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Apply the active preset (position + fov + look-at) whenever it changes.
  useEffect(() => {
    const cam = camRef.current;
    if (cam === null) return;
    const preset = CAM_PRESETS[camIdx];
    if (preset === undefined) return;
    cam.position.set(preset.pos[0], preset.pos[1], preset.pos[2]);
    cam.fov = preset.fov;
    cam.updateProjectionMatrix();
    // _camTarget was pre-allocated above — mutate in place, zero heap cost.
    _camTarget.set(preset.target[0], preset.target[1], preset.target[2]);
    cam.lookAt(_camTarget);
  }, [camIdx]);

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

  // Gate CoachingOverlay on the gameplay.coachingOverlay setting.
  const coachingOverlayEnabled = useSettingsStore((s) => s.gameplay.coachingOverlay);

  if (lesson === null) return null;

  return (
    <>
      <InputToggle
        source={inputSource}
        onSwitch={setInputSource}
        cameraAvailable={cameraAvailable}
      />
      {coachingOverlayEnabled && (
        <CoachingOverlay
          lesson={lesson}
          lastResult={lastResult}
          woodState={woodState.current}
          toolAngleDeg={toolAngleDeg}
        />
      )}
      {/* View-toggle hint — turners change sightline often (press V). */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          padding: '4px 10px',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.45)',
          color: '#e8e2d0',
          font: '12px system-ui, sans-serif',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        Press <b>V</b> to change view (operator / overhead)
      </div>
    </>
  );
}
