/**
 * SpeakerDisplay.tsx — Handmade hi-fi speaker display behind the demo area.
 *
 * A real quirk of the space: the director builds loudspeakers as a hobby, so a
 * little gallery of his work sits against the aisle wall behind the demo bench:
 *   • An open warm-plywood shelving unit holding several wooden speaker cabinets
 *     (bookshelf size) of varied wood tones, each with 1–3 round drivers.
 *   • A pair of tall tower/floorstanding speakers standing on the floor beside
 *     the unit.
 *   • A framed poster on the wall above the unit hinting at a speaker photo.
 *   • A subwoofer box on the floor with one big driver.
 *
 * Default placement: against the +Z aisle wall, around X ≈ -2.5, Z ≈ +3.8,
 * facing into the hall (-Z direction). Clear of the pegboard ToolWall
 * (X -8.5..-5.5) and the +X sign-wall doorway (X ≈ +2 / Z ≈ +2.8).
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at player lathe.
 *   Hall extends X ∈ [-16, +2], Z ∈ [-2.5, +4]. +Z wall at Z = +4.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the no-misused-spread
 * lint rule on class instances. The shared driver surround LatheGeometry is
 * also built once at module scope.
 *
 * No animation, no browser APIs, no Math.random / Date.now, no per-frame
 * allocation — purely static Three.js geometry.
 */

import type { ReactNode } from 'react';
import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** World position of the display (front-bottom-centre of the shelving unit). */
export const SPEAKER_DISPLAY_POS: [number, number, number] = [-2.5, 0, 7.05];

/** Rotation (radians). Faces into the hall toward the lathe row (-Z). */
export const SPEAKER_DISPLAY_ROT: [number, number, number] = [0, Math.PI, 0];

// Open shelving unit (warm plywood)
const UNIT_W   = 1.60;   // overall width  (X)
const UNIT_H   = 1.80;   // overall height (Y)
const UNIT_D   = 0.40;   // overall depth  (Z)
const PANEL_T  = 0.030;  // panel / shelf thickness
const SHELF_YS = [0.10, 0.68, 1.24] as const;  // shelf surface heights (bottom of each bay)

// Driver geometry (concentric rings on a speaker's front face)
const SURROUND_DEPTH = 0.012;  // dark rubber surround ring thickness

// Framed wall poster
const POSTER_W = 0.60;
const POSTER_H = 0.45;
const POSTER_Y = 1.90;
const FRAME_T  = 0.025;  // frame border width

// Subwoofer box
const SUB_SIDE = 0.45;

// ─── Module-scope materials ───────────────────────────────────────────────────

// Warm plywood for the open shelving unit.
const _plywoodMat = new THREE.MeshStandardMaterial({ color: '#c7a878', roughness: 0.80, metalness: 0.02 });

// Cabinet wood tones (varied warm species).
const _walnutMat = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.55, metalness: 0.04 });
const _cherryMat = new THREE.MeshStandardMaterial({ color: '#8a4a32', roughness: 0.55, metalness: 0.04 });
const _birchMat  = new THREE.MeshStandardMaterial({ color: '#d8b878', roughness: 0.60, metalness: 0.03 });

const CABINET_MATS = [_walnutMat, _cherryMat, _birchMat] as const;

// Driver parts.
const _surroundMat = new THREE.MeshStandardMaterial({ color: '#1c1c1f', roughness: 0.70, metalness: 0.05 }); // rubber surround ring
const _coneMat     = new THREE.MeshStandardMaterial({ color: '#3a342e', roughness: 0.85, metalness: 0.03 }); // paper/poly cone
const _domeMat     = new THREE.MeshStandardMaterial({ color: '#9a9aa0', roughness: 0.35, metalness: 0.55 }); // metal dust-cap dome

// Poster + subwoofer.
const _frameMat   = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.55, metalness: 0.20 });
const _posterMat  = new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.80, metalness: 0.0 });  // image panel
const _silhouMat  = new THREE.MeshStandardMaterial({ color: '#4a5560', roughness: 0.85, metalness: 0.0 });  // speaker silhouettes
const _subMat     = new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 0.45, metalness: 0.10 }); // dark wood/black sub box

// Shared driver surround profile — a shallow ring built once as LatheGeometry.
// Profile is a thin annulus extruded slightly forward (cup-shaped surround).
function makeSurroundGeometry(outerR: number): THREE.LatheGeometry {
  const innerR = outerR * 0.70;
  const pts = [
    new THREE.Vector2(innerR, 0),
    new THREE.Vector2(innerR, SURROUND_DEPTH),
    new THREE.Vector2(outerR, SURROUND_DEPTH * 0.6),
    new THREE.Vector2(outerR, 0),
  ];
  return new THREE.LatheGeometry(pts, 20);
}
// Unit-radius surround; scaled per-driver via the mesh scale.
const _surroundGeo = makeSurroundGeometry(1);

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Driver — concentric speaker driver mounted flush on a cabinet's front face.
 * Local origin sits ON the cabinet face; the driver protrudes in local +Z.
 *   r = outer driver radius (woofer big, tweeter small).
 */
