import { describe, it, expect } from 'vitest';
import {
  squarePoint,
  roundness,
  buildRing,
  buildBlankBuffers,
  RING_SEGMENTS,
  ROUND_FRACTION,
} from './blankGeometry.js';

// ── squarePoint ───────────────────────────────────────────────────────────────

describe('squarePoint', () => {
  const R = 0.05; // 50 mm half-side

  it('θ=0 → (R, 0): flat right face, x equals R', () => {
    const [x, z] = squarePoint(0, R);
    expect(x).toBeCloseTo(R);
    expect(z).toBeCloseTo(0);
  });

  it('θ=π/2 → (0, R): flat top face, z equals R', () => {
    const [x, z] = squarePoint(Math.PI / 2, R);
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(R);
  });

  it('θ=π → (-R, 0): flat left face, x equals -R', () => {
    const [x, z] = squarePoint(Math.PI, R);
    expect(x).toBeCloseTo(-R);
    expect(z).toBeCloseTo(0);
  });

  it('θ=3π/2 → (0, -R): flat bottom face, z equals -R', () => {
    const [x, z] = squarePoint(3 * Math.PI / 2, R);
    expect(x).toBeCloseTo(0);
    expect(z).toBeCloseTo(-R);
  });

  it('θ=π/4 corner sits at ~√2·R from origin', () => {
    const [x, z] = squarePoint(Math.PI / 4, R);
    const dist = Math.sqrt(x * x + z * z);
    expect(dist).toBeCloseTo(Math.SQRT2 * R, 5);
  });

  it('θ=5π/4 corner sits at ~√2·R from origin (third quadrant)', () => {
    const [x, z] = squarePoint(5 * Math.PI / 4, R);
    const dist = Math.sqrt(x * x + z * z);
    expect(dist).toBeCloseTo(Math.SQRT2 * R, 5);
  });

  it('flat-face distances are all equal to R for cardinal angles', () => {
    const cardinals = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
    for (const theta of cardinals) {
      const [x, z] = squarePoint(theta, R);
      const maxCoord = Math.max(Math.abs(x), Math.abs(z));
      expect(maxCoord).toBeCloseTo(R, 5);
    }
  });

  it('all points satisfy max(|x|, |z|) ≈ R (square boundary)', () => {
    for (let k = 0; k < 32; k++) {
      const theta = (k / 32) * 2 * Math.PI;
      const [x, z] = squarePoint(theta, R);
      // max coord should equal R (on the square boundary)
      const maxCoord = Math.max(Math.abs(x), Math.abs(z));
      expect(maxCoord).toBeCloseTo(R, 5);
    }
  });
});

// ── roundness ─────────────────────────────────────────────────────────────────

describe('roundness', () => {
  const R = 0.05;

  it('returns 0 when nothing has been removed (currentR == originalR)', () => {
    expect(roundness(R, R)).toBe(0);
  });

  it('returns 1 when removed ≥ ROUND_FRACTION * originalR', () => {
    const currentR = R - R * ROUND_FRACTION;
    expect(roundness(R, currentR)).toBeCloseTo(1, 5);
  });

  it('returns 1 when over-cut (currentR well below threshold)', () => {
    expect(roundness(R, 0)).toBe(1);
  });

  it('clamps at 0 (t never goes negative)', () => {
    // currentR > originalR is clamped to removed = 0
    expect(roundness(R, R * 1.5)).toBe(0);
  });

  it('clamps at 1 (t never exceeds 1)', () => {
    expect(roundness(R, 0)).toBe(1);
  });

  it('returns 0.5 at exactly half the ROUND_FRACTION removal', () => {
    const halfFraction = ROUND_FRACTION / 2;
    const currentR = R - R * halfFraction;
    expect(roundness(R, currentR)).toBeCloseTo(0.5, 5);
  });

  it('returns 1 for degenerate originalR=0 (guard clause)', () => {
    expect(roundness(0, 0)).toBe(1);
  });
});

// ── buildRing — t=0 gives square vertices ────────────────────────────────────

describe('buildRing at t=0 (pure square)', () => {
  const R = 0.05;
  const N = 32;
  const Y = 0.1;

  it('all vertices have y == stationY', () => {
    const ring = buildRing(R, R, Y, 0, N);
    for (let k = 0; k < N; k++) {
      expect(ring[k * 3 + 1]).toBeCloseTo(Y, 8);
    }
  });

  it('all vertices lie on the square boundary max(|x|,|z|) ≈ R', () => {
    const ring = buildRing(R, R, Y, 0, N);
    for (let k = 0; k < N; k++) {
      const x = ring[k * 3];
      const z = ring[k * 3 + 2];
      const maxCoord = Math.max(Math.abs(x!), Math.abs(z!));
      expect(maxCoord).toBeCloseTo(R, 5);
    }
  });

  it('corner vertex (k corresponding to π/4) is at ~√2·R from origin', () => {
    // k=4 out of 32 → θ = (4/32)*2π = π/4
    const ring = buildRing(R, R, Y, 0, N);
    const k = 4; // 4/32 * 2π = π/4
    const x = ring[k * 3]!;
    const z = ring[k * 3 + 2]!;
    const dist = Math.sqrt(x * x + z * z);
    expect(dist).toBeCloseTo(Math.SQRT2 * R, 5);
  });
});

