import type { FPSInput } from '../core/types.js';

const SENSITIVITY = 0.002;
const PITCH_CLAMP = 1.5;

// ---------------------------------------------------------------------------
// Injected config type (no import from src/client — see constraint §2)
// ---------------------------------------------------------------------------

/**
 * Optional keymap for remappable WASD+interact keys.
 * All values are expected to be lowercase single characters.
 * Injected from the outside (e.g. from settingsStore via FPSCamera) to keep
 * src/input free of any src/client dependency.
 */
export interface FPSKeymap {
  forward:  string;
  back:     string;
  left:     string;
  right:    string;
  interact: string;
}

/** Optional config injected into FPSController.setConfig(). */
export interface FPSConfig {
  keymap?:          FPSKeymap;
  lookSensitivity?: number;  // multiplier on SENSITIVITY; default 1
  invertY?:         boolean; // flip pitch delta sign; default false
}

// Default keymap mirrors the hardcoded w/a/s/d/e so existing tests stay green.
const DEFAULT_KEYMAP: FPSKeymap = {
  forward:  'w',
  back:     's',
  left:     'a',
  right:    'd',
  interact: 'e',
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Pure function — maps a set of pressed keys to forward/strafe scalars.
 *
 * Accepts an optional keymap; defaults to w/s/a/d so existing tests
 * that call keysToMovement(keys) without a second argument stay green.
 */
export function keysToMovement(
  keys: Set<string>,
  keymap?: FPSKeymap,
): { forward: number; strafe: number } {
  const km = keymap ?? DEFAULT_KEYMAP;
  // Normalise to lowercase for case-insensitive matching.
  const fwd = km.forward.toLowerCase();
  const bck = km.back.toLowerCase();
  const lft = km.left.toLowerCase();
  const rgt = km.right.toLowerCase();

  let forward = 0;
  let strafe = 0;

  for (const key of keys) {
    const k = key.toLowerCase();
    if (k === fwd) forward += 1;
    if (k === bck) forward -= 1;
    if (k === rgt) strafe  += 1;
    if (k === lft) strafe  -= 1;
  }

  return { forward, strafe };
}

/** Pure function — clamps pitch to ±PITCH_CLAMP radians. */
export function clampPitch(p: number): number {
  return Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, p));
}

/**
 * Right-hand strafe basis in the XZ plane for a horizontal forward vector.
 * right = cross(forward, worldUp) with up = +Y  →  (-fz, fx).
 * So when facing -Z (default camera forward), right is +X (the player's right).
 * Writes into `out` to avoid per-frame heap allocation (constraint #3).
 *
 * NOTE: FPSCamera previously inlined this with the signs negated — (fz, -fx) —
 * which pointed LEFT, flipping A and D. This is the corrected, tested home.
 */
export function rightVectorXZ(fx: number, fz: number, out: { x: number; z: number }): void {
  out.x = -fz;
  out.z = fx;
}

/**
 * Captures WASD + mouse-look and normalises to FPSInput.
 * Lives in src/input/ — no Three.js, no React.
 *
 * Config is injected via setConfig() to keep this layer dependency-clean
 * (no imports from src/client). FPSCamera reads settingsStore and pushes
 * config in on mount and on settings changes.
 */
export class FPSController {
  private readonly keys = new Set<string>();

  // ── Injected config (mutable, hot-swappable) ────────────────────────────
  private keymap:          FPSKeymap = { ...DEFAULT_KEYMAP };
  private lookSensitivity: number    = 1.0;
  private invertY:         boolean   = false;

  // Pre-allocated output object — mutated in place each getInput() call (constraint #3)
  private readonly state: FPSInput = {
    forward: 0,
    strafe: 0,
    yaw: 0,
    pitch: 0,
    interact: false,
  };

  // Edge-trigger state for interact key
  private interactDown     = false;
  private interactConsumed = false;

  // ---------------------------------------------------------------------------
  // Config injection
  // ---------------------------------------------------------------------------

  /**
   * Hot-swap the controller config without recreating the controller.
   * FPSCamera calls this on mount and whenever settingsStore.controls or
   * settingsStore.camera changes.
   *
   * Each field is optional — only provided fields are updated.
   */
  setConfig(cfg: FPSConfig): void {
    if (cfg.keymap           !== undefined) this.keymap          = cfg.keymap;
    if (cfg.lookSensitivity  !== undefined) this.lookSensitivity = cfg.lookSensitivity;
    if (cfg.invertY          !== undefined) this.invertY         = cfg.invertY;
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private readonly onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.key);
    // Interact key — edge-trigger (case-insensitive)
    const interactKey = this.keymap.interact.toLowerCase();
    if (e.key.toLowerCase() === interactKey) {
      if (!this.interactDown) {
        this.interactDown = true;
        this.interactConsumed = false;
      }
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key);
    const interactKey = this.keymap.interact.toLowerCase();
    if (e.key.toLowerCase() === interactKey) {
      this.interactDown = false;
      this.interactConsumed = false;
    }
  };

  private readonly onMouseMove = (e: MouseEvent) => {
    // Only accumulate when pointer is locked
    if (document.pointerLockElement == null) return;
    const sens = SENSITIVITY * this.lookSensitivity;
    this.state.yaw -= e.movementX * sens;
    // invertY flips the pitch delta (some players prefer natural trackpad feel)
    const pitchDelta = e.movementY * sens;
    this.state.pitch = clampPitch(
      this.state.pitch + (this.invertY ? pitchDelta : -pitchDelta),
    );
  };

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

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

  /**
   * Set the yaw (horizontal look angle, radians) directly.
   * Called once on mount by FPSCamera to orient the player toward a target
   * direction without requiring mouse movement.
   * Back-compatible: existing callers that never call setYaw() see yaw = 0.
   */
  setYaw(yaw: number): void {
    this.state.yaw = yaw;
  }

  /** Request pointer lock on the given element (guards for API existence). */
  requestPointerLock(element: HTMLElement): void {
    if (typeof element.requestPointerLock === 'function') {
      void element.requestPointerLock();
    }
  }

  // ---------------------------------------------------------------------------
  // Input snapshot
  // ---------------------------------------------------------------------------

  /**
   * Returns the current normalised FPSInput snapshot.
   * Always returns the same object reference — mutated in place (constraint #3).
   */
  getInput(): FPSInput {
    const { forward, strafe } = keysToMovement(this.keys, this.keymap);
    this.state.forward = forward;
    this.state.strafe = strafe;

    // Edge-trigger: true only on the first getInput() call after interact key goes down
    if (this.interactDown && !this.interactConsumed) {
      this.state.interact = true;
      this.interactConsumed = true;
    } else {
      this.state.interact = false;
    }

    return this.state;
  }
}
