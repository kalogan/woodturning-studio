/**
 * settingsStore.ts — Zustand store for all user-facing settings.
 *
 * Persisted to localStorage under the key `wts:settings:v2`.
 * (Bumped from v1 to v2 because we added `controls` + `camera` sections.
 *  A shape mismatch on parse falls back silently to defaults.)
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
 * - All Web Audio calls are import-safe: guarded behind typeof window checks
 *   in audioBus — no throw in jsdom.
 * - localStorage is guarded: typeof localStorage check before every access.
 *
 * Sections: audio, controls, camera.
 * Future slices: input, display, accessibility.
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

const STORAGE_KEY = 'wts:settings:v2';

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

// Suppress unused-var lint: CONTROLS_DEFAULTS exists as a doc anchor.
void CONTROLS_DEFAULTS;

// ---------------------------------------------------------------------------
// Shared persist helper — always snapshots all three sections together
// ---------------------------------------------------------------------------

function persist(audio: AudioSettings, controls: ControlsSettings, camera: CameraSettings): void {
  persistSettings({ audio, controls, camera });
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
    persist(audio, get().controls, get().camera);
  },

  setAmbientVolume: (v) => {
    const audio: AudioSettings = { ...get().audio, ambientVolume: clampAudio(v) };
    set({ audio });
    applyAudioToBus(audio);
    persist(audio, get().controls, get().camera);
  },

  setMotorVolume: (v) => {
    const audio: AudioSettings = { ...get().audio, motorVolume: clampAudio(v) };
    set({ audio });
    applyAudioToBus(audio);
    persist(audio, get().controls, get().camera);
  },

  setSfxVolume: (v) => {
    const audio: AudioSettings = { ...get().audio, sfxVolume: clampAudio(v) };
    set({ audio });
    applyAudioToBus(audio);
    persist(audio, get().controls, get().camera);
  },

  setMuted: (muted) => {
    const audio: AudioSettings = { ...get().audio, muted };
    set({ audio });
    applyAudioToBus(audio);
    persist(audio, get().controls, get().camera);
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
    persist(get().audio, controls, get().camera);
    return result;
  },

  resetKeymap: () => {
    const controls: ControlsSettings = { keymap: { ...KEYMAP_DEFAULTS } };
    set({ controls });
    persist(get().audio, controls, get().camera);
  },

  // ── Camera & feel ─────────────────────────────────────────────────────────

  camera: initialCamera,

  setLookSensitivity: (v) => {
    const camera: CameraSettings = { ...get().camera, lookSensitivity: clampSens(v) };
    set({ camera });
    persist(get().audio, get().controls, camera);
  },

  setInvertY: (v) => {
    const camera: CameraSettings = { ...get().camera, invertY: v };
    set({ camera });
    persist(get().audio, get().controls, camera);
  },

  setDialSensitivity: (v) => {
    const camera: CameraSettings = { ...get().camera, dialSensitivity: clampSens(v) };
    set({ camera });
    persist(get().audio, get().controls, camera);
  },
}));