// ── buildRing — t=1 gives circle vertices ────────────────────────────────────

describe('buildRing at t=1 (pure circle)', () => {
  const origR = 0.05;
  const curR = 0.04; // has been cut
  const N = 32;
  const Y = 0;

  it('all vertices are at distance curR from axis', () => {
    const ring = buildRing(origR, curR, Y, 1, N);
    for (let k = 0; k < N; k++) {
      const x = ring[k * 3]!;
      const z = ring[k * 3 + 2]!;
      const dist = Math.sqrt(x * x + z * z);
      expect(dist).toBeCloseTo(curR, 5);
    }
  });
});

// ── buildBlankBuffers ─────────────────────────────────────────────────────────

describe('buildBlankBuffers', () => {
  const stations = 20;
  const R = 0.05;
  const length = 0.3;
  const origProfile = new Float32Array(stations).fill(R);
  const curProfile = new Float32Array(stations).fill(R); // uncut blank

  it('positions array has correct length (stations*N + 2 cap verts) * 3', () => {
    const N = RING_SEGMENTS;
    const { positions } = buildBlankBuffers(origProfile, curProfile, length, N);
    expect(positions.length).toBe((stations * N + 2) * 3);
  });

  it('indices array has correct length for tube + caps', () => {
    const N = RING_SEGMENTS;
    const tubeTriCount = (stations - 1) * N * 2;
    const capTriCount = N * 2;
    const { indices } = buildBlankBuffers(origProfile, curProfile, length, N);
    expect(indices.length).toBe((tubeTriCount + capTriCount) * 3);
  });

  it('all vertex positions are finite', () => {
    const { positions } = buildBlankBuffers(origProfile, curProfile, length);
    for (let i = 0; i < positions.length; i++) {
      expect(Number.isFinite(positions[i]!)).toBe(true);
    }
  });

  it('all indices are within valid vertex range', () => {
    const N = RING_SEGMENTS;
    const maxIdx = stations * N + 1; // last valid vertex index
    const { indices } = buildBlankBuffers(origProfile, curProfile, length, N);
    for (let i = 0; i < indices.length; i++) {
      expect(indices[i]!).toBeGreaterThanOrEqual(0);
      expect(indices[i]!).toBeLessThanOrEqual(maxIdx);
    }
  });

  it('headstock cap centre y ≈ -length/2', () => {
    const N = RING_SEGMENTS;
    const { positions } = buildBlankBuffers(origProfile, curProfile, length, N);
    const headCapY = positions[(stations * N) * 3 + 1]!;
    expect(headCapY).toBeCloseTo(-length / 2, 6);
  });

  it('tailstock cap centre y ≈ +length/2', () => {
    const N = RING_SEGMENTS;
    const { positions } = buildBlankBuffers(origProfile, curProfile, length, N);
    const tailCapY = positions[(stations * N + 1) * 3 + 1]!;
    expect(tailCapY).toBeCloseTo(length / 2, 6);
  });

  it('uncut blank: all ring vertices lie on square boundary', () => {
    const N = RING_SEGMENTS;
    const { positions } = buildBlankBuffers(origProfile, curProfile, length, N);
    for (let i = 0; i < stations; i++) {
      for (let k = 0; k < N; k++) {
        const base = (i * N + k) * 3;
        const x = positions[base]!;
        const z = positions[base + 2]!;
        const maxCoord = Math.max(Math.abs(x), Math.abs(z));
        expect(maxCoord).toBeCloseTo(R, 5);
      }
    }
  });

  it('fully cut blank: all ring vertices lie on circle of currentR', () => {
    const N = RING_SEGMENTS;
    // Remove more than ROUND_FRACTION of R so every station is round
    const curR = R * (1 - ROUND_FRACTION * 2); // well past roundness threshold
    const cutProfile = new Float32Array(stations).fill(curR);
    const { positions } = buildBlankBuffers(origProfile, cutProfile, length, N);
    for (let i = 0; i < stations; i++) {
      for (let k = 0; k < N; k++) {
        const base = (i * N + k) * 3;
        const x = positions[base]!;
        const z = positions[base + 2]!;
        const dist = Math.sqrt(x * x + z * z);
        expect(dist).toBeCloseTo(curR, 4);
      }
    }
  });
});
