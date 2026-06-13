export type { ToolPose } from '../core/types.js';

export type InputSource = 'camera' | 'mouse';

export interface InputAdapter {
  readonly source: InputSource;
  /** Start producing ToolPose values. */
  start(): Promise<void>;
  stop(): void;
  /** Returns the latest pose, or null if not yet tracking. */
  getLatestPose(): import('../core/types.js').ToolPose | null;
}
