import type { ToolKind, ToolPose } from '../../core/types.js';

interface ToolMeshProps {
  toolKind: ToolKind;
  pose: ToolPose;
}

export function ToolMesh({ toolKind, pose }: ToolMeshProps) {
  const px = pose.position.x;
  const py = pose.position.y;
  const pz = pose.position.z;

  return (
    <group
      position={[px, py, pz]}
      rotation={[pose.angleX, pose.angleY, 0]}
    >
      {/* Handle — warm brown wood */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.28, 12]} />
        <meshStandardMaterial color="#6B3A1F" roughness={0.8} metalness={0.0} />
      </mesh>

      {/* Tip shape — metal, varies by tool kind */}
      {toolKind === 'roughing-gouge' && (
        <mesh position={[0, 0.155, 0]}>
          <sphereGeometry args={[0.012, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#4a4a4a" roughness={0.4} metalness={0.6} />
        </mesh>
      )}

      {toolKind === 'spindle-gouge' && (
        <>
          {/* Longer, narrower flute — 0.06 m exposed */}
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.004, 0.006, 0.06, 12]} />
            <meshStandardMaterial color="#4a4a4a" roughness={0.4} metalness={0.6} />
          </mesh>
          {/* Fingernail-ground tip — narrow ellipsoid rotated slightly */}
          <mesh position={[0, 0.202, 0]} rotation={[0.25, 0, 0]}>
            <sphereGeometry args={[0.004, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#5a5a5a" roughness={0.3} metalness={0.7} />
          </mesh>
        </>
      )}

      {toolKind === 'parting-tool' && (
        <mesh position={[0, 0.148, 0]}>
          <boxGeometry args={[0.003, 0.016, 0.018]} />
          <meshStandardMaterial color="#4a4a4a" roughness={0.4} metalness={0.6} />
        </mesh>
      )}
    </group>
  );
}
