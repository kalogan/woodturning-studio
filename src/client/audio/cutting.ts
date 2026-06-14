/**
 * cutting.ts — Sustained tool-on-wood cutting sound, intensity-driven.
 *
 * Design:
 * - Nodes are created ONCE (startCutting) and kept alive.
 * - Per-frame updates ONLY set AudioParam values — no per-frame allocation.
 * - All Web Audio access is guarded; jsdom / SSR import + call never throws.
 * - Routes through the SFX channel gain (getChannelGain('sfx')) so the SFX
 *   slider controls it alongside one-shot sfx.
 *
 * Cutting texture (two-layer mix):
 *   1. Scrape noise  — highpass-filtered white noise (looped) for the hiss/rasp
 *      quality of edge-on-wood. Filter cutoff is modulated by intensity
 *      (brighter = more aggressive cut). Gain rises with intensity.
 *   2. Mid body      — bandpass-filtered noise at ~1.2 kHz gives the "meat" of
 *      wood removal: a thick, woody rasp beneath the hiss. Gain also rises with
 *      intensity.
 *   Both pass through cuttingMasterGain → sfxChannel → master → destination.
 *
 * Intensity → gain/brightness mapping:
 *   - intensity 0    : masterGain ≈ 0 (silent)
 *   - intensity 0..1 : masterGain ramps from 0 → CUT_MASTER_MAX_GAIN (0.30)
 *   - scrape filter cutoff: CUT_HP_MIN_HZ (1200) + intensity × (CUT_HP_MAX_HZ - CUT_HP_MIN_HZ)
 *     i.e. 1200..4000 Hz — brighter as the cut gets more aggressive
 *   All transitions use setTargetAtTime(TC = 0.04 s) — no zipper noise.
 *
 * cutIntensityFromRemoval():
 *   Converts per-tick material removed (m³) to a 0..1 intensity value.
 *   The normalisation constant CUT_REMOVAL_SCALE (3e-6 m³/tick) is tuned so
 *   that a typical gouge cut at moderate depth registers ≈ 0.5–0.7 intensity.
 *   Clamped to [0, 1].
 */

import { getContext, getChannelGain } from './audioBus.js';

// ---------------------------------------------------------------------------
// Timbre constants — tunable by the director
// ---------------------------------------------------------------------------

/** Highpass cutoff at zero intensity — bright noise floor */
const CUT_HP_MIN_HZ       = 1200;
/** Highpass cutoff at full intensity — very bright, aggressive */
const CUT_HP_MAX_HZ       = 4000;
/** Bandpass centre for the mid "wood body" layer */
const CUT_BP_HZ           = 1200;
/** Bandpass Q — narrow enough for woody character, wide enough for texture */
const CUT_BP_Q            = 2.5;
/** Master gain ceiling (cuts through the motor without dominating) */
const CUT_MASTER_MAX_GAIN = 0.30;
/** Relative mix: scrape noise vs mid body inside the master bus */
const CUT_SCRAPE_REL_GAIN = 0.65;
const CUT_BODY_REL_GAIN   = 0.35;

/** smoothing time-constant for all setTargetAtTime calls (seconds) */
const TC = 0.04;

/**
 * Per-tick material removal (m³) that maps to intensity ≈ 1.0.
 * Tune this constant to taste; a typical moderate gouge cut at ~30% depth
 * in the physics model produces ~2e-6 m³/tick.
 */
const CUT_REMOVAL_SCALE = 3e-6;

// ---------------------------------------------------------------------------
// Pure intensity mapping — exported + unit-tested
// ---------------------------------------------------------------------------

/**
 * Convert per-tick material removal (m³) to a [0, 1] cut intensity value.
 * 0 removal → 0 (silent).  Higher removal → louder, brighter.
 * Clamped to [0, 1].  Pure function — no Web Audio dependency.
 *
 * @param materialRemoved  m³ removed this physics tick (from PhysicsResult)
 */
export function cutIntensityFromRemoval(materialRemoved: number): number {
  if (materialRemoved <= 0) return 0;
  const raw = materialRemoved / CUT_REMOVAL_SCALE;
  return Math.min(1, raw);
}

// ---------------------------------------------------------------------------
// Internal graph state — module-level singletons (one context lifetime)
// ---------------------------------------------------------------------------

let cuttingStarted = false;

// Noise source shared by both layers (one looped buffer for efficiency)
let cuttingNoiseSource: AudioBufferSourceNode | null = null;

// Layer 1 — highpass scrape (brightness driven by intensity)
let cuttingScrapeFilter: BiquadFilterNode | null = null;
let cuttingScrapeGain: GainNode | null = null;

// Layer 2 — bandpass body (mid-range woody texture)
let cuttingBodyFilter: BiquadFilterNode | null = null;
let cuttingBodyGain: GainNode | null = null;

// Master gain (driven per-frame by intensity)
let cuttingMasterGain: GainNode | null = null;

// ---------------------------------------------------------------------------
// Helper: 2-second white noise buffer (shared by both layers via fork)
// ---------------------------------------------------------------------------

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Public: start / stop
// ---------------------------------------------------------------------------

