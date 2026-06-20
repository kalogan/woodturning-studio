/**
 * PropLathe.tsx — lightweight, non-interactive prop lathe for hall dressing.
 *
 * Renders a clearly-recognisable wood-lathe silhouette (stand / bed / headstock /
 * tailstock / handwheel) without any interactivity, physics, or useFrame hooks.
 * Geometry is a simplified approximation of the Jet JWL-1642EVS proportions so the
 * prop reads as "same model" without the full part complexity.
 *
 * Proportions (metres) derived from content/lathe/jet-jwl-1642.json:
 *   Bed length:       ~1.45 m along X
 *   Bed top height:   ~0.895 m (stand 0.82 + bed slab 0.07 + way 0.04/2)
 *   Stand depth (Z):  ~0.42 m (footWidth from spec)
 *   Stand height:     ~0.82 m
 *
 * Props:
 *   position  — world [x, y, z] of the lathe group origin (floor level)
 *   rotation  — [rx, ry, rz] Euler; defaults to [0,0,0]
 *   color     — machine body colour (headstock / tailstock / stand)
 *
 * Materials are cached per unique colour string at MODULE SCOPE — no per-frame
 * allocation, no per-instance duplication.
 *
 * No imports from src/core/ (keeps dependency-cruiser green).
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────
// All measurements in metres.  Match real Jet JWL-1642EVS proportions.

const BED_LENGTH     = 1.45;    // bed along X
const BED_THICKNESS  = 0.07;    // bed slab vertical thickness
const BED_DEPTH      = 0.195;   // bed slab depth in Z (approx 2 ways + gap)
const WAY_HEIGHT     = 0.04;    // bed way height above slab top
const WAY_DEPTH      = 0.03;    // each way depth in Z
const STAND_H        = 0.80;    // leg height
const STAND_PLATE_T  = 0.02;    // top mounting plate thickness
const STAND_DEPTH    = 0.42;    // leg foot depth in Z
const STAND_LEG_T    = 0.07;    // leg slab thickness in X
const MACHINE_Y      = STAND_H + STAND_PLATE_T;  // bed bottom above floor

// Bed slab Y-centre (bed bottom at MACHINE_Y)
const BED_SLAB_CY    = MACHINE_Y + BED_THICKNESS / 2;
// Top of bed way surface
const BED_TOP_Y      = MACHINE_Y + BED_THICKNESS + WAY_HEIGHT;

// ── Headstock (left end of bed, -X side) ─────────────────────────────────────
const HS_W           = 0.30;    // body depth along X
const HS_H           = 0.26;    // body height above bed top
const HS_D           = 0.24;    // body depth in Z
const HS_LEFT_X      = -BED_LENGTH / 2;
const HS_CX          = HS_LEFT_X + HS_W / 2;
const HS_CY          = BED_TOP_Y + HS_H / 2;

// Motor housing on the back (-Z) of headstock
const MH_W           = 0.14;
const MH_H           = 0.14;
const MH_D           = 0.22;

// ── Tailstock (right end of bed, +X side) ────────────────────────────────────
const TS_W           = 0.18;    // body depth along X
const TS_H           = 0.24;    // body height above bed top
const TS_D           = 0.22;    // body depth in Z
const TS_CX          = BED_LENGTH / 2 - TS_W / 2;
const TS_CY          = BED_TOP_Y + TS_H / 2;

// Tailstock handwheel
const HW_R           = 0.06;    // radius
const HW_T           = 0.018;   // thickness
const HW_CX          = TS_CX + TS_W / 2 + HW_T / 2;
const HW_CY          = TS_CY;

// Tailstock quill cylinder (protrudes towards headstock)
const QUILL_D        = 0.038;
const QUILL_LEN      = 0.06;
const QUILL_CX       = TS_CX - TS_W / 2 - QUILL_LEN / 2;
const QUILL_CY       = BED_TOP_Y + TS_H * 0.55; // spindle height ~ 55 % of TS height above bed

// ── Legs along X (two legs at ±BED_LENGTH/2 * ~0.95) ────────────────────────
const LEG_X          = BED_LENGTH / 2 - STAND_LEG_T * 0.5;

// ─── Material cache ──────────────────────────────────────────────────────────
// Keyed by hex colour string.  THREE.MeshStandardMaterial instances live here
// for the machine body (painted cast iron feel).
const _bodyMatCache = new Map<string, THREE.MeshStandardMaterial>();

function bodyMat(color: string): THREE.MeshStandardMaterial {
  let m = _bodyMatCache.get(color);
  if (m === undefined) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.08 });
    _bodyMatCache.set(color, m);
  }
  return m;
}

// Shared materials (colour-independent)
const bedMat = new THREE.MeshStandardMaterial({
  color: '#cfcabb',   // dark cast iron — matches bed.color in spec
  roughness: 0.58,
  metalness: 0.18,
});

const steelMat = new THREE.MeshStandardMaterial({
  color: '#6a6a6a',   // brushed bare steel
  roughness: 0.32,
  metalness: 0.88,
});

const hwSpokeMat = new THREE.MeshStandardMaterial({
  color: '#5a5a5a',
  roughness: 0.45,
  metalness: 0.60,
});

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Two cast-iron legs that form the stand. */
function PropStand({ color }: { color: string }) {
  const mat = bodyMat(color);

  // Accent stripe (red) — same height band as the real Jet stand
  const stripeY = 0.12 + 0.018 / 2;
  const stripeArgs: [number, number, number] = [STAND_LEG_T + 0.002, 0.018, STAND_DEPTH];

  return (
    <group name="prop-stand">
      {/* Left leg */}
      <group position={[-LEG_X, STAND_H / 2, 0]}>
        <mesh>
          <boxGeometry args={[STAND_LEG_T, STAND_H, STAND_DEPTH]} />
          <primitive object={mat} attach="material" />
        </mesh>
        {/* Red accent stripe */}
        <mesh position={[0, stripeY - STAND_H / 2, 0]}>
          <boxGeometry args={stripeArgs} />
          <meshStandardMaterial color="#c0392b" roughness={0.4} metalness={0.1} />
        </mesh>
      </group>

      {/* Right leg */}
      <group position={[LEG_X, STAND_H / 2, 0]}>
        <mesh>
          <boxGeometry args={[STAND_LEG_T, STAND_H, STAND_DEPTH]} />
          <primitive object={mat} attach="material" />
        </mesh>
        {/* Red accent stripe */}
        <mesh position={[0, stripeY - STAND_H / 2, 0]}>
          <boxGeometry args={stripeArgs} />
          <meshStandardMaterial color="#c0392b" roughness={0.4} metalness={0.1} />
        </mesh>
      </group>

      {/* Top mounting plate spanning both legs */}
      <mesh position={[0, MACHINE_Y - STAND_PLATE_T / 2, 0]}>
        <boxGeometry args={[BED_LENGTH, STAND_PLATE_T, STAND_DEPTH * 0.55]} />
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  );
}

