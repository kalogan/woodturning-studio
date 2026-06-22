/**
 * FPSCamera — First-person walk controller for the workshop.
 *
 * Wraps FPSController (src/input/fpsController.ts) inside an R3F component.
 * Applies yaw/pitch to the camera and translates by WASD input each frame.
 *
 * Constraint compliance:
 *   - NO per-frame heap allocation: all THREE scratch objects are pre-allocated
 *     at module/ref scope and mutated in place inside useFrame.
 *   - FPSController.getInput() returns the same object every call (mutated in place).
 *   - onMove(x, z) callback is called each frame with the current XZ position
 *     via the pre-allocated posRef — the parent reads x/z scalars (no object allocation).
 */

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FPSController, rightVectorXZ } from '../../input/fpsController.js';
import { useSettingsStore } from '../ui/settingsStore.js';
import { emitFootstep } from '../audio/footsteps.js';

// ── Movement constants ─────────────────────────────────────────────────────
const MOVE_SPEED = 2.2;  // metres per second (tunable)
const EYE_HEIGHT = 1.6;  // metres

// ── Footstep cadence ───────────────────────────────────────────────────────
// One footstep is emitted every STEP_INTERVAL metres of actual travel, so the
// cadence scales naturally with MOVE_SPEED (≈ 2.2 / 0.45 ≈ 4.9 steps/s while
// walking). Distance is accumulated from the per-frame XZ delta — scalars only,
// no per-frame heap allocation. Footsteps fire ONLY while moving + pointer-locked.
const STEP_INTERVAL = 0.45;  // metres travelled per footstep (tunable)

/**
 * Walk spawn position (XZ).
 *
 * FPSCamera mounts fresh each time WORKSHOP_WALK begins — both on initial
 * entry and after stepBack() returns from AT_LATHE.  We reset to this spawn
 * so the very first proximity check does NOT immediately re-enter AT_LATHE.
 *
 * CONSTRAINT: this position MUST sit > 1.2 m from the tool rest (world XZ ≈
 * 0.062, 0.092) to stay outside the proximity-exit hysteresis distance.
 * At x = -14, z = 1.5 the distance is ≈ √((-14-0.062)² + (1.5-0.092)²) ≈ 14 m — safe.
 *
 * Long-hallway layout: hall X ∈ [-16, +2]. A narrow ENTRY VESTIBULE corridor
 * extends in -X off the entrance end (X ∈ [-19.5, -16], Z ∈ [0, 2.5]). The
 * player spawns IN the corridor and walks +X through the corridor mouth into the
 * main hall toward the sign + player lathe. WALK_SPAWN_YAW = -π/2 rotates the
 * FPSController yaw so the camera looks in the +X world direction on first frame.
 */
const WALK_SPAWN     = { x: -18.5, z: 1.25 } as const;
// Yaw offset to face +X on spawn: in the 'YXZ' Euler convention used by FPSCamera,
// yaw = 0 → looking -Z; yaw = -π/2 → looking +X (player faces down the hall).
const WALK_SPAWN_YAW = -Math.PI / 2;

/**
 * Walkable bounds — player position (XZ) is clamped inside these limits.
 *
 * The space is an L-shape: the MAIN HALL (wide in Z) plus a narrow VESTIBULE
 * corridor on the -X end (narrow in Z). A single AABB can't represent that, so
 * the clamp is PIECEWISE on X:
 *   • x < HALL_X_MIN (-16) → in the corridor: clamp Z to [VEST_MIN_Z, VEST_MAX_Z]
 *     and X to [VEST_MIN_X, …]
 *   • otherwise            → in the hall:     clamp Z to [ROOM_MIN_Z, ROOM_MAX_Z]
 * ROOM_MAX_X is shared. The corridor Z-range [0.3, 2.2] is a SUBSET of the hall
 * Z-range, so a player crossing the mouth at x ≈ -16 is never suddenly OOB.
 * A ~0.3 m wall-buffer keeps the camera from clipping the walls.
 */
const ROOM_MIN_X = -15.7;
const ROOM_MAX_X =   1.7;
const ROOM_MIN_Z = -2.2;
const ROOM_MAX_Z =  6.95;

