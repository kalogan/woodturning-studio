/**
 * synth.ts — Procedural synthesis helpers.
 *
 * Two layers:
 * 1. PURE parameter math functions (testable without Web Audio):
 *    - calcEnvelope()  → computes ADSR time-point schedule
 *    - clampGain()     → clamps a gain value to [0, 1]
 *    - calcOscParams() → normalises oscillator parameters
 *    - calcNoiseFilterFreq() → frequency clamp for noise filter
 *
 * 2. Web Audio node builders (guarded — no-op when ctx is null):
 *    - playTone()   → oscillator + ADSR gain envelope
 *    - playNoise()  → filtered noise burst
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnvelopeParams {
  /** Attack duration in seconds */
  attack: number;
  /** Decay duration in seconds */
  decay: number;
  /** Sustain level 0..1 */
  sustain: number;
  /** Release duration in seconds */
  release: number;
  /** Peak gain 0..1 */
  peak: number;
}

export interface EnvelopeSchedule {
  /** t0: start (silence) */
  t0: number;
  /** t1: end of attack (peak) */
  t1: number;
  /** t2: end of decay (sustain level) */
  t2: number;
  /** t3: end of sustain / start of release */
  t3: number;
  /** t4: end of release (silence) */
  t4: number;
  /** gain at peak (= peak) */
  peakGain: number;
  /** gain during sustain (= peak * sustain) */
  sustainGain: number;
}

export interface ToneParams {
  /** Frequency in Hz */
  freq: number;
  /** OscillatorType */
  type: OscillatorType;
  /** Total duration in seconds */
  duration: number;
  /** Master gain for this tone 0..1 */
  gain: number;
  /** ADSR — defaults to a short pluck if omitted */
  envelope?: Partial<EnvelopeParams>;
}

export interface NoiseParams {
  /** Centre frequency of the bandpass filter (Hz) */
  filterFreq: number;
  /** Filter Q */
  filterQ: number;
  /** Duration in seconds */
  duration: number;
  /** Master gain 0..1 */
  gain: number;
  /** Optional quick fade-in/out (seconds) */
  fadeIn?: number;
  /** Optional quick fade-out (seconds) */
  fadeOut?: number;
}

// ---------------------------------------------------------------------------
// Pure parameter math — fully testable without AudioContext
// ---------------------------------------------------------------------------

const DEFAULT_ENVELOPE: EnvelopeParams = {
  attack: 0.005,
  decay: 0.05,
  sustain: 0.3,
  release: 0.1,
  peak: 1.0,
};

/**
 * Compute the ADSR time-point schedule relative to a start time t0.
 * All values are in seconds. Pure function — no Web Audio dependency.
 */
export function calcEnvelope(
  t0: number,
  sustainDuration: number,
  params: Partial<EnvelopeParams> = {},
): EnvelopeSchedule {
  const env: EnvelopeParams = { ...DEFAULT_ENVELOPE, ...params };
  const peakGain = clampGain(env.peak);
  const sustainGain = clampGain(peakGain * env.sustain);
  const t1 = t0 + Math.max(0, env.attack);
  const t2 = t1 + Math.max(0, env.decay);
  const t3 = t2 + Math.max(0, sustainDuration);
  const t4 = t3 + Math.max(0, env.release);
  return { t0, t1, t2, t3, t4, peakGain, sustainGain };
}

/** Clamp a gain value to [0, 1]. Pure function. */
export function clampGain(gain: number): number {
  return Math.max(0, Math.min(1, gain));
}

/**
 * Normalise oscillator parameters — ensures freq is > 0 and gain is clamped.
 * Pure function — no Web Audio dependency.
 */
export function calcOscParams(p: ToneParams): ToneParams {
  return {
    ...p,
    freq: Math.max(1, p.freq),
    gain: clampGain(p.gain),
    duration: Math.max(0, p.duration),
  };
}

/**
 * Clamp a noise filter frequency to audible range [20, 20000] Hz.
 * Pure function.
 */
export function calcNoiseFilterFreq(freq: number): number {
  return Math.max(20, Math.min(20000, freq));
}

// ---------------------------------------------------------------------------
// Web Audio node builders — all guarded for null context
// ---------------------------------------------------------------------------

/**
 * Play a simple oscillator tone through the given destination node.
 * No-op when ctx is null (jsdom / SSR).
 */
export function playTone(
  ctx: AudioContext | null,
  destination: AudioNode | null,
  params: ToneParams,
): void {
  if (!ctx || !destination) return;

  const p = calcOscParams(params);
  const now = ctx.currentTime;

  const envParams: Partial<EnvelopeParams> = params.envelope ?? {};
  // sustain duration = total duration minus attack, decay, release headroom
  const adsr = { ...DEFAULT_ENVELOPE, ...envParams };
  const sustainDur = Math.max(
    0,
    p.duration - adsr.attack - adsr.decay - adsr.release,
  );
  const schedule = calcEnvelope(now, sustainDur, envParams);

  // Gain envelope node
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, schedule.t0);
  gainNode.gain.linearRampToValueAtTime(
    schedule.peakGain * p.gain,
    schedule.t1,
  );
  gainNode.gain.linearRampToValueAtTime(
    schedule.sustainGain * p.gain,
    schedule.t2,
  );
  gainNode.gain.setValueAtTime(schedule.sustainGain * p.gain, schedule.t3);
  gainNode.gain.linearRampToValueAtTime(0, schedule.t4);

  // Oscillator
  const osc = ctx.createOscillator();
  osc.type = p.type;
  osc.frequency.value = p.freq;

  osc.connect(gainNode);
  gainNode.connect(destination);

  osc.start(schedule.t0);
  osc.stop(schedule.t4 + 0.01);
}

/**
 * Create a short noise burst through a bandpass filter.
 * No-op when ctx is null.
 */
export function playNoise(
  ctx: AudioContext | null,
  destination: AudioNode | null,
  params: NoiseParams,
): void {
  if (!ctx || !destination) return;

  const now = ctx.currentTime;
  const duration = Math.max(0.01, params.duration);
  const filterFreq = calcNoiseFilterFreq(params.filterFreq);
  const gainLevel = clampGain(params.gain);
  const fadeIn = Math.max(0, params.fadeIn ?? 0.005);
  const fadeOut = Math.max(0, params.fadeOut ?? 0.02);

  // White noise buffer (1 second, resampled by playback rate)
  const bufferSize = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  // Bandpass filter
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = Math.max(0.1, params.filterQ);

  // Gain envelope for fade in/out
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(gainLevel, now + fadeIn);
  gainNode.gain.setValueAtTime(gainLevel, now + duration - fadeOut);
  gainNode.gain.linearRampToValueAtTime(0, now + duration);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(destination);

  source.start(now);
  source.stop(now + duration + 0.01);
}
