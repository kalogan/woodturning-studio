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
 * Lathe motor (three-layer mix):
 *   1. Fundamental HUM  — sawtooth at motorFundamentalHz (80 Hz).
 *                          Routes through motorHumDirectGain → dest DIRECTLY
 *                          (NOT through motorMasterGain) so it stays constant
 *                          while the motor is on. Gated by `power` flag:
 *                          fades to ~0.05 when on, fades to 0 when off.
 *                          This is a light, steady background hum — it does NOT
 *                          swell with rpm.
 *   2. Whir oscillator  — sine whose frequency sweeps with rpm
 *                          (motorMinWhirHz → motorMaxWhirHz). Routes through
 *                          motorMasterGain which scales 0→max with rpm.
 *                          This is the DOMINANT rising cue as speed increases.
 *   3. Bearing noise    — bandpass-filtered noise (faint texture only).
 *                          Max gain ~0.025 (cut to ~1/4 of the old 0.10) so
 *                          it never becomes prominent — just a faint hiss
 *                          texture at high rpm.
 *   motorMasterGain scales 0→0.28 with rpm — controls whir + bearing only.
 *   The HUM is on its own direct path, constant when powered.
 *
 * updateMotor() signature now accepts a `power` boolean so the hum can be
 * gated by lathe power state (not just rpm). AudioManager passes
 * useLatheStore.getState().power alongside currentRpm each frame.
 */

import { getContext, getMasterGain, getChannelGain } from './audioBus.js';

// ---------------------------------------------------------------------------
// Pure rpm → { whirFrequency, gain } mapping
// (exported so tests can exercise it without a live AudioContext)
// ---------------------------------------------------------------------------

/** Parameters the motor graph exposes for animation. */
export interface MotorParams {
  /** Frequency of the whir oscillator in Hz */
  whirFrequency: number;
  /**
   * Whir + bearing master gain [0, 1] — rises with rpm.
   * Does NOT include the hum (which has its own constant path).
   */
  gain: number;
}

// Motor timbre constants — tunable by the director.
const MOTOR_FUNDAMENTAL_HZ   = 80;    // fixed hum frequency (motor/mains tone)
const MOTOR_MIN_WHIR_HZ      = 60;    // whir freq at 0 rpm
const MOTOR_MAX_WHIR_HZ      = 380;   // whir freq at maxRpm
const MOTOR_MAX_GAIN          = 0.28;  // whir+bearing master gain at maxRpm
const MOTOR_BEARING_HZ        = 1400; // bearing noise centre frequency
const MOTOR_BEARING_Q         = 3.5;  // bearing noise filter Q
// Bearing noise max gain — faint texture; halved again per director (was 0.025).
const MOTOR_BEARING_MAX_GAIN  = 0.0125;
// Hum direct gain — light, steady hum when the lathe is powered on.
const MOTOR_HUM_ON_GAIN       = 0.05;
// Relative mix of the whir inside the motor master bus.
const MOTOR_WHIR_REL_GAIN     = 0.7;  // dominant voice — louder relative mix

// Ambient constants — tunable by the director.
const AMBIENT_FILTER_HZ = 180;   // lowpass cutoff for the shop noise bed
const AMBIENT_GAIN      = 0.04;  // very quiet constant level

/**
 * Map currentRpm → MotorParams for the whir/bearing portion of the motor graph.
 * Pure function — no Web Audio dependency.
 *
 * The hum is NOT included here; it has a constant gain gated by `power`.
 *
 * @param currentRpm  Live spindle speed (0..maxRpm)
 * @param maxRpm      Maximum spindle speed (from latheStore)
 */
