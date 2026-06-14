/**
 * accessoryRegistry.test.ts
 *
 * Verifies that every accessory id returned by getSetupAccessoryIds()
 * resolves to a valid registry entry with a Component and non-empty
 * displayName in ACCESSORY_REGISTRY.
 */
import { describe, it, expect } from 'vitest';
import { getSetupAccessoryIds } from '../../session/setup.js';
import { ACCESSORY_REGISTRY, getAccessoryComponent } from './AccessoryMesh.js';

describe('ACCESSORY_REGISTRY — completeness', () => {
  it('contains every id returned by getSetupAccessoryIds()', () => {
    const ids = getSetupAccessoryIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(
        Object.prototype.hasOwnProperty.call(ACCESSORY_REGISTRY, id),
        `ACCESSORY_REGISTRY is missing id "${id}"`,
      ).toBe(true);
    }
  });
});

describe('ACCESSORY_REGISTRY — entry shape', () => {
  it('every entry has a Component function', () => {
    const ids = getSetupAccessoryIds();
    for (const id of ids) {
      const entry = ACCESSORY_REGISTRY[id];
      expect(entry, `no entry for "${id}"`).toBeDefined();
      expect(
        typeof entry?.Component,
        `Component for "${id}" must be a function`,
      ).toBe('function');
    }
  });

  it('every entry has a non-empty displayName', () => {
    const ids = getSetupAccessoryIds();
    for (const id of ids) {
      const entry = ACCESSORY_REGISTRY[id];
      expect(entry, `no entry for "${id}"`).toBeDefined();
      expect(
        typeof entry?.displayName,
        `displayName for "${id}" must be a string`,
      ).toBe('string');
      expect(
        (entry?.displayName ?? '').length,
        `displayName for "${id}" must not be empty`,
      ).toBeGreaterThan(0);
    }
  });
});

describe('getAccessoryComponent helper', () => {
  it('returns the registry entry for a known id', () => {
    const ids = getSetupAccessoryIds();
    const firstId = ids[0];
    expect(firstId).toBeDefined();
    if (firstId === undefined) return;
    const entry = getAccessoryComponent(firstId);
    expect(entry).toBeDefined();
    expect(typeof entry?.Component).toBe('function');
  });

  it('returns undefined for an unknown id', () => {
    const result = getAccessoryComponent('not-a-real-accessory-xyz');
    expect(result).toBeUndefined();
  });

  it('all 7 accessory ids resolve to a defined entry', () => {
    const ids = getSetupAccessoryIds();
    expect(ids).toHaveLength(7);
    for (const id of ids) {
      const entry = getAccessoryComponent(id);
      expect(entry, `getAccessoryComponent("${id}") should not be undefined`).toBeDefined();
    }
  });
});