// Vestibule corridor clamp (active when x < HALL_X_MIN). Corridor footprint is
// X ∈ [-19.5, -16], Z ∈ [0, 2.5]; buffers pull the clamp ~0.3 m off each wall.
const VEST_HALL_X = -16.0;   // corridor↔hall boundary (= HALL_X_MIN)
const VEST_MIN_X  = -19.2;   // 0.3 m off the outer end wall (X = -19.5)
const VEST_MIN_Z  =   0.3;   // 0.3 m off the -Z corridor wall (Z = 0)
const VEST_MAX_Z  =   2.2;   // 0.3 m off the +Z corridor wall (Z = 2.5)

// ── Pre-allocated THREE scratch objects (module scope — never re-created) ──
// These are mutated in place inside useFrame to satisfy constraint #3.
const _forward = new THREE.Vector3();
const _right   = new THREE.Vector3();
const _rightXZ = { x: 0, z: 0 };  // scratch for rightVectorXZ — mutated in place
const _euler   = new THREE.Euler(0, 0, 0, 'YXZ');

interface FPSCameraProps {
  /** Called each frame with the player's world XZ position (no allocation). */
  onMove: (x: number, z: number) => void;
  /**
   * Called when the E key is pressed (edge-triggered via FPSController).
   * Tool-pickup seam: App.tsx calls pickUpTool() when AT_LATHE.
   */
  onInteract?: () => void;
}

