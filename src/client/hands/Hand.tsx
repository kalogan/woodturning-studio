/**
 * Hand.tsx — One parametric, anatomically-readable first-person bare hand.
 *
 * Construction overview:
 *  - Forearm stub: a cylinder running along -Z (into the screen from camera),
 *    terminating at the wrist.
 *  - Rolled sleeve cuff: a slightly larger, shorter cylinder band at the
 *    forearm end, slightly warm cloth color — sells "sleeves rolled up".
 *  - Palm: a gently flattened box, the anchor for all five fingers.
 *  - 4 fingers (index → pinky): each is 3 segments (proximal, intermediate,
 *    distal) built from short cylinders. Each segment is slightly narrower
 *    and shorter than the previous. Segments are parented to each other via
 *    groups so pose-driven rotation (curl) happens at each knuckle.
 *  - Thumb: 2 segments, angled out from the palm edge, positioned lower and
 *    to the thumb-side of the palm.
 *
 * Handedness: the geometry is built as a RIGHT hand.
 * Left hand: the parent <group> applies scale.x = -1 to mirror it.
 *
 * Skin material: meshStandardMaterial, roughness 0.70, metalness 0.02.
 * Default color: #C8956C — a believable mid/warm skin tone.
 *
 * Props:
 *   side       — 'left' | 'right'
 *   skinColor  — hex color string (optional; default mid-tone)
 *   pose       — HandPose (optional; default RELAXED)
 *   position   — [x, y, z] override
 *   rotation   — [rx, ry, rz] override
 */

import type { HandPose } from './handPose.js';
import { RELAXED } from './handPose.js';

// ── Skin material ─────────────────────────────────────────────────────────────
// Defined locally — mirrors lathe/materials.ts pattern but not imported from there.

interface SkinMaterialProps {
  color: string;
  roughness: number;
  metalness: number;
}

/**
 * Mid warm skin tone: #C8956C.
 * Roughness 0.70 (skin has pores/texture), very low metalness.
 */
function skinMaterial(color = '#C8956C'): SkinMaterialProps {
  return { color, roughness: 0.70, metalness: 0.02 };
}

/**
 * Rolled sleeve cuff material: a warm olive-brown cloth.
 * Low metalness, high roughness — woven cotton.
 */
function cuffMaterial(): SkinMaterialProps {
  return { color: '#5A4A38', roughness: 0.88, metalness: 0.0 };
}

// ── Geometry constants ────────────────────────────────────────────────────────
// All measurements in metres (Three.js world units).
// Fingers run along +Y (up) in local space; curl rotates around X.

const SEGS = 10; // cylinder radial segments — modest but clean

// Palm
const PALM_W = 0.075; // width (X)
const PALM_H = 0.085; // height (Y) — slightly taller than wide
const PALM_D = 0.025; // depth (Z) — palm thickness

// Forearm + cuff
const FOREARM_R = 0.018; // forearm cylinder radius
const FOREARM_L = 0.12;  // forearm stub length along -Z
const CUFF_R    = 0.022; // cuff band radius (slightly larger than forearm)
const CUFF_L    = 0.018; // cuff band length

// ── Finger segment dimensions — named constants to avoid indexed access ────────
// Finger: 3 segments (proximal / intermediate / distal). Each: [radius, length].
const F_PROX_R  = 0.009; const F_PROX_L  = 0.032;
const F_MID_R   = 0.008; const F_MID_L   = 0.025;
const F_DIST_R  = 0.007; const F_DIST_L  = 0.020;

// Thumb: 2 segments. Each: [radius, length].
const TH_PROX_R = 0.010; const TH_PROX_L = 0.030;
const TH_DIST_R = 0.009; const TH_DIST_L = 0.026;

// Finger lateral X positions on the palm (right hand, 0 = palm centre)
// index, middle, ring, pinky — named to avoid array indexing
const FX_INDEX  =  0.024;
const FX_MIDDLE =  0.008;
const FX_RING   = -0.008;
const FX_PINKY  = -0.023;

// Finger start Y (bottom of proximal knuckle) = just above the palm top face
const FINGER_BASE_Y = PALM_H / 2;

// Slight natural spread of fingers at rest (radians, rotation around Z)
const FSP_INDEX  = -0.06;
const FSP_MIDDLE = -0.02;
const FSP_RING   =  0.02;
const FSP_PINKY  =  0.05;

// Thumb anchor: sits on the radial (right/+X) side of the palm, lower
const THUMB_X = PALM_W / 2 + TH_PROX_L * 0.2;
const THUMB_Y = -PALM_H * 0.1;

// ── Props ─────────────────────────────────────────────────────────────────────

