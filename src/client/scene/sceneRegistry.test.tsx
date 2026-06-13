/**
 * sceneRegistry.test.tsx — structural tests for the scene registry.
 *
 * These tests assert purely structural / reference-equality properties.
 * No R3F components are rendered — we never call a Scene3D or Overlay
 * component, only inspect the registry object itself.
 */

import { describe, it, expect } from 'vitest';
import { sceneRegistry } from './sceneRegistry.js';
import type { SceneState } from '../../workshop/index.js';

// All valid SceneState values (mirrors sceneStore.ts union)
const ALL_STATES: SceneState[] = [
  'MENU',
  'WORKSHOP_WALK',
  'AT_LATHE',
  'TURNING',
  'LESSON_COMPLETE',
];

describe('sceneRegistry — completeness', () => {
  it('has an entry for every SceneState', () => {
    for (const state of ALL_STATES) {
      expect(
        sceneRegistry[state],
        `sceneRegistry is missing an entry for state "${state}"`,
      ).toBeDefined();
    }
  });

  it('contains exactly the expected set of states (no extra, no missing)', () => {
    const registeredKeys = Object.keys(sceneRegistry).sort();
    const expectedKeys = [...ALL_STATES].sort();
    expect(registeredKeys).toEqual(expectedKeys);
  });
});

describe('sceneRegistry — invariant #1 (proximity auto-lock design)', () => {
  // AT_LATHE intentionally uses a fixed operator camera + free cursor
  // (proximity auto-lock); the WALK↔AT_LATHE camera swap is by design.
  // The OLD invariant (same Scene3D reference = preserve FPS pointer lock)
  // is intentionally REVERSED: we now WANT FPSCamera to unmount when
  // proximity triggers AT_LATHE, so pointer lock is released and the
  // free cursor appears for clicking the START button + speed dial.

  it('WORKSHOP_WALK has its own Scene3D (FPSCamera walk scene)', () => {
    expect(sceneRegistry.WORKSHOP_WALK.Scene3D).toBeDefined();
  });

  it('AT_LATHE has its own distinct Scene3D (fixed-camera operator stance)', () => {
    expect(sceneRegistry.AT_LATHE.Scene3D).toBeDefined();
    // AT_LATHE intentionally uses a fixed operator camera + free cursor
    // (proximity auto-lock); the WALK↔AT_LATHE camera swap is by design.
    expect(sceneRegistry.AT_LATHE.Scene3D).not.toBe(sceneRegistry.WORKSHOP_WALK.Scene3D);
  });

  it('WORKSHOP_WALK and AT_LATHE have DIFFERENT Overlay references', () => {
    // Different overlays are expected: walk hint vs. E-to-grab / START prompt
    expect(sceneRegistry.WORKSHOP_WALK.Overlay).not.toBe(sceneRegistry.AT_LATHE.Overlay);
  });
});

describe('sceneRegistry — overlay shape', () => {
  it('MENU has an Overlay but no Scene3D', () => {
    expect(sceneRegistry.MENU.Overlay).toBeDefined();
    expect(sceneRegistry.MENU.Scene3D).toBeUndefined();
  });

  it('TURNING has both Scene3D and Overlay', () => {
    expect(sceneRegistry.TURNING.Scene3D).toBeDefined();
    expect(sceneRegistry.TURNING.Overlay).toBeDefined();
  });

  it('LESSON_COMPLETE has both Scene3D and Overlay', () => {
    expect(sceneRegistry.LESSON_COMPLETE.Scene3D).toBeDefined();
    expect(sceneRegistry.LESSON_COMPLETE.Overlay).toBeDefined();
  });

  it('every Scene3D and Overlay present is a function (React FC)', () => {
    for (const state of ALL_STATES) {
      const entry = sceneRegistry[state];
      if (entry.Scene3D !== undefined) {
        expect(typeof entry.Scene3D, `${state}.Scene3D should be a function`).toBe('function');
      }
      if (entry.Overlay !== undefined) {
        expect(typeof entry.Overlay, `${state}.Overlay should be a function`).toBe('function');
      }
    }
  });
});
