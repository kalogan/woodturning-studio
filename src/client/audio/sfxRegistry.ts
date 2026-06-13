/**
 * sfxRegistry.ts — Typed SfxId union + procedural sound factories.
 *
 * Each factory takes the live AudioContext + master GainNode and plays the
 * sound through the bus. All factories are guarded — passing null context
 * is a safe no-op (jsdom / SSR).
 *
 * Timbres are intentionally minimal stubs for S1; tune in later slices.
 */

import { playTone, playNoise } from './synth.js';

// ---------------------------------------------------------------------------
// SfxId type
// ---------------------------------------------------------------------------

export type SfxId =
  | 'tool.grab'        // pick up a turning tool
  | 'tool.select'      // scroll/click to change active tool
  | 'part.snap'        // assembly part snaps into place
  | 'control.tighten'  // tighten a bolt / chuck key
  | 'footstep'         // footstep on wooden floor
  | 'lathe.motor'      // brief motor-on burst (startup / idle tick)
  | 'cut'              // gouge engaging wood
  | 'catch';           // tool catch / dig-in

// ---------------------------------------------------------------------------
// Factory type
// ---------------------------------------------------------------------------

export type SfxFactory = (
  ctx: AudioContext | null,
  destination: AudioNode | null,
) => void;

// ---------------------------------------------------------------------------
// Sound factories
// ---------------------------------------------------------------------------

const factories: Record<SfxId, SfxFactory> = {
  'tool.grab': (ctx, dest) => {
    // Short metallic click — high-freq triangle with quick decay
    playTone(ctx, dest, {
      freq: 1200,
      type: 'triangle',
      duration: 0.12,
      gain: 0.4,
      envelope: { attack: 0.002, decay: 0.04, sustain: 0.1, release: 0.06, peak: 1 },
    });
  },

  'tool.select': (ctx, dest) => {
    // Soft woody tap — low sine pluck
    playTone(ctx, dest, {
      freq: 320,
      type: 'sine',
      duration: 0.1,
      gain: 0.3,
      envelope: { attack: 0.003, decay: 0.06, sustain: 0.05, release: 0.05, peak: 1 },
    });
  },

  'part.snap': (ctx, dest) => {
    // Satisfying thunk — two overlapping tones
    playTone(ctx, dest, {
      freq: 180,
      type: 'square',
      duration: 0.15,
      gain: 0.35,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0.1, release: 0.07, peak: 1 },
    });
    playTone(ctx, dest, {
      freq: 540,
      type: 'triangle',
      duration: 0.08,
      gain: 0.2,
      envelope: { attack: 0.001, decay: 0.04, sustain: 0.05, release: 0.04, peak: 1 },
    });
  },

  'control.tighten': (ctx, dest) => {
    // Ratchet-like filtered noise burst
    playNoise(ctx, dest, {
      filterFreq: 800,
      filterQ: 8,
      duration: 0.07,
      gain: 0.25,
      fadeIn: 0.003,
      fadeOut: 0.03,
    });
  },

  'footstep': (ctx, dest) => {
    // Dull thud on wood — low noise burst + sub-bass tone
    playNoise(ctx, dest, {
      filterFreq: 120,
      filterQ: 2,
      duration: 0.12,
      gain: 0.3,
      fadeIn: 0.002,
      fadeOut: 0.08,
    });
    playTone(ctx, dest, {
      freq: 60,
      type: 'sine',
      duration: 0.1,
      gain: 0.2,
      envelope: { attack: 0.001, decay: 0.06, sustain: 0.05, release: 0.04, peak: 1 },
    });
  },

  'lathe.motor': (ctx, dest) => {
    // Motor hum — sawtooth at 50 Hz (motor fundamental) + light noise
    playTone(ctx, dest, {
      freq: 50,
      type: 'sawtooth',
      duration: 0.4,
      gain: 0.25,
      envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.1, peak: 1 },
    });
    playNoise(ctx, dest, {
      filterFreq: 2000,
      filterQ: 1.5,
      duration: 0.4,
      gain: 0.08,
      fadeIn: 0.05,
      fadeOut: 0.1,
    });
  },

  'cut': (ctx, dest) => {
    // Sustained wood-cutting hiss — bandpass noise + pitched tone
    playNoise(ctx, dest, {
      filterFreq: 3500,
      filterQ: 2,
      duration: 0.35,
      gain: 0.3,
      fadeIn: 0.02,
      fadeOut: 0.1,
    });
    playTone(ctx, dest, {
      freq: 220,
      type: 'sawtooth',
      duration: 0.3,
      gain: 0.15,
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.6, release: 0.1, peak: 1 },
    });
  },

  'catch': (ctx, dest) => {
    // Jarring impact — short loud noise burst + low thud
    playNoise(ctx, dest, {
      filterFreq: 600,
      filterQ: 1,
      duration: 0.18,
      gain: 0.6,
      fadeIn: 0.001,
      fadeOut: 0.1,
    });
    playTone(ctx, dest, {
      freq: 80,
      type: 'square',
      duration: 0.15,
      gain: 0.4,
      envelope: { attack: 0.001, decay: 0.05, sustain: 0.2, release: 0.08, peak: 1 },
    });
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** All registered SfxIds (useful for exhaustiveness checks in tests). */
export const ALL_SFX_IDS: readonly SfxId[] = [
  'tool.grab',
  'tool.select',
  'part.snap',
  'control.tighten',
  'footstep',
  'lathe.motor',
  'cut',
  'catch',
] as const;

/**
 * Look up the factory for a given SfxId.
 * Returns undefined for unknown ids (callers should guard).
 */
export function getFactory(id: SfxId): SfxFactory {
  return factories[id];
}

/**
 * Play a sound by id through the given context and destination.
 * Safe no-op when ctx is null or id is unregistered.
 */
export function playSound(
  id: SfxId,
  ctx: AudioContext | null,
  destination: AudioNode | null,
): void {
  factories[id](ctx, destination);
}
