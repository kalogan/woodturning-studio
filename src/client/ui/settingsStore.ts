/**
 * settingsStore.ts — Zustand store for all user-facing settings.
 *
 * Persisted to localStorage under the key `wts:settings:v3`.
 * (Bumped from v2 to v3 because we added `display`, `input`, and `gameplay`
 *  sections.  A shape mismatch on parse falls back silently to defaults.)
 *
 * Design:
 * - isOpen controls the modal visibility (toggled by Escape in App.tsx).
 * - audio section is the single source of truth for all audio volumes/mute.
 *   It drives audioBus directly; the old audioSettings store is kept alive
 *   for backward-compat but is forwarded from here.
 * - controls.keymap holds rebindable WASD+interact keys. rebind() lowercases
 *   the key and SWAPS keys if the requested key is already bound to another
 *   action (avoids silent holes in the keymap — every action always has a key).
 * - camera holds look/dial sensitivity multipliers and invertY flag.
 * - display holds FOV (55..100) and fullscreen preference.
 * - input.mode is the SINGLE source of truth for turning-tool input source
 *   ('mouse' | 'camera'). Both the in-turning InputToggle HUD and the
 *   Settings > Input tab read/write this field.
 * - gameplay holds coachingOverlay toggle, assistLevel, and units preference.
 *   assistLevel / units are stored-pref-only for now:
 *   TODO: wire assistLevel → catch tolerance in src/core (brief §9 follow-up).
 *   TODO: wire units → any dimension display that needs metric/imperial.
 * - All Web Audio calls are import-safe: guarded behind typeof window checks
 *   in audioBus — no throw in jsdom.
 * - localStorage is guarded: typeof localStorage check before every access.
 *
 * Sections: audio, controls, camera, display, input, gameplay.
 */

import { create } from 'zustand';
import {
  setMuted as busMuted,
  setVolume as busVolume,
  setChannelVolume,
} from '../audio/audioBus.js';

// ---------------------------------------------------------------------------
// Persistence helpers (localStorage-guarded)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'wts:settings:v3';

function loadPersistedSettings(): Partial<PersistedSettings> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    // Cast to expected shape; individual field mergers below guard against
    // missing/wrong-typed fields at the value level.
    return JSON.parse(raw) as Partial<PersistedSettings>;
  } catch {
    return {};
  }
}

function persistSettings(s: PersistedSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota exceeded or private browsing — silently ignore */
  }
}

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

/** Subset of store state that is persisted to localStorage. */
interface PersistedSettings {
  audio: AudioSettings;
  controls: ControlsSettings;
  camera: CameraSettings;
  display: DisplaySettings;
  input: InputSettings;
  gameplay: GameplaySettings;
}

export interface AudioSettings {
  masterVolume: number;
  ambientVolume: number;
  motorVolume: number;
  sfxVolume: number;
  muted: boolean;
}

/** The set of remappable movement/interact actions. */
export type KeyAction = 'forward' | 'back' | 'left' | 'right' | 'interact';

export type Keymap = Record<KeyAction, string>;

export interface ControlsSettings {
  keymap: Keymap;
}

export interface CameraSettings {
  /** Multiplier applied to mouse-look delta. Range: 0.25–3. */
  lookSensitivity: number;
  /** Flip vertical (pitch) mouse axis. */
  invertY: boolean;
  /** Multiplier on the speed-dial drag sensitivity. Range: 0.25–3. */
  dialSensitivity: number;
}

export interface DisplaySettings {
  /** Vertical field-of-view for the walk (FPS) camera. Clamped 55..100. */
  fov: number;
  /**
   * Persisted fullscreen preference.
   * Actual fullscreen state is driven via the Fullscreen API in the Display tab;
   * this field reflects the last-requested value across sessions.
   */
  fullscreen: boolean;
}

/** Turning-tool input source. Single source of truth — see module JSDoc. */
export type InputMode = 'mouse' | 'camera';

export interface InputSettings {
  mode: InputMode;
}

export type AssistLevel = 'beginner' | 'normal' | 'off';
export type Units = 'metric' | 'imperial';

export interface GameplaySettings {
  /** Show/hide the CoachingOverlay HUD during turning. */
  coachingOverlay: boolean;
  /**
   * Assist level for catching / coaching feedback.
   * TODO: wire → catch tolerance in src/core (brief §9 follow-up).
   */
  assistLevel: AssistLevel;
  /**
   * Measurement unit preference for any displayed dimensions.
   * TODO: wire → dimension displays throughout the UI (follow-up).
   */
  units: Units;
}

