/**
 * DriveCenter — morse-taper spur center that grips and drives the blank.
 * Taper body + spurCount radial fins + center point.
 * All dimensions from spec.driveCenter.
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { bareSteel } from './materials.js';

interface DriveCenterProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const mat = bareSteel(spec.driveCenter.color);

export function DriveCenter({ position = [0, 0, 0], rotation = [0, 0, 0] }: DriveCenterProps) {
  const { diameter, length, spurCount, spurDepth, centerPointLength, spurLength, shaftRatio } = spec.driveCenter;

  const radius = diameter / 2;
  // Taper: shaft end diameter = face diameter * shaftRatio (from spec)
  const shaftRadius = radius * shaftRatio;

  // Centre of the taper body along X (lathe axis)
  const bodyX = 0;
  // Spurs are thin radial fins at the face (+X end) of the taper
  const spurWidth = spurDepth;
  const spurHeight = spurDepth * 1.5; // derived: fin thickness
  const spurY_base = length / 2; // fins at the +X face

  // Center point protrudes further in +X
  const pointX = length / 2 + centerPointLength / 2;

  const spurAngles: number[] = [];
  for (let i = 0; i < spurCount; i++) {
    spurAngles.push((i / spurCount) * Math.PI * 2);
  }

  return (
    <group position={position} rotation={rotation}>
      {/* Morse taper body — cone along X axis */}
      <mesh position={[bodyX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius, shaftRadius, length, 16]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* Spur fins — radial, at the face of the taper */}
      {spurAngles.map((angle, i) => (
        <mesh
          key={i}
          position={[
            spurY_base,
            Math.sin(angle) * spurLength / 2,
            Math.cos(angle) * spurLength / 2,
          ]}
          rotation={[angle, 0, 0]}
        >
          <boxGeometry args={[spurHeight, spurLength, spurWidth]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      ))}

      {/* Center point */}
      <mesh position={[pointX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0, radius * 0.15, centerPointLength, 8]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  );
}
