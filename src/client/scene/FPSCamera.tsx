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

// ── Movement constants ─────────────────────────────────────────────────────
const MOVE_SPEED = 1.4;  // metres per second
const EYE_HEIGHT = 1.6;  // metres

/**
 * Room AABB bounds — player position (XZ) is clamped inside these limits.
 * Values derived from Room.tsx conventions (warm-workshop room 8 × 6 m).
 * Kept as named constants with a comment — Room.tsx is NOT edited.
 *
 * Room is centred at the origin.  Half-extents:
 *   X: ±4.0 m  (8 m wide)
 *   Z: ±3.0 m  (6 m deep)
 * A 0.3 m wall-buffer keeps the camera from clipping the walls.
 */
const ROOM_MIN_X = -3.7;
const ROOM_MAX_X =  3.7;
const ROOM_MIN_Z = -2.7;
const ROOM_MAX_Z =  2.7;

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

  useEffect(() => {
    const ctrl = new FPSController();
    ctrl.start();
    controllerRef.current = ctrl;

    // Set initial eye height
    camera.position.y = EYE_HEIGHT;

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

      camera.position.x += (_forward.x * input.forward + _right.x * input.strafe) * dist;
      camera.position.z += (_forward.z * input.forward + _right.z * input.strafe) * dist;

      // Clamp to room bounds (named constants — see header comment)
      camera.position.x = Math.max(ROOM_MIN_X, Math.min(ROOM_MAX_X, camera.position.x));
      camera.position.z = Math.max(ROOM_MIN_Z, Math.min(ROOM_MAX_Z, camera.position.z));
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
