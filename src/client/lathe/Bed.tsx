/**
 * Bed — the cast-iron foundation of the Jet JWL-1642EVS.
 * Two parallel ways on top of a base slab, driven entirely by spec.bed fields.
 * Includes the red JET logo plate badge on the front face of the slab.
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { darkCastIron } from './materials.js';

interface BedProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const mat = darkCastIron(spec.bed.color);

export function Bed({ position = [0, 0, 0], rotation = [0, 0, 0] }: BedProps) {
  const { length, wayCount, wayWidth, wayGap, wayHeight, thickness, logoPlate } = spec.bed;

  // Base slab — centred at local origin; ways sit on top
  const slabY = 0;
  const wayY = slabY + thickness / 2 + wayHeight / 2;

  // Total span of ways: wayCount ways each wayWidth wide, separated by wayGap
  const totalWaySpan = (wayCount - 1) * (wayWidth + wayGap);
  const wayOffsets: number[] = [];
  for (let i = 0; i < wayCount; i++) {
    wayOffsets.push(-totalWaySpan / 2 + i * (wayWidth + wayGap));
  }

  // Bed slab depth in Z
  const slabDepth = wayWidth * wayCount + wayGap * (wayCount - 1) + wayWidth;

  // JET logo plate — centred along X, mounted on the front (+Z) face of the slab
  const logoZ = slabDepth / 2 + 0.003; // just proud of the slab face
  const logoY = 0; // centred vertically on slab

  return (
    <group position={position} rotation={rotation}>
      {/* Base slab */}
      <mesh position={[0, slabY, 0]}>
        <boxGeometry args={[length, thickness, slabDepth]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* Parallel ways */}
      {wayOffsets.map((zOff, i) => (
        <mesh key={i} position={[0, wayY, zOff]}>
          <boxGeometry args={[length, wayHeight, wayWidth]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      ))}

      {/* JET logo plate — red badge centred on the front face */}
      <mesh position={[0, logoY, logoZ]}>
        <boxGeometry args={[logoPlate.width, logoPlate.height, 0.004]} />
        <meshStandardMaterial
          color={logoPlate.color}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}
