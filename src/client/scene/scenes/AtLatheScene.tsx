/**
 * AtLatheScene — R3F Scene3D for AT_LATHE state.
 *
 * The player has been proximity-locked at the lathe. This scene replaces
 * the FPS walk view with a fixed operator camera + free mouse cursor so the
 * player can click the START button and drag the speed dial on the Headstock.
 *
 * Key design points:
 *  - NO <FPSCamera> here — we don't request pointer lock, cursor stays free.
 *  - Fixed <PerspectiveCamera makeDefault> aimed at the control panel face.
 *  - <Lathe defaultBlankVisible> — blank is on the spindle ready to turn.
 *  - useFrame ticks the lathe store so currentRpm eases toward targetRpm
 *    and the RPM readout on the Headstock updates each frame.
 *
 * Camera constants are DRAFT values — easy to tune visually on localhost:5173.
 * See the comment block below for guidance.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Lighting, Room, Furniture } from '../../workshop/index.js';
import { Lathe } from '../../lathe/index.js';
import { ToolRack } from '../../lathe/ToolRack.js';
import { useLatheStore } from '../../../workshop/index.js';
import { useSceneStore } from '../../../workshop/index.js';
import type { ToolKind } from '../../../core/types.js';
import type { SceneCtx } from '../sceneCtx.js';

// ─── Director tuning knobs ────────────────────────────────────────────────────
//
// ATLATHE_CAM_POS: operator eye position, standing at the front (+Z) of the
//   lathe, looking toward the headstock control panel.
//   Tweak Z to move closer/further from the panel (positive = closer to front).
//   Tweak Y for operator height.
//   Tweak X to shift left (−) or right (+) along the bed.
//
// ATLATHE_CAM_TARGET: the point the camera looks at — aimed at the control
//   panel which sits on the front face of the headstock (roughly X≈0.15,
//   Y≈1.20, Z≈0.20 in world space when lathe is at origin).
//
// ATLATHE_CAM_FOV: narrower (50°) to pull in the control panel detail;
//   widen if the director wants to see more of the shop surround.
//
// All three are FIRST-PASS DRAFT values — easy to tune without hunting code.
// ─────────────────────────────────────────────────────────────────────────────

/** Operator eye position: ~0.9 m in front of the lathe headstock panel, ~1.55 m tall. */
const ATLATHE_CAM_POS: [number, number, number] = [0.15, 1.55, 0.9];

/** Point the camera looks at: approximate centre of the control panel face. */
const ATLATHE_CAM_TARGET: [number, number, number] = [0.15, 1.20, 0.15];

/** Vertical FOV — tighter than walking to fill the view with the control panel. */
const ATLATHE_CAM_FOV = 50;

// Pre-allocated target vector — lookAt is called once in useEffect, not per frame.
const _camTarget = new THREE.Vector3(...ATLATHE_CAM_TARGET);

// ─────────────────────────────────────────────────────────────────────────────

// Display names for coaching messages
const TOOL_DISPLAY_NAMES: Record<ToolKind, string> = {
  'roughing-gouge': 'roughing gouge',
  'spindle-gouge': 'spindle gouge',
  'parting-tool': 'parting tool',
};

// Hint auto-clear timer id (module-level scalar — no heap object per render)
let _hintTimerId = 0;

interface Props { ctx: SceneCtx }

export function AtLatheScene({ ctx }: Props) {
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Grab handler: called by ToolRack with the clicked tool.
  // Correct tool → pickUpTool (AT_LATHE → TURNING).
  // Wrong tool   → transient coaching nudge, no grab.
  const handleGrab = useCallback((clickedTool: ToolKind) => {
    const expectedTool = ctx.lesson?.tool ?? null;

    if (expectedTool === null) {
      // No active lesson — grab anything (fallback safety)
      useSceneStore.getState().pickUpTool(clickedTool);
      return;
    }

    if (clickedTool === expectedTool) {
      useSceneStore.getState().pickUpTool(clickedTool);
    } else {
      // Wrong tool — show coaching nudge, do NOT grab
      const clickedName = TOOL_DISPLAY_NAMES[clickedTool];
      const expectedName = TOOL_DISPLAY_NAMES[expectedTool];
      const hint = `That's the ${clickedName} — this lesson needs the ${expectedName}`;
      useSceneStore.getState().setToolHint(hint);

      // Auto-clear after 3 s; cancel any previous timer (scalar, no object)
      window.clearTimeout(_hintTimerId);
      _hintTimerId = window.setTimeout(() => {
        useSceneStore.getState().setToolHint(null);
      }, 3000);
    }
  }, [ctx.lesson]);

  // Point the camera at the control panel once after mount.
  useEffect(() => {
    const cam = camRef.current;
    if (cam === null) return;
    // _camTarget was pre-allocated above — zero heap cost here.
    cam.lookAt(_camTarget);
  }, []);

  // Tick the lathe motor each frame so currentRpm eases toward targetRpm
  // and the Headstock's live RPM readout canvas stays current.
  // One ticker is enough; it lives here close to the controls.
  useFrame((_, dt) => {
    useLatheStore.getState().tick(dt);
  });

  return (
    <>
      {/* ── Fixed operator camera ─────────────────────────────────────────── */}
      {/* makeDefault replaces the default R3F camera; no OrbitControls / FPS. */}
      {/* The cursor stays free — no pointer-lock is requested here.           */}
      <PerspectiveCamera
        ref={camRef}
        makeDefault
        position={ATLATHE_CAM_POS}
        fov={ATLATHE_CAM_FOV}
      />

      {/* ── Workshop geometry — mirrors WalkScene composition ─────────────── */}
      <Lighting />
      <Room />
      <Furniture />

      {/*
       * Lathe at world origin.
       * defaultBlankVisible = true so the spindle has a blank mounted,
       * ready for the player to power on and then pick up the tool (→ TURNING).
       * Headstock's interactive START button + speed dial live inside <Lathe>.
       */}
      <Lathe position={[0, 0, 0]} defaultBlankVisible />

      {/*
       * Tool rack on the wall to the operator's left.
       * Position defined by RACK_POS in ToolRack.tsx — director-tunable.
       * onGrab wires the right-tool gate: correct → TURNING; wrong → nudge.
       */}
      <ToolRack onGrab={handleGrab} />

      {/*
       * NOTE: a static "reaching hand" was removed here — a single disembodied
       * hand floating at the panel (no connecting arm) read as awful. A proper
       * controls-hand should come from the lower frame edge (the operator's arm)
       * or appear only on interaction; deferred to a deliberate, eyeball-tuned pass.
       */}
    </>
  );
}
