/**
 * ToolRestMesh — standalone grabbable tool rest (post + bar).
 *
 * Centred at local origin (base of post at Y=0), bar running along X.
 * Reuses ToolRest.tsx geometry and dims from spec.toolRest.
 * Oriented upright for bench display.
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { bareSteel } from '../lathe/materials.js';

interface ToolRestMeshProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const { postDiameter, postHeight, barLength, barDiameter } = spec.toolRest;
const mat = bareSteel(spec.toolRest.color);

export function ToolRestMesh({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: ToolRestMeshProps) {
  // Bar centre is at the top of the post + half bar diameter.
  const barCentreY = postHeight + barDiameter / 2;

  // Bar offset toward operator side (same convention as assembled lathe).
  const barZOffset = postDiameter / 2;

  return (
    <group position={position} rotation={rotation}>
      {/* Vertical post */}
      <mesh position={[0, postHeight / 2, 0]}>
        <cylinderGeometry args={[postDiameter / 2, postDiameter / 2, postHeight, 12]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* Horizontal rest bar — runs along X, sitting on top of post */}
      <mesh position={[0, barCentreY, barZOffset]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[barDiameter / 2, barDiameter / 2, barLength, 12]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  );
}
