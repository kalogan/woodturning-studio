/**
 * FaceplateMesh — standalone faceplate decoy accessory.
 *
 * A flat disc with a threaded-bore centre hub and a ring of mounting bolt
 * holes, lying flat (face up, +Y) at local origin.
 * Dims from spec.faceplate.
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { darkCastIron } from '../lathe/materials.js';

interface FaceplateMeshProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const { diameter, thickness, boltCircleDiameter, boltCount, color } = spec.faceplate;
const mat = darkCastIron(color);

// Bolt hole peg geometry (small raised nubs to represent bolt positions)
const boltPegRadius = 0.005;
const boltPegHeight = thickness * 0.6;
const boltRadius = boltCircleDiameter / 2;

// Centre hub (raised ring around spindle thread bore)
const hubRadius = 0.025;
const hubHeight = thickness * 0.8;

export function FaceplateMesh({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: FaceplateMeshProps) {
  const discRadius = diameter / 2;
  const discY = thickness / 2; // disc centred so bottom face at Y=0

  const boltAngles: number[] = [];
  for (let i = 0; i < boltCount; i++) {
    boltAngles.push((i / boltCount) * Math.PI * 2);
  }

  return (
    <group position={position} rotation={rotation}>
      {/* Main disc — flat, face up */}
      <mesh position={[0, discY, 0]}>
        <cylinderGeometry args={[discRadius, discRadius, thickness, 32]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* Centre hub — raised ring representing the threaded spindle bore area */}
      <mesh position={[0, thickness + hubHeight / 2, 0]}>
        <cylinderGeometry args={[hubRadius, hubRadius * 1.2, hubHeight, 16]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* Bolt position pegs on bolt circle */}
      {boltAngles.map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.sin(angle) * boltRadius,
            thickness + boltPegHeight / 2,
            Math.cos(angle) * boltRadius,
          ]}
        >
          <cylinderGeometry args={[boltPegRadius, boltPegRadius, boltPegHeight, 8]} />
          <meshStandardMaterial color="#555" roughness={0.4} metalness={0.7} />
        </mesh>
      ))}
    </group>
  );
}
