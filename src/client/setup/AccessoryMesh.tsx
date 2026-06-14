/**
 * AccessoryMesh — registry of all Lesson-0 grabbable accessory components.
 *
 * Usage:
 *   import { ACCESSORY_REGISTRY, getAccessoryComponent } from './AccessoryMesh.js';
 *
 *   // Render an accessory by id:
 *   const { Component } = ACCESSORY_REGISTRY['spur-drive-center'];
 *   <Component position={[0, 0, 0]} />
 *
 *   // Or via helper:
 *   const Comp = getAccessoryComponent('scroll-chuck');
 *   if (Comp) <Comp />
 *
 * Keys are the accessoryId values from content/setup/lathe-setup.json:
 *   Correct (steps): spur-drive-center, live-center, tool-rest, power-plug
 *   Decoys:          faceplate, scroll-chuck, drill-chuck
 */
import type { FC } from 'react';
import { SpurDriveCenterMesh } from './SpurDriveCenterMesh.js';
import { LiveCenterMesh } from './LiveCenterMesh.js';
import { ToolRestMesh } from './ToolRestMesh.js';
import { FaceplateMesh } from './FaceplateMesh.js';
import { ScrollChuckMesh } from './ScrollChuckMesh.js';
import { DrillChuckMesh } from './DrillChuckMesh.js';
import { PowerPlugMesh } from './PowerPlugMesh.js';

/** Shared prop shape all accessory components accept. */
export interface AccessoryMeshProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/** One entry in the accessory registry. */
export interface AccessoryRegistryEntry {
  /** R3F component for this accessory — render as <Component position={…} /> */
  Component: FC<AccessoryMeshProps>;
  /** Human-readable display name (matches accessoryName in lathe-setup.json). */
  displayName: string;
}

/**
 * Registry of all 7 Lesson-0 grabbable accessories, keyed by accessory id.
 * Correct accessories first (as they appear in lathe-setup.json steps),
 * then decoys.
 */
export const ACCESSORY_REGISTRY: Record<string, AccessoryRegistryEntry> = {
  'spur-drive-center': {
    Component: SpurDriveCenterMesh,
    displayName: 'Spur drive centre',
  },
  'live-center': {
    Component: LiveCenterMesh,
    displayName: 'Live centre',
  },
  'tool-rest': {
    Component: ToolRestMesh,
    displayName: 'Tool rest',
  },
  'power-plug': {
    Component: PowerPlugMesh,
    displayName: 'Power cord',
  },
  'faceplate': {
    Component: FaceplateMesh,
    displayName: 'Faceplate',
  },
  'scroll-chuck': {
    Component: ScrollChuckMesh,
    displayName: 'Scroll chuck',
  },
  'drill-chuck': {
    Component: DrillChuckMesh,
    displayName: 'Drill chuck',
  },
};

/**
 * Look up a registry entry by accessory id.
 * Returns undefined for unknown ids (caller handles missing case).
 */
export function getAccessoryComponent(
  id: string,
): AccessoryRegistryEntry | undefined {
  return ACCESSORY_REGISTRY[id];
}