export function calcMotorParams(currentRpm: number, maxRpm: number): MotorParams {
  // Clamp rpm to [0, maxRpm].
  const rpm = Math.max(0, Math.min(currentRpm, maxRpm));
  // Normalised speed 0..1
  const t = maxRpm > 0 ? rpm / maxRpm : 0;

  // Linear interpolation for frequency; gain scales linearly with rpm.
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
// Internal graph state — module-level singletons (one context lifetime)
// ---------------------------------------------------------------------------

// Ambient nodes
let ambientStarted = false;
let ambientNoiseSource: AudioBufferSourceNode | null = null;
let ambientFilter: BiquadFilterNode | null = null;
let ambientGainNode: GainNode | null = null;

// Motor nodes
let motorStarted = false;
let motorHumOsc: OscillatorNode | null = null;
// Direct (constant) hum gain — NOT through motorMasterGain.
let motorHumDirectGain: GainNode | null = null;
let motorWhirOsc: OscillatorNode | null = null;
let motorWhirGain: GainNode | null = null;
let motorBearingSource: AudioBufferSourceNode | null = null;
let motorBearingFilter: BiquadFilterNode | null = null;
let motorBearingGain: GainNode | null = null;
// Master gain for whir + bearing only (scales with rpm).
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
  // Route through the ambient channel gain (→ master). Fall back to master
  // if the channel gain isn't ready (shouldn't happen after unlock()).
  const dest = getChannelGain('ambient') ?? getMasterGain();
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

  // Graph: noise → filter → gain → ambientChannel → master → destination
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
 * Nodes are connected; hum starts at gain 0, whir+bearing master at 0.
 * Call updateMotor() each frame to animate.
 * Safe no-op if already started or no AudioContext exists.
 */
export function startMotor(): void {
  const ctx = getContext();
  // Route through the motor channel gain (→ master). Fall back to master
  // if the channel gain isn't ready (shouldn't happen after unlock()).
  const dest = getChannelGain('motor') ?? getMasterGain();
  if (!ctx || !dest || motorStarted) return;
  motorStarted = true;

  // ── Motor master gain (whir + bearing, controlled per-frame by rpm) ───────
  motorMasterGain = ctx.createGain();
  motorMasterGain.gain.value = 0; // silent until rpm > 0
  motorMasterGain.connect(dest);

  // ── 1. Fundamental hum ── direct path, constant when lathe is powered ─────
  // Connects directly to the motor channel dest (not via motorMasterGain) so
  // the hum is independent of rpm. updateMotor() fades it to MOTOR_HUM_ON_GAIN
  // when power=true, and to 0 when power=false.
  motorHumOsc = ctx.createOscillator();
  motorHumOsc.type = 'sawtooth';
  motorHumOsc.frequency.value = MOTOR_FUNDAMENTAL_HZ;

  motorHumDirectGain = ctx.createGain();
  motorHumDirectGain.gain.value = 0; // starts silent; updateMotor gates it

  motorHumOsc.connect(motorHumDirectGain);
  motorHumDirectGain.connect(dest); // direct to motorChannel — NOT through motorMasterGain
  motorHumOsc.start();

  // ── 2. Whir oscillator — dominant rising cue ─────────────────────────────
  motorWhirOsc = ctx.createOscillator();
  motorWhirOsc.type = 'sine';
  motorWhirOsc.frequency.value = MOTOR_MIN_WHIR_HZ;

  motorWhirGain = ctx.createGain();
  motorWhirGain.gain.value = MOTOR_WHIR_REL_GAIN; // dominant relative mix

  motorWhirOsc.connect(motorWhirGain);
  motorWhirGain.connect(motorMasterGain);
  motorWhirOsc.start();

  // ── 3. Bearing / air noise — faint texture only ───────────────────────────
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
  motorHumDirectGain?.disconnect();
  motorWhirOsc?.disconnect();
  motorWhirGain?.disconnect();
  motorBearingSource?.disconnect();
  motorBearingFilter?.disconnect();
  motorBearingGain?.disconnect();
  motorMasterGain?.disconnect();

  motorHumOsc = null;
  motorHumDirectGain = null;
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
 * Update motor AudioParams to reflect the current RPM and power state.
 * MUST be called each animation frame — no React state, no allocation.
 * Uses setTargetAtTime for smooth ramps (no clicks/zipper noise).
 *
 * Safe no-op when motor not started or no AudioContext.
 *
 * @param currentRpm  Live spindle speed
 * @param maxRpm      Maximum spindle speed
 * @param power       Whether the lathe is switched on (gates the hum).
 *                    When false the hum fades out even if rpm > 0 (spin-down).
 *                    Defaults to true for backward-compat callers that only
 *                    pass rpm.
 */
export function updateMotor(currentRpm: number, maxRpm: number, power = true): void {
  const ctx = getContext();
  if (!ctx || !motorStarted) return;
  if (!motorMasterGain || !motorWhirOsc || !motorBearingGain || !motorHumDirectGain) return;

  const { whirFrequency, gain } = calcMotorParams(currentRpm, maxRpm);
  const t = calcMotorT(currentRpm, maxRpm);
  const now = ctx.currentTime;

  // Smooth time constant: 0.05 s — fast enough to feel responsive,
  // slow enough to avoid zipper/click artifacts.
  const TC = 0.05;

  // ── Whir + bearing master (scales with rpm) ───────────────────────────────
  motorMasterGain.gain.setTargetAtTime(gain, now, TC);

  // ── Whir frequency sweep ──────────────────────────────────────────────────
  motorWhirOsc.frequency.setTargetAtTime(whirFrequency, now, TC);

  // ── Bearing noise gain (faint texture — max MOTOR_BEARING_MAX_GAIN) ───────
  const bearingGainValue = t * MOTOR_BEARING_MAX_GAIN;
  motorBearingGain.gain.setTargetAtTime(bearingGainValue, now, TC);

  // ── Hum direct gain — constant when powered, silent when off ─────────────
  // Gated by `power` (latheStore.power): the lathe may be spinning down
  // (rpm > 0 but power=false) — in that case let the hum fade with the machine.
  // Using a slightly slower TC for the hum so it doesn't snap off.
  const HUM_TC = 0.15;
  const humTarget = power ? MOTOR_HUM_ON_GAIN : 0;
  motorHumDirectGain.gain.setTargetAtTime(humTarget, now, HUM_TC);
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
