/**
 * ToolWall.tsx — Wall-mounted pegboard with a hung set of woodturning hand tools.
 *
 * The universal signature of a real turning shop: a tan perforated hardboard
 * panel with a thin wood frame, a sparse grid of suggested peg holes, and a row
 * of hung turning tools — each a turned wooden HANDLE + a bright steel
 * tang/blade — plus a pair of calipers on a peg. Core kit, visibly varied:
 *   • Spindle roughing gouge (wide flute, big handle)
 *   • Bowl gouge (long, stout)
 *   • Spindle gouge (slimmer)
 *   • Skew chisel (flat angled blade)
 *   • Parting tool (narrow, deep)
 *   • Round-nose scraper (flat wide blade)
 *   • A pair of calipers (two thin curved steel legs)
 *
 * Default placement: HIGH on the +Z aisle wall, ABOVE the floor toolboxes
 * (chest X=-8, hand box X=-6.6) and clear of the wall clock at X=-10. Panel is
 * centred at X≈-7.0, spanning X ∈ [-8.6, -5.5], Y from ~1.5 to ~2.45, flush on
 * the +Z wall (Z≈3.96), facing -Z into the hall.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling 3.6 m, floor Y=0.
 *   +Z wall (≈ +4) = aisle / side wall (this panel mounts here, facing -Z).
 *
 * The group is placed flush on the +Z wall, rotated π so local +Z → world -Z;
 * tools/holes extend toward the hall along local +Z. Handle LatheGeometry
 * profiles + every reused geometry are built ONCE at module scope and shared.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the no-misused-spread
 * lint rule on class instances. All geometry is static — no per-frame
 * allocation, no animation, no Math.random, no Date.now, no browser APIs.
 */

import type { ReactNode } from 'react';
import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** World position of the pegboard group (wall-plane centre of the panel). */
export const TOOL_WALL_POS: [number, number, number] = [-7.0, 1.975, 3.96];

/** Rotation (radians). Faces -Z into the hall (local +Z → world -Z). */
export const TOOL_WALL_ROT: [number, number, number] = [0, Math.PI, 0];

// Pegboard panel
const PANEL_W  = 3.0;    // along-wall width (X)  → spans X ∈ [-8.5, -5.5] about centre
const PANEL_H  = 0.95;   // height (Y)            → Y ∈ [1.50, 2.45]
const PANEL_T  = 0.02;   // panel thickness (out from wall, local +Z)
const FRAME_T  = 0.04;   // frame strip face width
const FRAME_D  = 0.03;   // frame depth (proud of the panel)

// Peg-hole grid — modest literal grid via nested integer loops.
const HOLE_COLS = 16;    // holes across
const HOLE_ROWS = 5;     // holes down
const HOLE_R    = 0.006; // hole dot radius
const HOLE_MARGIN = 0.14;// inset from panel edge to first/last hole

// Tool hanging row
const TOOL_TOP_Y = PANEL_H / 2 - 0.10;  // peg-hook height (near top of panel)
const TOOL_Z     = PANEL_T / 2;          // tools hang just proud of the panel face

// ─── Module-scope materials ───────────────────────────────────────────────────

// Pegboard hardboard + frame
const _boardMat = new THREE.MeshStandardMaterial({ color: '#c9a878', roughness: 0.85, metalness: 0.03 });
const _frameMat = new THREE.MeshStandardMaterial({ color: '#6e5235', roughness: 0.70, metalness: 0.04 });
const _holeMat  = new THREE.MeshStandardMaterial({ color: '#3a2c1c', roughness: 0.90, metalness: 0.02 });

// Bright steel for tangs / blades / calipers / peg-hooks.
const _steelMat = new THREE.MeshStandardMaterial({ color: '#b8bcc2', roughness: 0.30, metalness: 0.80 });

// Turned-handle wood tones (walnut / ash / beech), indexed per tool.
const _walnutMat = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.45, metalness: 0.04 });
const _ashMat    = new THREE.MeshStandardMaterial({ color: '#cbb487', roughness: 0.50, metalness: 0.04 });
const _beechMat  = new THREE.MeshStandardMaterial({ color: '#c89a5e', roughness: 0.48, metalness: 0.04 });

