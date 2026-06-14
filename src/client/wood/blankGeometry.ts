/**
 * blankGeometry.ts — pure geometry math for the square-to-round blank morph.
 *
 * No Three.js, no browser APIs — only pure arithmetic so all helpers are
 * unit-testable in a Node environment.
 *
 * DIRECTOR-TUNABLE CONSTANTS:
 *   RING_SEGMENTS — number of vertices around each station ring (affects smoothness)
 *   ROUND_FRACTION — fraction of originalRadius that must be removed before the
 *                    station is fully round (t reaches 1).  ≈ 0.12 = 12% of R.
 */

/** Number of vertices around each ring cross-section. */
export const RING_SEGMENTS = 32;

/**
 * Fraction of originalR that must be removed to drive roundness from 0 → 1.
 * At t=0 the cross-section is a square; at t=1 it is a circle.
 */
export const ROUND_FRACTION = 0.12;

// ── Pure per-vertex math ──────────────────────────────────────────────────────

/**
 * Returns the X and Y components of the point on the SQUARE boundary in the
 * direction given by angle θ (radians), where the square has half-side `r`.
 * The square boundary is: max(|x|, |y|) = r in the direction (cosθ, sinθ).
 *
 * Result: scale direction by r / max(|cosθ|, |sinθ|) → corners sit at √2·r.
 */
export function squarePoint(theta: number, r: number): [number, number] {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const denom = Math.max(Math.abs(cosT), Math.abs(sinT));
  // Guard against zero (theta = ±π/4 at exactly zero denominator cannot happen,
  // but guard anyway for safety.)
  const scale = denom === 0 ? r : r / denom;
  return [cosT * scale, sinT * scale];
}

/**
 * Computes the roundness interpolation factor t ∈ [0, 1]:
 *   t=0 → square (no material removed yet)
 *   t=1 → fully round (removed ≥ ROUND_FRACTION * originalR)
 *
 * @param originalR  Starting radius at this station
 * @param currentR   Current (post-cut) radius at this station
 */
export function roundness(originalR: number, currentR: number): number {
  if (originalR <= 0) return 1; // degenerate station — treat as round
  const removed = Math.max(0, originalR - currentR);
  const t = removed / (originalR * ROUND_FRACTION);
  return Math.min(1, Math.max(0, t));
}

/**
 * Builds a single ring of N vertices at station z.
 * Output: flat array of triplets [x, y, z, x, y, z, ...] (length = N * 3).
 *
 * Axis convention: length runs along the local Y axis (same as old LatheGeometry),
 * so the cross-section occupies the X–Z plane:
 *   vertex = (crossX, stationY, crossZ)
 *
 * @param originalR   Starting radius (square extent = originalR, corners at ~1.41·R)
 * @param currentR    Current cut radius (used for the round endpoint + clamp)
 * @param stationY    Y position of this station along the blank's length
 * @param t           Roundness factor from `roundness()` — 0=square, 1=round
 * @param N           Number of vertices per ring (default RING_SEGMENTS)
 * @param out         Optional pre-allocated Float32Array slice to write into
 *                    (must be length >= N*3). If omitted a new array is returned.
 */
export function buildRing(
  originalR: number,
  currentR: number,
  stationY: number,
  t: number,
  N: number = RING_SEGMENTS,
  out?: Float32Array,
  outOffset: number = 0,
): Float32Array {
  const result = out ?? new Float32Array(N * 3);
  const off = outOffset;

  for (let k = 0; k < N; k++) {
    const theta = (k / N) * (2 * Math.PI);
    const [sqX, sqZ] = squarePoint(theta, originalR);
    const ciX = Math.cos(theta) * currentR;
    const ciZ = Math.sin(theta) * currentR;

    // Lerp square → circle based on roundness t
    const vx = sqX + (ciX - sqX) * t;
    const vz = sqZ + (ciZ - sqZ) * t;

    const base = off + k * 3;
    result[base] = vx;
    result[base + 1] = stationY;
    result[base + 2] = vz;
  }
  return result;
}

