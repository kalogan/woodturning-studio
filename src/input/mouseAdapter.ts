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

  private readonly onMove = (e: MouseEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;   // -1..1
    const ny = -(e.clientY / window.innerHeight) * 2 + 1;

    this.pose = {
      position: { x: nx * 0.15, y: ny * 0.05, z: nx * 0.12 },
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
