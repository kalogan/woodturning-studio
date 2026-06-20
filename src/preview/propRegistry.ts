/**
 * propRegistry.ts — zero-wiring enumeration of every previewable prop.
 *
 * Per PREVIEW_HARNESS.md §3.3 / §B: the gallery is DATA-DRIVEN. We never hand-
 * register individual props in the harness shell. Instead we enumerate the REAL
 * workshop barrel (`src/client/workshop/index.ts`) and pick up every export that
 * is a component — i.e. a function whose name is PascalCase. That filter keeps
 * the real React components and skips the numeric/string utility constants the
 * barrel also exports (HALL_X_MIN, LATHE_YAW, DEMO_BENCH_POS, …).
 *
 * Because this reads the live barrel, a newly-added workshop prop appears in the
 * gallery AUTOMATICALLY — adding it requires ZERO edits to this file or the shell.
 *
 * Two interactive entries that are NOT in the workshop barrel are appended by
 * hand (they live in other folders): the assembled interactive <Lathe> and the
 * whole-environment <Shop>.
 *
 * IMPORTANT: these are the REAL product components — never forks (§2).
 */
import type { ComponentType } from 'react';
import * as workshop from '../client/workshop/index.js';
import { Lathe } from '../client/lathe/index.js';
import { Shop } from '../client/scene/Shop.js';

export interface PropEntry {
  /** Display name + stable selector key. */
  readonly name: string;
  /** The real product component, rendered at the origin with its own defaults. */
  readonly Component: ComponentType<Record<string, never>>;
}

const PASCAL_CASE = /^[A-Z]/;

function isComponentExport(value: unknown, name: string): value is ComponentType {
  return typeof value === 'function' && PASCAL_CASE.test(name);
}

/**
 * Build the previewable list by enumerating the workshop barrel (data-driven),
 * then appending the two cross-folder interactive entries.
 */
function buildRegistry(): PropEntry[] {
  const entries: PropEntry[] = [];

  for (const [name, value] of Object.entries(workshop as Record<string, unknown>)) {
    if (isComponentExport(value, name)) {
      entries.push({ name, Component: value as ComponentType<Record<string, never>> });
    }
  }

  // Cross-folder interactive entries (not in the workshop barrel).
  entries.push({ name: 'Lathe', Component: Lathe as ComponentType<Record<string, never>> });
  entries.push({ name: 'Shop', Component: Shop as ComponentType<Record<string, never>> });

  // Stable, alphabetical order for the picker.
  entries.sort((a, b) => a.name.localeCompare(b.name));

  return entries;
}

export const PROP_REGISTRY: readonly PropEntry[] = buildRegistry();
