/**
 * Room.tsx — Procedural workshop shell (floor, walls, ceiling, baseboard trim)
 *
 * Room scale: 6m (X) × 5m (Z) × 3m (Y)
 * Origin is at floor-centre. Lathe station sits near world origin.
 * The +Z face (player spawn side) is left open — no wall there.
 */

import { concreteFloor, paintedDrywall, paintedDrywallCeiling } from '../lathe/materials.js';

const ROOM_W = 6;   // metres, X axis
const ROOM_D = 5;   // metres, Z axis
const ROOM_H = 3;   // metres, Y axis

const floorMat    = concreteFloor();
const wallMat     = paintedDrywall();
const ceilingMat  = paintedDrywallCeiling();
// Baseboard: slightly darker and warmer than wall — painted wood trim
const baseboardMat = { color: '#b8b0a0', roughness: 0.72, metalness: 0.0 };

export function Room() {
  return (
    <group name="room">
      {/* ── Floor ── */}
      <mesh
        name="floor"
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial {...floorMat} />
      </mesh>

      {/* ── Ceiling ── */}
      <mesh
        name="ceiling"
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, ROOM_H, 0]}
      >
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial {...ceilingMat} />
      </mesh>

      {/* ── Back wall (−Z) ── */}
      <mesh
        name="wall-back"
        receiveShadow
        position={[0, ROOM_H / 2, -ROOM_D / 2]}
      >
        <boxGeometry args={[ROOM_W, ROOM_H, 0.05]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>

      {/* ── Left wall (−X) ── */}
      <mesh
        name="wall-left"
        receiveShadow
        position={[-ROOM_W / 2, ROOM_H / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <boxGeometry args={[ROOM_D, ROOM_H, 0.05]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>

      {/* ── Right wall (+X) ── */}
      <mesh
        name="wall-right"
        receiveShadow
        position={[ROOM_W / 2, ROOM_H / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <boxGeometry args={[ROOM_D, ROOM_H, 0.05]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>

      {/* ── Baseboard trim — back wall ── */}
      <mesh
        name="baseboard-back"
        position={[0, 0.05, -ROOM_D / 2 + 0.03]}
      >
        <boxGeometry args={[ROOM_W, 0.1, 0.02]} />
        <meshStandardMaterial {...baseboardMat} />
      </mesh>

      {/* ── Baseboard trim — left wall ── */}
      <mesh
        name="baseboard-left"
        position={[-ROOM_W / 2 + 0.03, 0.05, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <boxGeometry args={[ROOM_D, 0.1, 0.02]} />
        <meshStandardMaterial {...baseboardMat} />
      </mesh>

      {/* ── Baseboard trim — right wall ── */}
      <mesh
        name="baseboard-right"
        position={[ROOM_W / 2 - 0.03, 0.05, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <boxGeometry args={[ROOM_D, 0.1, 0.02]} />
        <meshStandardMaterial {...baseboardMat} />
      </mesh>
    </group>
  );
}
