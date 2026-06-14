import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FPSController,
  keysToMovement,
  clampPitch,
  rightVectorXZ,
} from './fpsController.js';
import type { FPSKeymap } from './fpsController.js';

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('keysToMovement', () => {
  it('w → forward 1, strafe 0', () => {
    expect(keysToMovement(new Set(['w']))).toEqual({ forward: 1, strafe: 0 });
  });

  it('W (uppercase) → forward 1', () => {
    expect(keysToMovement(new Set(['W']))).toEqual({ forward: 1, strafe: 0 });
  });

  it('w + d → forward 1, strafe 1', () => {
    expect(keysToMovement(new Set(['w', 'd']))).toEqual({ forward: 1, strafe: 1 });
  });

  it('s + a → forward -1, strafe -1', () => {
    expect(keysToMovement(new Set(['s', 'a']))).toEqual({ forward: -1, strafe: -1 });
  });

  it('w + s (opposite) → forward 0', () => {
    expect(keysToMovement(new Set(['w', 's']))).toEqual({ forward: 0, strafe: 0 });
  });

  it('no keys → all zero', () => {
    expect(keysToMovement(new Set())).toEqual({ forward: 0, strafe: 0 });
  });
});

describe('clampPitch', () => {
  it('clamps positive overshoot to 1.5', () => {
    expect(clampPitch(2)).toBe(1.5);
  });

  it('clamps negative overshoot to -1.5', () => {
    expect(clampPitch(-2)).toBe(-1.5);
  });

  it('passes through values within range', () => {
    expect(clampPitch(1.0)).toBe(1.0);
    expect(clampPitch(-0.5)).toBe(-0.5);
    expect(clampPitch(0)).toBe(0);
  });

  it('boundary values are not clamped', () => {
    expect(clampPitch(1.5)).toBe(1.5);
    expect(clampPitch(-1.5)).toBe(-1.5);
  });
});

describe('rightVectorXZ (strafe basis — regression lock for the A/D flip)', () => {
  const out = { x: 0, z: 0 };

  it('facing -Z (default forward) → right is +X (player right)', () => {
    rightVectorXZ(0, -1, out);
    expect(out.x).toBeCloseTo(1);
    expect(out.z).toBeCloseTo(0);
  });

  it('facing +Z → right is -X', () => {
    rightVectorXZ(0, 1, out);
    expect(out.x).toBeCloseTo(-1);
    expect(out.z).toBeCloseTo(0);
  });

  it('facing +X → right is +Z', () => {
    rightVectorXZ(1, 0, out);
    expect(out.x).toBeCloseTo(0);
    expect(out.z).toBeCloseTo(1);
  });

  it('D (strafe +1) facing -Z moves +X (right), NOT -X (the old bug)', () => {
    rightVectorXZ(0, -1, out);
    expect(out.x * 1).toBeGreaterThan(0); // +1 strafe × right.x > 0 → moves right
  });

  it('writes in place into the passed out object (no allocation)', () => {
    const target = { x: 9, z: 9 };
    rightVectorXZ(0, -1, target);
    expect(target).toEqual({ x: 1, z: 0 });
  });
});

// ---------------------------------------------------------------------------
// FPSController — WASD and edge-trigger tests via jsdom event dispatch
// ---------------------------------------------------------------------------

describe('FPSController', () => {
  let ctrl: FPSController;

  beforeEach(() => {
    ctrl = new FPSController();
    ctrl.start();
  });

  afterEach(() => {
    ctrl.stop();
  });

  it('initially returns all zeros / false', () => {
    const input = ctrl.getInput();
    expect(input.forward).toBe(0);
    expect(input.strafe).toBe(0);
    expect(input.yaw).toBe(0);
    expect(input.pitch).toBe(0);
    expect(input.interact).toBe(false);
  });

  it('returns the same object reference each call (no per-frame allocation)', () => {
    const a = ctrl.getInput();
    const b = ctrl.getInput();
    expect(a).toBe(b);
  });

  it('W key → forward 1', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    expect(ctrl.getInput().forward).toBe(1);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
  });

  it('S key → forward -1', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(ctrl.getInput().forward).toBe(-1);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }));
  });

  it('D key → strafe 1', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    expect(ctrl.getInput().strafe).toBe(1);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
  });

  it('A key → strafe -1', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(ctrl.getInput().strafe).toBe(-1);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
  });

  describe('E key edge-trigger (interact)', () => {
    it('first getInput() after E keydown → interact true', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
      expect(ctrl.getInput().interact).toBe(true);
    });

    it('second getInput() without release → interact false', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
      ctrl.getInput(); // consumes
      expect(ctrl.getInput().interact).toBe(false);
    });

    it('release and re-press → interact true again', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
      ctrl.getInput(); // consumes
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
      expect(ctrl.getInput().interact).toBe(true);
    });

    it('no E press → interact stays false', () => {
      expect(ctrl.getInput().interact).toBe(false);
      expect(ctrl.getInput().interact).toBe(false);
    });
  });

  it('stop() removes listeners — keys no longer tracked', () => {
    ctrl.stop();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    expect(ctrl.getInput().forward).toBe(0);
    // Re-start for afterEach cleanup consistency
    ctrl.start();
  });
});

