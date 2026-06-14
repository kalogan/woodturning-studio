/**
 * setupProximity.ts — pure helpers for the Lesson-0 Setup scene interaction.
 *
 * Computes which interactable is nearest to the player in XZ and whether it is
 * within grab/mount range.  All functions are pure and allocation-light — the
 * caller pre-allocates scratch scalars and only reads the returned kind string.
 *
 * NO Three.js, NO React, NO browser APIs — safe to test in Vitest (Node).
 */

/** A bench slot the player can grab from. */
export interface BenchTarget {
  kind: 'bench';
  accessoryId: string;
  /** World-space XZ position of the slot (Y ignored for proximity). */
  x: number;
  z: number;
}

/** A lathe mount point the player can mount/unmount at. */
export interface MountTarget {
  kind: 'mount';
  /** Key that matches MountPoint in session/setup.ts. */
  mountPoint: string;
  /** Step id of the already-mounted accessory at this point (null if empty). */
  mountedStepId: string | null;
  x: number;
  z: number;
}

export type ProximityTarget = BenchTarget | MountTarget;

/**
 * Returns the nearest ProximityTarget to (playerX, playerZ), or null if the
 * closest is further than `maxRadius`.
 *
 * All arithmetic is scalar — no object allocation in the hot path.
 */
export function nearestTarget(
  playerX: number,
  playerZ: number,
  targets: readonly ProximityTarget[],
  maxRadius: number,
): ProximityTarget | null {
  let best: ProximityTarget | null = null;
  let bestDist2 = maxRadius * maxRadius;

  for (const t of targets) {
    const dx = t.x - playerX;
    const dz = t.z - playerZ;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      best = t;
    }
  }
  return best;
}

/**
 * Returns the XZ distance² between (x1,z1) and (x2,z2).
 * Exported for tests.
 */
export function dist2XZ(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return dx * dx + dz * dz;
}