/**
 * Create and connect the cutting sound graph.
 * Starts silent (masterGain = 0); call setCutIntensity() to drive it.
 * Safe no-op if already started or no AudioContext exists.
 */
export function startCutting(): void {
  const ctx = getContext();
  const dest = getChannelGain('sfx');
  if (!ctx || !dest || cuttingStarted) return;
  cuttingStarted = true;

  // ── Master gain → sfxChannel → master → destination ───────────────────────
  cuttingMasterGain = ctx.createGain();
  cuttingMasterGain.gain.value = 0; // silent until cut intensity > 0
  cuttingMasterGain.connect(dest);

  // ── Shared noise source (both filter layers receive the same signal) ───────
  const noiseBuffer = createNoiseBuffer(ctx);
  cuttingNoiseSource = ctx.createBufferSource();
  cuttingNoiseSource.buffer = noiseBuffer;
  cuttingNoiseSource.loop = true;

  // ── Layer 1: Highpass scrape (hiss) ───────────────────────────────────────
  cuttingScrapeFilter = ctx.createBiquadFilter();
  cuttingScrapeFilter.type = 'highpass';
  cuttingScrapeFilter.frequency.value = CUT_HP_MIN_HZ;
  cuttingScrapeFilter.Q.value = 0.5;

  cuttingScrapeGain = ctx.createGain();
  cuttingScrapeGain.gain.value = CUT_SCRAPE_REL_GAIN;

  // ── Layer 2: Bandpass body (mid-range woody rasp) ─────────────────────────
  cuttingBodyFilter = ctx.createBiquadFilter();
  cuttingBodyFilter.type = 'bandpass';
  cuttingBodyFilter.frequency.value = CUT_BP_HZ;
  cuttingBodyFilter.Q.value = CUT_BP_Q;

  cuttingBodyGain = ctx.createGain();
  cuttingBodyGain.gain.value = CUT_BODY_REL_GAIN;

  // ── Graph connections ──────────────────────────────────────────────────────
  // noise → scrapeFilter → scrapeGain → masterGain
  // noise → bodyFilter   → bodyGain   → masterGain
  // masterGain → sfxChannel → master → destination
  cuttingNoiseSource.connect(cuttingScrapeFilter);
  cuttingScrapeFilter.connect(cuttingScrapeGain);
  cuttingScrapeGain.connect(cuttingMasterGain);

  cuttingNoiseSource.connect(cuttingBodyFilter);
  cuttingBodyFilter.connect(cuttingBodyGain);
  cuttingBodyGain.connect(cuttingMasterGain);

  cuttingNoiseSource.start();
}

/**
 * Stop and disconnect the cutting sound graph.
 * Safe no-op if not started.
 */
export function stopCutting(): void {
  if (!cuttingStarted) return;
  try { cuttingNoiseSource?.stop(); } catch { /* already stopped */ }
  cuttingNoiseSource?.disconnect();
  cuttingScrapeFilter?.disconnect();
  cuttingScrapeGain?.disconnect();
  cuttingBodyFilter?.disconnect();
  cuttingBodyGain?.disconnect();
  cuttingMasterGain?.disconnect();

  cuttingNoiseSource = null;
  cuttingScrapeFilter = null;
  cuttingScrapeGain = null;
  cuttingBodyFilter = null;
  cuttingBodyGain = null;
  cuttingMasterGain = null;
  cuttingStarted = false;
}

// ---------------------------------------------------------------------------
// Public: per-frame intensity update
// ---------------------------------------------------------------------------

/**
 * Drive the cutting sound to the given intensity [0, 1].
 * - 0     : master gain fades to 0 (silent)
 * - 0..1  : master gain ramps to CUT_MASTER_MAX_GAIN × intensity
 * - filter cutoff brightens from CUT_HP_MIN_HZ → CUT_HP_MAX_HZ
 *
 * Uses setTargetAtTime for all AudioParam changes — no zipper noise.
 * Safe no-op when cutting not started or no AudioContext.
 *
 * @param intensity  Cut intensity [0, 1] — values outside range are clamped.
 */
export function setCutIntensity(intensity: number): void {
  const ctx = getContext();
  if (!ctx || !cuttingStarted) return;
  if (!cuttingMasterGain || !cuttingScrapeFilter) return;

  const t = Math.max(0, Math.min(1, intensity));
  const now = ctx.currentTime;

  // Master gain: 0 → CUT_MASTER_MAX_GAIN
  cuttingMasterGain.gain.setTargetAtTime(t * CUT_MASTER_MAX_GAIN, now, TC);

  // Highpass cutoff: brighter at higher intensity
  const cutoff = CUT_HP_MIN_HZ + t * (CUT_HP_MAX_HZ - CUT_HP_MIN_HZ);
  cuttingScrapeFilter.frequency.setTargetAtTime(cutoff, now, TC);
}

// ---------------------------------------------------------------------------
// Internal reset helper (for tests / HMR)
// ---------------------------------------------------------------------------

/** Stop the cutting graph and reset module state. Used in tests. */
export function _resetCutting(): void {
  stopCutting();
}