// ---------------------------------------------------------------------------
// keysToMovement — custom keymap
// ---------------------------------------------------------------------------

describe('keysToMovement — custom keymap', () => {
  const ARROW_KEYMAP: FPSKeymap = {
    forward:  'arrowup',
    back:     'arrowdown',
    left:     'arrowleft',
    right:    'arrowright',
    interact: 'f',
  };

  it('uses custom forward key', () => {
    expect(keysToMovement(new Set(['ArrowUp']), ARROW_KEYMAP)).toEqual({ forward: 1, strafe: 0 });
  });

  it('uses custom back key', () => {
    expect(keysToMovement(new Set(['ArrowDown']), ARROW_KEYMAP)).toEqual({ forward: -1, strafe: 0 });
  });

  it('uses custom right key', () => {
    expect(keysToMovement(new Set(['ArrowRight']), ARROW_KEYMAP)).toEqual({ forward: 0, strafe: 1 });
  });

  it('uses custom left key', () => {
    expect(keysToMovement(new Set(['ArrowLeft']), ARROW_KEYMAP)).toEqual({ forward: 0, strafe: -1 });
  });

  it('default w key does NOT fire forward with custom keymap', () => {
    expect(keysToMovement(new Set(['w']), ARROW_KEYMAP)).toEqual({ forward: 0, strafe: 0 });
  });

  it('diagonal: custom forward + right', () => {
    expect(keysToMovement(new Set(['ArrowUp', 'ArrowRight']), ARROW_KEYMAP)).toEqual({ forward: 1, strafe: 1 });
  });

  it('case-insensitive: uppercase custom key matches', () => {
    const ucKeymap: FPSKeymap = { forward: 'I', back: 'K', left: 'J', right: 'L', interact: 'F' };
    expect(keysToMovement(new Set(['i']), ucKeymap)).toEqual({ forward: 1, strafe: 0 });
  });
});

// ---------------------------------------------------------------------------
// FPSController — setConfig() hot-swap
// ---------------------------------------------------------------------------

describe('FPSController.setConfig()', () => {
  let ctrl: FPSController;

  beforeEach(() => {
    ctrl = new FPSController();
    ctrl.start();
  });

  afterEach(() => {
    ctrl.stop();
  });

  it('after setConfig({keymap}), custom forward key fires forward', () => {
    const km: FPSKeymap = { forward: 'i', back: 'k', left: 'j', right: 'l', interact: 'f' };
    ctrl.setConfig({ keymap: km });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
    expect(ctrl.getInput().forward).toBe(1);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'i' }));
  });

  it('after setConfig({keymap}), old w key no longer fires forward', () => {
    const km: FPSKeymap = { forward: 'i', back: 'k', left: 'j', right: 'l', interact: 'f' };
    ctrl.setConfig({ keymap: km });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    expect(ctrl.getInput().forward).toBe(0);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
  });

  it('after setConfig({keymap}), custom interact key edge-triggers', () => {
    const km: FPSKeymap = { forward: 'i', back: 'k', left: 'j', right: 'l', interact: 'f' };
    ctrl.setConfig({ keymap: km });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    expect(ctrl.getInput().interact).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'f' }));
  });

  it('setConfig() can be called mid-flight (partial update — only keymap)', () => {
    // Partial: only keymap, no lookSensitivity. Should not throw.
    expect(() => {
      ctrl.setConfig({ keymap: { forward: 't', back: 'g', left: 'f', right: 'h', interact: 'r' } });
    }).not.toThrow();
  });
});
