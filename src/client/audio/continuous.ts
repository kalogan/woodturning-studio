/**
 * continuous.ts — Sustained Web Audio graphs for ambient room tone + lathe motor.
 *
 * Design:
 * - Nodes are created ONCE (startAmbient / startMotor) and kept alive.
 * - Per-frame updates ONLY set AudioParam values — no allocation per frame.
 * - All Web Audio access is guarded; jsdom / SSR import + call never throws.
 * - Everything routes through the audioBus master gain so mute/volume apply.
 *
 * Ambient room tone:
 *   A quiet fluorescent-shop bed: low-gain white-noise buffer (looped) passed
 *   through a lowpass filter (~200 Hz) to give it a dull, pressure-like quality.
 *   Gain is constant at ~0.04 — barely perceptible but fills the silence.
 *
 * Lathe motor:
 *   Three layered sources, all modulated by rpm:
 *   1. Fundamental hum   — sawtooth at motorFundamentalHz (80 Hz at rest,
 *                           kept fixed; this is mains-frequency motor hum).
 *   2. Whir oscillator   — sine whose frequency sweeps with rpm
 *                           (motorMinWhirHz at 0 rpm → motorMaxWhirHz at maxRpm).
 *   3. Bearing noise     — bandpass-filtered noise at a constant centre
 *                           (bearing.filterHz), whose gain also rises with rpm.
 *   A single motor gain node (motorGainNode) controls overall motor level;
 *   it goes to 0 when rpm = 0 (completely silent at rest).
 */

import { getContext, getMasterGain } from './audioBus.js';

// ---------------------------------------------------------------------------
// Pure rpm → { whirFrequency, gain } mapping
// (exported so tests can exercise it without a live AudioContext)
// ---------------------------------------------------------------------------

/** Parameters the motor graph exposes for animation. */
export interface MotorParams {
  /** Frequency of the whir oscillator in Hz */
  whirFrequency: number;
  /** Overall motor gain [0, 1] */
  gain: number;
}

// Motor timbre constants — tunable by the director.
const MOTOR_FUNDAMENTAL_HZ = 80;    // fixed hum frequency (motor/mains tone)
const MOTOR_MIN_WHIR_HZ    = 60;    // whir freq at 0 rpm (unused because gain=0)
const MOTOR_MAX_WHIR_HZ    = 380;   // whir freq at maxRpm
const MOTOR_MAX_GAIN        = 0.28;  // gain at maxRpm (moderate; not loud)
const MOTOR_BEARING_HZ      = 1400; // bearing noise centre frequency
const MOTOR_BEARING_Q       = 3.5;  // bearing noise filter Q
const MOTOR_BEARING_GAIN    = 0.10; // bearing noise gain at maxRpm

// Ambient constants — tunable by the director.
const AMBIENT_FILTER_HZ = 180;   // lowpass cutoff for the shop noise bed
const AMBIENT_GAIN      = 0.04;  // very quiet constant level

/**
 * Map currentRpm → MotorParams for the motor graph.
 * Pure function — no Web Audio dependency.
 *
 * @param currentRpm  Live spindle speed (0..maxRpm)
 * @param maxRpm      Maximum spindle speed (from latheStore)
 */
export function calcMotorParams(currentRpm: number, maxRpm: number): MotorParams {
  // Clamp rpm to [0, maxRpm].
  const rpm = Math.max(0, Math.min(currentRpm, maxRpm));
  // Normalised speed 0..1
  const t = maxRpm > 0 ? rpm / maxRpm : 0;

  // Linear interpolation for both frequency and gain.
  const whirFrequency = MOTOR_MIN_WHIR_HZ + t * (MOTOR_MAX_WHIR_HZ - MOTOR_MIN_WHIR_HZ);
  const gain = t * MOTOR_MAX_GAIN;

  return { whirFrequency, gain };
}

/**
 * Normalised speed [0, 1] from rpm and maxRpm.
 * Pure function — used by motor graph to scale bearing noise.
 */
export function calcMotorT(currentRpm: number, maxRpm: number): number {
  const rpm = Math.max(0, Math.min(currentRpm, maxRpm));
  return maxRpm > 0 ? rpm / maxRpm : 0;
}