const _handleMats = [_walnutMat, _ashMat, _beechMat] as const;

// ─── Turned-handle profile (LatheGeometry) ────────────────────────────────────
// A classic turning-tool handle: ferrule end → swollen belly → tapered butt.
// Profile is normalised to unit length (y ∈ [0,1]); each tool scales it to its
// own handle length. Built ONCE — never per frame.

const V = (r: number, y: number) => new THREE.Vector2(r, y);

const _handleProfile = [
  V(0.000, 0.000),
  V(0.016, 0.000),  // ferrule end (where the tang enters)
  V(0.019, 0.030),
  V(0.022, 0.120),  // swell
  V(0.024, 0.300),  // belly (widest grip)
  V(0.022, 0.560),
  V(0.018, 0.800),
  V(0.013, 0.940),  // tapered butt
  V(0.009, 0.990),
  V(0.000, 1.000),  // rounded end cap
];

const _handleGeo = new THREE.LatheGeometry(_handleProfile, 16);

// Reused steel ferrule ring geometry (band where blade meets handle).
const _ferruleGeo = new THREE.CylinderGeometry(0.020, 0.020, 0.018, 12);

// ─── Tool kit specification ───────────────────────────────────────────────────
// Each tool hangs blade-DOWN from a peg-hook. Positions are literal (vary by
// index), evenly spaced along the panel. `handleLen` 0.18–0.30 m varies the set.
//
// blade shapes:
//   'gouge'   — round-section steel rod with a flute hint (slim cylinder)
//   'skew'    — flat angled blade (thin box, rolled slightly)
//   'parting' — narrow deep blade (tall thin box)
//   'scraper' — flat wide blade (wide thin box)

interface ToolSpec {
  x: number;            // along-wall position (local X)
  handleLen: number;    // handle length (m)
  handleScaleR: number; // radial scale on the handle (fatter = roughing gouge)
  matIdx: number;       // index into _handleMats
  blade: 'gouge' | 'skew' | 'parting' | 'scraper';
  bladeLen: number;     // exposed steel length (m)
  bladeR?: number;      // rod radius for gouges
  bladeW?: number;      // blade width for flat tools
  bladeThick?: number;  // blade thickness for flat tools
  roll?: number;        // local Z rotation (radians) for a slight angle / skew
  label: string;
}

// Evenly spaced across the 3.0 m panel, biased to leave the calipers room at +X.
const TOOLS: ToolSpec[] = [
  // Spindle roughing gouge — wide flute, BIG handle (fat + long).
  { x: -1.18, handleLen: 0.30, handleScaleR: 1.35, matIdx: 0, blade: 'gouge',
    bladeLen: 0.34, bladeR: 0.013, roll: 0.04, label: 'spindle-roughing-gouge' },
  // Bowl gouge — long, stout.
  { x: -0.78, handleLen: 0.28, handleScaleR: 1.20, matIdx: 1, blade: 'gouge',
    bladeLen: 0.38, bladeR: 0.011, roll: -0.03, label: 'bowl-gouge' },
  // Spindle gouge — slimmer.
  { x: -0.40, handleLen: 0.24, handleScaleR: 0.95, matIdx: 2, blade: 'gouge',
    bladeLen: 0.30, bladeR: 0.008, roll: 0.05, label: 'spindle-gouge' },
  // Skew chisel — flat angled blade.
  { x: -0.04, handleLen: 0.22, handleScaleR: 1.00, matIdx: 0, blade: 'skew',
    bladeLen: 0.28, bladeW: 0.026, bladeThick: 0.006, roll: 0.18, label: 'skew-chisel' },
  // Parting tool — narrow, deep.
  { x: 0.30, handleLen: 0.20, handleScaleR: 0.85, matIdx: 1, blade: 'parting',
    bladeLen: 0.26, bladeW: 0.010, bladeThick: 0.018, roll: -0.04, label: 'parting-tool' },
  // Round-nose scraper — flat wide blade.
  { x: 0.68, handleLen: 0.26, handleScaleR: 1.10, matIdx: 2, blade: 'scraper',
    bladeLen: 0.30, bladeW: 0.034, bladeThick: 0.006, roll: 0.03, label: 'round-nose-scraper' },
];