function Driver({ r }: { r: number }) {
  return (
    <group name="driver">
      {/* Rubber surround ring (lathe-turned annulus), lying in the X/Y plane. */}
      <mesh castShadow rotation={[-Math.PI / 2, 0, 0]} scale={[r, 1, r]}>
        <primitive object={_surroundGeo} attach="geometry" />
        <primitive object={_surroundMat} attach="material" />
      </mesh>
      {/* Cone — shallow recessed disc inside the surround. */}
      <mesh position={[0, 0, SURROUND_DEPTH * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[r * 0.66, r * 0.30, 20]} />
        <primitive object={_coneMat} attach="material" />
      </mesh>
      {/* Centre dust-cap dome. */}
      <mesh position={[0, 0, SURROUND_DEPTH * 0.9]}>
        <sphereGeometry args={[r * 0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <primitive object={_domeMat} attach="material" />
      </mesh>
    </group>
  );
}

/**
 * Speaker — a wooden cabinet box with 1–3 round drivers on its front face.
 * Local origin is the bottom-centre of the cabinet; front face is local +Z.
 *   w/h/d  = cabinet dimensions
 *   tone   = index into CABINET_MATS
 *   drivers = front-face driver radii, top-to-bottom (first = top tweeter,
 *             last = big woofer near the bottom)
 */
interface SpeakerProps {
  w: number;
  h: number;
  d: number;
  tone: number;
  drivers: readonly number[];
}

function Speaker({ w, h, d, tone, drivers }: SpeakerProps) {
  const mat = CABINET_MATS[tone % CABINET_MATS.length] ?? _walnutMat;
  const faceZ = d / 2 + 0.001;  // just proud of the front face

  // Lay drivers out vertically: first near the top, last near the bottom.
  const driverNodes: ReactNode[] = drivers.map((dr, i) => {
    const count = drivers.length;
    // Evenly distribute centres in the inner 70% of the cabinet height.
    const t = count === 1 ? 0.5 : i / (count - 1);
    const y = h * (0.82 - 0.64 * t);
    return (
      <group key={i} position={[0, y, faceZ]}>
        <Driver r={dr} />
      </group>
    );
  });

  return (
    <group name="speaker">
      {/* Cabinet body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {driverNodes}
    </group>
  );
}

/** Open warm-plywood shelving unit (sides, back, top, and a few shelves). */
function ShelvingUnit() {
  const sideX = UNIT_W / 2 - PANEL_T / 2;
  return (
    <group name="shelving-unit">
      {/* Left + right side panels */}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow receiveShadow position={[s * sideX, UNIT_H / 2, 0]}>
          <boxGeometry args={[PANEL_T, UNIT_H, UNIT_D]} />
          <primitive object={_plywoodMat} attach="material" />
        </mesh>
      ))}
      {/* Back panel (thin, set at the rear) */}
      <mesh receiveShadow position={[0, UNIT_H / 2, -UNIT_D / 2 + PANEL_T / 2]}>
        <boxGeometry args={[UNIT_W - PANEL_T * 2, UNIT_H, PANEL_T]} />
        <primitive object={_plywoodMat} attach="material" />
      </mesh>
      {/* Top cap */}
      <mesh castShadow receiveShadow position={[0, UNIT_H - PANEL_T / 2, 0]}>
        <boxGeometry args={[UNIT_W, PANEL_T, UNIT_D]} />
        <primitive object={_plywoodMat} attach="material" />
      </mesh>
      {/* Shelves */}
      {SHELF_YS.map((y, i) => (
        <mesh key={i} castShadow receiveShadow position={[0, y - PANEL_T / 2, 0]}>
          <boxGeometry args={[UNIT_W - PANEL_T * 2, PANEL_T, UNIT_D]} />
          <primitive object={_plywoodMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** Framed poster suggesting a photo of speakers (silhouette rectangles). */
function Poster() {
  const panelZ = 0.012;
  // A few speaker silhouettes on the image panel: [localX, h, w].
  const silhouettes: Array<[number, number, number]> = [
    [-0.16, 0.26, 0.09],
    [0.0, 0.32, 0.11],
    [0.17, 0.22, 0.08],
  ];
  return (
    <group name="poster" position={[0, POSTER_Y, 0]}>
      {/* Frame border (four thin bars) */}
      {/* Top + bottom */}
      {[1, -1].map((s) => (
        <mesh key={`tb${String(s)}`} castShadow position={[0, s * (POSTER_H / 2 - FRAME_T / 2), 0]}>
          <boxGeometry args={[POSTER_W, FRAME_T, 0.02]} />
          <primitive object={_frameMat} attach="material" />
        </mesh>
      ))}
      {/* Left + right */}
      {[-1, 1].map((s) => (
        <mesh key={`lr${String(s)}`} castShadow position={[s * (POSTER_W / 2 - FRAME_T / 2), 0, 0]}>
          <boxGeometry args={[FRAME_T, POSTER_H, 0.02]} />
          <primitive object={_frameMat} attach="material" />
        </mesh>
      ))}
      {/* Image panel */}
      <mesh position={[0, 0, panelZ * 0.4]}>
        <planeGeometry args={[POSTER_W - FRAME_T * 2, POSTER_H - FRAME_T * 2]} />
        <primitive object={_posterMat} attach="material" />
      </mesh>
      {/* Speaker silhouettes hinted on the panel */}
      {silhouettes.map(([x, sh, sw], i) => (
        <mesh key={i} position={[x, -0.03, panelZ * 0.6]}>
          <planeGeometry args={[sw, sh]} />
          <primitive object={_silhouMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** Subwoofer box — large dark cube on the floor with one big driver. */
function Subwoofer() {
  return (
    <group name="subwoofer">
      <mesh castShadow receiveShadow position={[0, SUB_SIDE / 2, 0]}>
        <boxGeometry args={[SUB_SIDE, SUB_SIDE, SUB_SIDE]} />
        <primitive object={_subMat} attach="material" />
      </mesh>
      {/* Big front driver */}
      <group position={[0, SUB_SIDE / 2, SUB_SIDE / 2 + 0.001]}>
        <Driver r={0.16} />
      </group>
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface SpeakerDisplayProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * SpeakerDisplay — handmade hi-fi speaker gallery against the aisle wall:
 * an open plywood shelving unit of bookshelf cabinets, two floorstanding
 * towers, a framed poster, and a subwoofer on the floor.
 *
 * Default position: SPEAKER_DISPLAY_POS = [-2.5, 0, 3.8]
 * Default rotation: SPEAKER_DISPLAY_ROT = [0, π, 0] (faces into the hall)
 * Both constants are exported for easy director tuning.
 */
export function SpeakerDisplay({
  position = SPEAKER_DISPLAY_POS,
  rotation = SPEAKER_DISPLAY_ROT,
}: SpeakerDisplayProps = {}) {
  return (
    <group name="speaker-display" position={position} rotation={rotation}>
      <ShelvingUnit />

      {/* Bookshelf speakers on the shelves — varied tone + size + driver count.
          Drivers listed top→bottom (tweeter first, woofer last). */}
      {/* Bottom shelf */}
      <group position={[-0.42, SHELF_YS[0], 0.02]}>
        <Speaker w={0.30} h={0.46} d={0.28} tone={0} drivers={[0.028, 0.10]} />
      </group>
      <group position={[0.40, SHELF_YS[0], 0.02]}>
        <Speaker w={0.34} h={0.50} d={0.30} tone={1} drivers={[0.030, 0.055, 0.115]} />
      </group>

      {/* Middle shelf */}
      <group position={[-0.45, SHELF_YS[1], 0.02]}>
        <Speaker w={0.26} h={0.40} d={0.24} tone={2} drivers={[0.026, 0.085]} />
      </group>
      <group position={[0.02, SHELF_YS[1], 0.02]}>
        <Speaker w={0.22} h={0.34} d={0.22} tone={0} drivers={[0.024, 0.075]} />
      </group>
      <group position={[0.44, SHELF_YS[1], 0.02]}>
        <Speaker w={0.24} h={0.38} d={0.22} tone={1} drivers={[0.080]} />
      </group>

      {/* Top shelf */}
      <group position={[-0.38, SHELF_YS[2], 0.02]}>
        <Speaker w={0.28} h={0.42} d={0.26} tone={1} drivers={[0.027, 0.090]} />
      </group>
      <group position={[0.36, SHELF_YS[2], 0.02]}>
        <Speaker w={0.20} h={0.30} d={0.20} tone={2} drivers={[0.070]} />
      </group>

      {/* Floorstanding towers, standing on the floor flanking the unit. */}
      <group position={[-UNIT_W / 2 - 0.30, 0, 0.0]}>
        <Speaker w={0.26} h={1.05} d={0.32} tone={0} drivers={[0.026, 0.090, 0.090]} />
      </group>
      <group position={[UNIT_W / 2 + 0.32, 0, 0.0]}>
        <Speaker w={0.28} h={1.15} d={0.34} tone={1} drivers={[0.028, 0.095, 0.095]} />
      </group>

      {/* Framed poster on the wall above the unit. */}
      <Poster />

      {/* Subwoofer box on the floor, off to one side. */}
      <group position={[UNIT_W / 2 + 0.30, 0, -0.55]}>
        <Subwoofer />
      </group>
    </group>
  );
}