// ---------------------------------------------------------------------------
// Internal graph state — modules-level singletons (one context lifetime)
// ---------------------------------------------------------------------------

// Ambient nodes
let ambientStarted = false;
let ambientNoiseSource: AudioBufferSourceNode | null = null;
let ambientFilter: BiquadFilterNode | null = null;
let ambientGainNode: GainNode | null = null;

// Motor nodes
let motorStarted = false;
let motorHumOsc: OscillatorNode | null = null;
let motorWhirOsc: OscillatorNode | null = null;
let motorWhirGain: GainNode | null = null;
let motorBearingSource: AudioBufferSourceNode | null = null;
let motorBearingFilter: BiquadFilterNode | null = null;
let motorBearingGain: GainNode | null = null;
let motorHumGain: GainNode | null = null;
let motorMasterGain: GainNode | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a 2-second white noise buffer (looped). */
function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 2; // 2 seconds
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Public: start / stop ambient
// ---------------------------------------------------------------------------

/**
 * Start the ambient room-tone graph.
 * Safe no-op if already started or no AudioContext exists.
 */
export function startAmbient(): void {
  const ctx = getContext();
  const dest = getMasterGain();
  if (!ctx || !dest || ambientStarted) return;
  ambientStarted = true;

  // Looping white noise
  ambientNoiseSource = ctx.createBufferSource();
  ambientNoiseSource.buffer = createNoiseBuffer(ctx);
  ambientNoiseSource.loop = true;

  // Lowpass filter — cuts everything above ~180 Hz for a dull shop hum.
  ambientFilter = ctx.createBiquadFilter();
  ambientFilter.type = 'lowpass';
  ambientFilter.frequency.value = AMBIENT_FILTER_HZ;
  ambientFilter.Q.value = 0.5;

  // Gain (constant, very quiet)
  ambientGainNode = ctx.createGain();
  ambientGainNode.gain.value = AMBIENT_GAIN;

  // Graph: noise → filter → gain → master
  ambientNoiseSource.connect(ambientFilter);
  ambientFilter.connect(ambientGainNode);
  ambientGainNode.connect(dest);

  ambientNoiseSource.start();
}

/**
 * Stop and disconnect the ambient graph.
 * Safe no-op if not started.
 */
export function stopAmbient(): void {
  if (!ambientStarted) return;
  try { ambientNoiseSource?.stop(); } catch { /* already stopped */ }
  ambientNoiseSource?.disconnect();
  ambientFilter?.disconnect();
  ambientGainNode?.disconnect();
  ambientNoiseSource = null;
  ambientFilter = null;
  ambientGainNode = null;
  ambientStarted = false;
}

// ---------------------------------------------------------------------------
// Public: start / stop motor
// ---------------------------------------------------------------------------

/**
 * Start the lathe motor sustained graph.
 * Nodes are connected but gain=0 — call updateMotor() each frame to animate.
 * Safe no-op if already started or no AudioContext exists.
 */
