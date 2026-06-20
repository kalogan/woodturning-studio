/**
 * editStore.test.ts — harness edit record: identity, diff, persistence.
 *
 * Pure logic against the zustand store + localStorage helpers. No R3F render.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { identityEdit, isIdentity, useEditStore } from './editStore.js';

beforeEach(() => {
  localStorage.clear();
  // Reset the in-memory store to a clean slate between tests.
  useEditStore.setState({ edits: {} });
});

describe('identityEdit / isIdentity', () => {
  it('identityEdit is identity and returns fresh arrays each call', () => {
    const a = identityEdit();
    const b = identityEdit();
    expect(isIdentity(a)).toBe(true);
    expect(a.scale).not.toBe(b.scale); // not shared references
  });

  it('detects non-identity edits', () => {
    expect(isIdentity({ ...identityEdit(), scale: [1.2, 1, 1] })).toBe(false);
    expect(isIdentity({ ...identityEdit(), tint: '#a87f4d' })).toBe(false);
    expect(isIdentity({ ...identityEdit(), position: [0, 0.5, 0] })).toBe(false);
    expect(isIdentity({ ...identityEdit(), rotationDeg: [0, 15, 0] })).toBe(false);
  });
});

describe('store mutation + diff', () => {
  it('getEdit returns identity for unknown props', () => {
    expect(isIdentity(useEditStore.getState().getEdit('Nope'))).toBe(true);
  });

  it('setEdit patches and persists; diff omits identity props', () => {
    const { setEdit } = useEditStore.getState();
    setEdit('Workbench', { scale: [1.2, 1, 1] });
    setEdit('Workbench', { rotationDeg: [0, 15, 0] });

    const edit = useEditStore.getState().getEdit('Workbench');
    expect(edit.scale).toEqual([1.2, 1, 1]);
    expect(edit.rotationDeg).toEqual([0, 15, 0]);

    const diff = useEditStore.getState().diff();
    expect(Object.keys(diff)).toEqual(['Workbench']);

    // Persisted to localStorage.
    const raw = localStorage.getItem('wts-preview-edits');
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw as string) as Record<string, { scale: number[] } | undefined>;
    expect(stored.Workbench?.scale).toEqual([1.2, 1, 1]);
  });

  it('reset removes a prop and is excluded from diff', () => {
    const { setEdit, reset } = useEditStore.getState();
    setEdit('Grinder', { tint: '#ff0000' });
    expect(Object.keys(useEditStore.getState().diff())).toContain('Grinder');
    reset('Grinder');
    expect(useEditStore.getState().diff()).toEqual({});
    expect(isIdentity(useEditStore.getState().getEdit('Grinder'))).toBe(true);
  });

  it('diff only includes non-identity props', () => {
    const { setEdit } = useEditStore.getState();
    setEdit('A', { scale: [2, 2, 2] });
    setEdit('B', {}); // patch with nothing → stays identity
    const diff = useEditStore.getState().diff();
    expect(Object.keys(diff)).toEqual(['A']);
  });
});
