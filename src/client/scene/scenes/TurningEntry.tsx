/**
 * TurningEntry — R3F Scene3D + DOM Overlay for TURNING state.
 *
 * Scene3D: renders the full workshop in first-person (Lighting, Room, Furniture, Lathe),
 * a FIXED operator camera, and the turning rig (TurningScene) positioned on the spindle.
 *
 * Overlay: two clean zones —
 *   • Top-left info panel  — lesson title + coaching cue + tool-angle readout.
 *   • Bottom-centre bar    — InputToggle (inline) | view hint | Step Away | Menu.
 *
 * Note: TurningScene is only rendered when adapter is ready and lesson is set,
 * matching the original guard in App.tsx.
 */

import { useRef, useEffect, useState } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import { useScrollZoom } from '../useScrollZoom.js';
import * as THREE from 'three';
import { Lighting, Room, Furniture } from '../../workshop/index.js';
import { Lathe } from '../../lathe/index.js';
import { TurningScene } from '../../lesson/index.js';
import { InputToggle, CoachingOverlay } from '../../ui/index.js';
import { useSettingsStore } from '../../ui/settingsStore.js';
import { escapeBtnStyle } from '../sharedStyles.js';
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

  // Tracks the active preset's base FOV so useScrollZoom knows the zoom-out ceiling.
  // Updated synchronously in the preset-apply effect below (before the next paint).
  // Pre-initialised to the default preset (index 0 = operator).
  const activeBaseFovRef = useRef<number>(CAM_PRESETS[0]?.fov ?? OPERATOR_CAM_FOV);

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
  // Also updates activeBaseFovRef so the scroll-zoom ceiling reflects the new preset.
  // Toggling V resets camera fov to the preset — zoom resets naturally.
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
    // Update the zoom ceiling for useScrollZoom — no re-render needed (ref mutation).
    activeBaseFovRef.current = preset.fov;
  }, [camIdx]);

  // Scroll-wheel zoom: "original" FOV = current preset's fov (read via ref).
  // Toggling V resets fov to preset.fov, so zoom resets on view change.
  useScrollZoom(() => activeBaseFovRef.current);

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

// ── Bottom-bar shared style ────────────────────────────────────────────────────
const bottomBarStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: 'rgba(20,18,14,0.82)',
  borderRadius: 10,
  padding: '10px 18px',
  zIndex: 100,
  pointerEvents: 'none', // re-enabled per interactive child below
  userSelect: 'none',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
  color: '#e8e2d0',
  whiteSpace: 'nowrap',
};

// Thin vertical divider between bar sections
const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 22,
  background: 'rgba(200,180,140,0.25)',
  flexShrink: 0,
};

// Re-enable pointer events on interactive children inside the no-events bar
const interactiveStyle: React.CSSProperties = { pointerEvents: 'auto' };

export function TurningOverlay({ ctx }: Props) {
  const {
    lesson, inputSource, setInputSource, cameraAvailable,
    lastResult, woodState, toolAngleDeg,
    returnToMenu, leaveLathe,
  } = ctx;

  // Gate CoachingOverlay on the gameplay.coachingOverlay setting.
  const coachingOverlayEnabled = useSettingsStore((s) => s.gameplay.coachingOverlay);

  if (lesson === null) return null;

  return (
    <>
      {/* ── TOP-LEFT: consolidated info panel ─────────────────────────────── */}
      {/*
       * Contains: lesson title + coaching cues + tool-angle readout.
       * CoachingOverlay already renders the angle + cue pills at top-left;
       * we wrap it with the lesson title to make a single coherent panel.
       * pointerEvents: none — purely informational.
       */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          pointerEvents: 'none',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Lesson title pill */}
        <div
          style={{
            background: 'rgba(20,18,14,0.75)',
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 12,
            color: '#c8a46a',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {lesson.title}
        </div>

        {/* Coaching overlay: angle readout + cue pills */}
        {coachingOverlayEnabled && (
          <CoachingOverlay
            lesson={lesson}
            lastResult={lastResult}
            woodState={woodState.current}
            toolAngleDeg={toolAngleDeg}
          />
        )}
      </div>

      {/* ── BOTTOM-CENTRE: unified control bar ───────────────────────────────
       *
       *  [ 🖱 Mouse  ⇄ Camera ] | [ V — Operator / Overhead ] | [ ⟵ Step away ] [ Menu ]
       *
       *  The bar itself has pointerEvents: none so the 3D scene underneath
       *  receives mouse events everywhere except the interactive controls,
       *  which each restore pointerEvents: auto.
       */}
      <div style={bottomBarStyle}>

        {/* Input toggle — inline mode, no fixed positioning */}
        <div style={interactiveStyle}>
          <InputToggle
            source={inputSource}
            onSwitch={setInputSource}
            cameraAvailable={cameraAvailable}
            inline
          />
        </div>

        <div style={dividerStyle} />

        {/* View hint — non-interactive label */}
        <span style={{ color: '#b0a898', fontSize: 12 }}>
          <kbd
            style={{
              background: '#3a3530',
              color: '#e8e2d0',
              borderRadius: 3,
              padding: '1px 5px',
              fontFamily: 'monospace',
              fontSize: 12,
              border: '1px solid #5a5048',
            }}
          >
            V
          </kbd>
          {' '}Operator / Overhead
        </span>

        <div style={dividerStyle} />

        {/* Step away — returns to WORKSHOP_WALK without losing blank progress */}
        <button
          style={{ ...escapeBtnStyle, ...interactiveStyle, color: '#e8e2d0', borderColor: '#5a5048' }}
          onClick={leaveLathe}
        >
          ⟵ Step away
        </button>

        {/* Menu — hard exit, resets everything */}
        <button
          style={{ ...escapeBtnStyle, ...interactiveStyle }}
          onClick={returnToMenu}
        >
          Menu
        </button>
      </div>
    </>
  );
}
