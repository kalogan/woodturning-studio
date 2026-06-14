/**
 * AudioManager.tsx — React component that manages the continuous audio graphs.
 *
 * Renders nothing (returns null). Responsibilities:
 *   1. Listen for the first user gesture (pointerdown / keydown) and call
 *      audioBus.unlock() — required by browser autoplay policy.
 *   2. After unlock, start the ambient room tone and lathe motor graphs.
 *   3. Drive the motor each frame via requestAnimationFrame: read
 *      useLatheStore.getState().currentRpm and .power imperatively (no React
 *      state, no per-frame allocation) and call updateMotor() to smooth the
 *      AudioParams. `power` gates the constant hum layer.
 *   4. On unmount: cancel the rAF, stop/disconnect all nodes cleanly.
 *
 * jsdom / SSR safety:
 *   - All Web Audio calls are inside audioBus guards (no AudioContext = no-op).
 *   - requestAnimationFrame is guarded: only called when typeof window !== 'undefined'.
 *   - The component can be imported and mounted in test environments without throwing.
 */

import { useEffect } from 'react';
import { unlock } from './audioBus.js';
import { startAmbient, startMotor, stopAmbient, stopMotor, updateMotor } from './continuous.js';
import { startCutting, stopCutting } from './cutting.js';
import { useLatheStore } from '../../workshop/latheStore.js';

export default function AudioManager(): null {
  useEffect(() => {
    // Guard: in jsdom / SSR, requestAnimationFrame may not exist.
    const hasRAF = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';

    let rafId: number | null = null;
    let audioStarted = false;

    // ── Per-frame rAF loop ────────────────────────────────────────────────
    // Runs every frame once audio is unlocked.
    // Reads rpm + power imperatively — zero React state, zero allocation.
    // `power` gates the constant hum layer (hum fades to 0 when lathe is off).
    function frame(): void {
      const { currentRpm, maxRpm, power } = useLatheStore.getState();
      updateMotor(currentRpm, maxRpm, power);

      if (hasRAF) {
        rafId = window.requestAnimationFrame(frame);
      }
    }

    // ── One-time gesture handler ──────────────────────────────────────────
    // Satisfies browser autoplay policy. Called at most once then removed.
    function onGesture(): void {
      if (audioStarted) return;
      audioStarted = true;

      // Remove both listeners — we only need the first gesture.
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);

      // Unlock the AudioContext (creates it / resumes it).
      unlock().then(() => {
        // Start sustained graphs.
        startAmbient();
        startMotor();
        startCutting();

        // Kick off the rAF motor loop.
        if (hasRAF) {
          rafId = window.requestAnimationFrame(frame);
        }
      }).catch(() => {
        // Autoplay unlock failed silently — non-fatal.
      });
    }

    // Only attach listeners in a real browser environment.
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', onGesture, { once: true });
      window.addEventListener('keydown', onGesture, { once: true });
    }

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      // Remove gesture listeners in case component unmounts before first gesture.
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', onGesture);
        window.removeEventListener('keydown', onGesture);
      }

      // Cancel the rAF loop.
      if (rafId !== null && hasRAF) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }

      // Stop and disconnect all continuous audio nodes.
      stopCutting();
      stopMotor();
      stopAmbient();
    };
  }, []); // empty deps — set up once on mount, tear down on unmount

  return null;
}
