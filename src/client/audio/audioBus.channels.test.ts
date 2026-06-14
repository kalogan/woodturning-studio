/**
 * audioBus.channels.test.ts — Tests for per-channel gain node API.
 *
 * jsdom has no real AudioContext, so we test:
 * - Channel volume storage (getChannelVolume) without a live context.
 * - setChannelVolume is a safe no-op in jsdom (no gain node to update).
 * - getChannelGain returns null before unlock().
 * - _reset() clears channel volumes back to default.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getChannelGain,
  setChannelVolume,
  getChannelVolume,
  _reset,
} from './audioBus.js';
import type { AudioChannel } from './audioBus.js';

const CHANNELS: AudioChannel[] = ['ambient', 'motor', 'sfx'];

beforeEach(async () => {
  await _reset();
});

// ---------------------------------------------------------------------------
// getChannelGain — null before unlock
// ---------------------------------------------------------------------------

describe('audioBus channels — getChannelGain before unlock', () => {
  for (const ch of CHANNELS) {
    it(`getChannelGain('${ch}') returns null before unlock()`, () => {
      expect(getChannelGain(ch)).toBeNull();
    });
  }
});

// ---------------------------------------------------------------------------
// setChannelVolume / getChannelVolume — volume stored without context
// ---------------------------------------------------------------------------

describe('audioBus channels — volume storage (no AudioContext)', () => {
  it('getChannelVolume returns 0.7 default for ambient', () => {
    expect(getChannelVolume('ambient')).toBeCloseTo(0.7);
  });

  it('getChannelVolume returns 0.7 default for motor', () => {
    expect(getChannelVolume('motor')).toBeCloseTo(0.7);
  });

  it('getChannelVolume returns 0.7 default for sfx', () => {
    expect(getChannelVolume('sfx')).toBeCloseTo(0.7);
  });

  it('setChannelVolume stores the value for ambient', () => {
    setChannelVolume('ambient', 0.3);
    expect(getChannelVolume('ambient')).toBeCloseTo(0.3);
  });

  it('setChannelVolume stores the value for motor', () => {
    setChannelVolume('motor', 0.5);
    expect(getChannelVolume('motor')).toBeCloseTo(0.5);
  });

  it('setChannelVolume stores the value for sfx', () => {
    setChannelVolume('sfx', 0.9);
    expect(getChannelVolume('sfx')).toBeCloseTo(0.9);
  });
});

// ---------------------------------------------------------------------------
// setChannelVolume — clamping
// ---------------------------------------------------------------------------

describe('audioBus channels — setChannelVolume clamping', () => {
  it('clamps values below 0 to 0 (ambient)', () => {
    setChannelVolume('ambient', -1);
    expect(getChannelVolume('ambient')).toBe(0);
  });

  it('clamps values above 1 to 1 (motor)', () => {
    setChannelVolume('motor', 2);
    expect(getChannelVolume('motor')).toBe(1);
  });

  it('clamps values below 0 to 0 (sfx)', () => {
    setChannelVolume('sfx', -0.5);
    expect(getChannelVolume('sfx')).toBe(0);
  });

  it('accepts 0 as a valid value', () => {
    setChannelVolume('sfx', 0);
    expect(getChannelVolume('sfx')).toBe(0);
  });

  it('accepts 1 as a valid value', () => {
    setChannelVolume('sfx', 1);
    expect(getChannelVolume('sfx')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// _reset restores defaults
// ---------------------------------------------------------------------------

describe('audioBus channels — _reset restores channel defaults', () => {
  it('_reset() restores ambient to 0.7', async () => {
    setChannelVolume('ambient', 0.1);
    await _reset();
    expect(getChannelVolume('ambient')).toBeCloseTo(0.7);
  });

  it('_reset() restores motor to 0.7', async () => {
    setChannelVolume('motor', 0.2);
    await _reset();
    expect(getChannelVolume('motor')).toBeCloseTo(0.7);
  });

  it('_reset() restores sfx to 0.7', async () => {
    setChannelVolume('sfx', 0.0);
    await _reset();
    expect(getChannelVolume('sfx')).toBeCloseTo(0.7);
  });
});

// ---------------------------------------------------------------------------
// safe no-op in jsdom
// ---------------------------------------------------------------------------

describe('audioBus channels — jsdom safety', () => {
  it('setChannelVolume does not throw when no AudioContext exists', () => {
    expect(() => { setChannelVolume('ambient', 0.5); }).not.toThrow();
    expect(() => { setChannelVolume('motor', 0.5); }).not.toThrow();
    expect(() => { setChannelVolume('sfx', 0.5); }).not.toThrow();
  });

  it('getChannelGain does not throw when no AudioContext exists', () => {
    expect(() => { getChannelGain('ambient'); }).not.toThrow();
    expect(() => { getChannelGain('motor'); }).not.toThrow();
    expect(() => { getChannelGain('sfx'); }).not.toThrow();
  });
});
