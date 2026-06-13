import { describe, it, expect } from 'vitest';
import { landmarksToPose } from './cameraAdapter.js';

describe('landmarksToPose', () => {
  it('angleX is negative when tip is above wrist (tip.y < wrist.y in normalized coords)', () => {
    // In normalized video coords, y=0 is top. A tip that is visually higher has a smaller y value.
    const wrist = { x: 0.5, y: 0.5, z: 0 };
    const tip = { x: 0.5, y: 0.2, z: 0 }; // tip is "higher" (smaller y)
    const thumbTip = { x: 0.9, y: 0.9, z: 0 }; // far from tip

    const pose = landmarksToPose(wrist, tip, thumbTip);

    // atan2(tip.y - wrist.y, tip.z - wrist.z) = atan2(-0.3, 0) = -PI/2 (negative)
    expect(pose.angleX).toBeLessThan(0);
  });

  it('pressure is 0.8 when thumb is close to index tip (distance < 0.05)', () => {
    const wrist = { x: 0.5, y: 0.7, z: 0 };
    const tip = { x: 0.5, y: 0.3, z: 0 };
    // thumbTip very close to tip
    const thumbTip = { x: 0.502, y: 0.302, z: 0 };

    const pose = landmarksToPose(wrist, tip, thumbTip);

    expect(pose.pressure).toBe(0.8);
  });

  it('pressure is 0 when thumb is far from index tip (distance >= 0.05)', () => {
    const wrist = { x: 0.5, y: 0.7, z: 0 };
    const tip = { x: 0.5, y: 0.3, z: 0 };
    // thumbTip far from tip
    const thumbTip = { x: 0.8, y: 0.8, z: 0 };

    const pose = landmarksToPose(wrist, tip, thumbTip);

    expect(pose.pressure).toBe(0);
  });

  it('position maps midpoint through the expected transform', () => {
    const wrist = { x: 0.5, y: 0.5, z: 0 };
    const tip = { x: 0.5, y: 0.5, z: 0 };
    const thumbTip = { x: 0.9, y: 0.9, z: 0 };

    const pose = landmarksToPose(wrist, tip, thumbTip);

    // midX = 0.5, midY = 0.5
    // x = (1 - 0.5) * 0.3 - 0.15 = 0
    // y = (0.5 - 0.5) * 0.1 = 0
    // z = (0.5 - 0.5) * 0.2 = 0
    expect(pose.position.x).toBeCloseTo(0);
    expect(pose.position.y).toBeCloseTo(0);
    expect(pose.position.z).toBeCloseTo(0);
  });
});
