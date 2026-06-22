/**
 * src/client/audio/index.ts — Public barrel for the audio subsystem.
 *
 * Gameplay code imports from here:
 *   import { emit, useAudioSettings, unlock, SfxId } from '../audio/index.js';
 */

// Bus lifecycle
export {
  getContext,
  getMasterGain,
  getChannelGain,
  unlock,
  setMuted,
  setVolume,
  isMuted,
  getVolume,
  setChannelVolume,
  getChannelVolume,
} from './audioBus.js';
export type { AudioChannel } from './audioBus.js';

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

// Footstep emitter — deterministic per-step variation for first-person walk
export { emitFootstep } from './footsteps.js';

// Continuous graphs — ambient room tone + RPM-driven motor
export { calcMotorParams, calcMotorT, startAmbient, startMotor, stopAmbient, stopMotor, updateMotor } from './continuous.js';
export type { MotorParams } from './continuous.js';

// Cutting sound — sustained tool-on-wood texture, intensity-driven
export { startCutting, stopCutting, setCutIntensity, cutIntensityFromRemoval } from './cutting.js';

// AudioManager — mounts once in App.tsx (always-on, renders null)
export { default as AudioManager } from './AudioManager.js';
