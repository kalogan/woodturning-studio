/**
 * events.test.ts — Tests for the emit() dispatcher.
 *
 * In jsdom (no AudioContext), emit() must be a total no-op.
 * With settings disabled/muted, emit() must also be a no-op.
 * No actual sound production is tested — only that nothing throws
 * and the guards work correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emit } from './events.js';
import { useAudioSettings } from './audioSettings.js';
import * as audioBus from './audioBus.js';
import * as sfxRegistry from './sfxRegistry.js';

beforeEach(() => {
  useAudioSettings.getState().reset();
  vi.restoreAllMocks();
});

describe('events — import does not throw', () => {
  it('importing events module does not throw', () => {
    expect(true).toBe(true);
  });
});

describe('events — emit() safe no-op in jsdom (no AudioContext)', () => {
  it('emit does not throw when AudioContext is unavailable', () => {
    expect(() => { emit('tool.grab'); }).not.toThrow();
  });

  it('emit does not throw for any registered SfxId', () => {
    const ids = sfxRegistry.ALL_SFX_IDS;
    for (const id of ids) {
      expect(() => { emit(id); }).not.toThrow();
    }
  });
});

describe('events — emit() respects enabled flag', () => {
  it('does not call playSound when enabled=false', () => {
    const spy = vi.spyOn(sfxRegistry, 'playSound');
    useAudioSettings.getState().setEnabled(false);
    emit('tool.grab');
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not call playSound when muted=true', () => {
    const spy = vi.spyOn(sfxRegistry, 'playSound');
    useAudioSettings.getState().setMuted(true);
    emit('cut');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('events — emit() with no context', () => {
  it('does not call playSound when getContext() returns null', () => {
    // In jsdom, getContext() returns null (no real AudioContext).
    // Confirm this is the case and that playSound is never reached.
    const ctxSpy = vi.spyOn(audioBus, 'getContext').mockReturnValue(null);
    const playSpy = vi.spyOn(sfxRegistry, 'playSound');

    emit('tool.select');

    expect(ctxSpy).toHaveBeenCalled();
    expect(playSpy).not.toHaveBeenCalled();
  });

  it('does not call playSound when getMasterGain() returns null', () => {
    // If somehow context exists but gain node is null, still safe.
    vi.spyOn(audioBus, 'getContext').mockReturnValue({} as AudioContext);
    vi.spyOn(audioBus, 'getMasterGain').mockReturnValue(null);
    const playSpy = vi.spyOn(sfxRegistry, 'playSound');

    emit('footstep');

    expect(playSpy).not.toHaveBeenCalled();
  });
});

describe('events — emit() routes to playSound when conditions met', () => {
  it('calls playSound with the correct id when enabled, unmuted, and context exists', () => {
    const fakeCtx = {} as AudioContext;
    const fakeGain = {} as GainNode;
    vi.spyOn(audioBus, 'getContext').mockReturnValue(fakeCtx);
    vi.spyOn(audioBus, 'getMasterGain').mockReturnValue(fakeGain);
    const playSpy = vi.spyOn(sfxRegistry, 'playSound').mockImplementation(() => {});

    emit('part.snap');

    expect(playSpy).toHaveBeenCalledWith('part.snap', fakeCtx, fakeGain);
  });
});
