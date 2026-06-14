/**
 * PowerPlugMesh — standalone mains power plug on a short cable.
 *
 * A chunky rectangular plug body with two rectangular prong recesses on the
 * face, plus a short cable stub below.
 * Origin at the bottom of the cable stub; plug body above, face pointing up.
 * Dimensions represent a NEMA 5-15 style 3-prong plug (~5 cm body).
 */
import { blackRubber, bareSteel } from '../lathe/materials.js';

interface PowerPlugMeshProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

// Plug body
const BODY_WIDTH  = 0.045;
const BODY_HEIGHT = 0.05;
const BODY_DEPTH  = 0.025;

// Cable stub (round, below plug body)
const CABLE_RADIUS = 0.008;
const CABLE_LENGTH = 0.06;

// Prong pegs (two flat blades + one ground pin)
const BLADE_WIDTH  = 0.006;
const BLADE_HEIGHT = 0.014;
const BLADE_DEPTH  = 0.003;
const BLADE_OFFSET_X = 0.01;   // half-spacing between the two blade slots
const BLADE_Y_ABOVE_BODY = BLADE_HEIGHT / 2;

const GROUND_RADIUS = 0.003;
const GROUND_HEIGHT = 0.01;

const rubberMat = blackRubber();
const steelMat  = bareSteel('#b0a080');  // warm brass-ish colour for prongs

export function PowerPlugMesh({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: PowerPlugMeshProps) {
  // Cable bottom at Y=0; cable stub runs from Y=0 to Y=CABLE_LENGTH
  const cableY = CABLE_LENGTH / 2;

  // Plug body bottom at top of cable stub
  const bodyBottomY = CABLE_LENGTH;
  const bodyCentreY = bodyBottomY + BODY_HEIGHT / 2;

  // Prongs protrude above top face of plug body
  const bodyTopY = bodyBottomY + BODY_HEIGHT;
  const bladeY   = bodyTopY + BLADE_Y_ABOVE_BODY;
  const groundY  = bodyTopY + GROUND_HEIGHT / 2;

  return (
    <group position={position} rotation={rotation}>
      {/* Cable stub */}
      <mesh position={[0, cableY, 0]}>
        <cylinderGeometry args={[CABLE_RADIUS, CABLE_RADIUS, CABLE_LENGTH, 10]} />
        <meshStandardMaterial {...rubberMat} />
      </mesh>

      {/* Plug body */}
      <mesh position={[0, bodyCentreY, 0]}>
        <boxGeometry args={[BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH]} />
        <meshStandardMaterial {...rubberMat} />
      </mesh>

      {/* Left blade prong */}
      <mesh position={[-BLADE_OFFSET_X, bladeY, 0]}>
        <boxGeometry args={[BLADE_WIDTH, BLADE_HEIGHT, BLADE_DEPTH]} />
        <meshStandardMaterial {...steelMat} />
      </mesh>

      {/* Right blade prong */}
      <mesh position={[BLADE_OFFSET_X, bladeY, 0]}>
        <boxGeometry args={[BLADE_WIDTH, BLADE_HEIGHT, BLADE_DEPTH]} />
        <meshStandardMaterial {...steelMat} />
      </mesh>

      {/* Ground pin (round, centred, slightly recessed below blades) */}
      <mesh position={[0, groundY, 0]}>
        <cylinderGeometry args={[GROUND_RADIUS, GROUND_RADIUS, GROUND_HEIGHT, 8]} />
        <meshStandardMaterial {...steelMat} />
      </mesh>
    </group>
  );
}