export interface SettingsStore {
  // ── Modal open/close ────────────────────────────────────────────────────────
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;

  // ── Audio ──────────────────────────────────────────────────────────────────
  audio: AudioSettings;
  setMasterVolume: (v: number) => void;
  setAmbientVolume: (v: number) => void;
  setMotorVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMuted: (muted: boolean) => void;

  // ── Controls (keymap) ──────────────────────────────────────────────────────
  controls: ControlsSettings;
  /**
   * Rebind `action` to `key` (lowercased).
   *
   * Conflict strategy — SWAP:
   *   If another action is already bound to that key, the two actions exchange
   *   their keys. This ensures the keymap is always a complete bijection
   *   (no action ever loses its binding silently).
   *
   * Returns 'ok' | 'swapped' so the UI can surface a transient notice.
   */
  rebind: (action: KeyAction, key: string) => 'ok' | 'swapped';
  resetKeymap: () => void;

  // ── Camera & feel ──────────────────────────────────────────────────────────
  camera: CameraSettings;
  setLookSensitivity: (v: number) => void;
  setInvertY: (v: boolean) => void;
  setDialSensitivity: (v: number) => void;

  // ── Display ────────────────────────────────────────────────────────────────
  display: DisplaySettings;
  /** Set vertical FOV for the walk camera. Clamped to 55..100. */
  setFov: (v: number) => void;
  /** Record the fullscreen preference (actual API calls happen in the UI). */
  setFullscreen: (v: boolean) => void;

  // ── Input ──────────────────────────────────────────────────────────────────
  input: InputSettings;
  /** Switch the turning-tool input source. Single source of truth. */
  setInputMode: (mode: InputMode) => void;

