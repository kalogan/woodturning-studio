import type { FPSInput } from '../core/types.js';

const SENSITIVITY = 0.002;
const PITCH_CLAMP = 1.5;

/** Pure function — maps a set of pressed keys to forward/strafe scalars. */
export function keysToMovement(keys: Set<string>): { forward: number; strafe: number } {
  let forward = 0;
  let strafe = 0;
  if (keys.has('w') || keys.has('W')) forward += 1;
  if (keys.has('s') || keys.has('S')) forward -= 1;
  if (keys.has('d') || keys.has('D')) strafe += 1;
  if (keys.has('a') || keys.has('A')) strafe -= 1;
  return { forward, strafe };
}

/** Pure function — clamps pitch to ±PITCH_CLAMP radians. */
export function clampPitch(p: number): number {
  return Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, p));
}

/**
 * Captures WASD + mouse-look and normalises to FPSInput.
 * Lives in src/input/ — no Three.js, no React.
 */
export class FPSController {
  private readonly keys = new Set<string>();

  // Pre-allocated output object — mutated in place each getInput() call (constraint #3)
  private readonly state: FPSInput = {
    forward: 0,
    strafe: 0,
    yaw: 0,
    pitch: 0,
    interact: false,
  };

  // Edge-trigger state for E key
  private interactDown = false;
  private interactConsumed = false;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key);
    if (e.key === 'e' || e.key === 'E') {
      if (!this.interactDown) {
        this.interactDown = true;
        this.interactConsumed = false;
      }
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key);
    if (e.key === 'e' || e.key === 'E') {
      this.interactDown = false;
      this.interactConsumed = false;
    }
  };

  private readonly onMouseMove = (e: MouseEvent) => {
    // Only accumulate when pointer is locked
    if (document.pointerLockElement == null) return;
    this.state.yaw -= e.movementX * SENSITIVITY;
    this.state.pitch = clampPitch(this.state.pitch - e.movementY * SENSITIVITY);
  };

  start(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
  }

  /** Request pointer lock on the given element (guards for API existence). */
  requestPointerLock(element: HTMLElement): void {
    if (typeof element.requestPointerLock === 'function') {
      void element.requestPointerLock();
    }
  }

  /**
   * Returns the current normalised FPSInput snapshot.
   * Always returns the same object reference — mutated in place.
   */
  getInput(): FPSInput {
    const { forward, strafe } = keysToMovement(this.keys);
    this.state.forward = forward;
    this.state.strafe = strafe;

    // Edge-trigger: true only on the first getInput() call after E goes down
    if (this.interactDown && !this.interactConsumed) {
      this.state.interact = true;
      this.interactConsumed = true;
    } else {
      this.state.interact = false;
    }

    return this.state;
  }
}
