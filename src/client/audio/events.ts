/**
 * events.ts — Semantic SfxEvent type + emit() dispatcher.
 *
 * This is the public API gameplay code will call:
 *   emit('tool.grab')
 *   emit('cut')
 *
 * emit() is a safe no-op when:
 *   - audioSettings.enabled is false
 *   - audioSettings.muted is true
 *   - no AudioContext exists (jsdom / before user gesture)
 */

import { getContext, getMasterGain } from './audioBus.js';
import { useAudioSettings } from './audioSettings.js';
import { playSound } from './sfxRegistry.js';
import type { SfxId } from './sfxRegistry.js';

// ---------------------------------------------------------------------------
// SfxEvent type
// ---------------------------------------------------------------------------

/**
 * Semantic audio event. One-to-one with SfxId for now; kept as a separate
 * type alias so future slices can add richer event objects (e.g. with
 * position / intensity) without changing the registry shape.
 */
export type SfxEvent = SfxId;

// ---------------------------------------------------------------------------
// emit
// ---------------------------------------------------------------------------

/**
 * Emit a semantic sound event.
 * Looks up the registry factory and plays through the master bus.
 *
 * Safe no-ops:
 * - settings.enabled === false
 * - settings.muted === true
 * - AudioContext not yet unlocked (null)
 */
export function emit(event: SfxEvent): void {
  const { enabled, muted } = useAudioSettings.getState();
  if (!enabled || muted) return;

  const ctx = getContext();
  const dest = getMasterGain();
  if (!ctx || !dest) return;

  playSound(event, ctx, dest);
}
