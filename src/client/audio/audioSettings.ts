/**
 * audioSettings.ts — Zustand store for audio preferences.
 *
 * Shape: { enabled, muted, volume } with clamped setters.
 * Mirrors the latheStore / sceneStore Zustand pattern exactly.
 *
 * The mount layer (S2+) will wire this store to the audioBus via a
 * useEffect / subscriber so the bus gain reflects store state at runtime.
 * In S1 the store is self-contained and fully testable via getState().
 */

import { create } from 'zustand';
import { setMuted, setVolume } from './audioBus.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AudioSettingsStore {
  /** Master switch — when false, emit() produces no sounds */
  enabled: boolean;
  /** Mute toggle (preserves volume for un-muting) */
  muted: boolean;
  /** Master volume [0, 1] */
  volume: number;

  /** Toggle the master enabled switch */
  setEnabled: (enabled: boolean) => void;
  /** Toggle mute; also mirrors state to the audioBus master gain */
  setMuted: (muted: boolean) => void;
  /** Set volume — clamped to [0, 1]; also mirrors to audioBus */
  setVolume: (volume: number) => void;
  /** Reset to factory defaults */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  enabled: true,
  muted: false,
  volume: 0.7,
} as const;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAudioSettings = create<AudioSettingsStore>((set) => ({
  ...DEFAULTS,

  setEnabled: (enabled) => {
    set({ enabled });
  },

  setMuted: (muted) => {
    set({ muted });
    // Mirror to the live bus (no-op in jsdom where no context exists).
    setMuted(muted);
  },

  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ volume: clamped });
    // Mirror to the live bus.
    setVolume(clamped);
  },

  reset: () => {
    set({ ...DEFAULTS });
    setMuted(DEFAULTS.muted);
    setVolume(DEFAULTS.volume);
  },
}));
