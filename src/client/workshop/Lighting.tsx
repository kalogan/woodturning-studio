/**
 * Lighting.tsx — Workshop lighting rig
 *
 * Design intent: warm workshop at dusk with the task light on.
 *   - Very low warm ambient: lifts shadow floors without flattening contrast
 *   - Overhead fluorescents: cooler, moderate — give the room shape and depth
 *   - Tungsten task spot (HERO): bright, warm, focused pool over the lathe
 *     at world origin. This is the primary light source the eye reads.
 *
 * Light budget: 1 ambient + 3 fluorescent pointLights + 1 task spotLight = 5
 *   (fluorescents share one shadow map; task spot casts its own)
 * Shadow maps: 1024 on task spot + one fluorescent — perf budget per brief.
 */

// Overhead fixture positions [x, z] — spread across ceiling, away from lathe
const FLUORESCENT_POSITIONS: [number, number][] = [
  [-1.6, -1.5],
  [0, -1.8],
  [1.6, -1.5],
];

const CEILING_Y = 3.0; // must match Room ROOM_H
const FIXTURE_Y = CEILING_Y - 0.05; // just below ceiling

// Task lamp hangs above the lathe station at origin, slightly toward operator
const TASK_LAMP_OFFSET: [number, number, number] = [0, CEILING_Y - 0.15, 0.3];

export function Lighting() {
  return (
    <group name="lighting">
      {/* ── Warm ambient — floor for shadows, not a fill light ── */}
      {/* Intentionally low so the task spot creates real contrast */}
      <ambientLight intensity={0.14} color="#ffe4c4" />

      {/* ── Overhead fluorescent fixtures ── */}
      {/* Cool-white, moderate intensity — room shape fill, NOT stadium lights */}
      {FLUORESCENT_POSITIONS.map(([x, z], i) => (
        <group key={i} position={[x, FIXTURE_Y, z]}>
          {/* Visible tube — emissive cool-white rectangle, bloom-ready */}
          <mesh>
            <boxGeometry args={[0.9, 0.04, 0.12]} />
            <meshStandardMaterial
              color="#c8d4f0"
              emissive="#b8c8ee"
              emissiveIntensity={1.8}
              roughness={0.3}
              metalness={0.1}
            />
          </mesh>
          {/* Point light — moderate, cooler white, gives room depth */}
          <pointLight
            color="#dde6ff"
            intensity={8}
            distance={6}
            decay={2}
            castShadow={i === 1} /* only centre fixture casts shadow */
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
        </group>
      ))}

      {/* ── Tungsten task spot — HERO light over lathe at origin ── */}
      {/*
       * At intensity=120 vs fluorescents at 8 each, the task spot is the
       * dominant source. The warm pool (~1.2m radius at floor) makes the
       * lathe station visually pop against the cooler, dimmer shop floor.
       * angle=0.52 rad (~30°) with penumbra=0.45 → soft focused circle.
       * Target is lathe centre at [0, 0.9, 0] (spindle height).
       */}
      <group position={TASK_LAMP_OFFSET}>
        {/* Shade housing — dark metal exterior */}
        <mesh>
          <cylinderGeometry args={[0.06, 0.22, 0.26, 16, 1, true]} />
          <meshStandardMaterial
            color="#2e2010"
            roughness={0.55}
            metalness={0.4}
            side={2} /* DoubleSide = 2 */
          />
        </mesh>
        {/* Shade inner — warm reflective surface bounces light down */}
        <mesh>
          <cylinderGeometry args={[0.055, 0.21, 0.25, 16, 1, true]} />
          <meshStandardMaterial
            color="#c87820"
            emissive="#b86010"
            emissiveIntensity={0.6}
            roughness={0.4}
            metalness={0.5}
            side={2}
          />
        </mesh>
        {/* Shade rim ring */}
        <mesh position={[0, -0.13, 0]}>
          <torusGeometry args={[0.22, 0.01, 8, 28]} />
          <meshStandardMaterial color="#1e1008" roughness={0.5} metalness={0.6} />
        </mesh>
        {/* Bulb glow — emissive sphere visible from below */}
        <mesh position={[0, -0.06, 0]}>
          <sphereGeometry args={[0.032, 10, 8]} />
          <meshStandardMaterial
            color="#ffce8a"
            emissive="#ffb060"
            emissiveIntensity={4.0}
            roughness={0.0}
            metalness={0.0}
          />
        </mesh>
        {/*
         * SpotLight — warm tungsten #ffb86b, high intensity creates the
         * focused warm pool. Target offset corrects for lamp overhang so
         * the cone centres on the lathe spindle axis at origin floor.
         */}
        <spotLight
          color="#ffb86b"
          intensity={120}
          angle={0.52}
          penumbra={0.45}
          distance={7}
          decay={2}
          position={[0, 0, 0]}
          target-position={[0, -3, -0.3]}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.001}
        />
      </group>
    </group>
  );
}
