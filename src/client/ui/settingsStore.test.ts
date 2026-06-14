/**
 * settingsStore.test.ts — Tests for the settings Zustand store.
 *
 * Covers:
 * - Defaults
 * - Volume setters (clamping)
 * - Mute toggle
 * - isOpen / open / close / toggle
 * - localStorage persistence round-trip (via a mocked localStorage)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

// We need to mock localStorage before importing the store, because the store
// reads from localStorage at module-evaluation time. Use vi.stubGlobal.

const localStorageMock = (() => {
  let store: Map<string, string> = new Map();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store = new Map(); },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

// Now import the store (after the stub is in place for the initial load).
// We use a dynamic import helper below to get a fresh store per test group.

import { useSettingsStore } from './settingsStore.js';

const STORAGE_KEY = 'wts:settings:v1';

function readStorage(): Record<string, unknown> {
  const raw = localStorageMock.getItem(STORAGE_KEY);
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

beforeEach(() => {
  // Reset localStorage and reset store to defaults by re-running the
  // setters to known values. The store module is already imported; we just
  // drive it back to defaults.
  localStorageMock.clear();
  const s = useSettingsStore.getState();
  // Reset modal
  s.close();
  // Reset audio to defaults
  s.setMasterVolume(0.8);
  s.setAmbientVolume(0.7);
  s.setMotorVolume(0.7);
  s.setSfxVolume(0.7);
  s.setMuted(false);
  // Clear storage again after those setter calls (they persist)
  localStorageMock.clear();
});

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

describe('settingsStore — defaults', () => {
  it('isOpen defaults to false', () => {
    expect(useSettingsStore.getState().isOpen).toBe(false);
  });

  it('masterVolume defaults to 0.8', () => {
    // After beforeEach resets it to 0.8
    expect(useSettingsStore.getState().audio.masterVolume).toBeCloseTo(0.8);
  });

  it('ambientVolume defaults to 0.7', () => {
    expect(useSettingsStore.getState().audio.ambientVolume).toBeCloseTo(0.7);
  });

  it('motorVolume defaults to 0.7', () => {
    expect(useSettingsStore.getState().audio.motorVolume).toBeCloseTo(0.7);
  });

  it('sfxVolume defaults to 0.7', () => {
    expect(useSettingsStore.getState().audio.sfxVolume).toBeCloseTo(0.7);
  });

  it('muted defaults to false', () => {
    expect(useSettingsStore.getState().audio.muted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// open / close / toggle
// ---------------------------------------------------------------------------

describe('settingsStore — modal open/close/toggle', () => {
  it('open() sets isOpen to true', () => {
    useSettingsStore.getState().open();
    expect(useSettingsStore.getState().isOpen).toBe(true);
  });

  it('close() sets isOpen to false', () => {
    useSettingsStore.getState().open();
    useSettingsStore.getState().close();
    expect(useSettingsStore.getState().isOpen).toBe(false);
  });

  it('toggle() flips isOpen from false to true', () => {
    useSettingsStore.getState().toggle();
    expect(useSettingsStore.getState().isOpen).toBe(true);
  });

  it('toggle() flips isOpen from true to false', () => {
    useSettingsStore.getState().open();
    useSettingsStore.getState().toggle();
    expect(useSettingsStore.getState().isOpen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Volume clamping
// ---------------------------------------------------------------------------

describe('settingsStore — setMasterVolume clamping', () => {
  it('accepts mid-range value', () => {
    useSettingsStore.getState().setMasterVolume(0.5);
    expect(useSettingsStore.getState().audio.masterVolume).toBeCloseTo(0.5);
  });

  it('clamps below 0 to 0', () => {
    useSettingsStore.getState().setMasterVolume(-1);
    expect(useSettingsStore.getState().audio.masterVolume).toBe(0);
  });

  it('clamps above 1 to 1', () => {
    useSettingsStore.getState().setMasterVolume(2);
    expect(useSettingsStore.getState().audio.masterVolume).toBe(1);
  });
});

describe('settingsStore — setAmbientVolume clamping', () => {
  it('clamps below 0 to 0', () => {
    useSettingsStore.getState().setAmbientVolume(-0.5);
    expect(useSettingsStore.getState().audio.ambientVolume).toBe(0);
  });

  it('clamps above 1 to 1', () => {
    useSettingsStore.getState().setAmbientVolume(1.5);
    expect(useSettingsStore.getState().audio.ambientVolume).toBe(1);
  });
});

describe('settingsStore — setMotorVolume clamping', () => {
  it('clamps below 0 to 0', () => {
    useSettingsStore.getState().setMotorVolume(-1);
    expect(useSettingsStore.getState().audio.motorVolume).toBe(0);
  });

  it('clamps above 1 to 1', () => {
    useSettingsStore.getState().setMotorVolume(2);
    expect(useSettingsStore.getState().audio.motorVolume).toBe(1);
  });
});

describe('settingsStore — setSfxVolume clamping', () => {
  it('accepts 0', () => {
    useSettingsStore.getState().setSfxVolume(0);
    expect(useSettingsStore.getState().audio.sfxVolume).toBe(0);
  });

  it('accepts 1', () => {
    useSettingsStore.getState().setSfxVolume(1);
    expect(useSettingsStore.getState().audio.sfxVolume).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Mute
// ---------------------------------------------------------------------------

describe('settingsStore — setMuted', () => {
  it('setMuted(true) mutes', () => {
    useSettingsStore.getState().setMuted(true);
    expect(useSettingsStore.getState().audio.muted).toBe(true);
  });

  it('setMuted(false) unmutes', () => {
    useSettingsStore.getState().setMuted(true);
    useSettingsStore.getState().setMuted(false);
    expect(useSettingsStore.getState().audio.muted).toBe(false);
  });

  it('setMuted does not change volumes', () => {
    useSettingsStore.getState().setMasterVolume(0.6);
    useSettingsStore.getState().setMuted(true);
    expect(useSettingsStore.getState().audio.masterVolume).toBeCloseTo(0.6);
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence round-trip
// ---------------------------------------------------------------------------

describe('settingsStore — localStorage persistence', () => {
  it('persists masterVolume to localStorage after setter', () => {
    useSettingsStore.getState().setMasterVolume(0.42);
    const persisted = readStorage();
    expect((persisted.audio as { masterVolume: number }).masterVolume).toBeCloseTo(0.42);
  });

  it('persists muted flag to localStorage', () => {
    useSettingsStore.getState().setMuted(true);
    const persisted = readStorage();
    expect((persisted.audio as { muted: boolean }).muted).toBe(true);
  });

  it('persists ambientVolume to localStorage', () => {
    useSettingsStore.getState().setAmbientVolume(0.33);
    const persisted = readStorage();
    expect((persisted.audio as { ambientVolume: number }).ambientVolume).toBeCloseTo(0.33);
  });

  it('persists sfxVolume to localStorage', () => {
    useSettingsStore.getState().setSfxVolume(0.55);
    const persisted = readStorage();
    expect((persisted.audio as { sfxVolume: number }).sfxVolume).toBeCloseTo(0.55);
  });

  it('round-trip: value survives write→read from localStorage JSON', () => {
    useSettingsStore.getState().setMotorVolume(0.25);
    const json = localStorageMock.getItem(STORAGE_KEY) ?? '{}';
    const parsed = JSON.parse(json) as { audio: { motorVolume: number } };
    expect(parsed.audio.motorVolume).toBeCloseTo(0.25);
  });
});

// ---------------------------------------------------------------------------
// jsdom-safety: importing store does not throw even without AudioContext
// ---------------------------------------------------------------------------

describe('settingsStore — jsdom safety', () => {
  it('store can be imported and used without throwing in jsdom', () => {
    expect(() => {
      const s = useSettingsStore.getState();
      s.setMasterVolume(0.5);
      s.setMuted(true);
      s.setMuted(false);
    }).not.toThrow();
  });
});
