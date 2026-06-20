/**
 * roomLayoutStore.ts — per-prop DELTA placements for the Room Editor tab.
 *
 * HARNESS-ONLY. The Room Editor renders the FULL assembled room (mirrors
 * Shop.tsx) and lets the director nudge any top-level prop IN CONTEXT, then
 * export a room-layout JSON to hand back for baking. Each placement is a DELTA
 * transform applied on top of the prop's own internal positioning — default =
 * identity, so the room initially looks EXACTLY like the deployed scene.
 *
 * This is a SEPARATE store from the gallery's editStore: different shape
 * (no tint), different localStorage key (`wts-room-layout`, never the gallery's
 * `wts-preview-edits`).
 *
 * KNOWN TRAP: zustand/useSyncExternalStore selectors MUST return STABLE
 * references. Never build a fresh object/array inside a selector (e.g.
 * `s => s.layout[name] ?? identity()`) — that trips "getSnapshot should be
 * cached" and an infinite render loop that blanks the harness. Consumers select
 * the raw stored entry and fall back to the module-scope frozen
 * IDENTITY_PLACEMENT in render.
 */
import { create } from 'zustand';

/** A single prop's DELTA placement in the room. Default = identity (no change). */
export interface RoomPlacement {
  /** Metre offset per axis, added to the prop's own position. Default [0,0,0]. */
  position: [number, number, number];
  /** Rotation in DEGREES per axis (applied as an extra rotation). Default [0,0,0]. */
  rotationDeg: [number, number, number];
  /** Multiplier per axis. Default [1,1,1]. */
  scale: [number, number, number];
}

/** Map of prop-name → placement. Props with no entry are at identity. */
export type RoomLayout = Record<string, RoomPlacement>;

const STORAGE_KEY = 'wts-room-layout';

/** A fresh identity placement (new arrays each call) — for MUTATION paths only. */
export function identityPlacement(): RoomPlacement {
  return {
    position: [0, 0, 0],
    rotationDeg: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

/**
 * A STABLE, frozen identity placement — a single shared reference for READ-ONLY
 * use as a selector fallback (`useRoomLayoutStore(s => s.layout[name]) ?? IDENTITY_PLACEMENT`).
 * Returning a fresh object from a selector each render triggers
 * "getSnapshot should be cached" + an infinite loop, so consumers MUST fall back
 * to THIS constant rather than calling identityPlacement() in a selector.
 * Never mutate it (callers spread/copy before editing).
 */
export const IDENTITY_PLACEMENT: RoomPlacement = Object.freeze({
  position: Object.freeze([0, 0, 0]),
  rotationDeg: Object.freeze([0, 0, 0]),
  scale: Object.freeze([1, 1, 1]),
}) as unknown as RoomPlacement;

/** True when a placement equals identity (so it can be omitted from the export diff). */
export function isIdentityPlacement(p: RoomPlacement): boolean {
  return (
    p.position[0] === 0 &&
    p.position[1] === 0 &&
    p.position[2] === 0 &&
    p.rotationDeg[0] === 0 &&
    p.rotationDeg[1] === 0 &&
    p.rotationDeg[2] === 0 &&
    p.scale[0] === 1 &&
    p.scale[1] === 1 &&
    p.scale[2] === 1
  );
}

const TRIPLE_NUM = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

/** Coerce an unknown value (from localStorage) into a valid RoomPlacement. */
function coercePlacement(value: unknown): RoomPlacement {
  const base = identityPlacement();
  if (typeof value !== 'object' || value === null) return base;
  const v = value as Record<string, unknown>;
  if (TRIPLE_NUM(v.position)) base.position = [v.position[0], v.position[1], v.position[2]];
  if (TRIPLE_NUM(v.rotationDeg)) {
    base.rotationDeg = [v.rotationDeg[0], v.rotationDeg[1], v.rotationDeg[2]];
  }
  if (TRIPLE_NUM(v.scale)) base.scale = [v.scale[0], v.scale[1], v.scale[2]];
  return base;
}

/** Read the persisted layout from localStorage (fail-soft → {}). */
function loadLayout(): RoomLayout {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: RoomLayout = {};
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      out[name] = coercePlacement(value);
    }
    return out;
  } catch {
    return {};
  }
}

/** Persist the layout to localStorage (fail-soft). */
function persistLayout(layout: RoomLayout): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* quota / private mode — ignore, layout still lives in memory */
  }
}

interface RoomLayoutState {
  /** All placements, keyed by prop name. Props with no entry are at identity. */
  layout: RoomLayout;
  /** Get the placement for a prop (FRESH identity if none — for mutation only). */
  getPlacement: (name: string) => RoomPlacement;
  /** Patch a prop's placement; persists. */
  setPlacement: (name: string, patch: Partial<RoomPlacement>) => void;
  /** Reset one prop to identity (removes its entry); persists. */
  reset: (name: string) => void;
  /** The non-identity subset, for export. */
  diff: () => RoomLayout;
}

export const useRoomLayoutStore = create<RoomLayoutState>((set, get) => ({
  layout: loadLayout(),

  getPlacement: (name) => get().layout[name] ?? identityPlacement(),

  setPlacement: (name, patch) => {
    set((state) => {
      const current = state.layout[name] ?? identityPlacement();
      const next: RoomPlacement = { ...current, ...patch };
      const layout: RoomLayout = { ...state.layout, [name]: next };
      persistLayout(layout);
      return { layout };
    });
  },

  reset: (name) => {
    set((state) => {
      if (!(name in state.layout)) return state;
      const { [name]: _removed, ...layout } = state.layout;
      void _removed;
      persistLayout(layout);
      return { layout };
    });
  },

  diff: () => {
    const out: RoomLayout = {};
    for (const [name, placement] of Object.entries(get().layout)) {
      if (!isIdentityPlacement(placement)) out[name] = placement;
    }
    return out;
  },
}));
