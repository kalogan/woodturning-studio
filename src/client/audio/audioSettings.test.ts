/**
 * audioSettings.test.ts — Tests for the Zustand audioSettings store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAudioSettings } from './audioSettings.js';

beforeEach(() => {
  useAudioSettings.getState().reset();
});

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

describe('audioSettings — defaults', () => {
  it('enabled defaults to true', () => {
    expect(useAudioSettings.getState().enabled).toBe(true);
  });

  it('muted defaults to false', () => {
    expect(useAudioSettings.getState().muted).toBe(false);
  });

  it('volume defaults to 0.7', () => {
    expect(useAudioSettings.getState().volume).toBeCloseTo(0.7);
  });
});

// ---------------------------------------------------------------------------
// setEnabled
// ---------------------------------------------------------------------------

describe('audioSettings — setEnabled', () => {
  it('setEnabled(false) disables audio', () => {
    useAudioSettings.getState().setEnabled(false);
    expect(useAudioSettings.getState().enabled).toBe(false);
  });

  it('setEnabled(true) re-enables audio', () => {
    useAudioSettings.getState().setEnabled(false);
    useAudioSettings.getState().setEnabled(true);
    expect(useAudioSettings.getState().enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// setMuted
// ---------------------------------------------------------------------------

describe('audioSettings — setMuted', () => {
  it('setMuted(true) sets muted to true', () => {
    useAudioSettings.getState().setMuted(true);
    expect(useAudioSettings.getState().muted).toBe(true);
  });

  it('setMuted(false) clears mute', () => {
    useAudioSettings.getState().setMuted(true);
    useAudioSettings.getState().setMuted(false);
    expect(useAudioSettings.getState().muted).toBe(false);
  });

  it('setMuted does not affect enabled', () => {
    useAudioSettings.getState().setMuted(true);
    expect(useAudioSettings.getState().enabled).toBe(true);
  });

  it('setMuted does not affect volume', () => {
    useAudioSettings.getState().setMuted(true);
    expect(useAudioSettings.getState().volume).toBeCloseTo(0.7);
  });
});

// ---------------------------------------------------------------------------
// setVolume — clamping
// ---------------------------------------------------------------------------

describe('audioSettings — setVolume clamping', () => {
  it('accepts a value in [0, 1]', () => {
    useAudioSettings.getState().setVolume(0.5);
    expect(useAudioSettings.getState().volume).toBeCloseTo(0.5);
  });

  it('clamps values below 0 to 0', () => {
    useAudioSettings.getState().setVolume(-1);
    expect(useAudioSettings.getState().volume).toBe(0);
  });

  it('clamps values above 1 to 1', () => {
    useAudioSettings.getState().setVolume(2);
    expect(useAudioSettings.getState().volume).toBe(1);
  });

  it('setVolume(0) is valid', () => {
    useAudioSettings.getState().setVolume(0);
    expect(useAudioSettings.getState().volume).toBe(0);
  });

  it('setVolume(1) is valid', () => {
    useAudioSettings.getState().setVolume(1);
    expect(useAudioSettings.getState().volume).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe('audioSettings — reset', () => {
  it('reset restores all defaults', () => {
    useAudioSettings.getState().setEnabled(false);
    useAudioSettings.getState().setMuted(true);
    useAudioSettings.getState().setVolume(0.1);

    useAudioSettings.getState().reset();

    const s = useAudioSettings.getState();
    expect(s.enabled).toBe(true);
    expect(s.muted).toBe(false);
    expect(s.volume).toBeCloseTo(0.7);
  });
});

// ---------------------------------------------------------------------------
// getState testability (no React needed)
// ---------------------------------------------------------------------------

describe('audioSettings — getState is testable without React', () => {
  it('getState() returns the current state', () => {
    const s = useAudioSettings.getState();
    expect(typeof s.enabled).toBe('boolean');
    expect(typeof s.muted).toBe('boolean');
    expect(typeof s.volume).toBe('number');
  });
});
