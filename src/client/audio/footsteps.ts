/**
 * footsteps.ts — Procedural footstep emitter for first-person walking.
 *
 * Builds a short, soft footstep entirely from Web Audio nodes (a filtered
 * noise burst + a low sub-thud tone) through the SAME unlocked AudioContext
 * and `sfx` channel that `emit()` uses — never a competing context.
 *
 * Gating mirrors events.emit():
 *   - safe no-op when audioSettings.enabled === false
 *   - safe no-op when audioSettings.muted === true
 *   - safe no-op before the AudioContext is unlocked (jsdom / SSR / pre-gesture)
 *
 * Variation is DETERMINISTIC — no Math.random()/Date.now() in the caller's
 * render tick. The footstep alternates pitch/gain by the even/odd parity of a
 * step counter the caller maintains, so consecutive steps differ slightly
 * (left/right foot feel) without RNG. AudioContext.currentTime is used for
 * scheduling, which is permitted.
 *
 * Allocation note: this is called once per STEP (not per frame), so the small
 * per-call node graph is created off the per-frame hot path. The caller's
 * useFrame must remain allocation-free; only the step-crossing branch calls
 * here.
 */

import { getContext, getChannelGain, getMasterGain } from './audioBus.js';
import { useAudioSettings } from './audioSettings.js';
import { playNoise, playTone } from './synth.js';

// ── Tunable footstep consts ────────────────────────────────────────────────
/** Lowpass-ish bandpass centre for the soft floor "thud" (Hz). */
const FOOTSTEP_FILTER_FREQ = 130;
/** Base loudness of the noise burst (0..1) — kept subtle. */
const FOOTSTEP_NOISE_GAIN = 0.16;
/** Base loudness of the sub-thud tone (0..1). */
const FOOTSTEP_TONE_GAIN = 0.1;
/** Burst length (seconds) — short, ~110 ms total. */
const FOOTSTEP_DURATION = 0.11;
/** Sub-thud fundamental (Hz). */
const FOOTSTEP_TONE_FREQ = 62;

// Even/odd (left/right foot) variation. Multiplicative, deterministic.
const ODD_PITCH_MULT = 1.12; // odd steps a touch higher
const ODD_GAIN_MULT = 0.88;  // …and a touch softer

/**
 * Emit one footstep. `stepIndex` selects the deterministic even/odd timbre.
 *
 * @param stepIndex monotonic step counter (caller-owned). Parity drives the
 *                  left/right variation; the absolute value is otherwise unused.
 */
export function emitFootstep(stepIndex: number): void {
  const { enabled, muted } = useAudioSettings.getState();
  if (!enabled || muted) return;

  const ctx = getContext();
  // Route through the sfx channel (→ master); fall back to master if needed.
  const dest = getChannelGain('sfx') ?? getMasterGain();
  if (!ctx || !dest) return;

  const odd = (stepIndex & 1) === 1;
  const pitchMult = odd ? ODD_PITCH_MULT : 1;
  const gainMult = odd ? ODD_GAIN_MULT : 1;

  // Soft filtered-noise burst — the body of the footstep.
  playNoise(ctx, dest, {
    filterFreq: FOOTSTEP_FILTER_FREQ * pitchMult,
    filterQ: 1.2,
    duration: FOOTSTEP_DURATION,
    gain: FOOTSTEP_NOISE_GAIN * gainMult,
    fadeIn: 0.002,
    fadeOut: 0.07,
  });

  // Low sub-thud — gives the step weight without being boomy.
  playTone(ctx, dest, {
    freq: FOOTSTEP_TONE_FREQ * pitchMult,
    type: 'sine',
    duration: FOOTSTEP_DURATION * 0.9,
    gain: FOOTSTEP_TONE_GAIN * gainMult,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0.04, release: 0.04, peak: 1 },
  });
}
