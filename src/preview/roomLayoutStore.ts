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

/**
 * Map of layout-key → placement. Props with no entry are at identity.
 *
 * Two flavours of key share this map (the store treats keys as opaque strings):
 *   • a bare prop name (e.g. "DemoBench") — a DELTA placement on top of the prop's
 *     own internal positioning (the original model).
 *   • a composite "<PropName>/<childName>" (e.g. "DemoBench/demo-lathe") — a FULL
 *     LOCAL transform OVERRIDE captured from a named child sub-group's gizmo. The
 *     child editor (RoomEditor) owns this interpretation; the store just stores it.
 */
export type RoomLayout = Record<string, RoomPlacement>;

/**
 * A named child's AUTHORED local transform — the baseline the child editor falls
 * back to when no override is stored yet (so the panel shows the child's real
 * position, and the first edit seeds a full override from it). Lives here (not in
 * RoomEditor) so RoomEditor and RoomPropertiesPanel can both import it WITHOUT a
 * circular module dependency.
 */
export interface ChildBaseline {
  readonly position: readonly [number, number, number];
  readonly rotationDeg: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
}

/** Separator between a prop name and a child name in a composite layout key. */
export const CHILD_KEY_SEP = '/';

/** Build the composite layout key for a named child inside a prop. */
export function childKey(propName: string, childName: string): string {
  return `${propName}${CHILD_KEY_SEP}${childName}`;
}

/** True when a layout key targets a child sub-group (vs a bare top-level prop). */
export function isChildKey(key: string): boolean {
  return key.includes(CHILD_KEY_SEP);
}

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

/** Max snapshots kept in each undo/redo stack (drop oldest beyond this). */
const HISTORY_LIMIT = 100;

/**
 * Coalescing window (ms). Consecutive commits to the SAME prop within this window
 * are folded into a single undo entry — so one slider/gizmo drag = one undo. See
 * the coalescing comment on `setPlacement` below.
 */
const COALESCE_MS = 400;

interface RoomLayoutState {
  /** All placements, keyed by prop name. Props with no entry are at identity. */
  layout: RoomLayout;
  /** Undo stack — full-layout snapshots of PRIOR states (oldest first). In-memory only. */
  past: RoomLayout[];
  /** Redo stack — full-layout snapshots to re-apply (most-recently-undone last). */
  future: RoomLayout[];
  /** True when there is at least one snapshot to undo to. */
  canUndo: boolean;
  /** True when there is at least one snapshot to redo to. */
  canRedo: boolean;
  /** Get the placement for a prop (FRESH identity if none — for mutation only). */
  getPlacement: (name: string) => RoomPlacement;
  /**
   * Patch a prop's placement; persists. Records an undo snapshot of the PRIOR
   * layout (coalescing rapid same-prop edits). `now` is an OPTIONAL monotonic
   * timestamp passed in by the caller (e.g. performance.now()) so the store never
   * reaches for a clock itself; when omitted, every commit gets its own entry.
   */
  setPlacement: (name: string, patch: Partial<RoomPlacement>, now?: number) => void;
  /** Reset one prop to identity (removes its entry); persists. Always undoable. */
  reset: (name: string) => void;
  /** Undo the last committed change (restore the prior layout). */
  undo: () => void;
  /** Re-apply the most-recently-undone change. */
  redo: () => void;
  /** The non-identity subset, for export. */
  diff: () => RoomLayout;
}

/** Push onto a history stack, dropping the oldest entries past HISTORY_LIMIT. */
function pushBounded(stack: RoomLayout[], snapshot: RoomLayout): RoomLayout[] {
  const next = [...stack, snapshot];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

// ── Coalescing bookkeeping (module-scope, NOT persisted) ─────────────────────
// Tracks the last-edited prop + timestamp so a continuous drag on ONE prop folds
// into a single undo entry. Reset whenever a different prop is edited, undo/redo
// runs, or no timestamp is supplied.
let lastEditName: string | null = null;
let lastEditTime = 0;

export const useRoomLayoutStore = create<RoomLayoutState>((set, get) => ({
  layout: loadLayout(),
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  getPlacement: (name) => get().layout[name] ?? identityPlacement(),

  setPlacement: (name, patch, now) => {
    set((state) => {
      const prior = state.layout;
      const current = prior[name] ?? identityPlacement();
      const next: RoomPlacement = { ...current, ...patch };
      const layout: RoomLayout = { ...prior, [name]: next };
      persistLayout(layout);

      // Coalesce: only open a NEW undo entry when this edit targets a different
      // prop than the last one, OR more than COALESCE_MS has elapsed, OR no
      // timestamp was supplied (granular history). Otherwise fold into the last
      // entry by mutating `layout` in place without growing `past`.
      const coalesce =
        now !== undefined &&
        lastEditName === name &&
        now - lastEditTime < COALESCE_MS;

      lastEditName = name;
      lastEditTime = now ?? 0;

      if (coalesce) {
        // Same drag: keep history as-is (the already-pushed snapshot still points
        // at the layout from BEFORE the drag began).
        return { layout };
      }

      return {
        layout,
        past: pushBounded(state.past, prior),
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  reset: (name) => {
    set((state) => {
      if (!(name in state.layout)) return state;
      const prior = state.layout;
      const { [name]: _removed, ...layout } = prior;
      void _removed;
      persistLayout(layout);
      // A reset always opens its own undo entry (break any drag coalescing).
      lastEditName = null;
      lastEditTime = 0;
      return {
        layout,
        past: pushBounded(state.past, prior),
        future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  undo: () => {
    set((state) => {
      if (state.past.length === 0) return state;
      const past = state.past.slice(0, -1);
      const restored = state.past[state.past.length - 1] as RoomLayout;
      const future = pushBounded(state.future, state.layout);
      persistLayout(restored);
      // Undo/redo break drag coalescing so the next edit opens a fresh entry.
      lastEditName = null;
      lastEditTime = 0;
      return {
        layout: restored,
        past,
        future,
        canUndo: past.length > 0,
        canRedo: true,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.future.length === 0) return state;
      const future = state.future.slice(0, -1);
      const restored = state.future[state.future.length - 1] as RoomLayout;
      const past = pushBounded(state.past, state.layout);
      persistLayout(restored);
      lastEditName = null;
      lastEditTime = 0;
      return {
        layout: restored,
        past,
        future,
        canUndo: true,
        canRedo: future.length > 0,
      };
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
