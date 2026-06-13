/**
 * Tailstock — right-end housing with extendable quill, handwheel, and lock handles.
 * All dimensions from spec.tailstock.
 * quillExtension prop (0..1) translates the quill outward by up to quillTravel.
 *
 * Details added for JWL-1642EVS:
 *  - Two lock handles (quill lock + tailstock body lock) — small dark lever cylinders
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { paintedCastIron, bareSteel, blackRubber } from './materials.js';

interface TailstockProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** 0 = retracted, 1 = fully extended */
  quillExtension?: number;
}

const bodyMat = paintedCastIron(spec.tailstock.color);
const steelMat = bareSteel();
const rubberMat = blackRubber();

export function Tailstock({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  quillExtension = 0,
}: TailstockProps) {
  const {
    width,
    height,
    depth,
    quillDiameter,
    quillTravel,
    quillLength,
    handwheelDiameter,
    handwheelThickness,
    lockKnobDiameter,
    lockKnobLength,
  } = spec.tailstock;

  const bodyY = height / 2;

  // Quill: runs along X axis (lathe axis), emerges from the -X (left) face
  const quillBaseX = -(width / 2); // left face
  const quillExtendX = -quillExtension * quillTravel;

  // Handwheel at the back (+X face) of the body
  const handwheelX = width / 2 + handwheelThickness / 2;

  // Quill lock knob — on front (+Z) face, upper area
  const quillLockZ = depth / 2 + lockKnobLength / 2;
  const quillLockY = bodyY + height * 0.1;

  // Tailstock body lock lever — on the bottom front, angled down
  const bodyLockZ = depth / 2 + lockKnobLength * 0.6;
  const bodyLockY = bodyY - height * 0.25;

  return (
    <group position={position} rotation={rotation}>
      {/* Main body box */}
      <mesh position={[0, bodyY, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* Quill cylinder — translates based on quillExtension */}
      <mesh
        position={[quillBaseX - quillLength / 2 + quillExtendX, height / 2, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[quillDiameter / 2, quillDiameter / 2, quillLength, 12]} />
        <meshStandardMaterial {...steelMat} />
      </mesh>

      {/* Handwheel */}
      <mesh
        position={[handwheelX, bodyY, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[handwheelDiameter / 2, handwheelDiameter / 2, handwheelThickness, 24]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* Quill lock lever — protruding from front face */}
      <mesh
        position={[width * 0.1, quillLockY, quillLockZ]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[lockKnobDiameter / 2, lockKnobDiameter / 2, lockKnobLength, 10]} />
        <meshStandardMaterial {...rubberMat} />
      </mesh>

      {/* Tailstock body lock lever — slightly lower, also front face */}
      <mesh
        position={[-width * 0.1, bodyLockY, bodyLockZ]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[lockKnobDiameter / 2, lockKnobDiameter / 2, lockKnobLength, 10]} />
        <meshStandardMaterial {...rubberMat} />
      </mesh>
    </group>
  );
}
