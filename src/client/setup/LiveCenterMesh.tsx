/**
 * LiveCenterMesh — standalone grabbable live centre.
 *
 * Centred at local origin, taper pointing upward along +Y (resting on bench).
 * Reuses LiveCenter.tsx geometry but oriented for bench display.
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { bareSteel } from '../lathe/materials.js';

interface LiveCenterMeshProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const mat = bareSteel(spec.liveCenter.color);

export function LiveCenterMesh({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: LiveCenterMeshProps) {
  const { diameter, length, pointAngleDeg, bodyDiameter, shaftRatio } = spec.liveCenter;

  const bodyRadius = bodyDiameter / 2;
  const faceRadius = diameter / 2;
  const shaftRadius = faceRadius * shaftRatio;

  // Cone point height from half-angle geometry
  const halfAngleRad = (pointAngleDeg / 2) * (Math.PI / 180);
  const pointHeight = faceRadius / Math.tan(halfAngleRad);

  // Body centre at Y = length/2 (bottom of taper at Y=0); point protrudes upward.
  const bodyY = length / 2;
  const pointY = length + pointHeight / 2;

  return (
    <group position={position} rotation={rotation}>
      {/* Main taper body — Y axis, wide end at bottom */}
      <mesh position={[0, bodyY, 0]}>
        <cylinderGeometry args={[bodyRadius, shaftRadius, length, 16]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* Rotating cone point — protrudes upward */}
      <mesh position={[0, pointY, 0]}>
        {/* tip at top (+Y), base at bottom */}
        <cylinderGeometry args={[0, faceRadius, pointHeight, 16]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  );
}
