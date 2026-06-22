/**
 * roomLayoutStore.test.ts — Room Editor delta-placement store: identity, diff,
 * persistence, and the STABLE frozen identity fallback (anti infinite-loop).
 *
 * Pure logic against the zustand store + localStorage helpers. No R3F render.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  IDENTITY_PLACEMENT,
  childKey,
  identityPlacement,
  isChildKey,
  isIdentityPlacement,
  useRoomLayoutStore,
} from './roomLayoutStore.js';

beforeEach(() => {
  localStorage.clear();
  useRoomLayoutStore.setState({
    layout: {},
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  });
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

describe('composite child keys', () => {
  it('childKey joins prop + child with the separator; isChildKey detects it', () => {
    const key = childKey('DemoBench', 'demo-lathe');
    expect(key).toBe('DemoBench/demo-lathe');
    expect(isChildKey(key)).toBe(true);
    expect(isChildKey('DemoBench')).toBe(false);
  });

  it('a child override is stored, diffed and reset like any other key', () => {
    const key = childKey('DemoBench', 'tv-stand');
    const { setPlacement } = useRoomLayoutStore.getState();
    setPlacement(key, { position: [0.2, 0, 0.5], rotationDeg: [0, 90, 0], scale: [1, 1, 1] });

    expect(useRoomLayoutStore.getState().getPlacement(key).position).toEqual([0.2, 0, 0.5]);
    expect(Object.keys(useRoomLayoutStore.getState().diff())).toEqual([key]);

    // Reset removes the override entirely (so the child reverts to authored).
    useRoomLayoutStore.getState().reset(key);
    expect(useRoomLayoutStore.getState().layout[key]).toBeUndefined();
    expect(useRoomLayoutStore.getState().diff()).toEqual({});
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

describe('undo / redo', () => {
  it('initially cannot undo or redo', () => {
    const s = useRoomLayoutStore.getState();
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
  });

  it('setPlacement → undo restores the prior layout → redo re-applies it', () => {
    const { setPlacement } = useRoomLayoutStore.getState();
    setPlacement('DemoBench', { position: [1, 0, -2] });
    expect(useRoomLayoutStore.getState().canUndo).toBe(true);

    useRoomLayoutStore.getState().undo();
    // Back to identity (entry removed from layout map).
    expect(useRoomLayoutStore.getState().layout.DemoBench).toBeUndefined();
    expect(useRoomLayoutStore.getState().canUndo).toBe(false);
    expect(useRoomLayoutStore.getState().canRedo).toBe(true);
    // localStorage reflects the restored layout.
    expect(localStorage.getItem('wts-room-layout')).toBe(JSON.stringify({}));

    useRoomLayoutStore.getState().redo();
    expect(useRoomLayoutStore.getState().getPlacement('DemoBench').position).toEqual([1, 0, -2]);
    expect(useRoomLayoutStore.getState().canRedo).toBe(false);
  });

  it('undo walks back through MULTIPLE distinct edits in order', () => {
    const { setPlacement } = useRoomLayoutStore.getState();
    setPlacement('A', { position: [1, 0, 0] });
    setPlacement('B', { position: [0, 2, 0] });

    let s = useRoomLayoutStore.getState();
    s.undo(); // undo B
    expect(useRoomLayoutStore.getState().layout.B).toBeUndefined();
    expect(useRoomLayoutStore.getState().getPlacement('A').position).toEqual([1, 0, 0]);

    s = useRoomLayoutStore.getState();
    s.undo(); // undo A
    expect(useRoomLayoutStore.getState().layout.A).toBeUndefined();
    expect(useRoomLayoutStore.getState().canUndo).toBe(false);
  });

  it('a new edit after undo CLEARS the redo stack', () => {
    const { setPlacement } = useRoomLayoutStore.getState();
    setPlacement('A', { position: [1, 0, 0] });
    useRoomLayoutStore.getState().undo();
    expect(useRoomLayoutStore.getState().canRedo).toBe(true);

    useRoomLayoutStore.getState().setPlacement('B', { position: [0, 1, 0] });
    expect(useRoomLayoutStore.getState().canRedo).toBe(false);
    expect(useRoomLayoutStore.getState().future).toEqual([]);
  });

  it('reset is undoable (undo brings the prop back)', () => {
    const { setPlacement, reset } = useRoomLayoutStore.getState();
    setPlacement('GrinderStation', { scale: [2, 2, 2] });
    reset('GrinderStation');
    expect(useRoomLayoutStore.getState().layout.GrinderStation).toBeUndefined();

    useRoomLayoutStore.getState().undo(); // undo the reset
    expect(useRoomLayoutStore.getState().getPlacement('GrinderStation').scale).toEqual([2, 2, 2]);
  });

  it('coalesces rapid same-prop edits (same timestamp window) into ONE undo entry', () => {
    const { setPlacement } = useRoomLayoutStore.getState();
    setPlacement('Slider', { scale: [1.5, 1.5, 1.5] }, 1000);
    setPlacement('Slider', { scale: [2, 2, 2] }, 1100); // within 400ms → coalesce
    setPlacement('Slider', { scale: [2.5, 2.5, 2.5] }, 1200);

    // Only ONE history entry despite three commits.
    expect(useRoomLayoutStore.getState().past.length).toBe(1);
    useRoomLayoutStore.getState().undo();
    // Undo jumps straight back to identity (before the drag began).
    expect(useRoomLayoutStore.getState().layout.Slider).toBeUndefined();
  });

  it('does NOT coalesce when the elapsed time exceeds the window', () => {
    const { setPlacement } = useRoomLayoutStore.getState();
    setPlacement('P', { position: [1, 0, 0] }, 1000);
    setPlacement('P', { position: [2, 0, 0] }, 2000); // >400ms → new entry
    expect(useRoomLayoutStore.getState().past.length).toBe(2);
  });

  it('does NOT coalesce edits to DIFFERENT props', () => {
    const { setPlacement } = useRoomLayoutStore.getState();
    setPlacement('X', { position: [1, 0, 0] }, 1000);
    setPlacement('Y', { position: [0, 1, 0] }, 1050); // different prop → new entry
    expect(useRoomLayoutStore.getState().past.length).toBe(2);
  });

  it('history is bounded to 100 entries (drops oldest)', () => {
    const { setPlacement } = useRoomLayoutStore.getState();
    // 150 distinct-prop edits → 150 would-be entries, capped at 100.
    for (let i = 0; i < 150; i++) {
      setPlacement(`prop-${String(i)}`, { position: [i, 0, 0] });
    }
    expect(useRoomLayoutStore.getState().past.length).toBe(100);
  });

  it('undo/redo with empty stacks are no-ops', () => {
    const before = useRoomLayoutStore.getState().layout;
    useRoomLayoutStore.getState().undo();
    useRoomLayoutStore.getState().redo();
    expect(useRoomLayoutStore.getState().layout).toBe(before);
  });
});