interface HandProps {
  side?: 'left' | 'right';
  skinColor?: string;
  pose?: HandPose;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a curl ratio [0..1] to a rotation angle in radians around X. */
function curlToRad(curl: number): number {
  // Each finger segment shares ~1/3 of the total curl arc.
  // Max full curl per segment ≈ 0.70 rad (~40°). 3 × 0.70 ≈ 2.10 rad total ≈ 120°.
  return curl * 0.70;
}

/** Thumb curl — thumb has 2 segments, slightly different range. */
function thumbCurlToRad(curl: number): number {
  return curl * 0.65;
}

// ── Sub-components (inline render helpers) ────────────────────────────────────

interface FingerProps {
  baseX: number;
  splayZ: number;
  curl: number;
  skin: SkinMaterialProps;
}

function Finger({ baseX, splayZ, curl, skin }: FingerProps) {
  const proxCurl = curlToRad(curl);
  return (
    <group position={[baseX, FINGER_BASE_Y, 0]} rotation={[0, 0, splayZ]}>
      {/* Proximal segment — MCP knuckle at palm top */}
      <group rotation={[proxCurl, 0, 0]}>
        <mesh position={[0, F_PROX_L / 2, 0]}>
          <cylinderGeometry args={[F_PROX_R, F_PROX_R * 1.1, F_PROX_L, SEGS]} />
          <meshStandardMaterial {...skin} />
        </mesh>

        {/* Intermediate segment — PIP joint */}
        <group position={[0, F_PROX_L, 0]} rotation={[proxCurl * 0.9, 0, 0]}>
          <mesh position={[0, F_MID_L / 2, 0]}>
            <cylinderGeometry args={[F_MID_R, F_MID_R * 1.05, F_MID_L, SEGS]} />
            <meshStandardMaterial {...skin} />
          </mesh>

          {/* Distal segment — DIP joint */}
          <group position={[0, F_MID_L, 0]} rotation={[proxCurl * 0.7, 0, 0]}>
            <mesh position={[0, F_DIST_L / 2, 0]}>
              <cylinderGeometry args={[F_DIST_R, F_DIST_R * 1.02, F_DIST_L, SEGS]} />
              <meshStandardMaterial {...skin} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

interface ThumbProps {
  curl: number;
  splay: number;
  skin: SkinMaterialProps;
}

function Thumb({ curl, splay, skin }: ThumbProps) {
  const proxCurl = thumbCurlToRad(curl);
  return (
    <group
      position={[THUMB_X, THUMB_Y, 0]}
      rotation={[0, 0, -(0.45 + splay * 0.25)]}
    >
      <group rotation={[proxCurl, 0, 0]}>
        <mesh position={[0, TH_PROX_L / 2, 0]}>
          <cylinderGeometry args={[TH_PROX_R, TH_PROX_R * 1.1, TH_PROX_L, SEGS]} />
          <meshStandardMaterial {...skin} />
        </mesh>
        {/* Distal thumb segment */}
        <group position={[0, TH_PROX_L, 0]} rotation={[proxCurl, 0, 0]}>
          <mesh position={[0, TH_DIST_L / 2, 0]}>
            <cylinderGeometry args={[TH_DIST_R, TH_DIST_R * 1.05, TH_DIST_L, SEGS]} />
            <meshStandardMaterial {...skin} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * A single procedural bare hand in first-person scale.
 * Build is right-hand; left is mirrored via scale.x = -1.
 */
export function Hand({
  side = 'right',
  skinColor = '#C8956C',
  pose = RELAXED,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: HandProps) {
  const skin = skinMaterial(skinColor);
  const cuff = cuffMaterial();

  // Mirror left hand by flipping X scale on the root group.
  const mirrorScale: [number, number, number] = side === 'left' ? [-1, 1, 1] : [1, 1, 1];

  // Wrist orientation applied to palm+fingers group.
  const wristRotation: [number, number, number] = [
    pose.wristPitch,
    pose.wristYaw,
    pose.wristRoll,
  ];

  return (
    <group position={position} rotation={rotation} scale={mirrorScale}>
      {/* ── Forearm stub — runs along -Z (into the screen from camera POV) ── */}
      {/* Cylinder default axis = Y; rotate 90° around X to align with Z */}
      <mesh
        position={[0, -PALM_H * 0.5, -FOREARM_L / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[FOREARM_R, FOREARM_R * 1.1, FOREARM_L, SEGS]} />
        <meshStandardMaterial {...skin} />
      </mesh>

      {/* ── Rolled sleeve cuff — at the far end of the forearm stub ── */}
      <mesh
        position={[0, -PALM_H * 0.5, -(FOREARM_L + CUFF_L * 0.3)]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[CUFF_R, CUFF_R * 1.05, CUFF_L, SEGS]} />
        <meshStandardMaterial {...cuff} />
      </mesh>

      {/* ── Wrist + palm group — applies wrist pose ── */}
      <group rotation={wristRotation}>
        {/* Palm box */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[PALM_W, PALM_H, PALM_D]} />
          <meshStandardMaterial {...skin} />
        </mesh>

        {/* ── Thumb ── */}
        <Thumb curl={pose.fingerCurls.thumb} splay={pose.thumbSplay} skin={skin} />

        {/* ── Four fingers (index, middle, ring, pinky) ── */}
        <Finger key="index"  baseX={FX_INDEX}  splayZ={FSP_INDEX}  curl={pose.fingerCurls.index}  skin={skin} />
        <Finger key="middle" baseX={FX_MIDDLE} splayZ={FSP_MIDDLE} curl={pose.fingerCurls.middle} skin={skin} />
        <Finger key="ring"   baseX={FX_RING}   splayZ={FSP_RING}   curl={pose.fingerCurls.ring}   skin={skin} />
        <Finger key="pinky"  baseX={FX_PINKY}  splayZ={FSP_PINKY}  curl={pose.fingerCurls.pinky}  skin={skin} />
      </group>
    </group>
  );
}
