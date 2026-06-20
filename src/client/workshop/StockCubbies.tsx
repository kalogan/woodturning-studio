/**
 * StockCubbies.tsx — Tall wooden cubby/pigeonhole shelving packed with offcut stock.
 *
 * A 4-column × 3-row grid of cubbies built from a wooden frame, with short
 * wood blanks/offcuts of varied warm colours poking out of most cubbies.
 * Uses makeBoardMaterial for both the frame and the stock pieces.
 *
 * Default placement: against the right (+X) wall, centred on Z.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at player lathe.
 *   Hall extends X ∈ [-3, +12], Z ∈ [-2.5, +9].
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No browser APIs — Three.js only.
 */

import type { ReactNode } from 'react';
import { makeBoardMaterial } from '../wood/woodMaterial.js';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** World position of the cubby unit (bottom-front-centre). */
export const CUBBIES_POS: [number, number, number] = [11.3, 0, 3.5];

/** Rotation (radians). Faces inward (-X), away from the right wall. */
export const CUBBIES_ROT: [number, number, number] = [0, -Math.PI / 2, 0];

// Cubby unit overall dimensions
const UNIT_COLS = 4;     // number of cubby columns
const UNIT_ROWS = 3;     // number of cubby rows
const CUBBY_W   = 0.32;  // inner cubby width  (X)
const CUBBY_H   = 0.30;  // inner cubby height (Y)
const CUBBY_D   = 0.50;  // cubby depth        (Z)
const WALL_T    = 0.022; // divider / shelf thickness
const BASE_H    = 0.08;  // plinth / base block height

// Derived overall dimensions
const TOTAL_W = UNIT_COLS * CUBBY_W + (UNIT_COLS + 1) * WALL_T;
const TOTAL_H = UNIT_ROWS * CUBBY_H + (UNIT_ROWS + 1) * WALL_T + BASE_H;
const TOTAL_D = CUBBY_D + WALL_T * 2;

// Stock blank dimensions
const BLANK_D    = 0.38;  // depth into / out of cubby
const BLANK_SIDE = 0.10;  // cross-section side length (square)

// ─── Module-scope materials ───────────────────────────────────────────────────

const _frameMat = makeBoardMaterial('#8c6535', undefined, { grainAxis: 'x' }); // oak frame, grain horizontal
const _backMat  = makeBoardMaterial('#7a5828', undefined, { grainAxis: 'x' }); // slightly darker back panel

// Varied stock blank colours (warm species palette)
const _stockMats = [
  makeBoardMaterial('#8B3A2A', undefined, { grainAxis: 'z' }), // cherry
  makeBoardMaterial('#3d2510', undefined, { grainAxis: 'z' }), // walnut
  makeBoardMaterial('#b88040', undefined, { grainAxis: 'z' }), // maple / ash
  makeBoardMaterial('#9b5c28', undefined, { grainAxis: 'z' }), // oak
  makeBoardMaterial('#6b3820', undefined, { grainAxis: 'z' }), // mahogany
  makeBoardMaterial('#c0904a', undefined, { grainAxis: 'z' }), // birch / pine
] as const;

// Which cubbies have stock in them: [row, col, materialIndex]
// Row 0 = bottom, Col 0 = leftmost.  A few left empty for realism.
const STOCKED: ReadonlyArray<[number, number, number]> = [
  [0, 0, 0], [0, 1, 3], [0, 2, 1], [0, 3, 4],
  [1, 0, 2], [1, 1, 5],             [1, 3, 0],  // [1,2] intentionally empty
  [2, 0, 3], [2, 1, 1], [2, 2, 5],              // [2,3] intentionally empty
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Structural frame: vertical dividers + horizontal shelves + back panel + plinth. */
function Frame() {
  const verticals: ReactNode[] = [];
  const horizontals: ReactNode[] = [];

  const frameH = TOTAL_H - BASE_H;

  // Vertical dividers (UNIT_COLS + 1)
  for (let c = 0; c <= UNIT_COLS; c++) {
    const x = -TOTAL_W / 2 + WALL_T / 2 + c * (CUBBY_W + WALL_T);
    verticals.push(
      <mesh key={String(c)} castShadow receiveShadow
            position={[x, BASE_H + frameH / 2, 0]}>
        <boxGeometry args={[WALL_T, frameH, TOTAL_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
    );
  }

  // Horizontal shelves (UNIT_ROWS + 1)
  for (let r = 0; r <= UNIT_ROWS; r++) {
    const y = BASE_H + WALL_T / 2 + r * (CUBBY_H + WALL_T);
    horizontals.push(
      <mesh key={String(r)} castShadow receiveShadow
            position={[0, y, 0]}>
        <boxGeometry args={[TOTAL_W, WALL_T, TOTAL_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
    );
  }

  return (
    <group name="frame">
      {verticals}
      {horizontals}

      {/* Back panel */}
      <mesh receiveShadow position={[0, BASE_H + frameH / 2, -CUBBY_D / 2 - WALL_T * 0.5]}>
        <boxGeometry args={[TOTAL_W, frameH, WALL_T]} />
        <primitive object={_backMat} attach="material" />
      </mesh>

      {/* Plinth / base block */}
      <mesh castShadow receiveShadow position={[0, BASE_H / 2, 0]}>
        <boxGeometry args={[TOTAL_W, BASE_H, TOTAL_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Stock blanks protruding from their cubbies. */
function StockBlanks() {
  const items: ReactNode[] = [];

  for (const [row, col, matIdx] of STOCKED) {
    // Centre of this cubby
    const cx = -TOTAL_W / 2 + WALL_T + col * (CUBBY_W + WALL_T) + CUBBY_W / 2;
    const cy = BASE_H + WALL_T + row * (CUBBY_H + WALL_T) + CUBBY_H / 2;
    // Blank sits inside cubby, shifted forward so the end protrudes
    const cz = (CUBBY_D - BLANK_D) / 2;

    // Deterministic per-blank nudge (avoids Math.random)
    const nudgeX = ((row * 7 + col * 13) % 5 - 2) * 0.005;
    const nudgeY = ((row * 11 + col * 3) % 5 - 2) * 0.004;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const mat = _stockMats[matIdx % _stockMats.length]!;

    items.push(
      <mesh key={`${String(row)}_${String(col)}`} castShadow
            position={[cx + nudgeX, cy + nudgeY, cz]}>
        <boxGeometry args={[BLANK_SIDE, BLANK_SIDE, BLANK_D]} />
        <primitive object={mat} attach="material" />
      </mesh>
    );
  }

  return <group name="stock-blanks">{items}</group>;
}

// ─── Public export ────────────────────────────────────────────────────────────

interface StockCubbiesProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * StockCubbies — tall wooden cubby unit packed with offcut wood stock.
 *
 * Default position: CUBBIES_POS = [11.3, 0, 3.5]  (right wall)
 * Default rotation: CUBBIES_ROT = [0, -π/2, 0]    (faces left into room)
 * Both constants are exported for easy director tuning.
 *
 * Unit overall footprint: ~1.5 m wide × ~1.1 m tall × ~0.54 m deep.
 */
export function StockCubbies({
  position = CUBBIES_POS,
  rotation = CUBBIES_ROT,
}: StockCubbiesProps = {}) {
  return (
    <group name="stock-cubbies" position={position} rotation={rotation}>
      <Frame />
      <StockBlanks />
    </group>
  );
}
