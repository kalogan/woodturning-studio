/**
 * audioBus.ts — AudioContext lifecycle + master gain + mute/volume.
 *
 * Design principles:
 * - LAZY: the AudioContext is never created at import time; only on the first
 *   explicit `unlock()` call (required by browser autoplay policy).
 * - GUARDED: every Web Audio access is wrapped in a null check so that
 *   importing this module in jsdom (which has no AudioContext) never throws.
 * - SAFE: all exported functions are safe no-ops when no context exists.
 */

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _muted = false;
let _volume = 0.7; // 0..1

/** Returns the live AudioContext, or null in jsdom / before unlock(). */
export function getContext(): AudioContext | null {
  return _ctx;
}

/** Returns the master GainNode, or null when no context exists. */
export function getMasterGain(): GainNode | null {
  return _master;
}

/**
 * Call once on a user gesture (click / keydown) to create or resume the
 * AudioContext. Safe to call multiple times (idempotent).
 */
export async function unlock(): Promise<void> {
  if (typeof AudioContext === 'undefined') {
    // jsdom / SSR — no-op
    return;
  }

  if (!_ctx) {
    _ctx = new AudioContext();
    _master = _ctx.createGain();
    _master.gain.value = _muted ? 0 : _volume;
    _master.connect(_ctx.destination);
  }

  if (_ctx.state === 'suspended') {
    await _ctx.resume();
  }
}

/**
 * Mute or un-mute all audio output through the master bus.
 * State is remembered so that unlock() respects it on context creation.
 */
export function setMuted(muted: boolean): void {
  _muted = muted;
  if (_master) {
    _master.gain.value = muted ? 0 : _volume;
  }
}

/**
 * Set master volume (clamped to [0, 1]).
 * Has no effect while muted — un-muting restores the stored volume.
 */
export function setVolume(volume: number): void {
  _volume = Math.max(0, Math.min(1, volume));
  if (_master && !_muted) {
    _master.gain.value = _volume;
  }
}

/** Expose current mute state (useful for wiring settings store). */
export function isMuted(): boolean {
  return _muted;
}

/** Expose current volume (useful for wiring settings store). */
export function getVolume(): number {
  return _volume;
}

/**
 * Reset everything — used in tests to restore clean state between cases.
 * Closes the AudioContext if one exists.
 */
export async function _reset(): Promise<void> {
  if (_ctx) {
    await _ctx.close();
    _ctx = null;
    _master = null;
  }
  _muted = false;
  _volume = 0.7;
}
