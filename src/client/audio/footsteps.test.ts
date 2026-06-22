/**
 * footsteps.test.ts — Tests for the procedural footstep emitter.
 *
 * In jsdom there is no AudioContext, so emitFootstep() must be a total no-op
 * that never throws. With settings disabled/muted it must also no-op before
 * touching the bus. When a (fake) context + dest exist it must route through
 * the synth builders, and its even/odd variation must be deterministic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emitFootstep } from './footsteps.js';
import { useAudioSettings } from './audioSettings.js';
import * as audioBus from './audioBus.js';
import * as synth from './synth.js';

beforeEach(() => {
  useAudioSettings.getState().reset();
  vi.restoreAllMocks();
});

describe('footsteps — safe no-op in jsdom (no AudioContext)', () => {
  it('does not throw when AudioContext is unavailable', () => {
    expect(() => { emitFootstep(0); }).not.toThrow();
  });

  it('does not throw across many step indices', () => {
    for (let i = 0; i < 16; i++) {
      expect(() => { emitFootstep(i); }).not.toThrow();
    }
  });
});

describe('footsteps — respects audio settings', () => {
  it('does not touch the synth when enabled=false', () => {
    const noiseSpy = vi.spyOn(synth, 'playNoise');
    const toneSpy = vi.spyOn(synth, 'playTone');
    const ctxSpy = vi.spyOn(audioBus, 'getContext');
    useAudioSettings.getState().setEnabled(false);

    emitFootstep(0);

    expect(noiseSpy).not.toHaveBeenCalled();
    expect(toneSpy).not.toHaveBeenCalled();
    expect(ctxSpy).not.toHaveBeenCalled();
  });

  it('does not touch the synth when muted=true', () => {
    const noiseSpy = vi.spyOn(synth, 'playNoise');
    const toneSpy = vi.spyOn(synth, 'playTone');
    useAudioSettings.getState().setMuted(true);

    emitFootstep(0);

    expect(noiseSpy).not.toHaveBeenCalled();
    expect(toneSpy).not.toHaveBeenCalled();
  });
});

describe('footsteps — no-op when context/dest missing', () => {
  it('does not call synth builders when getContext() is null', () => {
    vi.spyOn(audioBus, 'getContext').mockReturnValue(null);
    const noiseSpy = vi.spyOn(synth, 'playNoise');
    const toneSpy = vi.spyOn(synth, 'playTone');

    emitFootstep(0);

    expect(noiseSpy).not.toHaveBeenCalled();
    expect(toneSpy).not.toHaveBeenCalled();
  });

  it('does not call synth builders when no destination gain exists', () => {
    vi.spyOn(audioBus, 'getContext').mockReturnValue({} as AudioContext);
    vi.spyOn(audioBus, 'getChannelGain').mockReturnValue(null);
    vi.spyOn(audioBus, 'getMasterGain').mockReturnValue(null);
    const noiseSpy = vi.spyOn(synth, 'playNoise');

    emitFootstep(0);

    expect(noiseSpy).not.toHaveBeenCalled();
  });
});

describe('footsteps — routes to synth when conditions met', () => {
  it('plays a noise burst + tone through the sfx channel', () => {
    const fakeCtx = {} as AudioContext;
    const fakeGain = {} as GainNode;
    vi.spyOn(audioBus, 'getContext').mockReturnValue(fakeCtx);
    vi.spyOn(audioBus, 'getChannelGain').mockReturnValue(fakeGain);
    const noiseSpy = vi.spyOn(synth, 'playNoise').mockImplementation(() => {});
    const toneSpy = vi.spyOn(synth, 'playTone').mockImplementation(() => {});

    emitFootstep(0);

    expect(noiseSpy).toHaveBeenCalledTimes(1);
    expect(toneSpy).toHaveBeenCalledTimes(1);
    // Routed to the sfx channel gain we mocked.
    expect(noiseSpy).toHaveBeenCalledWith(fakeCtx, fakeGain, expect.anything());
    expect(toneSpy).toHaveBeenCalledWith(fakeCtx, fakeGain, expect.anything());
  });

  it('even/odd step indices produce deterministic distinct timbres', () => {
    const fakeCtx = {} as AudioContext;
    const fakeGain = {} as GainNode;
    vi.spyOn(audioBus, 'getContext').mockReturnValue(fakeCtx);
    vi.spyOn(audioBus, 'getChannelGain').mockReturnValue(fakeGain);
    const noiseSpy = vi.spyOn(synth, 'playNoise').mockImplementation(() => {});
    vi.spyOn(synth, 'playTone').mockImplementation(() => {});

    const freqOf = (callIndex: number): number => {
      const call = noiseSpy.mock.calls[callIndex];
      if (call === undefined) throw new Error(`no playNoise call at index ${String(callIndex)}`);
      return (call[2] as { filterFreq: number }).filterFreq;
    };

    emitFootstep(0); // even
    emitFootstep(1); // odd

    const evenFreq = freqOf(0);
    const oddFreq = freqOf(1);
    // Odd steps are pitched up — deterministic, not RNG.
    expect(oddFreq).toBeGreaterThan(evenFreq);

    // Same parity → identical params (fully deterministic).
    noiseSpy.mockClear();
    emitFootstep(2); // even again
    expect(freqOf(0)).toBe(evenFreq);
  });
});
