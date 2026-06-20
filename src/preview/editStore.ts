/**
 * editStore.ts — per-prop EDIT records for the preview harness (knobs + bake).
 *
 * HARNESS-ONLY. This is inspection scaffolding: it lets the director resize,
 * move, rotate and tint a prop in the harness and EXPORT those numbers as JSON
 * to hand back for baking into the real component. It NEVER mutates or forks the
 * real product source — edits are applied at the harness level only (a wrapping
 * <group> transform + a material clone, see PropertiesPanel / PreviewApp).
 *
 * Edits are keyed by prop name and PERSISTED to localStorage so they survive a
 * reload. The store is a tiny zustand store (zustand is already a dependency).
 */
import { create } from 'zustand';

/** A single prop's edit record. Default = identity (no change vs. the prop's own defaults). */
export interface PropEdit {
  /** Multiplier per axis. Default [1,1,1]. */
  scale: [number, number, number];
  /** Metre offset per axis. Default [0,0,0]. */
  position: [number, number, number];
  /** Rotation in DEGREES per axis. Default [0,0,0]. */
  rotationDeg: [number, number, number];
  /** Hex tint like "#a87f4d", or null = use the prop's own colours. */
  tint: string | null;
}

/** Map of prop-name → edit record. */
export type EditMap = Record<string, PropEdit>;

const STORAGE_KEY = 'wts-preview-edits';

/** The identity edit (no change). A fresh copy each call — never share the arrays. */
export function identityEdit(): PropEdit {
  return {
    scale: [1, 1, 1],
    position: [0, 0, 0],
    rotationDeg: [0, 0, 0],
    tint: null,
  };
}

/** True when an edit equals identity (so it can be omitted from the export diff). */
export function isIdentity(edit: PropEdit): boolean {
  return (
    edit.scale[0] === 1 &&
    edit.scale[1] === 1 &&
    edit.scale[2] === 1 &&
    edit.position[0] === 0 &&
    edit.position[1] === 0 &&
    edit.position[2] === 0 &&
    edit.rotationDeg[0] === 0 &&
    edit.rotationDeg[1] === 0 &&
    edit.rotationDeg[2] === 0 &&
    edit.tint === null
  );
}

const TRIPLE_NUM = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

/** Coerce an unknown value (from localStorage) into a valid PropEdit, falling back to identity. */
function coerceEdit(value: unknown): PropEdit {
  const base = identityEdit();
  if (typeof value !== 'object' || value === null) return base;
  const v = value as Record<string, unknown>;
  if (TRIPLE_NUM(v.scale)) base.scale = [v.scale[0], v.scale[1], v.scale[2]];
  if (TRIPLE_NUM(v.position)) base.position = [v.position[0], v.position[1], v.position[2]];
  if (TRIPLE_NUM(v.rotationDeg)) {
    base.rotationDeg = [v.rotationDeg[0], v.rotationDeg[1], v.rotationDeg[2]];
  }
  if (typeof v.tint === 'string') base.tint = v.tint;
  return base;
}

/** Read the persisted edit map from localStorage (fail-soft → {}). */
function loadEdits(): EditMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: EditMap = {};
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      out[name] = coerceEdit(value);
    }
    return out;
  } catch {
    return {};
  }
}

/** Persist the edit map to localStorage (fail-soft). */
function persistEdits(edits: EditMap): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  } catch {
    /* quota / private mode — ignore, edits still live in memory */
  }
}

interface EditState {
  /** All edits, keyed by prop name. Props with no entry are at identity. */
  edits: EditMap;
  /** Get the edit for a prop (identity if none recorded). */
  getEdit: (name: string) => PropEdit;
  /** Patch a prop's edit; persists. */
  setEdit: (name: string, patch: Partial<PropEdit>) => void;
  /** Reset one prop to identity (removes its entry); persists. */
  reset: (name: string) => void;
  /** The non-identity subset, for export. */
  diff: () => EditMap;
}

export const useEditStore = create<EditState>((set, get) => ({
  edits: loadEdits(),

  getEdit: (name) => get().edits[name] ?? identityEdit(),

  setEdit: (name, patch) => {
    set((state) => {
      const current = state.edits[name] ?? identityEdit();
      const next: PropEdit = { ...current, ...patch };
      const edits: EditMap = { ...state.edits, [name]: next };
      persistEdits(edits);
      return { edits };
    });
  },

  reset: (name) => {
    set((state) => {
      if (!(name in state.edits)) return state;
      const { [name]: _removed, ...edits } = state.edits;
      void _removed;
      persistEdits(edits);
      return { edits };
    });
  },

  diff: () => {
    const out: EditMap = {};
    for (const [name, edit] of Object.entries(get().edits)) {
      if (!isIdentity(edit)) out[name] = edit;
    }
    return out;
  },
}));
