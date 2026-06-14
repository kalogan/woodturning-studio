import type { ToolKind, ToolPose } from '../../core/types.js';

// ─── Director tuning knobs ────────────────────────────────────────────────────
//
// TOOL_BASE_ROTATION — Euler [rx, ry, rz] in radians (XYZ order).
//
//   The tool geometry has its handle-to-tip axis along local +Y (tip at +Y end).
//   A real turner holds the tool roughly horizontal with the tip angled slightly
//   UP toward the spinning blank surface and the handle angled DOWN toward their
//   body (+Z = operator side).
//
//   rotateX(+PI/2) maps +Y → -Z  (tip now points toward -Z = into the blank
//                                   from the operator side)
//   subtract 0.25 rad           → tilts tip upward ~14° from horizontal so the
//                                   cutting edge reaches the blank surface rather
//                                   than pointing straight at the rest bar
//
//   Net: the tool lies nearly horizontal across the rest, tip presented to the
//   wood, handle angling back toward the operator and slightly downward.
//   Tune rx to raise/lower the tip; tune ry to sweep the tip left/right.
//
const TOOL_BASE_ROTATION: [number, number, number] = [
  Math.PI / 2 - 0.25, // ~1.32 rad — nearly horizontal, tip tilted up ~14°
  0,
  0,
];
// ─────────────────────────────────────────────────────────────────────────────

interface ToolMeshProps {
  toolKind: ToolKind;
  pose: ToolPose;
  /**
   * Mouse cursor-follow mode: the tool body CENTRE tracks the cursor. The mouse
   * path stores the station along the blank (world X) in pose.z and the height in
   * pose.y, so we render at local (pose.z, pose.y, 0) — depth fixed at the rest —
   * which places the handle centre exactly under the cursor. The hand/camera path
   * leaves this false and maps the pose straight to local x/y/z as before.
   */
  cursorFollowMode?: boolean;
}

export function ToolMesh({ toolKind, pose, cursorFollowMode = false }: ToolMeshProps) {
  const px = cursorFollowMode ? pose.position.z : pose.position.x;
  const py = pose.position.y;
  const pz = cursorFollowMode ? 0 : pose.position.z;

  // Compose pose technique-modulation angles ON TOP of the base orientation.
  // pose.angleX/angleY are small (~±0.2 rad) and represent the turner adjusting
  // bevel angle and sweep — they ride on top of the base frame established above.
  const rx = TOOL_BASE_ROTATION[0] + pose.angleX;
  const ry = TOOL_BASE_ROTATION[1] + pose.angleY;
  const rz = TOOL_BASE_ROTATION[2];

  return (
    <group
      position={[px, py, pz]}
      rotation={[rx, ry, rz]}
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
