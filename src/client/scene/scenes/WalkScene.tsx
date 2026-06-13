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

import { Lighting, Room, Furniture } from '../../workshop/index.js';
import { Lathe } from '../../lathe/index.js';
import { FPSCamera } from '../FPSCamera.js';
import type { SceneCtx } from '../sceneCtx.js';

interface Props { ctx: SceneCtx }

export function WalkScene({ ctx }: Props) {
  return (
    <>
      <Lighting />
      <Room />
      <Furniture />
      {/* Lathe is floor-standing; its own stand provides working height */}
      <Lathe position={[0, 0, 0]} defaultBlankVisible />
      {/* FPS walk controller — replaces OrbitControls in walk/lathe states */}
      <FPSCamera onMove={ctx.handlePlayerMove} onInteract={ctx.handleInteract} />
    </>
  );
}
