import type { ToolPose } from '../core/types.js';
import type { InputAdapter } from './types.js';

/**
 * Translates mouse position + button state into a ToolPose.
 * Canvas is assumed to be the full viewport.
 */
export class MouseAdapter implements InputAdapter {
  readonly source = 'mouse' as const;

  private pose: ToolPose = {
    position: { x: 0, y: 0, z: 0 },
    angleX: 0.3,  // default bevel-contact angle
    angleY: 0,
    pressure: 0,
  };

  // ── Director tuning knob ───────────────────────────────────────────────────
  //
  // MOUSE_Y_SCALE — vertical range of pose.position.y (metres, rig-local).
  //
  //   The contact gate in PhysicsLoop fires when:
  //     TOOL_REST_ANCHOR_Y + pose.position.y  <=  blank_radius_at_station
  //   where TOOL_REST_ANCHOR_Y = -0.01 m and blank radius ≈ 0.05 m.
  //
  //   At MOUSE_Y_SCALE = 0.13, ny=+1 (mouse at top of screen) gives
  //   tipY = -0.01 + 0.13 = +0.12 m — comfortably ABOVE a 0.05 m blank.
  //   ny ≈ +0.46 (upper-middle area) puts tipY right at the blank surface
  //   so the player has clear travel above and into the cut.
  //
  //   Was 0.05 (too small — couldn't clear the blank top).  Raise to give
  //   room to present the tool above the wood before lowering it in.
  //   Tune here; also update TOOL_REST_ANCHOR_Y in PhysicsLoop.tsx if
  //   the rig or rest height changes.
  //
  private readonly MOUSE_Y_SCALE = 0.13; // TUNABLE — metres of Y travel per unit of ny

  private readonly onMove = (e: MouseEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;   // -1..1
    const ny = -(e.clientY / window.innerHeight) * 2 + 1;

    this.pose = {
      position: { x: nx * 0.15, y: ny * this.MOUSE_Y_SCALE, z: nx * 0.12 },
      angleX: 0.3 + ny * 0.2,
      angleY: nx * 0.2,
      pressure: this.pose.pressure,
    };
  };

  private readonly onDown = () => { this.pose = { ...this.pose, pressure: 0.8 }; };
  private readonly onUp   = () => { this.pose = { ...this.pose, pressure: 0 }; };

  start(): Promise<void> {
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mousedown', this.onDown);
    window.addEventListener('mouseup', this.onUp);
    return Promise.resolve();
  }

  stop(): void {
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('mouseup', this.onUp);
  }

  getLatestPose(): ToolPose {
    return this.pose;
  }
}
