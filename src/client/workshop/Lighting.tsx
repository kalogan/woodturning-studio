/**
 * Lighting.tsx — Workshop lighting rig
 *
 * Design intent: bright fluorescent shop like a real woodturning classroom.
 *   - Moderate warm ambient: lifts the whole hall without flattening contrast
 *   - Two parallel rows of overhead shop fluorescents down the hall length —
 *     one over the lathe row (near back wall) and one over the aisle centre.
 *     Each fixture = emissive panel + pointLight underneath.
 *   - Tungsten task spot (HERO): bright, warm, focused pool over the player lathe.
 *
 * Hall extents (from Hall.tsx constants):
 *   X ∈ [-16, +2]   — long axis (18 m); player lathe at origin end
 *   Z ∈ [-2.5, +4]  — short axis (6.5 m wide)
 *   Ceiling: 3.6 m
 *
 * Light budget:
 *   1 ambient
 *   + 6 fixtures × row A (lathe row)  = 6 pointLights
 *   + 6 fixtures × row B (aisle)      = 6 pointLights
 *   + 1 task spotLight
 *   = 14 lights total (well within WebGL 16-light default limit for forward pass)
 *
 * No per-frame heap allocation — all positions are static module-scope constants.
 */

// ─── Hall dimensions (must match Hall.tsx) ─────────────────────────────────
// Copied as constants here so Lighting.tsx stays self-contained and doesn't
// import from Hall.tsx (avoids a circular dep risk through the client/ tree).
const HALL_X_MIN = -16.0;
const HALL_X_MAX =   2.0;
const HALL_H     =  3.6;   // ceiling height
const HALL_Z_MIN = -2.5;   // back wall (lathe row)
const HALL_Z_MAX =  7.25;  // front wall (aisle/windows) — widened +3.25 m

// ─── Fixture layout ─────────────────────────────────────────────────────────
// FIXTURE_COUNT: number of fixtures per row down the long X axis.
const FIXTURE_COUNT = 6;

// X positions: evenly spaced from near the entrance end to the lathe at origin.
// We leave ~1 m margin at each end so fixtures don't clip into end walls.
const FIXTURE_X_START = HALL_X_MIN + 1.0;   // ~ -15
const FIXTURE_X_END   = HALL_X_MAX - 1.5;   // ~  0.5

// Build the X array once at module scope — no per-render allocation.
const FIXTURE_XS: number[] = [];
for (let i = 0; i < FIXTURE_COUNT; i++) {
  FIXTURE_XS.push(
    FIXTURE_X_START + (i / (FIXTURE_COUNT - 1)) * (FIXTURE_X_END - FIXTURE_X_START),
  );
}

// Row A — over the lathe row, just in from the back (-Z) wall.
const ROW_A_Z = HALL_Z_MIN + 1.0;   // ≈ -1.5  (above the lathe operators)

// Row B — over the aisle, roughly 1/3 from the front (+Z) wall.
const ROW_B_Z = HALL_Z_MIN + (HALL_Z_MAX - HALL_Z_MIN) * 0.62; // ≈ +1.5

// Fixture Y — mount panels tight to the ceiling, lights just below
const FIXTURE_PANEL_Y = HALL_H - 0.06;   // emissive panel flush to ceiling
const FIXTURE_LIGHT_Y = HALL_H - 0.15;   // point light just below panel

// ─── Fixture visual parameters ───────────────────────────────────────────────
// Tube housing: long thin box, bright cool-white emissive
const TUBE_W  = 1.4;   // length along X (tube runs down the hall axis)
const TUBE_D  = 0.14;  // depth along Z
const TUBE_H  = 0.05;  // thin panel height

const TUBE_COLOR    = '#d8e4f8';   // slightly blue-white
const TUBE_EMISSIVE = '#c4d8ff';
const TUBE_EMISSIVE_INTENSITY = 2.2;

// ─── Light parameters ────────────────────────────────────────────────────────
// Each fixture has a pointLight directly below the panel.
// distance=12 means it reaches across ~3.3 m of hall width and ~6 m down the
// hall from each fixture; adjacent fixtures overlap nicely so the floor is even.
const FLUORO_COLOR     = '#dde8ff';   // cool-white fluorescent tint
const FLUORO_INTENSITY = 14;          // bright enough to light the floor clearly
const FLUORO_DISTANCE  = 12;          // metres, covers half-gap between fixtures
const FLUORO_DECAY     = 2;

// ─── Ambient ─────────────────────────────────────────────────────────────────
// Lifted from 0.14 → 0.40 for bright-shop feel. Slightly warm so brick walls
// still read warm even without direct light; the fluorescents cool it back.
const AMBIENT_INTENSITY = 0.40;
const AMBIENT_COLOR     = '#fff5e8';  // very slightly warm white

// ─── Task lamp ───────────────────────────────────────────────────────────────
// Spot centred above the player lathe at world origin. Keeps the work surface
// as a visually distinct warm pool even in the brighter room.
const TASK_LAMP_POS: [number, number, number] = [0, HALL_H - 0.15, 0.3];

