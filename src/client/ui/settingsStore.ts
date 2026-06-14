/**
 * settingsStore.ts — Zustand store for all user-facing settings.
 *
 * Persisted to localStorage under the key `wts:settings:v1`.
 * Shape is versioned so future slices can add sections without conflicts.
 *
 * Design:
 * - isOpen controls the modal visibility (toggled by Escape in App.tsx).
 * - audio section is the single source of truth for all audio volumes/mute.
 *   It drives audioBus directly; the old audioSettings store is kept alive
 *   for backward-compat but is forwarded from here.
 * - All Web Audio calls are import-safe: guarded behind typeof window checks
 *   in audioBus — no throw in jsdom.
 * - localStorage is guarded: typeof localStorage check before every access.
 *
 * Sections (this slice): audio.
 * Future slices: controls, input, camera, display, accessibility.
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

const STORAGE_KEY = 'wts:settings:v1';

function loadPersistedSettings(): Partial<PersistedSettings> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
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
}

export interface AudioSettings {
  masterVolume: number;
  ambientVolume: number;
  motorVolume: number;
  sfxVolume: number;
  muted: boolean;
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

// ---------------------------------------------------------------------------
// Helper — clamp and push to bus
// ---------------------------------------------------------------------------

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function applyAudioToBus(audio: AudioSettings): void {
  busMuted(audio.muted);
  busVolume(audio.masterVolume);
  setChannelVolume('ambient', audio.ambientVolume);
  setChannelVolume('motor', audio.motorVolume);
  setChannelVolume('sfx', audio.sfxVolume);
}

// ---------------------------------------------------------------------------
// Load persisted state (once at module evaluation)
// ---------------------------------------------------------------------------

const persisted = loadPersistedSettings();
const initialAudio: AudioSettings = {
  ...AUDIO_DEFAULTS,
  ...(persisted.audio ?? {}),
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  isOpen: false,
  open: () => { set({ isOpen: true }); },
  close: () => { set({ isOpen: false }); },
  toggle: () => { set((s) => ({ isOpen: !s.isOpen })); },

  audio: initialAudio,

  setMasterVolume: (v) => {
    const audio: AudioSettings = { ...get().audio, masterVolume: clamp(v) };
    set({ audio });
    applyAudioToBus(audio);
    persistSettings({ audio });
  },

  setAmbientVolume: (v) => {
    const audio: AudioSettings = { ...get().audio, ambientVolume: clamp(v) };
    set({ audio });
    applyAudioToBus(audio);
    persistSettings({ audio });
  },

  setMotorVolume: (v) => {
    const audio: AudioSettings = { ...get().audio, motorVolume: clamp(v) };
    set({ audio });
    applyAudioToBus(audio);
    persistSettings({ audio });
  },

  setSfxVolume: (v) => {
    const audio: AudioSettings = { ...get().audio, sfxVolume: clamp(v) };
    set({ audio });
    applyAudioToBus(audio);
    persistSettings({ audio });
  },

  setMuted: (muted) => {
    const audio: AudioSettings = { ...get().audio, muted };
    set({ audio });
    applyAudioToBus(audio);
    persistSettings({ audio });
  },
}));
