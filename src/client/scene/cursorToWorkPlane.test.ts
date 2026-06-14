/**
 * cursorToWorkPlane.test.ts
 *
 * Pure-math tests — no R3F, no Three.js, no browser APIs.
 *
 * Reference geometry (mirrors TurningScene.tsx + TurningEntry.tsx defaults):
 *   OPERATOR_CAM_POS = [0.23, 1.65, 1.0]
 *   OPERATOR_CAM_FOV = 60°  vertical
 *   RIG_WORLD_POSITION = [0.23, 1.10, 0.0]
 *   TOOL_REST_ANCHOR_Y = -0.01
 *   work plane Z = 0 (rig world Z)
 *   aspect = 16/9 (typical monitor)
 */

import { describe, it, expect } from 'vitest';
import { cursorToWorkPlane, computeTanHalfFov } from './cursorToWorkPlane.js';

// ── Shared constants (mirror the real tuning knobs) ───────────────────────────
const CAM_X = 0.23;
const CAM_Y = 1.65;
const CAM_Z = 1.00;
const FOV_V_DEG = 60;
const ASPECT = 16 / 9;
const WORK_PLANE_Z = 0.0;
const RIG_X = 0.23;
const RIG_Y = 1.10;
const ANCHOR_Y = -0.01;

const { tanHalfFovV, tanHalfFovH } = computeTanHalfFov(FOV_V_DEG, ASPECT);

const BASE_PARAMS = {
  camX: CAM_X,
  camY: CAM_Y,
  camZ: CAM_Z,
  tanHalfFovH,
  tanHalfFovV,
  workPlaneZ: WORK_PLANE_Z,
  rigWorldX: RIG_X,
  rigWorldY: RIG_Y,
  toolRestAnchorY: ANCHOR_Y,
};

// Helper: compute expected t (distance along ray to work plane)
// rdZ = -1, so t = (workPlaneZ - camZ) / -1 = camZ - workPlaneZ
const T = CAM_Z - WORK_PLANE_Z; // = 1.0

// Utility: assert result is non-null and return it as non-nullable.
// Uses expect(...).not.toBeNull() so Vitest reports the failure correctly,
// then throws if somehow null (satisfies TypeScript flow analysis).
function assertHit(result: ReturnType<typeof cursorToWorkPlane>) {
  expect(result).not.toBeNull();
  if (result === null) throw new Error('result was null');
  return result;
}

describe('computeTanHalfFov', () => {
  it('60° vertical FOV → tanHalfFovV ≈ tan(30°) = 0.5774', () => {
    expect(tanHalfFovV).toBeCloseTo(Math.tan(Math.PI / 6), 6);
  });

  it('horizontal tanHalfFov = tanHalfFovV * aspect', () => {
    expect(tanHalfFovH).toBeCloseTo(tanHalfFovV * ASPECT, 10);
  });
});

describe('cursorToWorkPlane — basic geometry', () => {
  it('cursor at NDC centre (0, 0) places posZ at 0 (blank centre)', () => {
    const r = assertHit(cursorToWorkPlane(0, 0, BASE_PARAMS));
    // xWorld = camX + T * 0 * tanHalfFovH = camX → posZ = 0
    expect(r.posZ).toBeCloseTo(0, 8);
  });

  it('cursor at NDC centre (0, 0) posX is always 0', () => {
    const r = assertHit(cursorToWorkPlane(0, 0, BASE_PARAMS));
    expect(r.posX).toBe(0);
  });

  it('cursor at NDC centre (0, 0) posY = camY − rigY − anchorY', () => {
    const r = assertHit(cursorToWorkPlane(0, 0, BASE_PARAMS));
    expect(r.posY).toBeCloseTo(CAM_Y - RIG_Y - ANCHOR_Y, 6);
  });

  it('cursor right (+1, 0) moves tool toward tailstock (+posZ)', () => {
    const right = assertHit(cursorToWorkPlane(1, 0, BASE_PARAMS));
    const centre = assertHit(cursorToWorkPlane(0, 0, BASE_PARAMS));
    expect(right.posZ).toBeGreaterThan(centre.posZ);
  });

  it('cursor left (-1, 0) moves tool toward headstock (−posZ)', () => {
    const left = assertHit(cursorToWorkPlane(-1, 0, BASE_PARAMS));
    const centre = assertHit(cursorToWorkPlane(0, 0, BASE_PARAMS));
    expect(left.posZ).toBeLessThan(centre.posZ);
  });

  it('cursor up (0, +1) raises posY (tool lifts away from blank surface)', () => {
    const up = assertHit(cursorToWorkPlane(0, 1, BASE_PARAMS));
    const centre = assertHit(cursorToWorkPlane(0, 0, BASE_PARAMS));
    expect(up.posY).toBeGreaterThan(centre.posY);
  });

  it('cursor down (0, -1) lowers posY (tool descends toward blank)', () => {
    const down = assertHit(cursorToWorkPlane(0, -1, BASE_PARAMS));
    const centre = assertHit(cursorToWorkPlane(0, 0, BASE_PARAMS));
    expect(down.posY).toBeLessThan(centre.posY);
  });
});