/** Bed slab + two way rails. */
function PropBed() {
  return (
    <group name="prop-bed">
      {/* Base slab */}
      <mesh position={[0, BED_SLAB_CY, 0]}>
        <boxGeometry args={[BED_LENGTH, BED_THICKNESS, BED_DEPTH]} />
        <primitive object={bedMat} attach="material" />
      </mesh>
      {/* Front way rail */}
      <mesh position={[0, BED_TOP_Y - WAY_HEIGHT / 2, WAY_DEPTH]}>
        <boxGeometry args={[BED_LENGTH, WAY_HEIGHT, WAY_DEPTH]} />
        <primitive object={bedMat} attach="material" />
      </mesh>
      {/* Back way rail */}
      <mesh position={[0, BED_TOP_Y - WAY_HEIGHT / 2, -WAY_DEPTH]}>
        <boxGeometry args={[BED_LENGTH, WAY_HEIGHT, WAY_DEPTH]} />
        <primitive object={bedMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Headstock body + motor housing. */
function PropHeadstock({ color }: { color: string }) {
  const mat = bodyMat(color);
  return (
    <group name="prop-headstock">
      {/* Main body */}
      <mesh position={[HS_CX, HS_CY, 0]}>
        <boxGeometry args={[HS_W, HS_H, HS_D]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* Motor housing on back (-Z face) of body */}
      <mesh position={[HS_CX, BED_TOP_Y + MH_H / 2, -HS_D / 2 - MH_D / 2]}>
        <boxGeometry args={[MH_W, MH_H, MH_D]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* Spindle nose stub */}
      <mesh
        position={[HS_LEFT_X + HS_W + 0.03, BED_TOP_Y + HS_H * 0.55, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.025, 0.025, 0.06, 12]} />
        <primitive object={steelMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Tailstock body + quill stub + handwheel. */
function PropTailstock({ color }: { color: string }) {
  const mat = bodyMat(color);
  return (
    <group name="prop-tailstock">
      {/* Body */}
      <mesh position={[TS_CX, TS_CY, 0]}>
        <boxGeometry args={[TS_W, TS_H, TS_D]} />
        <primitive object={mat} attach="material" />
      </mesh>

      {/* Quill cylinder (toward headstock) */}
      <mesh
        position={[QUILL_CX, QUILL_CY, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[QUILL_D / 2, QUILL_D / 2, QUILL_LEN, 10]} />
        <primitive object={steelMat} attach="material" />
      </mesh>

      {/* Handwheel disc */}
      <mesh
        position={[HW_CX, HW_CY, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[HW_R, HW_R, HW_T, 20]} />
        <primitive object={mat} attach="material" />
      </mesh>

      {/* Handwheel hub */}
      <mesh
        position={[HW_CX, HW_CY, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.015, 0.015, HW_T + 0.006, 8]} />
        <primitive object={hwSpokeMat} attach="material" />
      </mesh>

      {/* Handwheel spokes (3×) */}
      {([0, Math.PI / 3, (2 * Math.PI) / 3] as const).map((angle, i) => (
        <mesh
          key={i}
          position={[HW_CX, HW_CY + Math.sin(angle) * HW_R * 0.5, Math.cos(angle) * HW_R * 0.5]}
          rotation={[angle, Math.PI / 2, 0]}
        >
          <boxGeometry args={[0.006, HW_R * 0.85, 0.006]} />
          <primitive object={hwSpokeMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ─── PropLathe (exported) ────────────────────────────────────────────────────

interface PropLatheProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Machine body colour — headstock, tailstock, stand */
  color?: string;
}

export function PropLathe({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color = '#e8e6dc',
}: PropLatheProps) {
  return (
    <group name="prop-lathe" position={position} rotation={rotation}>
      <PropStand color={color} />
      <PropBed />
      <PropHeadstock color={color} />
      <PropTailstock color={color} />
    </group>
  );
}