export function startMotor(): void {
  const ctx = getContext();
  const dest = getMasterGain();
  if (!ctx || !dest || motorStarted) return;
  motorStarted = true;

  // ── Motor master gain (controlled per-frame) ─────────────────────────────
  motorMasterGain = ctx.createGain();
  motorMasterGain.gain.value = 0; // silent until rpm > 0
  motorMasterGain.connect(dest);

  // ── 1. Fundamental hum ───────────────────────────────────────────────────
  motorHumOsc = ctx.createOscillator();
  motorHumOsc.type = 'sawtooth';
  motorHumOsc.frequency.value = MOTOR_FUNDAMENTAL_HZ;

  motorHumGain = ctx.createGain();
  motorHumGain.gain.value = 0.6; // relative mix within the motor bus

  motorHumOsc.connect(motorHumGain);
  motorHumGain.connect(motorMasterGain);
  motorHumOsc.start();

  // ── 2. Whir oscillator ───────────────────────────────────────────────────
  motorWhirOsc = ctx.createOscillator();
  motorWhirOsc.type = 'sine';
  motorWhirOsc.frequency.value = MOTOR_MIN_WHIR_HZ;

  motorWhirGain = ctx.createGain();
  motorWhirGain.gain.value = 0.45; // relative mix

  motorWhirOsc.connect(motorWhirGain);
  motorWhirGain.connect(motorMasterGain);
  motorWhirOsc.start();

  // ── 3. Bearing / air noise ───────────────────────────────────────────────
  const noiseBuffer = createNoiseBuffer(ctx);

  motorBearingSource = ctx.createBufferSource();
  motorBearingSource.buffer = noiseBuffer;
  motorBearingSource.loop = true;

  motorBearingFilter = ctx.createBiquadFilter();
  motorBearingFilter.type = 'bandpass';
  motorBearingFilter.frequency.value = MOTOR_BEARING_HZ;
  motorBearingFilter.Q.value = MOTOR_BEARING_Q;

  motorBearingGain = ctx.createGain();
  motorBearingGain.gain.value = 0; // driven per-frame via calcMotorT

  motorBearingSource.connect(motorBearingFilter);
  motorBearingFilter.connect(motorBearingGain);
  motorBearingGain.connect(motorMasterGain);
  motorBearingSource.start();
}

/**
 * Stop and disconnect the motor graph.
 * Safe no-op if not started.
 */
export function stopMotor(): void {
  if (!motorStarted) return;
  try { motorHumOsc?.stop(); } catch { /* already stopped */ }
  try { motorWhirOsc?.stop(); } catch { /* already stopped */ }
  try { motorBearingSource?.stop(); } catch { /* already stopped */ }

  motorHumOsc?.disconnect();
  motorHumGain?.disconnect();
  motorWhirOsc?.disconnect();
  motorWhirGain?.disconnect();
  motorBearingSource?.disconnect();
  motorBearingFilter?.disconnect();
  motorBearingGain?.disconnect();
  motorMasterGain?.disconnect();

  motorHumOsc = null;
  motorHumGain = null;
  motorWhirOsc = null;
  motorWhirGain = null;
  motorBearingSource = null;
  motorBearingFilter = null;
  motorBearingGain = null;
  motorMasterGain = null;
  motorStarted = false;
}

// ---------------------------------------------------------------------------
// Public: per-frame motor update
// ---------------------------------------------------------------------------

/**
 * Update motor AudioParams to reflect the current RPM.
 * MUST be called each animation frame — no React state, no allocation.
 * Uses setTargetAtTime for smooth ramps (no clicks/zipper noise).
 *
 * Safe no-op when motor not started or no AudioContext.
 *
 * @param currentRpm  Live spindle speed
 * @param maxRpm      Maximum spindle speed
 */
export function updateMotor(currentRpm: number, maxRpm: number): void {
  const ctx = getContext();
  if (!ctx || !motorStarted) return;
  if (!motorMasterGain || !motorWhirOsc || !motorBearingGain) return;

  const { whirFrequency, gain } = calcMotorParams(currentRpm, maxRpm);
  const t = calcMotorT(currentRpm, maxRpm);
  const now = ctx.currentTime;

  // Smooth time constant: 0.05 s — fast enough to feel responsive,
  // slow enough to avoid zipper/click artifacts.
  const TC = 0.05;

  // Master motor gain
  motorMasterGain.gain.setTargetAtTime(gain, now, TC);

  // Whir frequency sweep
  motorWhirOsc.frequency.setTargetAtTime(whirFrequency, now, TC);

  // Bearing noise gain (scales with rpm, relative to master)
  const bearingGainValue = t * MOTOR_BEARING_GAIN;
  motorBearingGain.gain.setTargetAtTime(bearingGainValue, now, TC);
}

// ---------------------------------------------------------------------------
// Internal reset helper (for tests / HMR)
// ---------------------------------------------------------------------------

/**
 * Stop all graphs and reset module state.
 * Called in tests via the AudioManager on unmount.
 * Not exported publicly — use stopAmbient() + stopMotor() individually.
 */
export function _resetContinuous(): void {
  stopAmbient();
  stopMotor();
}
