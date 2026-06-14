/**
 * SpurDriveCenterMesh — standalone grabbable spur drive centre.
 *
 * Centred at its local origin (so it can rest flat on a bench, or be held
 * in hand).  Reuses the same geometry logic as DriveCenter.tsx but with
 * the taper axis running along Y (upright on bench = centre spur points up)
 * and the whole part scaled to sit in a bench slot.
 *
 * In the assembled lathe the spur axis is X; here we keep it Y so it reads
 * recognisably "resting on a shelf" (tapered end up, morse taper down).
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { bareSteel } from '../lathe/materials.js';

interface SpurDriveCenterMeshProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const mat = bareSteel(spec.driveCenter.color);

export function SpurDriveCenterMesh({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: SpurDriveCenterMeshProps) {
  const {
    diameter,
    length,
    spurCount,
    spurDepth,
    centerPointLength,
    spurLength,
    shaftRatio,
  } = spec.driveCenter;

  const radius = diameter / 2;
  const shaftRadius = radius * shaftRatio;

  // Part rests on bench with taper pointing upward along +Y.
  // Body centre at Y = length/2 (bottom of taper at Y=0).
  const bodyY = length / 2;

  // Spur fins sit at the top face (+Y end) of the taper body.
  const spursY = length;

  // Center point protrudes above the spur face.
  const pointY = length + centerPointLength / 2;

  const spurAngles: number[] = [];
  for (let i = 0; i < spurCount; i++) {
    spurAngles.push((i / spurCount) * Math.PI * 2);
  }

  return (
    <group position={position} rotation={rotation}>
      {/* Morse taper body — Y axis, wide end at bottom */}
      <mesh position={[0, bodyY, 0]}>
        <cylinderGeometry args={[radius, shaftRadius, length, 16]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* Spur fins — radial, at the top face */}
      {spurAngles.map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.sin(angle) * (spurLength / 2),
            spursY,
            Math.cos(angle) * (spurLength / 2),
          ]}
          rotation={[0, angle, 0]}
        >
          <boxGeometry args={[spurDepth * 1.5, spurDepth, spurLength]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      ))}

      {/* Center point — cone above the spurs */}
      <mesh position={[0, pointY, 0]}>
        <cylinderGeometry args={[0, radius * 0.15, centerPointLength, 8]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  );
}
