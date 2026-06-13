/**
 * Banjo — low, chunky cast-iron clamping block that straddles the bed ways
 * and accepts the tool-rest post. All dimensions from spec.banjo.
 *
 * The block sits centred over the ways (Z=0 in machine space), with its top
 * surface flush to or slightly above the way tops.  A vertical post bore runs
 * through the centre.  Two angled lock levers (cam handles) point toward the
 * operator (+Z) and slightly downward — one to clamp the banjo to the bed,
 * one to lock the tool-rest post height.
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { darkCastIron, blackRubber } from './materials.js';

interface BanjoProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const blockMat  = darkCastIron(spec.banjo.color);
const leverMat  = blackRubber();

// Lever geometry derived from clampBoltDiameter
const LEVER_RADIUS   = spec.banjo.clampBoltDiameter / 2;        // 0.008 m
const LEVER_LENGTH   = spec.banjo.clampBoltDiameter * 5.5;      // ~0.088 m
const KNOB_RADIUS    = spec.banjo.clampBoltDiameter * 0.9;      // ~0.0144 m
// Angle below horizontal toward operator (radians)
const LEVER_TILT     = Math.PI / 6;   // 30°

export function Banjo({ position = [0, 0, 0], rotation = [0, 0, 0] }: BanjoProps) {
  const { width, depth, height, postHoleDiameter } = spec.banjo;

  // ── Lock levers ─────────────────────────────────────────────────────────────
  // Both levers emerge from the front face (+Z side) of the block, angled
  // downward at LEVER_TILT.  We place them offset in X so they don't overlap.
  //
  // A lever is a cylinder whose LOCAL Y-axis runs along its length. We rotate
  // it so it points +Z and down: rotation about X by -(PI/2 - LEVER_TILT).
  const leverAngleX = -(Math.PI / 2 - LEVER_TILT);   // tilts rod toward +Z and down

  // Single lock lever: centred on the block front face
  const bedClampLeverY = height * 0.5;
  const bedClampLeverZ = depth / 2;   // front face

  // Lever tip offset in local space (end of cylinder relative to mount)
  // cylinder is centred at half its length along its axis
  const leverTipZOffset  =  Math.cos(LEVER_TILT) * LEVER_LENGTH;
  const leverTipYOffset  = -Math.sin(LEVER_TILT) * LEVER_LENGTH;

  return (
    <group position={position} rotation={rotation}>
      {/* ── Main cast block ─────────────────────────────────────────── */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial {...blockMat} />
      </mesh>

      {/* ── Post hole indicator — dark inset cylinder ─────────────── */}
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry
          args={[postHoleDiameter / 2, postHoleDiameter / 2, height + 0.001, 10]}
        />
        <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* ── Single lock lever ───────────────────────────────────────── */}
      <group position={[0, bedClampLeverY, bedClampLeverZ]}>
        {/* Rod */}
        <mesh
          position={[
            0,
            (Math.sin(LEVER_TILT) * LEVER_LENGTH) / 2,
            (Math.cos(LEVER_TILT) * LEVER_LENGTH) / 2,
          ]}
          rotation={[leverAngleX, 0, 0]}
        >
          <cylinderGeometry args={[LEVER_RADIUS, LEVER_RADIUS, LEVER_LENGTH, 8]} />
          <meshStandardMaterial {...leverMat} />
        </mesh>
        {/* Knob at tip */}
        <mesh
          position={[
            0,
            leverTipYOffset / 2,
            leverTipZOffset / 2,
          ]}
        >
          <sphereGeometry args={[KNOB_RADIUS, 8, 8]} />
          <meshStandardMaterial {...leverMat} />
        </mesh>
      </group>
    </group>
  );
}
