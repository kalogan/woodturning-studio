/**
 * ToolBench — a simple workshop workbench surface with all 7 Lesson-0
 * accessories arranged in a row on top.
 *
 * Layout: 7 slots equally spaced along the bench top (X axis), centred at X=0.
 * Each slot has a KNOWN local offset exported via `benchSlotPosition(index)`.
 *
 * A later interaction slice can place proximity targets at each slot by calling
 * benchSlotPosition(i) and offsetting by the bench world position.
 *
 * Props:
 *   position — world position of the bench centre (default origin)
 *
 * Slot order matches ACCESSORY_IDS (7 items):
 *   0: spur-drive-center
 *   1: live-center
 *   2: tool-rest
 *   3: power-plug
 *   4: faceplate
 *   5: scroll-chuck
 *   6: drill-chuck
 */
import { ACCESSORY_REGISTRY } from './AccessoryMesh.js';
import { workshopWood, darkCastIron } from '../lathe/materials.js';

interface ToolBenchProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

// Bench surface dimensions
const BENCH_LENGTH = 1.4;   // spans 7 accessories with comfortable spacing
const BENCH_DEPTH  = 0.5;
const BENCH_HEIGHT = 0.04;  // top surface slab thickness

// Leg dimensions
const LEG_WIDTH     = 0.06;
const LEG_HEIGHT    = 0.85; // typical shop bench height ~900mm total (slab + legs)
const LEG_DEPTH     = 0.06;

// Top slab sits on the legs; local Y=0 is the floor under the bench.
// Accessories rest on top of the slab at Y = LEG_HEIGHT + BENCH_HEIGHT.
const SLAB_CENTRE_Y = LEG_HEIGHT + BENCH_HEIGHT / 2;

// Slot layout
const SLOT_COUNT   = 7;
const SLOT_SPACING = BENCH_LENGTH / (SLOT_COUNT + 1); // equal gap on each end

// Slot Y: accessories rest ON TOP of the slab surface.
const SLOT_SURFACE_Y = LEG_HEIGHT + BENCH_HEIGHT;

/**
 * Returns the local-space position of bench slot `index` (0-based, left to right).
 * The position is the point ON the bench surface where the accessory origin sits.
 * A proximity target should be placed at bench.position + benchSlotPosition(i).
 */
export function benchSlotPosition(index: number): [number, number, number] {
  // Slots are evenly spaced along X, centred on the bench (X=0 at bench centre).
  const x = -BENCH_LENGTH / 2 + SLOT_SPACING * (index + 1);
  return [x, SLOT_SURFACE_Y, 0];
}

/** Ordered list of all accessory ids as they appear left-to-right on the bench. */
export const BENCH_ACCESSORY_IDS: string[] = [
  'spur-drive-center',
  'live-center',
  'tool-rest',
  'power-plug',
  'faceplate',
  'scroll-chuck',
  'drill-chuck',
];

const slabMat  = workshopWood('#8B5E3C');
const legMat   = workshopWood('#7a5230');
const viseScrew = darkCastIron();

// Leg X positions (two legs, symmetric)
const LEG_X_OFFSET = BENCH_LENGTH / 2 - LEG_WIDTH / 2 - 0.05;
const LEG_Y_CENTRE = LEG_HEIGHT / 2;

export function ToolBench({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: ToolBenchProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* ── Bench structure ─────────────────────────────────────────────── */}

      {/* Top slab */}
      <mesh position={[0, SLAB_CENTRE_Y, 0]}>
        <boxGeometry args={[BENCH_LENGTH, BENCH_HEIGHT, BENCH_DEPTH]} />
        <meshStandardMaterial {...slabMat} />
      </mesh>

      {/* Front-left leg */}
      <mesh position={[-LEG_X_OFFSET, LEG_Y_CENTRE, BENCH_DEPTH / 2 - LEG_DEPTH / 2]}>
        <boxGeometry args={[LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH]} />
        <meshStandardMaterial {...legMat} />
      </mesh>

      {/* Front-right leg */}
      <mesh position={[LEG_X_OFFSET, LEG_Y_CENTRE, BENCH_DEPTH / 2 - LEG_DEPTH / 2]}>
        <boxGeometry args={[LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH]} />
        <meshStandardMaterial {...legMat} />
      </mesh>

      {/* Back-left leg */}
      <mesh position={[-LEG_X_OFFSET, LEG_Y_CENTRE, -(BENCH_DEPTH / 2 - LEG_DEPTH / 2)]}>
        <boxGeometry args={[LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH]} />
        <meshStandardMaterial {...legMat} />
      </mesh>

      {/* Back-right leg */}
      <mesh position={[LEG_X_OFFSET, LEG_Y_CENTRE, -(BENCH_DEPTH / 2 - LEG_DEPTH / 2)]}>
        <boxGeometry args={[LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH]} />
        <meshStandardMaterial {...legMat} />
      </mesh>

      {/* Lower stretcher rail (front) for rigidity */}
      <mesh position={[0, LEG_HEIGHT * 0.3, BENCH_DEPTH / 2 - LEG_DEPTH / 2]}>
        <boxGeometry args={[BENCH_LENGTH - LEG_WIDTH, 0.04, LEG_DEPTH * 0.5]} />
        <meshStandardMaterial {...legMat} />
      </mesh>

      {/* Small vice screw knob on front-left face (decorative) */}
      <mesh position={[-BENCH_LENGTH / 2 - 0.02, SLAB_CENTRE_Y, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.04, 12]} />
        <meshStandardMaterial {...viseScrew} />
      </mesh>

      {/* ── Accessories ─────────────────────────────────────────────────── */}
      {BENCH_ACCESSORY_IDS.map((id, i) => {
        const entry = ACCESSORY_REGISTRY[id];
        if (entry === undefined) return null;
        const { Component } = entry;
        const [sx, sy, sz] = benchSlotPosition(i);
        return (
          <Component
            key={id}
            position={[sx, sy, sz]}
          />
        );
      })}
    </group>
  );
}
