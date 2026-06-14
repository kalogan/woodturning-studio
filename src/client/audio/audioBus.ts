/**
 * audioBus.ts — AudioContext lifecycle + master gain + per-channel gains + mute/volume.
 *
 * Design principles:
 * - LAZY: the AudioContext is never created at import time; only on the first
 *   explicit `unlock()` call (required by browser autoplay policy).
 * - GUARDED: every Web Audio access is wrapped in a null check so that
 *   importing this module in jsdom (which has no AudioContext) never throws.
 * - SAFE: all exported functions are safe no-ops when no context exists.
 *
 * Signal chain:
 *   ambient source → ambientGain ─┐
 *   motor sources  → motorGain   ─┤─→ masterGain → destination
 *   sfx sources    → sfxGain     ─┘
 *
 * Channel gains are inserted between their sources and the master gain.
 * They are created in unlock() alongside the master and are always non-null
 * once the context exists.
 */

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _muted = false;
let _volume = 0.7; // 0..1

// ---------------------------------------------------------------------------
// Per-channel gain nodes (created in unlock() alongside master)
// ---------------------------------------------------------------------------

/** Channel identifiers for per-channel volume control. */
export type AudioChannel = 'ambient' | 'motor' | 'sfx';

let _ambientGain: GainNode | null = null;
let _motorGain: GainNode | null = null;
let _sfxGain: GainNode | null = null;

// Channel volumes (0..1) — stored so they can be applied after unlock().
let _channelVolumes: Record<AudioChannel, number> = {
  ambient: 0.7,
  motor: 0.7,
  sfx: 0.7,
};

/** Returns the live AudioContext, or null in jsdom / before unlock(). */
export function getContext(): AudioContext | null {
  return _ctx;
}

/** Returns the master GainNode, or null when no context exists. */
export function getMasterGain(): GainNode | null {
  return _master;
}

/**
 * Returns the gain node for a named audio channel (ambient | motor | sfx).
 * Returns null in jsdom / before unlock().
 * Sources should connect to their channel gain, not directly to master.
 */
export function getChannelGain(channel: AudioChannel): GainNode | null {
  switch (channel) {
    case 'ambient': return _ambientGain;
    case 'motor':   return _motorGain;
    case 'sfx':     return _sfxGain;
  }
}

/**
 * Set the volume of a named channel (clamped to [0, 1]).
 * Safe no-op when no context exists — stored value is applied on next unlock().
 */
export function setChannelVolume(channel: AudioChannel, volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  _channelVolumes[channel] = clamped;
  const node = getChannelGain(channel);
  if (node) {
    node.gain.value = clamped;
  }
}

/**
 * Get the current volume of a named channel.
 */
export function getChannelVolume(channel: AudioChannel): number {
  return _channelVolumes[channel];
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

    // ── Master gain → destination ──────────────────────────────────────────
    _master = _ctx.createGain();
    _master.gain.value = _muted ? 0 : _volume;
    _master.connect(_ctx.destination);

    // ── Per-channel gains → master ─────────────────────────────────────────
    // Each channel has its own GainNode so volume can be set independently.
    _ambientGain = _ctx.createGain();
    _ambientGain.gain.value = _channelVolumes.ambient;
    _ambientGain.connect(_master);

    _motorGain = _ctx.createGain();
    _motorGain.gain.value = _channelVolumes.motor;
    _motorGain.connect(_master);

    _sfxGain = _ctx.createGain();
    _sfxGain.gain.value = _channelVolumes.sfx;
    _sfxGain.connect(_master);
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
    _ambientGain = null;
    _motorGain = null;
    _sfxGain = null;
  }
  _muted = false;
  _volume = 0.7;
  _channelVolumes = { ambient: 0.7, motor: 0.7, sfx: 0.7 };
}
