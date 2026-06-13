/**
 * LiveCenter — rotating tailstock center that supports the blank's right end.
 * Taper body + rotating cone point. All dimensions from spec.liveCenter.
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { bareSteel } from './materials.js';

interface LiveCenterProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const mat = bareSteel(spec.liveCenter.color);

export function LiveCenter({ position = [0, 0, 0], rotation = [0, 0, 0] }: LiveCenterProps) {
  const { diameter, length, pointAngleDeg, bodyDiameter, shaftRatio } = spec.liveCenter;

  const bodyRadius = bodyDiameter / 2;
  const faceRadius = diameter / 2;
  // Taper shaft end = face diameter * shaftRatio (from spec)
  const shaftRadius = faceRadius * shaftRatio;

  // Point cone height derived from point angle and face radius
  // half-angle = pointAngleDeg / 2, so height = radius / tan(halfAngle)
  const halfAngleRad = (pointAngleDeg / 2) * (Math.PI / 180);
  const pointHeight = faceRadius / Math.tan(halfAngleRad);

  const pointX = length / 2 + pointHeight / 2;

  return (
    <group position={position} rotation={rotation}>
      {/* Main taper body — along X axis */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyRadius, shaftRadius, length, 16]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* Rotating cone point — protrudes in +X */}
      <mesh position={[pointX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        {/* Base of cone at -pointHeight/2, tip at +pointHeight/2 along Y before rotation */}
        <cylinderGeometry args={[0, faceRadius, pointHeight, 16]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  );
}
