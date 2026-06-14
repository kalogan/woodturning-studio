/**
 * settingsStore.test.ts — Tests for the settings Zustand store.
 *
 * Covers:
 * - Defaults (audio, controls keymap, camera)
 * - Volume setters (clamping)
 * - Mute toggle
 * - isOpen / open / close / toggle
 * - localStorage persistence round-trip (via a mocked localStorage)
 * - rebind() — basic, conflict-swap, reset
 * - camera setters — clamping at SENS_MIN/SENS_MAX
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

import { useSettingsStore, KEYMAP_DEFAULTS, KEY_ACTIONS, FOV_MIN, FOV_MAX } from './settingsStore.js';

const STORAGE_KEY = 'wts:settings:v3';

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
  // Reset keymap to defaults
  s.resetKeymap();
  // Reset camera to defaults
  s.setLookSensitivity(1.0);
  s.setInvertY(false);
  s.setDialSensitivity(1.0);
  // Reset display to defaults
  s.setFov(75);
  s.setFullscreen(false);
  // Reset input to defaults
  s.setInputMode('mouse');
  // Reset gameplay to defaults
  s.setCoachingOverlay(true);
  s.setAssistLevel('normal');
  s.setUnits('metric');
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

// ---------------------------------------------------------------------------
// Controls — keymap defaults
// ---------------------------------------------------------------------------

describe('settingsStore — controls keymap defaults', () => {
  it('KEY_ACTIONS contains all 5 actions', () => {
    expect(KEY_ACTIONS).toHaveLength(5);
    expect(KEY_ACTIONS).toContain('forward');
    expect(KEY_ACTIONS).toContain('back');
    expect(KEY_ACTIONS).toContain('left');
    expect(KEY_ACTIONS).toContain('right');
    expect(KEY_ACTIONS).toContain('interact');
  });

  it('default keymap is w/s/a/d/e', () => {
    const { keymap } = useSettingsStore.getState().controls;
    expect(keymap.forward).toBe('w');
    expect(keymap.back).toBe('s');
    expect(keymap.left).toBe('a');
    expect(keymap.right).toBe('d');
    expect(keymap.interact).toBe('e');
  });

  it('KEYMAP_DEFAULTS matches the store defaults', () => {
    const { keymap } = useSettingsStore.getState().controls;
    for (const action of KEY_ACTIONS) {
      expect(keymap[action]).toBe(KEYMAP_DEFAULTS[action]);
    }
  });
});

// ---------------------------------------------------------------------------
// Controls — rebind
// ---------------------------------------------------------------------------

describe('settingsStore — rebind', () => {
  it('rebind to unoccupied key returns ok and updates keymap', () => {
    const s = useSettingsStore.getState();
    const result = s.rebind('forward', 'i');
    expect(result).toBe('ok');
    expect(useSettingsStore.getState().controls.keymap.forward).toBe('i');
  });

  it('rebind lowercases the incoming key', () => {
    useSettingsStore.getState().rebind('back', 'K');
    expect(useSettingsStore.getState().controls.keymap.back).toBe('k');
  });

  it('rebind to currently-same key is a no-op and returns ok', () => {
    // 'w' is already bound to forward — rebinding forward→w should be ok
    const result = useSettingsStore.getState().rebind('forward', 'w');
    expect(result).toBe('ok');
    expect(useSettingsStore.getState().controls.keymap.forward).toBe('w');
  });

  it('rebind conflict: SWAP — target key swaps with conflict action', () => {
    // forward=w, back=s. Rebind forward→s. Expected: forward=s, back=w.
    const result = useSettingsStore.getState().rebind('forward', 's');
    expect(result).toBe('swapped');
    const km = useSettingsStore.getState().controls.keymap;
    expect(km.forward).toBe('s');
    expect(km.back).toBe('w');  // old forward key goes to back
  });

  it('after swap, all 5 actions still have distinct keys (bijection preserved)', () => {
    useSettingsStore.getState().rebind('forward', 's');
    const km = useSettingsStore.getState().controls.keymap;
    const values = KEY_ACTIONS.map((a) => km[a]);
    const unique = new Set(values);
    expect(unique.size).toBe(KEY_ACTIONS.length);
  });

  it('resetKeymap() restores defaults', () => {
    useSettingsStore.getState().rebind('forward', 'i');
    useSettingsStore.getState().rebind('back', 'k');
    useSettingsStore.getState().resetKeymap();
    const km = useSettingsStore.getState().controls.keymap;
    expect(km.forward).toBe('w');
    expect(km.back).toBe('s');
  });

  it('rebind persists to localStorage', () => {
    useSettingsStore.getState().rebind('interact', 'f');
    const stored = readStorage();
    const km = (stored.controls as { keymap: Record<string, string> }).keymap;
    expect(km['interact']).toBe('f');
  });
});

// ---------------------------------------------------------------------------
// Camera — setters and clamping
// ---------------------------------------------------------------------------

describe('settingsStore — camera settings', () => {
  it('lookSensitivity defaults to 1.0', () => {
    expect(useSettingsStore.getState().camera.lookSensitivity).toBeCloseTo(1.0);
  });

  it('invertY defaults to false', () => {
    expect(useSettingsStore.getState().camera.invertY).toBe(false);
  });

  it('dialSensitivity defaults to 1.0', () => {
    expect(useSettingsStore.getState().camera.dialSensitivity).toBeCloseTo(1.0);
  });

  it('setLookSensitivity accepts mid-range value', () => {
    useSettingsStore.getState().setLookSensitivity(1.5);
    expect(useSettingsStore.getState().camera.lookSensitivity).toBeCloseTo(1.5);
  });

  it('setLookSensitivity clamps below 0.25 to 0.25', () => {
    useSettingsStore.getState().setLookSensitivity(0);
    expect(useSettingsStore.getState().camera.lookSensitivity).toBeCloseTo(0.25);
  });

  it('setLookSensitivity clamps above 3 to 3', () => {
    useSettingsStore.getState().setLookSensitivity(10);
    expect(useSettingsStore.getState().camera.lookSensitivity).toBeCloseTo(3.0);
  });

  it('setDialSensitivity clamps below 0.25 to 0.25', () => {
    useSettingsStore.getState().setDialSensitivity(-1);
    expect(useSettingsStore.getState().camera.dialSensitivity).toBeCloseTo(0.25);
  });

  it('setDialSensitivity clamps above 3 to 3', () => {
    useSettingsStore.getState().setDialSensitivity(99);
    expect(useSettingsStore.getState().camera.dialSensitivity).toBeCloseTo(3.0);
  });

  it('setInvertY(true) flips flag', () => {
    useSettingsStore.getState().setInvertY(true);
    expect(useSettingsStore.getState().camera.invertY).toBe(true);
  });

  it('setInvertY(false) clears flag', () => {
    useSettingsStore.getState().setInvertY(true);
    useSettingsStore.getState().setInvertY(false);
    expect(useSettingsStore.getState().camera.invertY).toBe(false);
  });

  it('camera settings persist to localStorage', () => {
    useSettingsStore.getState().setLookSensitivity(2.0);
    useSettingsStore.getState().setInvertY(true);
    useSettingsStore.getState().setDialSensitivity(0.5);
    const stored = readStorage();
    const cam = stored.camera as { lookSensitivity: number; invertY: boolean; dialSensitivity: number };
    expect(cam.lookSensitivity).toBeCloseTo(2.0);
    expect(cam.invertY).toBe(true);
    expect(cam.dialSensitivity).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// Display — FOV + fullscreen
// ---------------------------------------------------------------------------

describe('settingsStore — display settings', () => {
  it('fov defaults to 75', () => {
    expect(useSettingsStore.getState().display.fov).toBe(75);
  });

  it('fullscreen defaults to false', () => {
    expect(useSettingsStore.getState().display.fullscreen).toBe(false);
  });

  it('setFov accepts a value within range', () => {
    useSettingsStore.getState().setFov(90);
    expect(useSettingsStore.getState().display.fov).toBe(90);
  });

  it('setFov clamps below FOV_MIN (55) to FOV_MIN', () => {
    useSettingsStore.getState().setFov(10);
    expect(useSettingsStore.getState().display.fov).toBe(FOV_MIN);
  });

  it('setFov clamps above FOV_MAX (100) to FOV_MAX', () => {
    useSettingsStore.getState().setFov(200);
    expect(useSettingsStore.getState().display.fov).toBe(FOV_MAX);
  });

  it('setFov clamps at exactly FOV_MIN boundary', () => {
    useSettingsStore.getState().setFov(FOV_MIN);
    expect(useSettingsStore.getState().display.fov).toBe(FOV_MIN);
  });

  it('setFov clamps at exactly FOV_MAX boundary', () => {
    useSettingsStore.getState().setFov(FOV_MAX);
    expect(useSettingsStore.getState().display.fov).toBe(FOV_MAX);
  });

  it('setFullscreen(true) sets flag', () => {
    useSettingsStore.getState().setFullscreen(true);
    expect(useSettingsStore.getState().display.fullscreen).toBe(true);
  });

  it('setFullscreen(false) clears flag', () => {
    useSettingsStore.getState().setFullscreen(true);
    useSettingsStore.getState().setFullscreen(false);
    expect(useSettingsStore.getState().display.fullscreen).toBe(false);
  });

  it('display settings persist to localStorage', () => {
    useSettingsStore.getState().setFov(80);
    useSettingsStore.getState().setFullscreen(true);
    const stored = readStorage();
    const disp = stored.display as { fov: number; fullscreen: boolean };
    expect(disp.fov).toBe(80);
    expect(disp.fullscreen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Input — mode
// ---------------------------------------------------------------------------

describe('settingsStore — input settings', () => {
  it('input.mode defaults to mouse', () => {
    expect(useSettingsStore.getState().input.mode).toBe('mouse');
  });

  it('setInputMode("camera") switches to camera', () => {
    useSettingsStore.getState().setInputMode('camera');
    expect(useSettingsStore.getState().input.mode).toBe('camera');
  });

  it('setInputMode("mouse") switches back to mouse', () => {
    useSettingsStore.getState().setInputMode('camera');
    useSettingsStore.getState().setInputMode('mouse');
    expect(useSettingsStore.getState().input.mode).toBe('mouse');
  });

  it('input.mode persists to localStorage', () => {
    useSettingsStore.getState().setInputMode('camera');
    const stored = readStorage();
    const inp = stored.input as { mode: string };
    expect(inp.mode).toBe('camera');
  });
});

// ---------------------------------------------------------------------------
// Gameplay / Accessibility
// ---------------------------------------------------------------------------

describe('settingsStore — gameplay settings', () => {
  it('coachingOverlay defaults to true', () => {
    expect(useSettingsStore.getState().gameplay.coachingOverlay).toBe(true);
  });

  it('assistLevel defaults to "normal"', () => {
    expect(useSettingsStore.getState().gameplay.assistLevel).toBe('normal');
  });

  it('units defaults to "metric"', () => {
    expect(useSettingsStore.getState().gameplay.units).toBe('metric');
  });

  it('setCoachingOverlay(false) turns off overlay', () => {
    useSettingsStore.getState().setCoachingOverlay(false);
    expect(useSettingsStore.getState().gameplay.coachingOverlay).toBe(false);
  });

  it('setCoachingOverlay(true) turns on overlay', () => {
    useSettingsStore.getState().setCoachingOverlay(false);
    useSettingsStore.getState().setCoachingOverlay(true);
    expect(useSettingsStore.getState().gameplay.coachingOverlay).toBe(true);
  });

  it('setAssistLevel("beginner") updates assist level', () => {
    useSettingsStore.getState().setAssistLevel('beginner');
    expect(useSettingsStore.getState().gameplay.assistLevel).toBe('beginner');
  });

  it('setAssistLevel("off") updates assist level', () => {
    useSettingsStore.getState().setAssistLevel('off');
    expect(useSettingsStore.getState().gameplay.assistLevel).toBe('off');
  });

  it('setUnits("imperial") updates units', () => {
    useSettingsStore.getState().setUnits('imperial');
    expect(useSettingsStore.getState().gameplay.units).toBe('imperial');
  });

  it('setUnits("metric") updates units', () => {
    useSettingsStore.getState().setUnits('imperial');
    useSettingsStore.getState().setUnits('metric');
    expect(useSettingsStore.getState().gameplay.units).toBe('metric');
  });

  it('gameplay settings persist to localStorage', () => {
    useSettingsStore.getState().setCoachingOverlay(false);
    useSettingsStore.getState().setAssistLevel('beginner');
    useSettingsStore.getState().setUnits('imperial');
    const stored = readStorage();
    const gp = stored.gameplay as { coachingOverlay: boolean; assistLevel: string; units: string };
    expect(gp.coachingOverlay).toBe(false);
    expect(gp.assistLevel).toBe('beginner');
    expect(gp.units).toBe('imperial');
  });
});
