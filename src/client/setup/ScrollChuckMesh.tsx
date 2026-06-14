/**
 * ScrollChuckMesh — standalone 4-jaw scroll chuck decoy accessory.
 *
 * A cylindrical chuck body with 4 radial jaws on the face.
 * Dimensions are reasonable for a mid-size lathe scroll chuck (~120mm dia).
 * Origin at bottom face of chuck body (sits flat on bench).
 */
import { darkCastIron, bareSteel, blackRubber } from '../lathe/materials.js';

interface ScrollChuckMeshProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

// Chuck body dimensions (reasonable for a 4" scroll chuck)
const BODY_RADIUS = 0.06;      // 120mm diameter
const BODY_HEIGHT = 0.055;     // 55mm tall

// Jaw dimensions
const JAW_COUNT = 4;
const JAW_WIDTH = 0.014;
const JAW_HEIGHT = 0.018;
const JAW_DEPTH = 0.028;
const JAW_RADIUS_OFFSET = BODY_RADIUS * 0.55; // how far from centre each jaw sits

// Scroll ring (decorative band around the face)
const SCROLL_RING_RADIUS = BODY_RADIUS * 0.85;
const SCROLL_RING_HEIGHT = 0.006;

// Key hole pegs around the periphery (3 holes for chuck key, decorative)
const KEY_HOLE_COUNT = 3;
const KEY_PEG_RADIUS = 0.006;
const KEY_PEG_HEIGHT = 0.008;

const bodyMat = darkCastIron('#2e2e2e');
const jawMat = bareSteel('#5a5a5a');
const scrollMat = bareSteel('#888');
const keyMat = blackRubber();

export function ScrollChuckMesh({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: ScrollChuckMeshProps) {
  const jawAngles: number[] = [];
  for (let i = 0; i < JAW_COUNT; i++) {
    jawAngles.push((i / JAW_COUNT) * Math.PI * 2);
  }

  const keyAngles: number[] = [];
  for (let i = 0; i < KEY_HOLE_COUNT; i++) {
    keyAngles.push((i / KEY_HOLE_COUNT) * Math.PI * 2 + Math.PI / 6);
  }

  return (
    <group position={position} rotation={rotation}>
      {/* Main chuck body cylinder */}
      <mesh position={[0, BODY_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[BODY_RADIUS, BODY_RADIUS * 1.05, BODY_HEIGHT, 32]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* Scroll ring on the face */}
      <mesh position={[0, BODY_HEIGHT + SCROLL_RING_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[SCROLL_RING_RADIUS, SCROLL_RING_RADIUS, SCROLL_RING_HEIGHT, 32]} />
        <meshStandardMaterial {...scrollMat} />
      </mesh>

      {/* 4 radial jaws on the face */}
      {jawAngles.map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.sin(angle) * JAW_RADIUS_OFFSET,
            BODY_HEIGHT + JAW_HEIGHT / 2,
            Math.cos(angle) * JAW_RADIUS_OFFSET,
          ]}
          rotation={[0, angle, 0]}
        >
          <boxGeometry args={[JAW_WIDTH, JAW_HEIGHT, JAW_DEPTH]} />
          <meshStandardMaterial {...jawMat} />
        </mesh>
      ))}

      {/* Chuck key holes around periphery (decorative pegs) */}
      {keyAngles.map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.sin(angle) * (BODY_RADIUS - 0.008),
            BODY_HEIGHT * 0.6,
            Math.cos(angle) * (BODY_RADIUS - 0.008),
          ]}
        >
          <cylinderGeometry args={[KEY_PEG_RADIUS, KEY_PEG_RADIUS, KEY_PEG_HEIGHT, 8]} />
          <meshStandardMaterial {...keyMat} />
        </mesh>
      ))}
    </group>
  );
}
