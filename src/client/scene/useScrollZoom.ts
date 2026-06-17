/**
 * useScrollZoom — scroll-wheel FOV zoom for fixed R3F lathe cameras.
 *
 * Usage:
 *   useScrollZoom(() => BASE_FOV)
 *
 * Scroll UP  → zoom IN  (decrease FOV, magnify)
 * Scroll DOWN → zoom OUT (increase FOV) up to the view's original/base FOV.
 *
 * The hook is event-driven (no useFrame), so no per-frame heap allocations.
 * Cleanup removes the listener on unmount.
 *
 * Only works with PerspectiveCamera; silently no-ops for orthographic cameras.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Tuning knobs ─────────────────────────────────────────────────────────────

/** Minimum FOV (degrees) — cannot zoom further in than this. */
export const MIN_FOV = 20;

/** FOV change per wheel notch (one deltaY unit ≈ 100 in most browsers). */
export const FOV_STEP = 3;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure math — exported for unit tests.
 *
 * Given the current FOV, a wheel event's deltaY, and bounds, returns the
 * next clamped FOV. No side-effects, no allocations.
 *
 * @param currentFov  Current camera FOV in degrees.
 * @param wheelDeltaY WheelEvent.deltaY (positive = scroll down = zoom out).
 * @param minFov      Minimum FOV (zoom-in clamp).
 * @param maxFov      Maximum FOV (zoom-out clamp = original/base FOV).
 * @param step        FOV change per notch (divided by 100 because deltaY ~100/notch).
 */
export function nextZoomFov(
  currentFov: number,
  wheelDeltaY: number,
  minFov: number,
  maxFov: number,
  step: number,
): number {
  // deltaY > 0 → scroll down → zoom OUT → increase FOV
  // deltaY < 0 → scroll up  → zoom IN  → decrease FOV
  const delta = (wheelDeltaY / 100) * step;
  const raw = currentFov + delta;
  return Math.max(minFov, Math.min(maxFov, raw));
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook — attaches a wheel listener to the R3F canvas.
 *
 * @param getMaxFov  Getter that returns the "original" FOV for the active view.
 *                   Called on every wheel event so toggling camera presets
 *                   updates the zoom-out ceiling without a re-render.
 * @param minFov     Override MIN_FOV if needed (default = MIN_FOV).
 * @param step       Override FOV_STEP if needed (default = FOV_STEP).
 */
export function useScrollZoom(
  getMaxFov: () => number,
  minFov: number = MIN_FOV,
  step: number = FOV_STEP,
): void {
  const { camera, gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault(); // prevent page scroll while hovering the canvas

      if (!(camera instanceof THREE.PerspectiveCamera)) return;

      camera.fov = nextZoomFov(camera.fov, e.deltaY, minFov, getMaxFov(), step);
      camera.updateProjectionMatrix();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
    // getMaxFov is intentionally NOT in the dep array — it's called on each
    // event (closure over stable refs). camera and gl.domElement are stable
    // R3F references across the component lifetime.
  }, [camera, gl.domElement, minFov, step]);
}
