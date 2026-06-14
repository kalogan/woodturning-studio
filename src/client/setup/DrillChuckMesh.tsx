/**
 * DrillChuckMesh — standalone Jacobs drill chuck decoy accessory.
 *
 * A knurled cylinder body tapering to 3 converging jaws at the business end.
 * Origin at the bottom (morse-taper end); chuck body points upward (+Y).
 * Dimensions are reasonable for a small lathe drill chuck (~50mm body).
 */
import { bareSteel, darkCastIron } from '../lathe/materials.js';

interface DrillChuckMeshProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

// Drill chuck dimensions (approx Jacobs 1-13mm chuck)
const BODY_RADIUS_BASE = 0.028;   // bottom (taper end, smaller)
const BODY_RADIUS_TOP  = 0.022;   // top (nose end, slightly smaller)
const BODY_HEIGHT = 0.06;         // body length

// Knurl ring bands (3 decorative rings on body)
const KNURL_RING_COUNT = 3;
const KNURL_RING_HEIGHT = 0.004;
const KNURL_RING_EXTRA_RADIUS = 0.0015;

// Nose/jaw section
const NOSE_HEIGHT = 0.022;        // length of nose taper
const NOSE_RADIUS_BASE = 0.018;
const NOSE_RADIUS_TIP  = 0.008;   // pinches toward 3 converging jaws

// 3 jaw slivers (thin wedges poking out of the nose)
const JAW_COUNT = 3;
const JAW_WIDTH = 0.004;
const JAW_HEIGHT = 0.014;
const JAW_DEPTH = 0.005;
const JAW_RADIUS_OFFSET = 0.006;

const bodyMat = darkCastIron('#3a3a3a');
const steelMat = bareSteel('#5a5a5a');

export function DrillChuckMesh({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: DrillChuckMeshProps) {
  // Knurl ring positions spread evenly along the body
  const knurlPositions: number[] = [];
  for (let i = 0; i < KNURL_RING_COUNT; i++) {
    knurlPositions.push(BODY_HEIGHT * ((i + 1) / (KNURL_RING_COUNT + 1)));
  }

  const jawAngles: number[] = [];
  for (let i = 0; i < JAW_COUNT; i++) {
    jawAngles.push((i / JAW_COUNT) * Math.PI * 2);
  }

  const noseBaseY = BODY_HEIGHT;
  const noseCentreY = noseBaseY + NOSE_HEIGHT / 2;
  const jawY = noseBaseY + NOSE_HEIGHT + JAW_HEIGHT / 2;

  return (
    <group position={position} rotation={rotation}>
      {/* Chuck body — slightly tapered cylinder */}
      <mesh position={[0, BODY_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[BODY_RADIUS_TOP, BODY_RADIUS_BASE, BODY_HEIGHT, 20]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* Knurl bands — slightly wider rings */}
      {knurlPositions.map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <cylinderGeometry
            args={[
              BODY_RADIUS_TOP + KNURL_RING_EXTRA_RADIUS,
              BODY_RADIUS_TOP + KNURL_RING_EXTRA_RADIUS,
              KNURL_RING_HEIGHT,
              20,
            ]}
          />
          <meshStandardMaterial {...steelMat} />
        </mesh>
      ))}

      {/* Nose taper — narrows toward the jaw tips */}
      <mesh position={[0, noseCentreY, 0]}>
        <cylinderGeometry args={[NOSE_RADIUS_TIP, NOSE_RADIUS_BASE, NOSE_HEIGHT, 16]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* 3 converging jaw slivers at nose tip */}
      {jawAngles.map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.sin(angle) * JAW_RADIUS_OFFSET,
            jawY,
            Math.cos(angle) * JAW_RADIUS_OFFSET,
          ]}
          rotation={[0, angle, 0]}
        >
          <boxGeometry args={[JAW_WIDTH, JAW_HEIGHT, JAW_DEPTH]} />
          <meshStandardMaterial {...steelMat} />
        </mesh>
      ))}
    </group>
  );
}
