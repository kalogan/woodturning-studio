/**
 * roomLayoutStore.test.ts — Room Editor delta-placement store: identity, diff,
 * persistence, and the STABLE frozen identity fallback (anti infinite-loop).
 *
 * Pure logic against the zustand store + localStorage helpers. No R3F render.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  IDENTITY_PLACEMENT,
  identityPlacement,
  isIdentityPlacement,
  useRoomLayoutStore,
} from './roomLayoutStore.js';

beforeEach(() => {
  localStorage.clear();
  useRoomLayoutStore.setState({ layout: {} });
});

describe('identityPlacement / isIdentityPlacement', () => {
  it('identityPlacement is identity and returns fresh arrays each call', () => {
    const a = identityPlacement();
    const b = identityPlacement();
    expect(isIdentityPlacement(a)).toBe(true);
    expect(a.position).not.toBe(b.position); // not shared references
  });

  it('IDENTITY_PLACEMENT is a STABLE frozen reference and is identity', () => {
    expect(isIdentityPlacement(IDENTITY_PLACEMENT)).toBe(true);
    expect(Object.isFrozen(IDENTITY_PLACEMENT)).toBe(true);
    // Same reference every access — safe as a selector fallback.
    expect(IDENTITY_PLACEMENT).toBe(IDENTITY_PLACEMENT);
  });

  it('detects non-identity placements', () => {
    expect(isIdentityPlacement({ ...identityPlacement(), scale: [1.2, 1, 1] })).toBe(false);
    expect(isIdentityPlacement({ ...identityPlacement(), position: [0, 0.5, 0] })).toBe(false);
    expect(isIdentityPlacement({ ...identityPlacement(), rotationDeg: [0, 15, 0] })).toBe(false);
  });
});

describe('store mutation + diff', () => {
  it('getPlacement returns identity for unknown props', () => {
    expect(isIdentityPlacement(useRoomLayoutStore.getState().getPlacement('Nope'))).toBe(true);
  });

  it('setPlacement patches and persists under wts-room-layout; diff omits identity', () => {
    const { setPlacement } = useRoomLayoutStore.getState();
    setPlacement('DemoBench', { position: [1, 0, -2] });
    setPlacement('DemoBench', { rotationDeg: [0, 45, 0] });

    const p = useRoomLayoutStore.getState().getPlacement('DemoBench');
    expect(p.position).toEqual([1, 0, -2]);
    expect(p.rotationDeg).toEqual([0, 45, 0]);

    const diff = useRoomLayoutStore.getState().diff();
    expect(Object.keys(diff)).toEqual(['DemoBench']);

    // Persisted under the NEW key (never the gallery's wts-preview-edits).
    expect(localStorage.getItem('wts-preview-edits')).toBeNull();
    const raw = localStorage.getItem('wts-room-layout');
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw as string) as Record<string, { position: number[] } | undefined>;
    expect(stored.DemoBench?.position).toEqual([1, 0, -2]);
  });

  it('reset removes a prop and excludes it from diff', () => {
    const { setPlacement, reset } = useRoomLayoutStore.getState();
    setPlacement('GrinderStation', { scale: [2, 2, 2] });
    expect(Object.keys(useRoomLayoutStore.getState().diff())).toContain('GrinderStation');
    reset('GrinderStation');
    expect(useRoomLayoutStore.getState().diff()).toEqual({});
    expect(isIdentityPlacement(useRoomLayoutStore.getState().getPlacement('GrinderStation'))).toBe(
      true,
    );
  });

  it('diff only includes non-identity placements', () => {
    const { setPlacement } = useRoomLayoutStore.getState();
    setPlacement('A', { scale: [2, 2, 2] });
    setPlacement('B', {}); // patch with nothing → stays identity
    const diff = useRoomLayoutStore.getState().diff();
    expect(Object.keys(diff)).toEqual(['A']);
  });
});