describe('cursorToWorkPlane — exact numeric values', () => {
  it('posZ = (camX + T * ndcX * tanHalfFovH) - rigX', () => {
    const ndcX = 0.5;
    const expectedXWorld = CAM_X + T * ndcX * tanHalfFovH;
    const expectedPosZ = expectedXWorld - RIG_X;
    const r = assertHit(cursorToWorkPlane(ndcX, 0, BASE_PARAMS));
    expect(r.posZ).toBeCloseTo(expectedPosZ, 10);
  });

  it('posY = (camY + T * ndcY * tanHalfFovV) - rigY - anchorY', () => {
    const ndcY = -0.3;
    const expectedYWorld = CAM_Y + T * ndcY * tanHalfFovV;
    const expectedPosY = expectedYWorld - RIG_Y - ANCHOR_Y;
    const r = assertHit(cursorToWorkPlane(0, ndcY, BASE_PARAMS));
    expect(r.posY).toBeCloseTo(expectedPosY, 10);
  });

  it('tipY = ANCHOR_Y + posY = Y_world - rigY (contact gate formula holds)', () => {
    const ndcY = -0.5;
    const r = assertHit(cursorToWorkPlane(0, ndcY, BASE_PARAMS));
    const tipY = ANCHOR_Y + r.posY;
    const yWorld = CAM_Y + T * ndcY * tanHalfFovV;
    // tipY should equal yWorld - rigY so contact gate compares correctly
    expect(tipY).toBeCloseTo(yWorld - RIG_Y, 10);
  });
});

describe('cursorToWorkPlane — station range', () => {
  it('blank half-length (0.15 m) is reachable within the horizontal FOV', () => {
    // cursor at far right should reach more than 0.15 m from centre
    const right = assertHit(cursorToWorkPlane(1, 0, BASE_PARAMS));
    // tanHalfFovH ≈ 0.577 * (16/9) ≈ 1.026 → posZ at ndcX=1 ≈ 1.026 m >> 0.15 m
    expect(Math.abs(right.posZ)).toBeGreaterThan(0.15);
  });

  it('contact fires when cursor aligns with blank surface height', () => {
    // blank radius = 0.05 m; tipY = rigY + 0.05 = 1.15
    // ndcY = (1.15 - camY) / (T * tanHalfFovV) = (1.15 - 1.65) / tanHalfFovV
    const targetYWorld = RIG_Y + 0.05;
    const ndcY = (targetYWorld - CAM_Y) / (T * tanHalfFovV);
    const r = assertHit(cursorToWorkPlane(0, ndcY, BASE_PARAMS));
    const tipY = ANCHOR_Y + r.posY;
    // tipY should equal the blank radius at this cursor position
    expect(tipY).toBeCloseTo(0.05, 6);
  });

  it('contact is absent when cursor is near top of screen (tipY > blank radius)', () => {
    const blankRadius = 0.05;
    const contactTolerance = 0.002;
    const r = assertHit(cursorToWorkPlane(0, 1, BASE_PARAMS));
    const tipY = ANCHOR_Y + r.posY;
    expect(tipY).toBeGreaterThan(blankRadius + contactTolerance);
  });
});

describe('cursorToWorkPlane — symmetry', () => {
  it('left/right symmetric about camX=rigX: posZ(-x) = -posZ(+x)', () => {
    // camX === rigX = 0.23, so xWorld(±ndcX) = 0.23 ± T*ndcX*tanH
    // posZ = xWorld - rigX = ± T*ndcX*tanH → perfect symmetry
    const left = assertHit(cursorToWorkPlane(-0.7, 0, BASE_PARAMS));
    const right = assertHit(cursorToWorkPlane(0.7, 0, BASE_PARAMS));
    expect(left.posZ).toBeCloseTo(-right.posZ, 10);
  });
});
