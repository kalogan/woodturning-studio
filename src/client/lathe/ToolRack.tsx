/**
 * ToolRack — wall-mounted rack holding the 3 turning tools.
 *
 * Positioned on the wall to the operator's left (−X side), near the headstock,
 * so it's clearly visible from the AT_LATHE fixed camera at ~[0.15, 1.55, 0.9].
 *
 * Each tool hangs handle-down in the rack. Clicking a tool fires onGrab(toolKind).
 * Hover sets the pointer cursor via document.body.style.cursor.
 *
 * No per-frame allocation: all positions are computed at module load from the
 * director-tunable constants below.
 */

import { useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { ToolKind } from '../../core/types.js';

// ─── Director tuning knobs ────────────────────────────────────────────────────
//
// RACK_POS: World position of the rack board centre.
//   X: operator's left (−X from the lathe headstock at x≈0.15)
//   Y: mid-height on the wall — tools hang at eye level from the camera
//   Z: flush with the back wall surface (≈ −1.2 in the room geometry)
//
// RACK_TOOL_SPACING: horizontal gap between tool centres (metres)
//
// RACK_BOARD_W / H: visual dimensions of the backing board (metres)
//
// RACK_PEG_LENGTH: length of the cylindrical peg each tool hangs on (metres)
//
// ─────────────────────────────────────────────────────────────────────────────

/** World position of the rack board centre. */
const RACK_POS: [number, number, number] = [-0.55, 1.35, -0.9];

/** Horizontal gap between adjacent tool peg centres (metres). */
const RACK_TOOL_SPACING = 0.14;

/** Backing board dimensions (metres). */
const RACK_BOARD_W = 0.52;
const RACK_BOARD_H = 0.22;
const RACK_BOARD_D = 0.018;

/** Peg cylinder dimensions (metres). */
const RACK_PEG_RADIUS = 0.008;
const RACK_PEG_LENGTH = 0.06;

// ─── Tool-slot layout ─────────────────────────────────────────────────────────
// Three tools centred on RACK_POS, equally spaced.
// Computed once at module load — zero heap cost in render.

const TOOL_KINDS: ToolKind[] = ['roughing-gouge', 'spindle-gouge', 'parting-tool'];

/** X offset for each tool peg relative to RACK_POS[0]. */
const SLOT_OFFSET_X: Record<ToolKind, number> = {
  'roughing-gouge': -RACK_TOOL_SPACING,
  'spindle-gouge':  0,
  'parting-tool':   RACK_TOOL_SPACING,
};

// ─── Per-rack-slot colour label ───────────────────────────────────────────────
// Subtle colour band on the backing board behind each slot so the player can
// quickly identify which tool is which at a glance.
const SLOT_COLORS: Record<ToolKind, string> = {
  'roughing-gouge': '#4a7c59',   // muted green — "safe first tool"
  'spindle-gouge':  '#4a6a8a',   // muted blue
  'parting-tool':   '#8a4a4a',   // muted red
};

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  /** Called when the player clicks a tool. The grab logic (right vs wrong tool)
   *  lives in AtLatheScene — ToolRack just reports which tool was clicked. */
  onGrab: (tool: ToolKind) => void;
}

// ── Rack-tool sub-component ───────────────────────────────────────────────────
// Renders a single tool in a neutral resting pose (handle down, peg through
// the ferrule area). Handles hover cursor + click.

interface RackToolProps {
  toolKind: ToolKind;
  posX: number;
  posY: number;
  posZ: number;
  onGrab: (tool: ToolKind) => void;
}