export function FPSCamera({ onMove, onInteract }: FPSCameraProps) {
  const { camera, gl } = useThree();

  // Controller instance — lives for the lifetime of this component.
  const controllerRef = useRef<FPSController | null>(null);

  // Track whether pointer is locked so we skip movement when not focused.
  const pointerLockedRef = useRef(false);

  // ── Footstep scheduling state (scalars — no per-frame allocation) ─────────
  // stepDistanceRef accumulates metres travelled this stride; when it crosses
  // STEP_INTERVAL we emit a footstep and subtract the interval. stepIndexRef is
  // the monotonic step counter whose parity drives deterministic (RNG-free)
  // left/right timbre variation.
  const stepDistanceRef = useRef(0);
  const stepIndexRef = useRef(0);

  // ── Push settingsStore config into the controller whenever settings change ─
  // Config is injected here (client → input direction) so src/input never
  // imports from src/client (dependency-cruiser constraint).
  const controls = useSettingsStore((s) => s.controls);
  const cameraSettings = useSettingsStore((s) => s.camera);
  const fov = useSettingsStore((s) => s.display.fov);

  // Sync config whenever settings change. Effect runs after every render
  // where controls or cameraSettings differ (Zustand selector stable-refs).
  useEffect(() => {
    const ctrl = controllerRef.current;
    if (ctrl === null) return;
    ctrl.setConfig({
      keymap:          controls.keymap,
      lookSensitivity: cameraSettings.lookSensitivity,
      invertY:         cameraSettings.invertY,
    });
  }, [controls, cameraSettings]);

  // ── FOV effect — applied in an effect (NOT per-frame) ─────────────────────
  // Only the walk (FPS) camera is affected; AT_LATHE / TURNING cameras are
  // fixed-framing PerspectiveCameras in their own scene entries.
  useEffect(() => {
    // camera here is the R3F default camera (walk camera only — FPSCamera is
    // only mounted in WORKSHOP_WALK state).
    if (!('fov' in camera)) return;
    const perspCam = camera as THREE.PerspectiveCamera;
    perspCam.fov = fov;
    perspCam.updateProjectionMatrix();
  }, [camera, fov]);

  useEffect(() => {
    // Read latest settings at mount time (not in deps — this effect runs once).
    const { controls: initControls, camera: initCam } = useSettingsStore.getState();
    const ctrl = new FPSController();
    // Apply current settings immediately on construction.
    ctrl.setConfig({
      keymap:          initControls.keymap,
      lookSensitivity: initCam.lookSensitivity,
      invertY:         initCam.invertY,
    });
    ctrl.start();
    controllerRef.current = ctrl;

    // Reset to the walk spawn position and orientation.
    // WALK_SPAWN is > 1.2 m from the tool rest, so the proximity check on the
    // first frame after mount will NOT immediately re-enter AT_LATHE.
    camera.position.set(WALK_SPAWN.x, EYE_HEIGHT, WALK_SPAWN.z);
    // Set initial yaw so the player faces -X (down the hall toward the sign).
    // The FPSController accumulates yaw from mouse delta; setting it here
    // makes the first frame show the correct orientation without any mouse input.
    ctrl.setYaw(WALK_SPAWN_YAW);

    // Request pointer lock on canvas click
    const canvas = gl.domElement;
    const handleClick = () => {
      ctrl.requestPointerLock(canvas);
    };

    const handleLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement === canvas;
    };

    canvas.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handleLockChange);

    return () => {
      ctrl.stop();
      canvas.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handleLockChange);
      // Release pointer lock when leaving walk mode (e.g. → AT_LATHE). Without this
      // the lock persists into the fixed-camera lathe view, hiding the cursor so the
      // player can't click START / drag the speed dial (R3F needs a visible cursor to
      // raycast onto the 3D controls).
      if (document.pointerLockElement !== null) {
        document.exitPointerLock();
      }
      controllerRef.current = null;
    };
  }, [camera, gl]);

  useFrame((_state, delta) => {
    const ctrl = controllerRef.current;
    if (ctrl === null) return;

    // Read input (same object returned every time — mutated in place)
    const input = ctrl.getInput();

    // ── Apply yaw and pitch to camera ────────────────────────────────────
    // Reuse _euler scratch — avoids new Euler() per frame
    _euler.set(input.pitch, input.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(_euler);

    // ── Translate camera in the XZ plane ────────────────────────────────
    // Only move when pointer is locked (avoids drift when alt-tabbed)
    if (pointerLockedRef.current && (input.forward !== 0 || input.strafe !== 0)) {
      // Horizontal forward vector from camera orientation (no Y component)
      camera.getWorldDirection(_forward);
      _forward.y = 0;
      _forward.normalize();

      // Right vector: perpendicular to forward in the XZ plane.
      // right = cross(forward, +Y) = (-fz, fx) — see rightVectorXZ. The previous
      // inline (fz, -fx) pointed LEFT, which flipped A and D. Allocation-free.
      rightVectorXZ(_forward.x, _forward.z, _rightXZ);
      _right.set(_rightXZ.x, 0, _rightXZ.z);

      const dist = MOVE_SPEED * delta;

      // Per-frame XZ displacement (scalars — no allocation).
      const dx = (_forward.x * input.forward + _right.x * input.strafe) * dist;
      const dz = (_forward.z * input.forward + _right.z * input.strafe) * dist;

      camera.position.x += dx;
      camera.position.z += dz;

      // ── Footstep cadence ──────────────────────────────────────────────────
      // Accumulate actual travelled distance and emit a footstep every
      // STEP_INTERVAL metres. We only reach this branch while moving +
      // pointer-locked, so steps never fire when standing still. The while-loop
      // catches the (rare) case of a single frame spanning > one interval.
      stepDistanceRef.current += Math.sqrt(dx * dx + dz * dz);
      while (stepDistanceRef.current >= STEP_INTERVAL) {
        stepDistanceRef.current -= STEP_INTERVAL;
        emitFootstep(stepIndexRef.current);
        stepIndexRef.current += 1;
      }

      // Clamp to walkable bounds — PIECEWISE for the L-shaped corridor + hall.
      // (named constants — see header comment).
      if (camera.position.x < VEST_HALL_X) {
        // In the vestibule corridor: narrow in Z, extends further in -X.
        camera.position.x = Math.max(VEST_MIN_X, Math.min(ROOM_MAX_X, camera.position.x));
        camera.position.z = Math.max(VEST_MIN_Z, Math.min(VEST_MAX_Z, camera.position.z));
      } else {
        // In the main hall: wide in Z.
        camera.position.x = Math.max(ROOM_MIN_X, Math.min(ROOM_MAX_X, camera.position.x));
        camera.position.z = Math.max(ROOM_MIN_Z, Math.min(ROOM_MAX_Z, camera.position.z));
      }
    } else {
      // Not moving (or unlocked): drop any partial-stride distance so resuming
      // walk waits a full STEP_INTERVAL before the next step (no instant click).
      stepDistanceRef.current = 0;
    }

    // Keep eye height constant (no vertical movement in walk mode)
    camera.position.y = EYE_HEIGHT;

    // Edge-triggered interact (E key) — fire callback once per key-press
    if (input.interact && onInteract !== undefined) {
      onInteract();
    }

    // Report XZ position to parent — scalars only, no object allocation
    onMove(camera.position.x, camera.position.z);
  });

  // No rendered geometry — this component only drives the camera
  return null;
}