  // ── Gameplay / Accessibility ───────────────────────────────────────────────
  gameplay: GameplaySettings;
  setCoachingOverlay: (v: boolean) => void;
  setAssistLevel: (v: AssistLevel) => void;
  setUnits: (v: Units) => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const AUDIO_DEFAULTS: AudioSettings = {
  masterVolume: 0.8,
  ambientVolume: 0.7,
  motorVolume: 0.7,
  sfxVolume: 0.7,
  muted: false,
};

export const KEYMAP_DEFAULTS: Keymap = {
  forward:  'w',
  back:     's',
  left:     'a',
  right:    'd',
  interact: 'e',
};

const CONTROLS_DEFAULTS: ControlsSettings = {
  keymap: { ...KEYMAP_DEFAULTS },
};

const CAMERA_DEFAULTS: CameraSettings = {
  lookSensitivity: 1.0,
  invertY:         false,
  dialSensitivity: 1.0,
};

// FOV range for the walk camera (AT_LATHE / TURNING cameras are fixed framings)
export const FOV_MIN = 55;
export const FOV_MAX = 100;

const DISPLAY_DEFAULTS: DisplaySettings = {
  fov:        75,
  fullscreen: false,
};

const INPUT_DEFAULTS: InputSettings = {
  mode: 'mouse',
};

const GAMEPLAY_DEFAULTS: GameplaySettings = {
  coachingOverlay: true,
  assistLevel:     'normal',
  units:           'metric',
};

// Sensitivity range clamp (0.25x – 3x)
const SENS_MIN = 0.25;
const SENS_MAX = 3.0;

// ---------------------------------------------------------------------------
// Helper — clamp to various ranges
// ---------------------------------------------------------------------------

function clampAudio(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function clampSens(v: number): number {
  return Math.max(SENS_MIN, Math.min(SENS_MAX, v));
}

function clampFov(v: number): number {
  return Math.max(FOV_MIN, Math.min(FOV_MAX, v));
}

function applyAudioToBus(audio: AudioSettings): void {
  busMuted(audio.muted);
  busVolume(audio.masterVolume);
  setChannelVolume('ambient', audio.ambientVolume);
  setChannelVolume('motor', audio.motorVolume);
  setChannelVolume('sfx', audio.sfxVolume);
}

// ---------------------------------------------------------------------------
// Helpers to merge persisted partial shapes safely
// ---------------------------------------------------------------------------

/** Exported so tests and the UI can iterate over all rebindable actions. */
export const KEY_ACTIONS: KeyAction[] = ['forward', 'back', 'left', 'right', 'interact'];

function mergeKeymap(saved: unknown): Keymap {
  if (typeof saved !== 'object' || saved === null) return { ...KEYMAP_DEFAULTS };
  const m = saved as Record<string, unknown>;
  const result: Keymap = { ...KEYMAP_DEFAULTS };
  for (const action of KEY_ACTIONS) {
    const v = m[action];
    if (typeof v === 'string' && v.length > 0) {
      result[action] = v.toLowerCase();
    }
  }
  return result;
}

function mergeCameraSettings(saved: unknown): CameraSettings {
  if (typeof saved !== 'object' || saved === null) return { ...CAMERA_DEFAULTS };
  const m = saved as Record<string, unknown>;
  return {
    lookSensitivity: typeof m['lookSensitivity'] === 'number'
      ? clampSens(m['lookSensitivity'])
      : CAMERA_DEFAULTS.lookSensitivity,
    invertY: typeof m['invertY'] === 'boolean'
      ? m['invertY']
      : CAMERA_DEFAULTS.invertY,
    dialSensitivity: typeof m['dialSensitivity'] === 'number'
      ? clampSens(m['dialSensitivity'])
      : CAMERA_DEFAULTS.dialSensitivity,
  };
}

function mergeDisplaySettings(saved: unknown): DisplaySettings {
  if (typeof saved !== 'object' || saved === null) return { ...DISPLAY_DEFAULTS };
  const m = saved as Record<string, unknown>;
  return {
    fov: typeof m['fov'] === 'number'
      ? clampFov(m['fov'])
      : DISPLAY_DEFAULTS.fov,
    fullscreen: typeof m['fullscreen'] === 'boolean'
      ? m['fullscreen']
      : DISPLAY_DEFAULTS.fullscreen,
  };
}

function mergeInputSettings(saved: unknown): InputSettings {
  if (typeof saved !== 'object' || saved === null) return { ...INPUT_DEFAULTS };
  const m = saved as Record<string, unknown>;
  const mode = m['mode'];
  return {
    mode: (mode === 'mouse' || mode === 'camera') ? mode : INPUT_DEFAULTS.mode,
  };
}

function mergeGameplaySettings(saved: unknown): GameplaySettings {
  if (typeof saved !== 'object' || saved === null) return { ...GAMEPLAY_DEFAULTS };
  const m = saved as Record<string, unknown>;
  const assistLevel = m['assistLevel'];
  const units = m['units'];
  return {
    coachingOverlay: typeof m['coachingOverlay'] === 'boolean'
      ? m['coachingOverlay']
      : GAMEPLAY_DEFAULTS.coachingOverlay,
    assistLevel: (assistLevel === 'beginner' || assistLevel === 'normal' || assistLevel === 'off')
      ? assistLevel
      : GAMEPLAY_DEFAULTS.assistLevel,
    units: (units === 'metric' || units === 'imperial')
      ? units
      : GAMEPLAY_DEFAULTS.units,
  };
}

// ---------------------------------------------------------------------------
// Load persisted state (once at module evaluation)
// ---------------------------------------------------------------------------

const persisted = loadPersistedSettings();

const initialAudio: AudioSettings = {
  ...AUDIO_DEFAULTS,
  ...(persisted.audio ?? {}),
};

const initialControls: ControlsSettings = {
  keymap: mergeKeymap(persisted.controls?.keymap),
};

const initialCamera: CameraSettings = mergeCameraSettings(persisted.camera);
const initialDisplay: DisplaySettings = mergeDisplaySettings(persisted.display);
const initialInput: InputSettings = mergeInputSettings(persisted.input);
const initialGameplay: GameplaySettings = mergeGameplaySettings(persisted.gameplay);

// Suppress unused-var lint: CONTROLS_DEFAULTS exists as a doc anchor.
void CONTROLS_DEFAULTS;

// ---------------------------------------------------------------------------
// Shared persist helper — always snapshots all six sections together
// ---------------------------------------------------------------------------

function persist(
  audio: AudioSettings,
  controls: ControlsSettings,
  camera: CameraSettings,
  display: DisplaySettings,
  input: InputSettings,
  gameplay: GameplaySettings,
): void {
  persistSettings({ audio, controls, camera, display, input, gameplay });
}

/** Convenience: read all six sections from the current store state and persist. */
function persistAll(get: () => SettingsStore): void {
  const s = get();
  persist(s.audio, s.controls, s.camera, s.display, s.input, s.gameplay);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  isOpen: false,
  open:   () => { set({ isOpen: true }); },
  close:  () => { set({ isOpen: false }); },
  toggle: () => { set((s) => ({ isOpen: !s.isOpen })); },

  // ── Audio ─────────────────────────────────────────────────────────────────

  audio: initialAudio,

  setMasterVolume: (v) => {
    const audio: AudioSettings = { ...get().audio, masterVolume: clampAudio(v) };
    set({ audio });
    applyAudioToBus(audio);
    persistAll(get);
  },

  setAmbientVolume: (v) => {
    const audio: AudioSettings = { ...get().audio, ambientVolume: clampAudio(v) };
    set({ audio });
    applyAudioToBus(audio);
    persistAll(get);
  },

  setMotorVolume: (v) => {
    const audio: AudioSettings = { ...get().audio, motorVolume: clampAudio(v) };
    set({ audio });
    applyAudioToBus(audio);
    persistAll(get);
  },

  setSfxVolume: (v) => {
    const audio: AudioSettings = { ...get().audio, sfxVolume: clampAudio(v) };
    set({ audio });
    applyAudioToBus(audio);
    persistAll(get);
  },

  setMuted: (muted) => {
    const audio: AudioSettings = { ...get().audio, muted };
    set({ audio });
    applyAudioToBus(audio);
    persistAll(get);
  },

  // ── Controls (keymap) ─────────────────────────────────────────────────────

  controls: initialControls,

  rebind: (action, key) => {
    const normalised = key.toLowerCase();
    const currentKeymap = get().controls.keymap;

    // Check if any OTHER action is already bound to this key.
    const conflict = KEY_ACTIONS.find(
      (a) => a !== action && currentKeymap[a] === normalised,
    );

    let newKeymap: Keymap;
    let result: 'ok' | 'swapped';

    if (conflict !== undefined) {
      // SWAP: conflicting action takes the current action's old key.
      newKeymap = {
        ...currentKeymap,
        [action]:   normalised,
        [conflict]: currentKeymap[action],
      };
      result = 'swapped';
    } else {
      newKeymap = { ...currentKeymap, [action]: normalised };
      result = 'ok';
    }

    const controls: ControlsSettings = { keymap: newKeymap };
    set({ controls });
    persistAll(get);
    return result;
  },

  resetKeymap: () => {
    const controls: ControlsSettings = { keymap: { ...KEYMAP_DEFAULTS } };
    set({ controls });
    persistAll(get);
  },

  // ── Camera & feel ─────────────────────────────────────────────────────────

  camera: initialCamera,

  setLookSensitivity: (v) => {
    const camera: CameraSettings = { ...get().camera, lookSensitivity: clampSens(v) };
    set({ camera });
    persistAll(get);
  },

  setInvertY: (v) => {
    const camera: CameraSettings = { ...get().camera, invertY: v };
    set({ camera });
    persistAll(get);
  },

  setDialSensitivity: (v) => {
    const camera: CameraSettings = { ...get().camera, dialSensitivity: clampSens(v) };
    set({ camera });
    persistAll(get);
  },

  // ── Display ───────────────────────────────────────────────────────────────

  display: initialDisplay,

  setFov: (v) => {
    const display: DisplaySettings = { ...get().display, fov: clampFov(v) };
    set({ display });
    persistAll(get);
  },

  setFullscreen: (v) => {
    const display: DisplaySettings = { ...get().display, fullscreen: v };
    set({ display });
    persistAll(get);
  },

  // ── Input ─────────────────────────────────────────────────────────────────

  input: initialInput,

  setInputMode: (mode) => {
    const input: InputSettings = { mode };
    set({ input });
    persistAll(get);
  },

  // ── Gameplay / Accessibility ──────────────────────────────────────────────

  gameplay: initialGameplay,

  setCoachingOverlay: (v) => {
    const gameplay: GameplaySettings = { ...get().gameplay, coachingOverlay: v };
    set({ gameplay });
    persistAll(get);
  },

  setAssistLevel: (v) => {
    const gameplay: GameplaySettings = { ...get().gameplay, assistLevel: v };
    set({ gameplay });
    persistAll(get);
  },

  setUnits: (v) => {
    const gameplay: GameplaySettings = { ...get().gameplay, units: v };
    set({ gameplay });
    persistAll(get);
  },
}));
