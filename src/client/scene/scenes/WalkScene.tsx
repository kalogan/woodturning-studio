/**
 * WalkScene — R3F Scene3D shared by WORKSHOP_WALK and AT_LATHE.
 *
 * INVARIANT: This is the SAME component reference used in both registry
 * entries. React must NOT unmount/remount it when the scene transitions
 * between WORKSHOP_WALK and AT_LATHE, otherwise FPSCamera loses pointer lock.
 *
 * Contains the workshop geometry (Lighting, Room, Furniture, Lathe) and the
 * FPSCamera walk controller. OrbitControls are NOT used here.
 */

import { Shop } from '../Shop.js';
import { Lathe } from '../../lathe/index.js';
import { LATHE_YAW } from '../../workshop/index.js';
import { FPSCamera } from '../FPSCamera.js';
import type { SceneCtx } from '../sceneCtx.js';

interface Props { ctx: SceneCtx }

export function WalkScene({ ctx }: Props) {
  return (
    <>
      <Shop />
      {/* Lathe is floor-standing; its own stand provides working height.
          Angled by LATHE_YAW (about Y) so the player's lathe matches the angled
          prop-lathe row in the walk view — see HallLathes.LATHE_YAW. Only the
          WALK view is angled: AT_LATHE/TURNING frame the lathe head-on (angle
          invisible) and SETUP keeps it axis-aligned so mount-point proximity
          stays in sync with the geometry. */}
      <Lathe position={[0, 0, 0]} rotation={[0, LATHE_YAW, 0]} defaultBlankVisible />
      {/* FPS walk controller — replaces OrbitControls in walk/lathe states */}
      <FPSCamera onMove={ctx.handlePlayerMove} onInteract={ctx.handleInteract} />
    </>
  );
}