// ─── Entry vestibule corridor ──────────────────────────────────────────────
// A short entry corridor off the -X end of the main hall:
//   X ∈ [-19.5, -16], Z ∈ [0.0, 2.5], ceiling ≈ 3.6.
// It used to borrow the main hall's lights and read DIM, so it gets its own
// dedicated fluorescent fixture + a single modest cool-white pointLight.
const VEST_PANEL_POS: [number, number, number] = [-17.7, 3.54, 1.25];
const VEST_LIGHT_Y = 3.45;             // point light just below the panel
// Brighter emissive panel so the corridor reads lit even with a modest light.
const VEST_EMISSIVE_INTENSITY = 2.6;
const VEST_LIGHT_INTENSITY = 12;       // cool white, modest — keeps within budget
const VEST_LIGHT_DISTANCE  = 9;        // covers the short corridor
const VEST_LIGHT_DECAY     = 2;

export function Lighting() {
  return (
    <group name="lighting">

      {/* ── Warm ambient — raised to bright-shop level ── */}
      <ambientLight intensity={AMBIENT_INTENSITY} color={AMBIENT_COLOR} />

      {/* ── Row A: overhead fluorescents over the lathe row ── */}
      <group name="fluoro-row-a">
        {FIXTURE_XS.map((x, i) => (
          <group key={`a${String(i)}`} position={[x, FIXTURE_PANEL_Y, ROW_A_Z]}>
            {/* Visible fluorescent tube housing */}
            <mesh>
              <boxGeometry args={[TUBE_W, TUBE_H, TUBE_D]} />
              <meshStandardMaterial
                color={TUBE_COLOR}
                emissive={TUBE_EMISSIVE}
                emissiveIntensity={TUBE_EMISSIVE_INTENSITY}
                roughness={0.25}
                metalness={0.05}
              />
            </mesh>
            {/* Light source — every fixture gets a light; total 6+6=12 point lights */}
            <pointLight
              position={[0, FIXTURE_LIGHT_Y - FIXTURE_PANEL_Y, 0]}
              color={FLUORO_COLOR}
              intensity={FLUORO_INTENSITY}
              distance={FLUORO_DISTANCE}
              decay={FLUORO_DECAY}
            />
          </group>
        ))}
      </group>

      {/* ── Row B: overhead fluorescents over the aisle ── */}
      <group name="fluoro-row-b">
        {FIXTURE_XS.map((x, i) => (
          <group key={`b${String(i)}`} position={[x, FIXTURE_PANEL_Y, ROW_B_Z]}>
            {/* Visible fluorescent tube housing */}
            <mesh>
              <boxGeometry args={[TUBE_W, TUBE_H, TUBE_D]} />
              <meshStandardMaterial
                color={TUBE_COLOR}
                emissive={TUBE_EMISSIVE}
                emissiveIntensity={TUBE_EMISSIVE_INTENSITY}
                roughness={0.25}
                metalness={0.05}
              />
            </mesh>
            {/* Light source */}
            <pointLight
              position={[0, FIXTURE_LIGHT_Y - FIXTURE_PANEL_Y, 0]}
              color={FLUORO_COLOR}
              intensity={FLUORO_INTENSITY}
              distance={FLUORO_DISTANCE}
              decay={FLUORO_DECAY}
            />
          </group>
        ))}
      </group>

      {/* ── Tungsten task spot — HERO light over lathe at origin ── */}
      {/*
       * At intensity=120 vs fluorescents at 14 each, the task spot is still
       * dominant close-up — its warm pool makes the lathe station pop even
       * in the now-brighter ambient room.
       * angle=0.52 rad (~30°) with penumbra=0.45 → soft focused circle.
       * Target offset centres cone on lathe spindle at origin.
       */}
      <group position={TASK_LAMP_POS}>
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
         * SpotLight — warm tungsten, stays as HERO light for the work surface.
         * Toned slightly from 120→90 since ambient is now brighter, but the
         * warm pool contrast is preserved.
         */}
        <spotLight
          color="#ffb86b"
          intensity={90}
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

      {/* ── Entry vestibule corridor fixture ── */}
      {/*
       * One dedicated fluorescent over the entry corridor off the -X end of the
       * hall. Brighter emissive panel + a single modest cool-white pointLight so
       * the hallway no longer reads dim while staying within the light budget.
       */}
      <group name="fluoro-vestibule" position={VEST_PANEL_POS}>
        {/* Visible fluorescent tube housing — reuses the hall fixture style */}
        <mesh>
          <boxGeometry args={[TUBE_W, TUBE_H, TUBE_D]} />
          <meshStandardMaterial
            color={TUBE_COLOR}
            emissive={TUBE_EMISSIVE}
            emissiveIntensity={VEST_EMISSIVE_INTENSITY}
            roughness={0.25}
            metalness={0.05}
          />
        </mesh>
        {/* Light source — single modest cool-white point light */}
        <pointLight
          position={[0, VEST_LIGHT_Y - VEST_PANEL_POS[1], 0]}
          color={FLUORO_COLOR}
          intensity={VEST_LIGHT_INTENSITY}
          distance={VEST_LIGHT_DISTANCE}
          decay={VEST_LIGHT_DECAY}
        />
      </group>

    </group>
  );
}
