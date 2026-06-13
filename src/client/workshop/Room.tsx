/**
 * Room.tsx — Procedural workshop shell (floor, walls, ceiling, baseboard trim)
 *
 * Room scale: 6m (X) × 5m (Z) × 3m (Y)
 * Origin is at floor-centre. Lathe station sits near world origin.
 * The +Z face (player spawn side) is left open — no wall there.
 */

const ROOM_W = 6;   // metres, X axis
const ROOM_D = 5;   // metres, Z axis
const ROOM_H = 3;   // metres, Y axis

const FLOOR_COLOR = '#6b6b68';
const WALL_COLOR = '#d8d2c4';
const CEILING_COLOR = '#e8e4dc';
const BASEBOARD_COLOR = '#b8b0a0';

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
        <meshStandardMaterial
          color={FLOOR_COLOR}
          roughness={0.92}
          metalness={0.0}
        />
      </mesh>

      {/* ── Ceiling ── */}
      <mesh
        name="ceiling"
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, ROOM_H, 0]}
      >
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial
          color={CEILING_COLOR}
          roughness={0.85}
          metalness={0.0}
        />
      </mesh>

      {/* ── Back wall (−Z) ── */}
      <mesh
        name="wall-back"
        receiveShadow
        position={[0, ROOM_H / 2, -ROOM_D / 2]}
      >
        <boxGeometry args={[ROOM_W, ROOM_H, 0.05]} />
        <meshStandardMaterial
          color={WALL_COLOR}
          roughness={0.82}
          metalness={0.0}
        />
      </mesh>

      {/* ── Left wall (−X) ── */}
      <mesh
        name="wall-left"
        receiveShadow
        position={[-ROOM_W / 2, ROOM_H / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <boxGeometry args={[ROOM_D, ROOM_H, 0.05]} />
        <meshStandardMaterial
          color={WALL_COLOR}
          roughness={0.82}
          metalness={0.0}
        />
      </mesh>

      {/* ── Right wall (+X) ── */}
      <mesh
        name="wall-right"
        receiveShadow
        position={[ROOM_W / 2, ROOM_H / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <boxGeometry args={[ROOM_D, ROOM_H, 0.05]} />
        <meshStandardMaterial
          color={WALL_COLOR}
          roughness={0.82}
          metalness={0.0}
        />
      </mesh>

      {/* ── Baseboard trim — back wall ── */}
      <mesh
        name="baseboard-back"
        position={[0, 0.05, -ROOM_D / 2 + 0.03]}
      >
        <boxGeometry args={[ROOM_W, 0.1, 0.02]} />
        <meshStandardMaterial
          color={BASEBOARD_COLOR}
          roughness={0.7}
          metalness={0.0}
        />
      </mesh>

      {/* ── Baseboard trim — left wall ── */}
      <mesh
        name="baseboard-left"
        position={[-ROOM_W / 2 + 0.03, 0.05, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <boxGeometry args={[ROOM_D, 0.1, 0.02]} />
        <meshStandardMaterial
          color={BASEBOARD_COLOR}
          roughness={0.7}
          metalness={0.0}
        />
      </mesh>

      {/* ── Baseboard trim — right wall ── */}
      <mesh
        name="baseboard-right"
        position={[ROOM_W / 2 - 0.03, 0.05, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <boxGeometry args={[ROOM_D, 0.1, 0.02]} />
        <meshStandardMaterial
          color={BASEBOARD_COLOR}
          roughness={0.7}
          metalness={0.0}
        />
      </mesh>
    </group>
  );
}
