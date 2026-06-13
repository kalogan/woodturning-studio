/**
 * audioBus.test.ts — Tests for audioBus module.
 *
 * jsdom has no real AudioContext, so we test the guarded no-op behaviour:
 * - importing the module must not throw
 * - all exported functions are callable without throwing
 * - state transitions for volume/mute work without a live context
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getContext,
  getMasterGain,
  setMuted,
  setVolume,
  isMuted,
  getVolume,
  _reset,
} from './audioBus.js';

beforeEach(async () => {
  await _reset();
});

describe('audioBus — jsdom guard (no AudioContext available)', () => {
  it('importing audioBus does not throw', () => {
    // If we got here, import succeeded.
    expect(true).toBe(true);
  });

  it('getContext() returns null before unlock()', () => {
    expect(getContext()).toBeNull();
  });

  it('getMasterGain() returns null before unlock()', () => {
    expect(getMasterGain()).toBeNull();
  });
});

describe('audioBus — setMuted / isMuted', () => {
  it('isMuted() defaults to false', () => {
    expect(isMuted()).toBe(false);
  });

  it('setMuted(true) flips isMuted to true', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
  });

  it('setMuted(false) flips isMuted back to false', () => {
    setMuted(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('setMuted is a safe no-op when no context exists', () => {
    // Should not throw even without AudioContext.
    expect(() => { setMuted(true); }).not.toThrow();
  });
});

describe('audioBus — setVolume / getVolume', () => {
  it('getVolume() defaults to 0.7', () => {
    expect(getVolume()).toBeCloseTo(0.7);
  });

  it('setVolume stores the value', () => {
    setVolume(0.5);
    expect(getVolume()).toBeCloseTo(0.5);
  });

  it('setVolume clamps values below 0 to 0', () => {
    setVolume(-1);
    expect(getVolume()).toBe(0);
  });

  it('setVolume clamps values above 1 to 1', () => {
    setVolume(2);
    expect(getVolume()).toBe(1);
  });

  it('setVolume(0) is valid', () => {
    setVolume(0);
    expect(getVolume()).toBe(0);
  });

  it('setVolume(1) is valid', () => {
    setVolume(1);
    expect(getVolume()).toBe(1);
  });

  it('setVolume is a safe no-op when no context exists', () => {
    expect(() => { setVolume(0.8); }).not.toThrow();
  });
});
