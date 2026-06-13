import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { ToolPose, Vec3 } from '../core/types.js';
import type { InputAdapter } from './types.js';

/**
 * Maps raw hand landmarks to a ToolPose.
 * Exported for unit testing (pure function, no browser deps).
 */
export function landmarksToPose(
  wrist: Vec3,
  tip: Vec3,
  thumbTip: Vec3,
): ToolPose {
  // Position: midpoint of wrist and index-tip, mapped to world coords
  const midX = (wrist.x + tip.x) / 2;
  const midY = (wrist.y + tip.y) / 2;

  const position: Vec3 = {
    x: (1 - midX) * 0.3 - 0.15,
    y: (0.5 - midY) * 0.1,
    z: (midX - 0.5) * 0.2,
  };

  // angleX: pitch — atan2 using normalized landmark Y and Z coords
  const angleX = Math.atan2(tip.y - wrist.y, tip.z - wrist.z);

  // angleY: yaw
  const angleY = Math.atan2(tip.x - wrist.x, tip.z - wrist.z);

  // pressure: derived from thumb-index distance
  const dx = thumbTip.x - tip.x;
  const dy = thumbTip.y - tip.y;
  const dz = thumbTip.z - tip.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const pressure = dist < 0.05 ? 0.8 : 0;

  return { position, angleX, angleY, pressure };
}

/**
 * Tracks a pencil-shaped object via MediaPipe hand-landmark tracking.
 * The vector from wrist to index-tip approximates the pencil angle.
 */
export class CameraAdapter implements InputAdapter {
  readonly source = 'camera' as const;

  private pose: ToolPose | null = null;
  private stream: MediaStream | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private rafId: number | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ video: true });

    // Set up video element
    const video = document.createElement('video');
    video.srcObject = this.stream;
    video.playsInline = true;
    await video.play();
    this.video = video;

    // Init MediaPipe HandLandmarker
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
    );
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      numHands: 1,
      runningMode: 'VIDEO',
    });

    // Start detection loop
    const detect = (): void => {
      if (!this.handLandmarker || !this.video) return;

      const result = this.handLandmarker.detectForVideo(
        this.video,
        performance.now(),
      );

      if (result.landmarks.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const lms = result.landmarks[0]!;
        const wrist = lms[0];
        const tip = lms[8];
        const thumbTip = lms[4];

        if (wrist && tip && thumbTip) {
          this._setPose(landmarksToPose(wrist, tip, thumbTip));
        }
      }

      this.rafId = requestAnimationFrame(detect);
    };

    this.rafId = requestAnimationFrame(detect);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stream?.getTracks().forEach(t => {
      t.stop();
    });
    this.stream = null;
    this.video = null;
    this.handLandmarker?.close();
    this.handLandmarker = null;
    this.pose = null;
  }

  getLatestPose(): ToolPose | null {
    return this.pose;
  }

  /** Called by the detection loop to update the latest pose. */
  _setPose(pose: ToolPose): void {
    this.pose = pose;
  }
}
