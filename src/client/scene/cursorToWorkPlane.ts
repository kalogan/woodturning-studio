/**
 * cursorToWorkPlane — pure math helper (no Three.js, no browser APIs).
 *
 * Converts a cursor NDC position + camera intrinsics into a ToolPose whose
 * tip sits on the lathe work plane under the cursor.
 *
 * ─── Geometry ────────────────────────────────────────────────────────────────
 *
 * The TURNING camera is FIXED at OPERATOR_CAM_POS looking toward the blank.
 * The blank lies along world X at RIG_WORLD_Y height, roughly at world Z = 0.
 *
 * Work plane: the vertical plane that contains the blank's spin axis (world X)
 * and faces the camera.  Normal = (0, 0, 1) (pointing toward the operator),
 * passing through Z = WORK_PLANE_Z (the rig's world Z, nominally 0).
 *
 * Ray-plane intersection (no heap allocation in caller — caller pre-allocates):
 *   Given a perspective camera:
 *     rayDir = normalize(viewDir + right*ndcX*tanHalfFovH + up*ndcY*tanHalfFovV)
 *   Intersect with plane Z = K:
 *     t = (K - camZ) / rayDir.z          (valid when rayDir.z ≠ 0)
 *     X_world = camX + t * rayDir.x
 *     Y_world = camY + t * rayDir.y
 *
 * Camera axes (operator cam looks from +Z toward origin along -Z):
 *   right = (+1, 0, 0)  (world X+)
 *   up    = ( 0, 1, 0)  (world Y+)
 *   fwd   = ( 0, 0,-1)  (world -Z, toward lathe)
 *
 * This means the NDC ray is simply:
 *   rayDir.x = ndcX * tanHalfFovH
 *   rayDir.y = ndcY * tanHalfFovV
 *   rayDir.z = -1   (before normalisation — normalisation is optional; we need t in world)
 *
 * Since we only care about the ratio (t·rayDir.x) and the formula cancels normalisation:
 *   t = (K - camZ) / (-1)  = camZ - K   (for fwd = -Z)
 *   X_world = camX + t * (ndcX * tanHalfFovH)
 *   Y_world = camY + t * (ndcY * tanHalfFovV)
 *
 * ─── Pose derivation ─────────────────────────────────────────────────────────
 *
 *  pose.position.z  (traverse / station):
 *    The blank spans [rigX − halfLen, rigX + halfLen] along world X.
 *    PhysicsLoop station formula: stationIndex = round(((z + len/2) / len) * (n−1))
 *    So we map:  pose.z = X_world − rigWorldX
 *
 *  pose.position.y  (depth / contact height):
 *    tipY (used by the contact gate) = TOOL_REST_ANCHOR_Y + pose.y
 *    We want tipY = Y_world − rigWorldY, so:
 *    pose.y = (Y_world − rigWorldY) − toolRestAnchorY
 *
 *  pose.position.x  = 0 (not used by physics; keep ToolMesh centred)
 *
 *  angleX / angleY / pressure  — preserved from previous adapter pose so the
 *    caller can mutate them independently (bevel angle, pressure).
 *
 * ─── Tunable constants ───────────────────────────────────────────────────────
 *
 *  All constants that describe the camera or rig come in as parameters so they
 *  stay in sync with TurningScene.tsx and TurningEntry.tsx without duplication.
 *  The only thing fixed here is the camera's axis convention (right=+X, up=+Y,
 *  fwd=-Z), which matches the Three.js default for a camera at positive Z
 *  looking toward origin.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Parameters that describe the fixed operator camera and rig geometry. */
export interface WorkPlaneParams {
  /** Camera eye world position [x, y, z]. */
  camX: number;
  camY: number;
  camZ: number;
  /** Tangent of half the horizontal field-of-view (tanHalfFovH). */
  tanHalfFovH: number;
  /** Tangent of half the vertical field-of-view (tanHalfFovV). */
  tanHalfFovV: number;
  /** World-Z of the work plane (= rig world Z, nominally 0). */
  workPlaneZ: number;
  /** Rig world X — blank centre on the spindle axis (= RIG_WORLD_POSITION[0]). */
  rigWorldX: number;
  /** Rig world Y — spindle height (= RIG_WORLD_POSITION[1]). */
  rigWorldY: number;
  /** TOOL_REST_ANCHOR_Y — Y of tool anchor in rig-local space. */
  toolRestAnchorY: number;
}

/** Result type — matches the x/y/z sub-fields of ToolPose.position. */
export interface CursorWorkPlaneResult {
  /** pose.position.x — stays 0 (unused by physics). */
  posX: number;
  /**
   * pose.position.y — height above/below tool rest anchor.
   * tipY = toolRestAnchorY + posY = Y_world − rigWorldY
   */
  posY: number;
  /**
   * pose.position.z — traverse along the blank (station selector).
   * stationIndex = round(((posZ + len/2) / len) * (stations−1))
   * posZ = X_world − rigWorldX, so it spans ±halfBlankLength.
   */
  posZ: number;
}

/**
 * Convert NDC cursor coordinates into a work-plane tool position.
 *
 * No heap allocation — all arithmetic is on primitive scalars.
 * Returns null when the ray is parallel to the work plane (extremely rare
 * edge case when camera is exactly coplanar).
 *
 * @param ndcX  Cursor NDC X (−1 = left edge, +1 = right edge)
 * @param ndcY  Cursor NDC Y (−1 = bottom edge, +1 = top edge)
 * @param p     Camera + rig geometry constants (pre-computed once, passed in)
 */
export function cursorToWorkPlane(
  ndcX: number,
  ndcY: number,
  p: WorkPlaneParams,
): CursorWorkPlaneResult | null {
  // Ray direction components (unnormalised; fwd = -Z for standard Three.js cam).
  const rdX = ndcX * p.tanHalfFovH;
  const rdY = ndcY * p.tanHalfFovV;
  // rdZ is always -1 for a perspective camera looking toward -Z.
  // The guard below is intentionally kept for completeness but TypeScript knows
  // rdZ is literally -1, so we cast to number to avoid the "no overlap" error.
  const rdZ: number = -1.0;

  // Ray-plane intersection: plane is Z = workPlaneZ.
  // t = (workPlaneZ − camZ) / rdZ
  if (rdZ === 0) return null; // camera axis is parallel to plane (never happens here)

  const t = (p.workPlaneZ - p.camZ) / rdZ;

  // t should be positive (plane is in front of camera).
  // Guard: if plane is behind the camera (shouldn't happen with this geometry)
  // we still compute and let physics clip it.
  const xWorld = p.camX + t * rdX;
  const yWorld = p.camY + t * rdY;

  return {
    posX: 0,
    posY: yWorld - p.rigWorldY - p.toolRestAnchorY,
    posZ: xWorld - p.rigWorldX,
  };
}

/**
 * Compute tanHalfFovH from vertical FOV (degrees) and aspect ratio.
 * Call once at startup — not per frame.
 *
 * Three.js PerspectiveCamera.fov is the vertical FOV.
 * tanHalfFovV = tan(fovV_rad / 2)
 * tanHalfFovH = tanHalfFovV * aspect
 */
export function computeTanHalfFov(
  verticalFovDeg: number,
  aspect: number,
): { tanHalfFovV: number; tanHalfFovH: number } {
  const tanHalfFovV = Math.tan((verticalFovDeg * Math.PI) / 180 / 2);
  return { tanHalfFovV, tanHalfFovH: tanHalfFovV * aspect };
}
