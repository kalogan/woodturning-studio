/**
 * src/client/audio/index.ts — Public barrel for the audio subsystem.
 *
 * Gameplay code imports from here:
 *   import { emit, useAudioSettings, unlock, SfxId } from '../audio/index.js';
 */

// Bus lifecycle
export { getContext, getMasterGain, unlock, setMuted, setVolume, isMuted, getVolume } from './audioBus.js';

// Settings store
export { useAudioSettings } from './audioSettings.js';

// Registry
export { getFactory, playSound, ALL_SFX_IDS } from './sfxRegistry.js';
export type { SfxId, SfxFactory } from './sfxRegistry.js';

// Synth helpers (exported for advanced use / later slices)
export { calcEnvelope, clampGain, calcOscParams, calcNoiseFilterFreq, playTone, playNoise } from './synth.js';
export type { EnvelopeParams, EnvelopeSchedule, ToneParams, NoiseParams } from './synth.js';

// Events dispatcher — the primary API for gameplay code
export { emit } from './events.js';
export type { SfxEvent } from './events.js';