// ── Full geometry buffer builder ──────────────────────────────────────────────

/**
 * Builds a complete flat-array geometry for the blank given the physics profile
 * arrays.  Returns typed arrays ready to be passed to BufferGeometry.setAttribute.
 *
 * Layout:
 *   - stations ring vertices: (stations) rings × N vertices each
 *   - 1 centre cap vertex at the headstock end (index = stations * N)
 *   - 1 centre cap vertex at the tailstock end  (index = stations * N + 1)
 *
 * @param originalProfile  Float32Array of starting radii per station
 * @param currentProfile   Float32Array of current radii per station
 * @param length           Blank length in metres
 * @param N                Vertices per ring (default RING_SEGMENTS)
 */
export function buildBlankBuffers(
  originalProfile: Float32Array,
  currentProfile: Float32Array,
  length: number,
  N: number = RING_SEGMENTS,
): { positions: Float32Array; indices: Uint32Array } {
  const stations = originalProfile.length;

  // Vertex layout:
  //   indices [0 .. stations*N - 1]       — ring vertices
  //   index   [stations*N]                — headstock cap centre (i=0 end)
  //   index   [stations*N + 1]            — tailstock cap centre (i=last end)
  const totalVerts = stations * N + 2;
  const positions = new Float32Array(totalVerts * 3);

  // Fill ring vertices
  for (let i = 0; i < stations; i++) {
    const origR = originalProfile[i] ?? 0;
    const curR = Math.min(currentProfile[i] ?? 0, origR); // clamp: never grow
    const stationY = (i / (stations - 1)) * length - length / 2;
    const t = roundness(origR, curR);
    buildRing(origR, curR, stationY, t, N, positions, i * N * 3);
  }

  // Cap centres
  const headY = -length / 2;
  const tailY = length / 2;
  const capBase = stations * N * 3;
  positions[capBase] = 0;
  positions[capBase + 1] = headY;
  positions[capBase + 2] = 0;
  positions[capBase + 3] = 0;
  positions[capBase + 4] = tailY;
  positions[capBase + 5] = 0;

  // Index layout:
  //   tube quads: (stations-1) × N × 2 triangles = (stations-1) × N × 6 indices
  //   headstock cap fan: N × 3 indices
  //   tailstock cap fan: N × 3 indices
  const tubeTriCount = (stations - 1) * N * 2;
  const capTriCount = N * 2;
  const totalTris = tubeTriCount + capTriCount;
  const indices = new Uint32Array(totalTris * 3);

  let idx = 0;

  // Tube quads: ring i → ring i+1, connecting vertex k to (k+1)%N
  for (let i = 0; i < stations - 1; i++) {
    const ringA = i * N;
    const ringB = (i + 1) * N;
    for (let k = 0; k < N; k++) {
      const kn = (k + 1) % N;
      // Two triangles per quad (CCW winding for outward-facing normals)
      indices[idx++] = ringA + k;
      indices[idx++] = ringB + k;
      indices[idx++] = ringB + kn;

      indices[idx++] = ringA + k;
      indices[idx++] = ringB + kn;
      indices[idx++] = ringA + kn;
    }
  }

  // Headstock cap (station 0), fan to cap centre (stations*N)
  const headCapCentre = stations * N;
  const headRing = 0;
  for (let k = 0; k < N; k++) {
    const kn = (k + 1) % N;
    // Wind inward (headstock faces −Y direction)
    indices[idx++] = headRing + kn;
    indices[idx++] = headRing + k;
    indices[idx++] = headCapCentre;
  }

  // Tailstock cap (station last), fan to cap centre (stations*N + 1)
  const tailCapCentre = stations * N + 1;
  const tailRing = (stations - 1) * N;
  for (let k = 0; k < N; k++) {
    const kn = (k + 1) % N;
    // Wind outward (tailstock faces +Y direction)
    indices[idx++] = tailRing + k;
    indices[idx++] = tailRing + kn;
    indices[idx++] = tailCapCentre;
  }

  return { positions, indices };
}
