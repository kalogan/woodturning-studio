/**
 * DemoStation.tsx — Wall-mounted flat-panel demo monitor.
 *
 * A thin dark bezel box with an emissive screen face (slight blue-white glow)
 * suggesting a live instructor feed. Mounted on the right wall (+X = 3)
 * at roughly eye height, angled to face the lathe station at origin.
 *
 * Props let callers override position/rotation for layout flexibility.
 * No per-frame allocations — purely static.
 */

interface DemoStationProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const BEZEL_W = 0.82;
const BEZEL_H = 0.52;
const BEZEL_D = 0.06;
const SCREEN_INSET = 0.03;

export function DemoStation({
  // X pulled inward from 2.94 → 2.80: the mount arm back-stub (local-Z = −0.13)
  // maps to world X ≈ 2.80 + 0.13 = 2.93, well clear of the right wall inner face
  // at X = 2.975 (wall centre 3.0, half-thickness 0.025).
  position = [2.80, 1.65, -0.6],
  rotation = [0, -Math.PI / 2 + 0.18, 0],
}: DemoStationProps) {
  return (
    <group name="demo-station" position={position} rotation={rotation}>
      {/* Bezel / frame */}
      <mesh castShadow>
        <boxGeometry args={[BEZEL_W, BEZEL_H, BEZEL_D]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.6} metalness={0.25} />
      </mesh>

      {/* Emissive screen face */}
      <mesh position={[0, 0, BEZEL_D / 2 + 0.001]}>
        <boxGeometry
          args={[BEZEL_W - SCREEN_INSET, BEZEL_H - SCREEN_INSET, 0.004]}
        />
        <meshStandardMaterial
          color="#8ab4d8"
          emissive="#6090b8"
          emissiveIntensity={0.6}
          roughness={0.05}
          metalness={0.0}
        />
      </mesh>

      {/* Wall-mount arm — simple bracket stub */}
      <mesh position={[0, -BEZEL_H / 2 - 0.04, -BEZEL_D / 2 - 0.04]}>
        <boxGeometry args={[0.08, 0.08, 0.12]} />
        <meshStandardMaterial color="#333338" roughness={0.7} metalness={0.35} />
      </mesh>

      {/* Horizontal wall-plate */}
      <mesh position={[0, -BEZEL_H / 2 - 0.04, -BEZEL_D / 2 - 0.1]}>
        <boxGeometry args={[0.18, 0.04, 0.02]} />
        <meshStandardMaterial color="#333338" roughness={0.7} metalness={0.35} />
      </mesh>
    </group>
  );
}