// Calipers hang on their own peg near the +X end of the board.
const CALIPER_X = 1.14;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Tan hardboard panel + wood frame + a sparse grid of suggested peg holes. */
function Panel() {
  const holes: ReactNode[] = [];
  const innerW = PANEL_W - HOLE_MARGIN * 2;
  const innerH = PANEL_H - HOLE_MARGIN * 2;

  for (let cx = 0; cx < HOLE_COLS; cx++) {
    for (let cy = 0; cy < HOLE_ROWS; cy++) {
      const hx = -innerW / 2 + (innerW * cx) / (HOLE_COLS - 1);
      const hy = -innerH / 2 + (innerH * cy) / (HOLE_ROWS - 1);
      holes.push(
        <mesh key={`${String(cx)}-${String(cy)}`} position={[hx, hy, PANEL_T / 2 + 0.001]}>
          <cylinderGeometry args={[HOLE_R, HOLE_R, 0.002, 8]} />
          <primitive object={_holeMat} attach="material" />
        </mesh>,
      );
    }
  }

  return (
    <group name="pegboard-panel">
      {/* Hardboard panel body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[PANEL_W, PANEL_H, PANEL_T]} />
        <primitive object={_boardMat} attach="material" />
      </mesh>

      {/* Wood frame — top / bottom / left / right strips proud of the face */}
      <mesh castShadow position={[0, PANEL_H / 2, FRAME_D / 2]}>
        <boxGeometry args={[PANEL_W + FRAME_T * 2, FRAME_T, PANEL_T + FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
      <mesh castShadow position={[0, -PANEL_H / 2, FRAME_D / 2]}>
        <boxGeometry args={[PANEL_W + FRAME_T * 2, FRAME_T, PANEL_T + FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
      <mesh castShadow position={[-PANEL_W / 2, 0, FRAME_D / 2]}>
        <boxGeometry args={[FRAME_T, PANEL_H, PANEL_T + FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
      <mesh castShadow position={[PANEL_W / 2, 0, FRAME_D / 2]}>
        <boxGeometry args={[FRAME_T, PANEL_H, PANEL_T + FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>

      {/* Suggested peg holes (modest grid) */}
      {holes}
    </group>
  );
}

/** A small steel L-shaped peg-hook the tool hangs from. */
function PegHook({ x, y }: { x: number; y: number }) {
  return (
    <group name="peg-hook" position={[x, y, TOOL_Z]}>
      {/* Stub into the board */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.03, 8]} />
        <primitive object={_steelMat} attach="material" />
      </mesh>
      {/* Up-turned lip the tool rests against */}
      <mesh position={[0, 0.012, 0.018]}>
        <cylinderGeometry args={[0.004, 0.004, 0.024, 8]} />
        <primitive object={_steelMat} attach="material" />
      </mesh>
    </group>
  );
}

/** One hung turning tool: peg-hook + steel blade (down) + ferrule + handle (up). */
function Tool({ spec }: { spec: ToolSpec }) {
  const mat = _handleMats[spec.matIdx % _handleMats.length] ?? _walnutMat;
  const roll = spec.roll ?? 0;

  // Tool hangs blade-DOWN: the steel blade points to -Y from the hook, the
  // handle rises above it. The hook sits at TOOL_TOP_Y; the blade tip hangs
  // below, the handle stacks on top of the blade.
  const hookY = TOOL_TOP_Y;
  const bladeTopY = hookY - 0.01;             // steel starts just under the hook
  const bladeCenterY = bladeTopY - spec.bladeLen / 2;
  const ferruleY = bladeTopY + 0.004;         // ring band at blade/handle joint
  const handleBaseY = ferruleY + 0.009;       // handle rises above the ferrule

  return (
    <group name={`tool-${spec.label}`} position={[spec.x, 0, TOOL_Z]} rotation={[0, 0, roll]}>
      <PegHook x={0} y={hookY} />

      {/* Steel blade / tang (hangs down) */}
      {spec.blade === 'gouge' ? (
        <mesh castShadow position={[0, bladeCenterY, 0]}>
          <cylinderGeometry args={[spec.bladeR ?? 0.01, spec.bladeR ?? 0.01, spec.bladeLen, 12]} />
          <primitive object={_steelMat} attach="material" />
        </mesh>
      ) : (
        <mesh castShadow position={[0, bladeCenterY, 0]}>
          <boxGeometry args={[spec.bladeW ?? 0.02, spec.bladeLen, spec.bladeThick ?? 0.006]} />
          <primitive object={_steelMat} attach="material" />
        </mesh>
      )}

      {/* Steel ferrule ring where the blade enters the handle */}
      <mesh castShadow position={[0, ferruleY, 0]} geometry={_ferruleGeo}>
        <primitive object={_steelMat} attach="material" />
      </mesh>

      {/* Turned wooden handle (rises above the ferrule). LatheGeometry is unit
          length along +Y; scale Y to handleLen and X/Z radially per tool. */}
      <mesh
        castShadow
        receiveShadow
        position={[0, handleBaseY, 0]}
        scale={[spec.handleScaleR, spec.handleLen, spec.handleScaleR]}
        geometry={_handleGeo}
      >
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  );
}

/** A pair of outside calipers: two thin curved steel legs joined at a pivot. */
function Calipers({ x }: { x: number }) {
  const legLen = 0.24;
  const legs = [-1, 1] as const;

  return (
    <group name="calipers" position={[x, TOOL_TOP_Y - 0.02, TOOL_Z]}>
      <PegHook x={0} y={0.02} />

      {/* Pivot boss the two legs swing on */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.012, 12]} />
        <primitive object={_steelMat} attach="material" />
      </mesh>

      {/* Two legs splayed apart and bowed inward at the tips (curved feel via
          two angled segments per leg). */}
      {legs.map((s, i) => (
        <group key={i} rotation={[0, 0, s * 0.22]}>
          {/* Upper straight segment */}
          <mesh castShadow position={[0, -legLen * 0.30, 0]}>
            <boxGeometry args={[0.006, legLen * 0.6, 0.004]} />
            <primitive object={_steelMat} attach="material" />
          </mesh>
          {/* Lower segment curving back inward (toe) */}
          <mesh
            castShadow
            position={[-s * 0.018, -legLen * 0.72, 0]}
            rotation={[0, 0, s * 0.55]}
          >
            <boxGeometry args={[0.006, legLen * 0.4, 0.004]} />
            <primitive object={_steelMat} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface ToolWallProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * ToolWall — wall-mounted pegboard with a hung set of woodturning hand tools.
 *
 * A tan hardboard panel (~3.0 m × 0.95 m) with a wood frame and a sparse grid of
 * suggested peg holes, carrying a row of hung turning tools (roughing gouge, bowl
 * gouge, spindle gouge, skew, parting tool, scraper) and a pair of calipers, each
 * a turned wooden handle + bright steel blade hung blade-down on a peg-hook.
 *
 * Default position: TOOL_WALL_POS = [-7.0, 1.975, 3.96]  (+Z aisle wall, high)
 * Default rotation: TOOL_WALL_ROT = [0, π, 0]            (faces -Z into hall)
 * Both constants are exported for easy director tuning.
 *
 * Footprint: spans X ∈ [-8.5, -5.5], Y ∈ [1.50, 2.45], flush on the +Z wall —
 * clear of the clock (X=-10) and above the floor toolboxes (X=-8, -6.6).
 */
export function ToolWall({
  position = TOOL_WALL_POS,
  rotation = TOOL_WALL_ROT,
}: ToolWallProps = {}) {
  return (
    <group name="tool-wall" position={position} rotation={rotation}>
      <Panel />
      {TOOLS.map((spec) => (
        <Tool key={spec.label} spec={spec} />
      ))}
      <Calipers x={CALIPER_X} />
    </group>
  );
}