function RackTool({ toolKind, posX, posY, posZ, onGrab }: RackToolProps) {
  const meshRef = useRef<Mesh | null>(null);

  const handlePointerOver = () => {
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    document.body.style.cursor = 'default';
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onGrab(toolKind);
  };

  // Tool geometry in resting pose: handle DOWN (−Y), tip UP (+Y).
  // The handle axis is local +Y; we don't rotate so the tool hangs vertically.
  // Handle: brown wood cylinder
  // Tip: varies by toolKind (matches ToolMesh shapes but simplified for rack)

  return (
    <group
      position={[posX, posY, posZ]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Invisible hit-volume so the whole tool length is clickable */}
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.018, 0.018, 0.32, 8]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>

      {/* Handle — warm brown wood */}
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.20, 10]} />
        <meshStandardMaterial color="#6B3A1F" roughness={0.8} metalness={0.0} />
      </mesh>

      {/* Ferrule — short metal band where peg slots through */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.010, 0.010, 0.018, 10]} />
        <meshStandardMaterial color="#888888" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Metal shank above ferrule */}
      <mesh position={[0, 0.10, 0]}>
        <cylinderGeometry args={[0.005, 0.007, 0.06, 10]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Tip shape — varies by toolKind */}
      {toolKind === 'roughing-gouge' && (
        <mesh position={[0, 0.145, 0]}>
          <sphereGeometry args={[0.011, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#4a4a4a" roughness={0.4} metalness={0.6} />
        </mesh>
      )}

      {toolKind === 'spindle-gouge' && (
        <>
          <mesh position={[0, 0.148, 0]}>
            <cylinderGeometry args={[0.004, 0.005, 0.04, 10]} />
            <meshStandardMaterial color="#4a4a4a" roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.168, 0]}>
            <sphereGeometry args={[0.004, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#5a5a5a" roughness={0.3} metalness={0.7} />
          </mesh>
        </>
      )}

      {toolKind === 'parting-tool' && (
        <mesh position={[0, 0.142, 0]}>
          <boxGeometry args={[0.003, 0.014, 0.016]} />
          <meshStandardMaterial color="#4a4a4a" roughness={0.4} metalness={0.6} />
        </mesh>
      )}
    </group>
  );
}

// ── ToolRack ──────────────────────────────────────────────────────────────────

export function ToolRack({ onGrab }: Props) {
  return (
    <group position={RACK_POS}>
      {/* ── Backing board ─────────────────────────────────────────────────── */}
      <mesh position={[0, 0, -RACK_BOARD_D / 2]}>
        <boxGeometry args={[RACK_BOARD_W, RACK_BOARD_H, RACK_BOARD_D]} />
        <meshStandardMaterial color="#5c3d1e" roughness={0.9} metalness={0.0} />
      </mesh>

      {/* ── Colour-coded slot strips (subtle) ─────────────────────────────── */}
      {TOOL_KINDS.map((kind) => (
        <mesh key={kind} position={[SLOT_OFFSET_X[kind], 0, -0.001]}>
          <boxGeometry args={[RACK_TOOL_SPACING * 0.85, RACK_BOARD_H * 0.9, 0.002]} />
          <meshStandardMaterial color={SLOT_COLORS[kind]} roughness={1} metalness={0} transparent opacity={0.35} />
        </mesh>
      ))}

      {/* ── Horizontal peg bar (rail across the front face of the board) ───── */}
      <mesh position={[0, 0.04, RACK_PEG_RADIUS + 0.001]}>
        <boxGeometry args={[RACK_BOARD_W * 0.95, 0.016, 0.014]} />
        <meshStandardMaterial color="#3a2010" roughness={0.85} metalness={0.0} />
      </mesh>

      {/* ── Per-slot pegs ─────────────────────────────────────────────────── */}
      {TOOL_KINDS.map((kind) => (
        <mesh
          key={`peg-${kind}`}
          position={[SLOT_OFFSET_X[kind], 0.04, RACK_PEG_LENGTH / 2 + 0.009]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[RACK_PEG_RADIUS, RACK_PEG_RADIUS, RACK_PEG_LENGTH, 8]} />
          <meshStandardMaterial color="#888888" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}

      {/* ── Hanging tools ─────────────────────────────────────────────────── */}
      {TOOL_KINDS.map((kind) => (
        <RackTool
          key={kind}
          toolKind={kind}
          posX={SLOT_OFFSET_X[kind]}
          posY={-0.01}
          posZ={RACK_PEG_LENGTH * 0.6}
          onGrab={onGrab}
        />
      ))}

      {/* ── Label strip (thin dark bar at bottom of board) ─────────────────── */}
      <mesh position={[0, -RACK_BOARD_H / 2 + 0.012, 0.001]}>
        <boxGeometry args={[RACK_BOARD_W * 0.95, 0.018, 0.003]} />
        <meshStandardMaterial color="#2a1a08" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

// Re-export the position constant so AtLatheScene can reference it if needed.
export { RACK_POS };
